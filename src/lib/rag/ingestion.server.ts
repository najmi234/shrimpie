import crypto from "crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-ignore
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseClient } from "@supabase/supabase-js";
import { getEmbeddings } from "./embeddings.server";
import { getSystemConfig } from "../settings.server";

if (typeof globalThis !== "undefined") {
    (globalThis as any).pdfjsWorker = pdfjsWorker;
}

export interface ParsedPage {
    pageNum: number;
    text: string;
}

export interface IngestionChunk {
    content: string;
    embeddingText: string;
    metadata: {
        filename: string;
        source: string;
        sop_number?: number;
        sop_title?: string;
        section?: string;
        page_start: number;
        page_end: number;
        content_type: "narrative" | "procedure" | "table" | "formula";
        topic: string;
        chunk_index: number;
    };
}

export interface IngestOptions {
    supabaseAdmin: SupabaseClient;
    knowledgeBaseId: string;
    filename: string;
    fileBuffer: Buffer;
}

export interface IngestResult {
    documentId: string;
    chunkCount: number;
    checksum: string;
    version: number;
    alreadyExists?: boolean;
}

/**
 * Compute SHA-256 hash for document content idempotency
 */
export function computeChecksum(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Parse PDF page-by-page preserving physical page numbers
 */
export async function extractPdfPages(buffer: Buffer): Promise<ParsedPage[]> {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
        data,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableFontFace: true,
    });

    const pdfDocument = await loadingTask.promise;
    const pages: ParsedPage[] = [];

    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        if (pageText) {
            pages.push({ pageNum: i, text: pageText });
        }
    }

    return pages;
}

/**
 * Detect topic taxonomy based on comprehensive aquaculture and document domain keywords
 */
export function detectTopic(text: string, sectionTitle?: string): string {
    const lower = (text + " " + (sectionTitle || "")).toLowerCase();

    if (/\b(pakan|feeding|fcr|fr|pemberian pakan|ancho)\b/i.test(lower)) {
        return "feeding";
    }
    if (/\b(abw|adg|sampling|size|panjang|berat|bobot|pertumbuhan)\b/i.test(lower)) {
        return "growth";
    }
    if (/\b(kualitas air|do|tan|ph|salinitas|amonia|alkalinitas|suhu|tom)\b/i.test(lower)) {
        return "water_quality";
    }
    if (/\b(biosekuriti|sterilisasi|desinfektan|sanitasi|karantina)\b/i.test(lower)) {
        return "biosecurity";
    }
    if (/\b(probiotik|bakteri|fermentasi|molase)\b/i.test(lower)) {
        return "probiotic";
    }
    if (/\b(benur|tebar|penebaran|density|kepadatan)\b/i.test(lower)) {
        return "stocking";
    }
    if (/\b(panen|harvest|partial harvest|sampling panen)\b/i.test(lower)) {
        return "harvest";
    }
    if (/\b(penyakit|wssv|imnv|ehp|ahpnd|virus|bakteri|kesehatan|gejala|infeksi)\b/i.test(lower)) {
        return "health";
    }
    if (/\b(persiapan tambak|pengeringan|pengapuran|plankton|water preparation)\b/i.test(lower)) {
        return "pond_preparation";
    }

    return "general";
}

/**
 * Detect content type (formula, table, procedure, or narrative)
 */
export function detectContentType(text: string): "narrative" | "procedure" | "table" | "formula" {
    const lower = text.toLowerCase();

    // Check formula pattern
    if (
        lower.includes("abw =") ||
        lower.includes("adg =") ||
        lower.includes("fcr =") ||
        lower.includes("sr =") ||
        lower.includes("biomass =") ||
        lower.includes("size = 1000")
    ) {
        return "formula";
    }

    // Check table pattern
    if (text.includes("|") || (lower.includes("doc") && lower.includes("abw") && lower.includes("pakan"))) {
        return "table";
    }

    // Check numbered procedure pattern
    if (/(\d+\.\s+[A-Z])|(\n\d+\.)/.test(text) || lower.includes("prosedur kerja") || lower.includes("langkah-langkah")) {
        return "procedure";
    }

    return "narrative";
}

/**
 * Create Content-Aware Chunks with Exact Block & Page Provenance
 * Chunks preserve exact page_start and page_end derived strictly from the pages contributing to that chunk.
 */
export async function createContentAwareChunks(
    filename: string,
    pages: ParsedPage[]
): Promise<IngestionChunk[]> {
    const chunks: IngestionChunk[] = [];
    let globalChunkIndex = 0;

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 200,
        separators: ["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
    });

    // Detect generic sections or process page-by-page to guarantee exact page provenance
    let currentSectionTitle = "";
    let currentSopNumber: number | undefined = undefined;

    const sopRegex = /(?:SOP\s*(\d+)|BAB\s*([I|V|X\d]+))\s*[:\-–]?\s*([^\n]+)?/i;

    for (const page of pages) {
        // Detect section title if present on this page
        const sopMatch = page.text.match(sopRegex);
        if (sopMatch) {
            if (sopMatch[1]) currentSopNumber = parseInt(sopMatch[1]);
            if (sopMatch[3]) currentSectionTitle = sopMatch[3].trim();
        } else {
            // Check for markdown / generic heading
            const headingMatch = page.text.match(/(?:^|\n)(?:#+\s*|CHAPTER\s*\d+|PASAL\s*\d+|([A-Z\s]{4,30}))(?:\n|$)/);
            if (headingMatch && headingMatch[0].trim().length > 3) {
                currentSectionTitle = headingMatch[0].trim();
            }
        }

        const splitDocs = await splitter.createDocuments([page.text]);

        for (const doc of splitDocs) {
            const rawContent = doc.pageContent.trim();
            if (!rawContent) continue;

            const contentType = detectContentType(rawContent);
            const topic = detectTopic(rawContent, currentSectionTitle);

            // Contextual Header for Embedding
            const contextHeader = `Dokumen: ${filename}${currentSectionTitle ? ` | Seksi: ${currentSectionTitle}` : ""} | Topik: ${topic}\nHalaman: ${page.pageNum}\n---`;
            const embeddingText = `${contextHeader}\n${rawContent}`;

            chunks.push({
                content: rawContent,
                embeddingText: embeddingText,
                metadata: {
                    filename: filename,
                    source: filename,
                    sop_number: currentSopNumber,
                    sop_title: currentSectionTitle || undefined,
                    section: currentSectionTitle || undefined,
                    page_start: page.pageNum,
                    page_end: page.pageNum,
                    content_type: contentType,
                    topic: topic,
                    chunk_index: globalChunkIndex++,
                },
            });
        }
    }

    return chunks;
}

/**
 * Unified Ingestion Service for Admin Upload & CLI
 * Handles:
 * 1. Target KB Status Check (Must be BUILDING)
 * 2. File Resource Limit Verification (Max 25MB)
 * 3. Idempotency Check & Cleanup of prior FAILED / partial ingestion
 * 4. PDF Parsing & Exact Page Provenance Chunking
 * 5. Target-KB Locked Embeddings Generation
 * 6. Batch Insertion & KB Status Update to READY
 */
export async function ingestDocumentToKnowledgeBase(
    options: IngestOptions
): Promise<IngestResult> {
    const { supabaseAdmin, knowledgeBaseId, filename, fileBuffer } = options;

    // Resource Limit: 25 MB max file size
    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    if (fileBuffer.length > MAX_FILE_BYTES) {
        throw new Error(`Ukuran file "${filename}" melebihi batas maksimal 25 MB.`);
    }

    // 1. Verify target Knowledge Base status (Must be BUILDING)
    const { data: kb, error: kbErr } = await supabaseAdmin
        .from("knowledge_bases")
        .select("id, version, status, embedding_provider, embedding_model, embedding_dimension")
        .eq("id", knowledgeBaseId)
        .single();

    if (kbErr || !kb) {
        throw new Error(`Target Knowledge Base dengan ID ${knowledgeBaseId} tidak ditemukan.`);
    }

    if (kb.status !== "BUILDING") {
        throw new Error(
            `Dokumen hanya dapat di-upload ke Knowledge Base berstatus BUILDING. Status KB v${kb.version} saat ini adalah "${kb.status}".`
        );
    }

    // 2. Parse File Page-by-Page
    const ext = filename.split(".").pop()?.toLowerCase();
    let pages: ParsedPage[] = [];

    if (ext === "pdf") {
        pages = await extractPdfPages(fileBuffer);
    } else {
        const rawText = fileBuffer.toString("utf-8");
        if (rawText.trim()) {
            pages = [{ pageNum: 1, text: rawText }];
        }
    }

    if (pages.length === 0) {
        throw new Error(`File "${filename}" kosong atau tidak memiliki teks yang dapat diekstrak.`);
    }

    const fullText = pages.map((p) => p.text).join("\n\n");
    const checksum = computeChecksum(fullText);

    // 3. Check for existing READY duplicate in target KB
    const { data: existingDoc } = await supabaseAdmin
        .from("source_documents")
        .select("id, metadata")
        .eq("knowledge_base_id", kb.id)
        .eq("checksum", checksum)
        .maybeSingle();

    const existingStatus = (existingDoc?.metadata as any)?.status || "READY";

    if (existingDoc && existingStatus === "READY") {
        return {
            documentId: existingDoc.id,
            chunkCount: 0,
            checksum,
            version: kb.version,
            alreadyExists: true,
        };
    }

    // Clean up partial/FAILED prior upload if exists
    if (existingDoc) {
        await supabaseAdmin.from("document_chunks").delete().eq("document_id", existingDoc.id);
        await supabaseAdmin.from("source_documents").delete().eq("id", existingDoc.id);
    }

    // 4. Create Source Document record with status inside metadata
    const { data: sourceDoc, error: docErr } = await supabaseAdmin
        .from("source_documents")
        .insert({
            knowledge_base_id: kb.id,
            filename: filename,
            checksum: checksum,
            metadata: {
                source: filename,
                page_count: pages.length,
                status: "PROCESSING",
            },
        })
        .select("id")
        .single();

    if (docErr || !sourceDoc) {
        throw new Error(`Gagal membuat catatan dokumen: ${docErr?.message}`);
    }

    try {
        // 5. Create Content-Aware Chunks
        const chunks = await createContentAwareChunks(filename, pages);
        if (chunks.length === 0) {
            throw new Error("Gagal membagi dokumen menjadi chunk. Tidak ada konten valid.");
        }

        // 6. Get Embeddings model locked to Target KB config
        const embeddingsModel = await getEmbeddings({
            model: kb.embedding_model,
            providerUrl: kb.embedding_provider,
            dimensions: kb.embedding_dimension || 768,
        });

        const BATCH_SIZE = 20;
        const embeddingTexts = chunks.map((c) => c.embeddingText);
        const vectorEmbeddings: number[][] = [];

        for (let i = 0; i < embeddingTexts.length; i += BATCH_SIZE) {
            const batchTexts = embeddingTexts.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await embeddingsModel.embedDocuments(batchTexts);
            vectorEmbeddings.push(...batchEmbeddings);
        }

        if (vectorEmbeddings.length !== chunks.length) {
            throw new Error(`Embeddings count (${vectorEmbeddings.length}) != chunks count (${chunks.length}).`);
        }

        // 7. Insert Chunks
        const chunksToInsert = chunks.map((chunk, idx) => ({
            knowledge_base_id: kb.id,
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
            const { error: insertErr } = await supabaseAdmin.from("document_chunks").insert(batchToInsert);
            if (insertErr) {
                throw new Error(`Gagal menyimpan chunk embeddings: ${insertErr.message}`);
            }
        }

        // 8. Update Source Document status to READY in metadata
        await supabaseAdmin
            .from("source_documents")
            .update({
                metadata: {
                    source: filename,
                    chunk_count: chunks.length,
                    page_count: pages.length,
                    status: "READY",
                },
            })
            .eq("id", sourceDoc.id);

        // 9. Recalculate KB metadata total_chunks & status
        const { count: totalChunks } = await supabaseAdmin
            .from("document_chunks")
            .select("*", { count: "exact", head: true })
            .eq("knowledge_base_id", kb.id);

        await supabaseAdmin
            .from("knowledge_bases")
            .update({
                status: kb.status,
                metadata: { total_chunks: totalChunks || 0, updated_at: new Date().toISOString() },
            })
            .eq("id", kb.id);

        return {
            documentId: sourceDoc.id,
            chunkCount: chunks.length,
            checksum,
            version: kb.version,
        };
    } catch (err: any) {
        // Rollback partial chunks & mark document FAILED in metadata
        await supabaseAdmin.from("document_chunks").delete().eq("document_id", sourceDoc.id);
        await supabaseAdmin
            .from("source_documents")
            .update({
                metadata: {
                    source: filename,
                    status: "FAILED",
                    error: err.message,
                },
            })
            .eq("id", sourceDoc.id);

        throw err;
    }
}
