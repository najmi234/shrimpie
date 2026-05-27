/**
 * Server-side embedding utilities for RAG.
 * Uses Supabase service role or server client for write operations (ingest, API routes).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generate an embedding vector for the given text using Gemini text-embedding-004.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent({
        content: { role: "user", parts: [{ text }] },
        outputDimensionality: 768,
    } as any);
    return result.embedding.values;
}

/**
 * Create a Supabase client for server-side use (with service role key if available).
 */
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

/**
 * Search for relevant documents using cosine similarity via pgvector.
 */
export async function searchDocuments(
    query: string,
    matchCount: number = 5,
    matchThreshold: number = 0.5
): Promise<{ id: number; content: string; metadata: Record<string, unknown>; similarity: number }[]> {
    const embedding = await generateEmbedding(query);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
    });

    if (error) {
        console.error("Error searching documents:", error);
        return [];
    }

    return data ?? [];
}

/**
 * Insert a document chunk with its embedding into Supabase.
 */
export async function insertDocumentChunk(
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> = {}
) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("documents").insert({
        content,
        embedding,
        metadata,
    });
    if (error) {
        throw new Error(`Failed to insert document chunk: ${error.message}`);
    }
}
