/**
 * Document Ingestion Script for RAG (Unified Pipeline)
 *
 * Reads all .txt, .md, and .pdf files from the /docs folder,
 * ingests them into a BUILDING Knowledge Base using the canonical
 * ingestDocumentToKnowledgeBase service, runs smoke tests, and atomically activates the KB.
 *
 * Usage:
 *   npx tsx scripts/ingest-docs.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { getSystemConfig } from "../src/lib/settings.server";
import { ingestDocumentToKnowledgeBase } from "../src/lib/rag/ingestion.server";
import { getEmbeddings } from "../src/lib/rag/embeddings.server";

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

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function main() {
    const config = await getSystemConfig();

    console.log("====================================================");
    console.log("⚡ SHRIMPIE UNIFIED KNOWLEDGE BASE INGESTION TOOL");
    console.log(`Embedding Model: ${config.embeddingModel}`);
    console.log(`Base URL: ${config.embeddingProviderUrl}`);
    console.log("====================================================\n");

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

    // ─── 1. Determine next KB version & create BUILDING KB ────
    const { data: latestKb } = await supabaseAdmin
        .from("knowledge_bases")
        .select("version")
        .order("version", { ascending: false })
        .limit(1);

    const nextVersion = (latestKb && latestKb.length > 0 ? latestKb[0].version : 0) + 1;
    console.log(`🚀 Creating Knowledge Base v${nextVersion} (Status: BUILDING)...`);

    const { data: newKb, error: kbErr } = await supabaseAdmin
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
                created_by: "CLI Ingestion",
            },
        })
        .select()
        .single();

    if (kbErr || !newKb) {
        console.error(`❌ Gagal membuat Knowledge Base v${nextVersion}:`, kbErr?.message);
        process.exit(1);
    }

    const kbId = newKb.id;

    try {
        let totalChunksInserted = 0;

        for (const file of files) {
            const filePath = path.join(DOCS_DIR, file);
            console.log(`📖 Processing document: ${file}`);
            const buffer = fs.readFileSync(filePath);

            const result = await ingestDocumentToKnowledgeBase({
                supabaseAdmin,
                knowledgeBaseId: kbId,
                filename: file,
                fileBuffer: buffer,
            });

            if (result.alreadyExists) {
                console.log(`   ⏭️  Dokumen sudah pernah di-ingest sebelumnya.\n`);
            } else {
                console.log(`   ✅ Success! Ingested ${result.chunkCount} chunk(s) with exact page provenance.\n`);
                totalChunksInserted += result.chunkCount;
            }
        }

        // ─── 2. Smoke Retrieval Test ─────────────────────────────
        console.log("🧪 Running smoke retrieval test on KB v" + nextVersion + "...");
        const embeddings = await getEmbeddings({
            model: config.embeddingModel,
            providerUrl: config.embeddingProviderUrl,
            dimensions: 768,
        });

        const testQueryEmbedding = await embeddings.embedQuery("penyakit udang vaname");
        const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
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
        await supabaseAdmin
            .from("knowledge_bases")
            .update({ status: "READY" })
            .eq("id", kbId);

        // ─── 3. Atomic Activation ────────────────────────────────
        console.log(`🔄 Atomically activating Knowledge Base v${nextVersion}...`);
        const { data: actResult, error: actError } = await supabaseAdmin.rpc(
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
        await supabaseAdmin
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
