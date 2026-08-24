import crypto from "crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// @ts-ignore
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

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
 * Detect topic taxonomy based on aquaculture keywords
 */
function detectTopic(text: string, sopTitle?: string): string {
    const lower = (text + " " + (sopTitle || "")).toLowerCase();

    if (lower.includes("pakan") || lower.includes("feeding") || lower.includes("fcr") || lower.includes("fr")) {
        return "feeding";
    }
    if (lower.includes("abw") || lower.includes("adg") || lower.includes("sampling") || lower.includes("size")) {
        return "growth";
    }
    if (lower.includes("kualitas air") || lower.includes("do") || lower.includes("tan") || lower.includes("ph") || lower.includes("salinitas")) {
        return "water_quality";
    }
    if (lower.includes("biosekuriti") || lower.includes("sterilisasi") || lower.includes("desinfektan")) {
        return "biosecurity";
    }
    if (lower.includes("probiotik") || lower.includes("bakteri")) {
        return "probiotic";
    }
    if (lower.includes("benur") || lower.includes("tebar") || lower.includes("penebaran")) {
        return "stocking";
    }
    if (lower.includes("panen") || lower.includes("harvest")) {
        return "harvest";
    }
    if (lower.includes("penyakit") || lower.includes("wssv") || lower.includes("ehp") || lower.includes("ahpnd") || lower.includes("kesehatan")) {
        return "health";
    }
    if (lower.includes("persiapan tambak") || lower.includes("pengeringan") || lower.includes("pengapuran")) {
        return "pond_preparation";
    }

    return "general";
}

/**
 * Detect content type (formula, table, procedure, or narrative)
 */
function detectContentType(text: string): "narrative" | "procedure" | "table" | "formula" {
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
    if (text.includes("|") || lower.includes("doc") && lower.includes("abw") && lower.includes("pakan")) {
        return "table";
    }

    // Check numbered procedure pattern
    if (/(\d+\.\s+[A-Z])|(\n\d+\.)/.test(text) || lower.includes("prosedur kerja") || lower.includes("langkah-langkah")) {
        return "procedure";
    }

    return "narrative";
}

interface SopSection {
    sopNumber?: number;
    sopTitle?: string;
    sectionHeader?: string;
    pages: { pageNum: number; text: string }[];
}

/**
 * Split pages into SOP / BAB hard boundaries
 */
function groupPagesBySopBoundary(pages: ParsedPage[]): SopSection[] {
    const sections: SopSection[] = [];
    let currentSection: SopSection = {
        sopNumber: undefined,
        sopTitle: undefined,
        sectionHeader: undefined,
        pages: [],
    };

    const sopRegex = /(?:SOP\s*(\d+)|BAB\s*([I|V|X]+))\s*[:\-–]?\s*([^\n]+)?/i;

    for (const page of pages) {
        const match = page.text.match(sopRegex);
        if (match) {
            // Push previous section if non-empty
            if (currentSection.pages.length > 0) {
                sections.push(currentSection);
            }

            const sopNum = match[1] ? parseInt(match[1]) : undefined;
            const sopTitle = match[3] ? match[3].trim() : `SOP Section`;

            currentSection = {
                sopNumber: sopNum,
                sopTitle: sopTitle,
                sectionHeader: match[0].trim(),
                pages: [page],
            };
        } else {
            currentSection.pages.push(page);
        }
    }

    if (currentSection.pages.length > 0) {
        sections.push(currentSection);
    }

    return sections;
}

/**
 * Generate content-aware & structure-aware chunks with rich metadata and contextual embedding text
 */
export async function createContentAwareChunks(
    filename: string,
    pages: ParsedPage[]
): Promise<IngestionChunk[]> {
    const sopSections = groupPagesBySopBoundary(pages);
    const chunks: IngestionChunk[] = [];
    let globalChunkIndex = 0;

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1200,
        chunkOverlap: 200,
        separators: ["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
    });

    for (const sec of sopSections) {
        const pageStart = sec.pages[0]?.pageNum || 1;
        const pageEnd = sec.pages[sec.pages.length - 1]?.pageNum || pageStart;
        const combinedText = sec.pages.map((p) => p.text).join("\n\n");

        if (!combinedText.trim()) continue;

        const splitDocs = await splitter.createDocuments([combinedText]);

        for (const doc of splitDocs) {
            const rawContent = doc.pageContent.trim();
            if (!rawContent) continue;

            const contentType = detectContentType(rawContent);
            const topic = detectTopic(rawContent, sec.sopTitle);

            // Prepend Contextual Header for Embedding (Section 24 of strategy)
            const contextHeader = `Dokumen: ${filename}${sec.sopTitle ? ` | SOP: ${sec.sopTitle}` : ""}${sec.sectionHeader ? ` | Seksi: ${sec.sectionHeader}` : ""} | Topik: ${topic}\nHalaman: ${pageStart}-${pageEnd}\n---`;
            const embeddingText = `${contextHeader}\n${rawContent}`;

            chunks.push({
                content: rawContent,
                embeddingText: embeddingText,
                metadata: {
                    filename: filename,
                    source: filename,
                    sop_number: sec.sopNumber,
                    sop_title: sec.sopTitle,
                    section: sec.sectionHeader,
                    page_start: pageStart,
                    page_end: pageEnd,
                    content_type: contentType,
                    topic: topic,
                    chunk_index: globalChunkIndex++,
                },
            });
        }
    }

    return chunks;
}
