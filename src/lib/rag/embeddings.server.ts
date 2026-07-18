/**
 * Server-side RAG utilities using LangChain + OpenRouter.
 *
 * - Embeddings: OpenAI text-embedding-3-small via OpenRouter
 * - Vector DB:  Supabase pgvector via LangChain SupabaseVectorStore
 * - LLM:        OpenRouter (configured separately in the chat route)
 */
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Document } from "@langchain/core/documents";
import { getSystemConfig } from "../settings.server";

// ─── Embeddings (OpenAI via OpenRouter / Custom Provider) ────────
/**
 * Get the OpenAI embeddings instance (routed through OpenRouter / Custom Provider).
 * Uses text-embedding-3-small with 768 dimensions to match the pgvector column.
 */
export async function getEmbeddings(): Promise<OpenAIEmbeddings> {
    const config = await getSystemConfig();
    return new OpenAIEmbeddings({
        model: config.embeddingModel,
        dimensions: 768,
        configuration: {
            baseURL: config.embeddingProviderUrl,
        },
        apiKey: config.embeddingApiKey || undefined,
    });
}

// ─── Supabase Admin Client ───────────────────────────────────────
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

// ─── Vector Store ────────────────────────────────────────────────
/**
 * Get the SupabaseVectorStore instance.
 */
export async function getVectorStore(): Promise<SupabaseVectorStore> {
    const embeddings = await getEmbeddings();
    return new SupabaseVectorStore(embeddings, {
        client: getSupabaseAdmin(),
        tableName: "documents",
        queryName: "match_documents",
    });
}

/**
 * Search for relevant documents using cosine similarity via LangChain.
 * Returns documents with their similarity scores.
 */
export async function searchDocuments(
    query: string,
    matchCount: number = 5
): Promise<
    { content: string; metadata: Record<string, unknown>; similarity: number }[]
> {
    const vectorStore = await getVectorStore();

    const results = await vectorStore.similaritySearchWithScore(
        query,
        matchCount
    );

    return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata ?? {},
        similarity: score,
    }));
}

/**
 * Generate an embedding vector for the given text.
 * Convenience wrapper around the LangChain embeddings instance.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await getEmbeddings();
    return embeddings.embedQuery(text);
}

/**
 * Insert a document chunk with its embedding into Supabase.
 * Uses the vector store's addDocuments method.
 */
export async function insertDocumentChunk(
    content: string,
    metadata: Record<string, unknown> = {}
) {
    const vectorStore = await getVectorStore();
    const doc: Document = { pageContent: content, metadata };
    await vectorStore.addDocuments([doc]);
}
