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
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
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

function computeChecksum(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
}

async function splitIntoChunksStructureAware(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        separators: ["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
    });
    const docs = await splitter.createDocuments([text]);
    return docs.map((d) => d.pageContent);
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
    console.log("⚡ SHRIMPIE VERSIONED KNOWLEDGE BASE INGESTION TOOL");
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

    // ─── 1. Determine next KB version ───────────────────────
    let nextVersion = 1;
    let newKb: any = null;
    let kbCreateError: any = null;

    try {
        const { data: latestKb } = await supabase
            .from("knowledge_bases")
            .select("version")
            .order("version", { ascending: false })
            .limit(1);

        nextVersion = (latestKb && latestKb.length > 0 ? latestKb[0].version : 0) + 1;
        console.log(`🚀 Creating Knowledge Base v${nextVersion} (Status: BUILDING)...`);

        const { data: createdKb, error: err } = await supabase
            .from("knowledge_bases")
            .insert({
                version: nextVersion,
                status: "BUILDING",
                embedding_provider: config.embeddingProviderUrl || "default",
                embedding_model: config.embeddingModel,
                embedding_dimension: 768,
                metadata: {
                    total_files: files.length,
                    initiated_at: new Date().toISOString(),
                },
            })
            .select()
            .single();

        newKb = createdKb;
        kbCreateError = err;
    } catch (e: any) {
        kbCreateError = e;
    }

    // Fallback to legacy 'documents' table if versioning table 'knowledge_bases' is not applied yet
    if (kbCreateError) {
        console.warn(`\n⚠️  Tabel 'knowledge_bases' belum ada di Supabase Database (PGRST205).`);
        console.warn(`ℹ️  Menjalankan fallback ingestion ke tabel 'documents' (Legacy Mode)...`);
        console.warn(`💡 Petunjuk: Jalankan file SQL 'supabase/migrations/20260824_knowledge_base_versioning.sql' di Supabase SQL Editor untuk mengaktifkan KB Versioning.\n`);

        const vectorStore = new SupabaseVectorStore(embeddings, {
            client: supabase,
            tableName: "documents",
            queryName: "match_documents",
        });

        let totalDocsInserted = 0;
        for (const file of files) {
            const filePath = path.join(DOCS_DIR, file);
            console.log(`📖 Processing document: ${file}`);
            const content = await readFileContent(filePath);
            if (!content.trim()) continue;

            const chunkTexts = await splitIntoChunksStructureAware(content);
            const docsToInsert = chunkTexts.map(
                (text, idx) =>
                    new Document({
                        pageContent: text,
                        metadata: {
                            source: file,
                            chunk: idx,
                            total_chunks: chunkTexts.length,
                        },
                    })
            );

            process.stdout.write(`   🔄 Embedding & inserting ${docsToInsert.length} chunk(s)...`);
            const BATCH_SIZE = 30;
            for (let i = 0; i < docsToInsert.length; i += BATCH_SIZE) {
                const batch = docsToInsert.slice(i, i + BATCH_SIZE);
                let attempts = 0;
                let inserted = false;
                while (!inserted && attempts < 5) {
                    try {
                        await vectorStore.addDocuments(batch);
                        inserted = true;
                    } catch (err: any) {
                        attempts++;
                        if (attempts >= 5) throw err;
                        const waitSec = attempts * 10;
                        console.log(`\n   ⚠️ Rate limit / error encountered. Retrying batch in ${waitSec}s...`);
                        await new Promise((r) => setTimeout(r, waitSec * 1000));
                    }
                }
                if (i + BATCH_SIZE < docsToInsert.length) {
                    await new Promise((r) => setTimeout(r, 1200));
                }
            }
            totalDocsInserted += docsToInsert.length;
            console.log(` ✅`);
        }

        console.log(`\n🎉 SUCCESS! Fallback ingestion complete. Total ${totalDocsInserted} document chunk(s) inserted into 'documents' table.`);
        process.exit(0);
    }

    const kbId = newKb.id;

    try {
        let totalChunksInserted = 0;

        for (const file of files) {
            const filePath = path.join(DOCS_DIR, file);
            console.log(`📖 Processing document: ${file}`);

            const content = await readFileContent(filePath);
            if (!content.trim()) {
                console.log(`   ⏭️  Empty or unreadable content, skipping.\n`);
                continue;
            }

            const currentChecksum = computeChecksum(content);

            // Record source document
            const { data: sourceDoc, error: docError } = await supabase
                .from("source_documents")
                .insert({
                    knowledge_base_id: kbId,
                    filename: file,
                    checksum: currentChecksum,
                    metadata: {
                        size_bytes: fs.statSync(filePath).size,
                    },
                })
                .select()
                .single();

            if (docError || !sourceDoc) {
                throw new Error(`Failed to record source document ${file}: ${docError?.message}`);
            }

            const chunkTexts = await splitIntoChunksStructureAware(content);
            console.log(`   ✂️  Split into ${chunkTexts.length} structure-aware chunk(s)`);

            process.stdout.write(`   🔄 Embedding & inserting ${chunkTexts.length} chunk(s)...`);

            // Compute embeddings for all chunks in batches
            const BATCH_SIZE = 25;
            for (let i = 0; i < chunkTexts.length; i += BATCH_SIZE) {
                const batchTexts = chunkTexts.slice(i, i + BATCH_SIZE);
                let batchEmbeddings: number[][] = [];
                let attempts = 0;
                let success = false;
                while (!success && attempts < 5) {
                    try {
                        batchEmbeddings = await embeddings.embedDocuments(batchTexts);
                        success = true;
                    } catch (err: any) {
                        attempts++;
                        if (attempts >= 5) throw err;
                        const waitSec = attempts * 10;
                        console.log(`\n   ⚠️ Rate limit (429) encountered. Waiting ${waitSec}s before retry...`);
                        await new Promise((r) => setTimeout(r, waitSec * 1000));
                    }
                }

                const chunkRows = batchTexts.map((text, idx) => ({
                    knowledge_base_id: kbId,
                    document_id: sourceDoc.id,
                    content: text,
                    metadata: {
                        source: file,
                        checksum: currentChecksum,
                        chunk_index: i + idx,
                        total_chunks: chunkTexts.length,
                        kb_version: nextVersion,
                    },
                    embedding: batchEmbeddings[idx],
                }));

                const { error: insertError } = await supabase
                    .from("document_chunks")
                    .insert(chunkRows);

                if (insertError) {
                    throw new Error(`Failed to insert document chunks: ${insertError.message}`);
                }

                totalChunksInserted += batchTexts.length;

                if (i + BATCH_SIZE < chunkTexts.length) {
                    await new Promise((r) => setTimeout(r, 1200));
                }
            }
            console.log(` ✅`);
            console.log();
        }

        // ─── 2. Smoke Retrieval Test ─────────────────────────────
        console.log("🧪 Running smoke retrieval test on KB v" + nextVersion + "...");
        const testQueryEmbedding = await embeddings.embedQuery("penyakit udang vaname");
        const { data: searchResults, error: searchError } = await supabase.rpc(
            "match_knowledge_base_documents",
            {
                query_embedding: testQueryEmbedding,
                active_kb_id: kbId,
                match_count: 2,
            }
        );

        if (searchError || !searchResults || searchResults.length === 0) {
            throw new Error(`Smoke retrieval test failed: ${searchError?.message || "No results returned"}`);
        }

        console.log(`   ✅ Smoke test passed! Top match similarity: ${searchResults[0].similarity.toFixed(4)}\n`);

        // Mark KB as READY prior to activation
        await supabase
            .from("knowledge_bases")
            .update({ status: "READY" })
            .eq("id", kbId);

        // ─── 3. Atomic Activation ────────────────────────────────
        console.log(`🔄 Atomically activating Knowledge Base v${nextVersion}...`);
        const { data: actResult, error: actError } = await supabase.rpc(
            "activate_knowledge_base",
            { target_kb_id: kbId }
        );

        if (actError || !actResult) {
            throw new Error(`Atomic activation failed: ${actError?.message}`);
        }

        console.log(`\n🎉 SUCCESS! Knowledge Base v${nextVersion} is now ACTIVE with ${totalChunksInserted} chunk(s).`);
    } catch (err: any) {
        console.error(`\n❌ INGESTION FAILED: ${err.message}`);
        console.log(`   Marking Knowledge Base v${nextVersion} as FAILED...`);
        await supabase
            .from("knowledge_bases")
            .update({ status: "FAILED", metadata: { error: err.message } })
            .eq("id", kbId);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

