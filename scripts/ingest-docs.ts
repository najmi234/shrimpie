/**
 * Document Ingestion Script for RAG (LangChain version)
 *
 * Reads all .txt, .md, and .pdf files from the /docs folder,
 * splits them into chunks, generates embeddings via OpenRouter, and stores in Supabase.
 *
 * Usage:
 *   npx tsx scripts/ingest-docs.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Document } from "@langchain/core/documents";
import { PDFParse } from "pdf-parse";
import { getSystemConfig } from "../src/lib/settings.server";

// ─── Config ───────────────────────────────────────────────
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
const DOCS_DIR = path.join(process.cwd(), "docs");

// ─── Validate environment ─────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error(
        "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
}

// ─── Init clients ─────────────────────────────────────────
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helpers ──────────────────────────────────────────────

function splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        chunks.push(text.slice(start, end));
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}

async function readFileContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".txt" || ext === ".md") {
        return fs.readFileSync(filePath, "utf-8");
    }

    if (ext === ".pdf") {
        try {
            const buffer = fs.readFileSync(filePath);
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            return result.text;
        } catch (err) {
            console.error(`⚠️  Failed to parse PDF: ${path.basename(filePath)}`);
            console.error(`   Error:`, err);
            return "";
        }
    }

    console.warn(
        `⚠️  Unsupported file type: ${ext}, skipping ${path.basename(filePath)}`
    );
    return "";
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
    const config = await getSystemConfig();

    console.log("====================================================");
    console.log("⚡ SHRIMPIE DOCUMENT INGESTION TOOL");
    console.log(`Embedding Model: ${config.embeddingModel}`);
    console.log(`Base URL: ${config.embeddingProviderUrl}`);
    console.log("====================================================\n");

    const embeddings = new OpenAIEmbeddings({
        model: config.embeddingModel,
        dimensions: 768,
        configuration: {
            baseURL: config.embeddingProviderUrl,
        },
        apiKey: config.embeddingApiKey || undefined,
    });

    const vectorStore = new SupabaseVectorStore(embeddings, {
        client: supabase,
        tableName: "documents",
        queryName: "match_documents",
    });

    console.log("📂 Reading documents from:", DOCS_DIR);

    if (!fs.existsSync(DOCS_DIR)) {
        console.error(
            `❌ Folder 'docs/' tidak ditemukan. Buat folder dan taruh dokumen di dalamnya.`
        );
        process.exit(1);
    }

    const files = fs.readdirSync(DOCS_DIR).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return [".txt", ".md", ".pdf"].includes(ext);
    });

    if (files.length === 0) {
        console.error("❌ Tidak ada file .txt/.md/.pdf di folder docs/");
        process.exit(1);
    }

    console.log(`📄 Found ${files.length} file(s): ${files.join(", ")}\n`);

    // ─── Clean old data before re-ingesting ───────────────
    console.log("🗑️  Clearing existing documents from database...");
    const { error: truncError } = await supabase
        .from("documents")
        .delete()
        .neq("id", 0); // Delete all rows
    if (truncError) {
        console.warn(`⚠️  Could not clear old documents: ${truncError.message}`);
    } else {
        console.log("   ✅ Old documents cleared.\n");
    }

    let totalChunks = 0;

    for (const file of files) {
        const filePath = path.join(DOCS_DIR, file);
        console.log(`📖 Processing: ${file}`);

        const content = await readFileContent(filePath);
        if (!content.trim()) {
            console.log(`   ⏭️  Empty or unreadable, skipping.\n`);
            continue;
        }

        const chunks = splitIntoChunks(content);
        console.log(`   ✂️  Split into ${chunks.length} chunk(s)`);

        // Build LangChain Document array for this file
        const documents: Document[] = chunks.map((chunk, i) => ({
            pageContent: chunk,
            metadata: {
                source: file,
                chunk_index: i,
                total_chunks: chunks.length,
            },
        }));

        // Insert all chunks at once using LangChain vector store
        process.stdout.write(
            `   🔄 Embedding & inserting ${documents.length} chunk(s)...`
        );

        try {
            // Process in batches to avoid rate limits
            const BATCH_SIZE = 5;
            for (let i = 0; i < documents.length; i += BATCH_SIZE) {
                const batch = documents.slice(i, i + BATCH_SIZE);
                await vectorStore.addDocuments(batch);
                totalChunks += batch.length;

                if (i + BATCH_SIZE < documents.length) {
                    // Rate limiting: small delay between batches
                    await new Promise((r) => setTimeout(r, 500));
                }
            }
            console.log(` ✅`);
        } catch (err: any) {
            console.error(` ❌ Error: ${err.message}`);
        }

        console.log();
    }

    console.log(`\n🎉 Done! Inserted ${totalChunks} chunk(s) into Supabase.`);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
