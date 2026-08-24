import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmbeddings } from "@/lib/rag/embeddings.server";
import { getSystemConfig } from "@/lib/settings.server";
import {
    computeChecksum,
    extractPdfPages,
    createContentAwareChunks,
    ParsedPage,
} from "@/lib/rag/ingestion.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

async function verifyAdminUser(): Promise<boolean> {
    try {
        const supabase = await createServerClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) return false;

        const { data: profile } = await supabase
            .from("profiles")
            .select("user_role")
            .eq("id", user.id)
            .single();

        return profile?.user_role === "admin";
    } catch {
        return false;
    }
}

export async function POST(req: Request) {
    const isAdmin = await verifyAdminUser();
    if (!isAdmin) {
        return NextResponse.json(
            { error: "Unauthorized. Fitur ini hanya untuk Administrator." },
            { status: 403 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "File dokumen tidak ditemukan." },
                { status: 400 }
            );
        }

        const filename = file.name;
        const ext = filename.split(".").pop()?.toLowerCase();

        if (!["pdf", "txt", "md"].includes(ext || "")) {
            return NextResponse.json(
                { error: "Format file tidak didukung. Harap upload file .pdf, .txt, atau .md." },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let pages: ParsedPage[] = [];

        if (ext === "pdf") {
            try {
                pages = await extractPdfPages(buffer);
            } catch (err) {
                console.error("PDF Parsing Error:", err);
                return NextResponse.json(
                    { error: `Gagal membaca isi file PDF "${filename}".` },
                    { status: 400 }
                );
            }
        } else {
            const rawText = buffer.toString("utf-8");
            if (rawText.trim()) {
                pages = [{ pageNum: 1, text: rawText }];
            }
        }

        if (pages.length === 0) {
            return NextResponse.json(
                { error: `File "${filename}" kosong atau tidak memiliki teks yang bisa diekstrak.` },
                { status: 400 }
            );
        }

        const fullText = pages.map((p) => p.text).join("\n\n");

        // 1. Compute SHA-256 Checksum
        const checksum = computeChecksum(fullText);

        // 2. Get / Create Active Knowledge Base
        const supabaseAdmin = getSupabaseAdmin();
        const config = await getSystemConfig();

        let { data: activeKb } = await supabaseAdmin
            .from("knowledge_bases")
            .select("id, version, metadata")
            .eq("status", "ACTIVE")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!activeKb) {
            const { data: newKb, error: kbErr } = await supabaseAdmin
                .from("knowledge_bases")
                .insert({
                    version: 1,
                    status: "ACTIVE",
                    embedding_provider: config.embeddingProviderUrl || "default",
                    embedding_model: config.embeddingModel,
                    embedding_dimension: 768,
                    activated_at: new Date().toISOString(),
                })
                .select("id, version, metadata")
                .single();

            if (kbErr || !newKb) {
                throw new Error(`Gagal membuat Knowledge Base versi 1: ${kbErr?.message}`);
            }
            activeKb = newKb;
        }

        // 3. Idempotency Check: Check if duplicate checksum exists
        const { data: existingDoc } = await supabaseAdmin
            .from("source_documents")
            .select("id, filename")
            .eq("knowledge_base_id", activeKb.id)
            .eq("checksum", checksum)
            .maybeSingle();

        if (existingDoc) {
            return NextResponse.json({
                success: true,
                alreadyExists: true,
                filename: filename,
                version: activeKb.version,
                message: `Dokumen "${filename}" sudah pernah di-ingest sebelumnya (SHA-256 Checksum identik).`,
                status: "Ready",
            });
        }

        // 4. Create Content-Aware Chunks
        const chunks = await createContentAwareChunks(filename, pages);

        if (chunks.length === 0) {
            return NextResponse.json(
                { error: "Gagal membuat chunk dokumen. Tidak ada konten valid." },
                { status: 400 }
            );
        }

        // 5. Create Source Document Record
        const { data: sourceDoc, error: docErr } = await supabaseAdmin
            .from("source_documents")
            .insert({
                knowledge_base_id: activeKb.id,
                filename: filename,
                checksum: checksum,
                metadata: {
                    source: filename,
                    chunk_count: chunks.length,
                    page_count: pages.length,
                },
            })
            .select("id")
            .single();

        if (docErr || !sourceDoc) {
            throw new Error(`Gagal membuat data source document: ${docErr?.message}`);
        }

        // 6. Generate Contextual Embeddings in Batches of 20
        const embeddingsModel = await getEmbeddings();
        const BATCH_SIZE = 20;
        const embeddingTexts = chunks.map((c) => c.embeddingText);
        const vectorEmbeddings: number[][] = [];

        for (let i = 0; i < embeddingTexts.length; i += BATCH_SIZE) {
            const batchTexts = embeddingTexts.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await embeddingsModel.embedDocuments(batchTexts);
            vectorEmbeddings.push(...batchEmbeddings);
        }

        // 7. Validate Embeddings Count
        if (vectorEmbeddings.length !== chunks.length) {
            throw new Error(
                `Ingestion Validation Failed: Generated vectors count (${vectorEmbeddings.length}) does not match chunks count (${chunks.length}).`
            );
        }

        // 8. Insert Document Chunks with Rich Metadata
        const chunksToInsert = chunks.map((chunk, idx) => ({
            knowledge_base_id: activeKb.id,
            document_id: sourceDoc.id,
            content: chunk.content,
            metadata: {
                ...chunk.metadata,
                source: filename,
            },
            embedding: vectorEmbeddings[idx],
        }));

        for (let i = 0; i < chunksToInsert.length; i += BATCH_SIZE) {
            const batchToInsert = chunksToInsert.slice(i, i + BATCH_SIZE);
            const { error: insertChunksErr } = await supabaseAdmin
                .from("document_chunks")
                .insert(batchToInsert);

            if (insertChunksErr) {
                throw new Error(`Gagal menyimpan chunk embeddings: ${insertChunksErr.message}`);
            }
        }

        // 9. Update total_chunks in Active KB metadata
        try {
            const { count: totalChunks } = await supabaseAdmin
                .from("document_chunks")
                .select("*", { count: "exact", head: true })
                .eq("knowledge_base_id", activeKb.id);

            if (totalChunks !== null) {
                const existingMeta = activeKb.metadata || {};
                await supabaseAdmin
                    .from("knowledge_bases")
                    .update({ metadata: { ...existingMeta, total_chunks: totalChunks } })
                    .eq("id", activeKb.id);
            }
        } catch {
            // Ignore metadata update error
        }

        return NextResponse.json({
            success: true,
            filename: filename,
            version: activeKb.version,
            chunkCount: chunks.length,
            embeddingModel: config.embeddingModel,
            status: "Ready",
        });
    } catch (err: any) {
        console.error("Knowledge Upload Error:", err);
        return NextResponse.json(
            { error: err.message || "Terjadi kesalahan internal saat pemrosesan dokumen." },
            { status: 500 }
        );
    }
}
