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

// ─── Embeddings (OpenAI via OpenRouter) ──────────────────────────
let _embeddings: OpenAIEmbeddings | null = null;

/**
 * Get the shared OpenAI embeddings instance (routed through OpenRouter).
 * Uses text-embedding-3-small with 768 dimensions to match the pgvector column.
 */
export function getEmbeddings(): OpenAIEmbeddings {
    if (!_embeddings) {
        _embeddings = new OpenAIEmbeddings({
            model: "openai/text-embedding-3-small",
            dimensions: 768,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
            },
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }
    return _embeddings;
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
let _vectorStore: SupabaseVectorStore | null = null;

/**
 * Get the shared SupabaseVectorStore instance.
 */
export function getVectorStore(): SupabaseVectorStore {
    if (!_vectorStore) {
        _vectorStore = new SupabaseVectorStore(getEmbeddings(), {
            client: getSupabaseAdmin(),
            tableName: "documents",
            queryName: "match_documents",
        });
    }
    return _vectorStore;
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
    const vectorStore = getVectorStore();

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
    const embeddings = getEmbeddings();
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
    const vectorStore = getVectorStore();
    const doc: Document = { pageContent: content, metadata };
    await vectorStore.addDocuments([doc]);
}
