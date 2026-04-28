import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/client";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generate an embedding vector for the given text using Gemini text-embedding-004.
 * Returns a 768-dimensional float array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

/**
 * Search for relevant documents in Supabase using cosine similarity.
 */
export async function searchDocuments(
    query: string,
    matchCount: number = 5,
    matchThreshold: number = 0.5
): Promise<{ id: number; content: string; metadata: Record<string, unknown>; similarity: number }[]> {
    const embedding = await generateEmbedding(query);
    const supabase = createClient();

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
