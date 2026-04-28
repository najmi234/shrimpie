/**
 * Document Ingestion Script for RAG
 *
 * Reads all .txt and .pdf files from the /docs folder,
 * splits them into chunks, generates embeddings, and stores in Supabase.
 *
 * Usage:
 *   npx tsx scripts/ingest-docs.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";

// ─── Config ───────────────────────────────────────────────
const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks
const DOCS_DIR = path.join(process.cwd(), "docs");

// ─── Init clients ─────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

async function generateEmbedding(text: string): Promise<number[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
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

    console.warn(`⚠️  Unsupported file type: ${ext}, skipping ${path.basename(filePath)}`);
    return "";
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
    console.log("📂 Reading documents from:", DOCS_DIR);

    if (!fs.existsSync(DOCS_DIR)) {
        console.error(`❌ Folder 'docs/' tidak ditemukan. Buat folder dan taruh dokumen di dalamnya.`);
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

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            process.stdout.write(`   🔄 Embedding chunk ${i + 1}/${chunks.length}...`);

            const embedding = await generateEmbedding(chunk);

            const { error } = await supabase.from("documents").insert({
                content: chunk,
                embedding,
                metadata: {
                    source: file,
                    chunk_index: i,
                    total_chunks: chunks.length,
                },
            });

            if (error) {
                console.error(` ❌ Error: ${error.message}`);
            } else {
                console.log(` ✅`);
                totalChunks++;
            }

            // Rate limiting: small delay between API calls
            await new Promise((r) => setTimeout(r, 200));
        }
        console.log();
    }

    console.log(`\n🎉 Done! Inserted ${totalChunks} chunk(s) into Supabase.`);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
