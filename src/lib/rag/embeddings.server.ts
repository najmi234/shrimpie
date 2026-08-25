/**
 * Server-side RAG utilities using LangChain + OpenRouter + Hybrid Search + Reranking.
 *
 * - Embeddings: OpenAI text-embedding-3-small via OpenRouter
 * - Vector DB:  Supabase pgvector (Dense) + Full Text Search (Sparse) via RRF
 * - Reranker:   Cross-Encoder / Relevance Alignment Scoring & Cohere fallback
 */
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Document } from "@langchain/core/documents";
import { getSystemConfig } from "../settings.server";
import { rerankDocuments, CandidateChunk, RerankedChunk } from "./reranker.server";

export interface SearchResult {
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
    rrf_score?: number;
    rerank_score?: number;
    dense_rank?: number | null;
    fts_rank?: number | null;
}

// ─── Embeddings (OpenAI via OpenRouter / Custom Provider) ────────
/**
 * Get the OpenAI embeddings instance (routed through OpenRouter / Custom Provider).
 * Uses text-embedding-3-small with 768 dimensions to match the pgvector column.
 */
export async function getEmbeddings(options?: {
    model?: string;
    providerUrl?: string;
    dimensions?: number;
}): Promise<OpenAIEmbeddings> {
    const config = await getSystemConfig();
    let modelName = options?.model || config.embeddingModel || "text-embedding-3-small";
    const providerUrl = options?.providerUrl || config.embeddingProviderUrl || "https://openrouter.ai/api/v1";
    const dimensions = options?.dimensions || 768;

    // If using direct OpenAI API (not OpenRouter), strip vendor prefix like 'openai/'
    if (providerUrl.includes("api.openai.com") && modelName.startsWith("openai/")) {
        modelName = modelName.replace("openai/", "");
    }

    return new OpenAIEmbeddings({
        model: modelName,
        dimensions: dimensions,
        configuration: {
            baseURL: providerUrl,
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
 * Search for relevant documents using Hybrid Retrieval (Dense Vector + Sparse Full-Text Search with RRF)
 * and Reranking.
 *
 * Resolves the current ACTIVE knowledge_base version to use its locked embedding configuration.
 * Falls back to legacy documents table or vector-only search if hybrid RPC is unavailable.
 */
export async function searchDocuments(
    query: string,
    matchCount: number = 5
): Promise<SearchResult[]> {
    const supabase = getSupabaseAdmin();
    const candidatePoolSize = Math.max(matchCount * 3, 15);

    // 1. Fetch active Knowledge Base record
    const { data: activeKb } = await supabase
        .from("knowledge_bases")
        .select("id, embedding_model, embedding_provider, embedding_dimension")
        .eq("status", "ACTIVE")
        .order("activated_at", { ascending: false })
        .limit(1)
        .single();

    if (activeKb) {
        // Use active KB's locked embedding model configuration
        const config = await getSystemConfig();
        const embeddings = new OpenAIEmbeddings({
            model: activeKb.embedding_model || config.embeddingModel,
            dimensions: activeKb.embedding_dimension || 768,
            configuration: {
                baseURL: config.embeddingProviderUrl,
            },
            apiKey: config.embeddingApiKey || undefined,
        });

        const queryEmbedding = await embeddings.embedQuery(query);

        // Try Hybrid Search RPC (Dense + FTS + RRF)
        let candidates: CandidateChunk[] = [];
        const { data: hybridResults, error: hybridError } = await supabase.rpc(
            "match_hybrid_knowledge_base_documents",
            {
                query_text: query,
                query_embedding: queryEmbedding,
                active_kb_id: activeKb.id,
                match_count: candidatePoolSize,
            }
        );

        if (!hybridError && hybridResults && hybridResults.length > 0) {
            candidates = hybridResults.map((row: any) => ({
                id: row.id,
                content: row.content,
                metadata: row.metadata ?? {},
                similarity: row.similarity,
                rrf_score: row.rrf_score,
                dense_rank: row.dense_rank,
                fts_rank: row.fts_rank,
            }));
        } else {
            if (hybridError) {
                console.warn("Hybrid Search RPC unavailable, falling back to Dense Vector Search:", hybridError.message);
            }
            // Fallback to Dense Vector Search RPC
            const { data: denseResults, error: denseError } = await supabase.rpc(
                "match_knowledge_base_documents",
                {
                    query_embedding: queryEmbedding,
                    active_kb_id: activeKb.id,
                    match_count: candidatePoolSize,
                }
            );

            if (!denseError && denseResults) {
                candidates = denseResults.map((row: any, idx: number) => ({
                    id: row.id,
                    content: row.content,
                    metadata: row.metadata ?? {},
                    similarity: row.similarity,
                    dense_rank: idx + 1,
                }));
            }
        }

        // Apply Reranking to candidate pool
        const reranked = await rerankDocuments(query, candidates, matchCount);

        return reranked.map((item) => ({
            content: item.content,
            metadata: item.metadata,
            similarity: item.similarity,
            rrf_score: item.rrf_score,
            rerank_score: item.rerank_score,
            dense_rank: item.dense_rank,
            fts_rank: item.fts_rank,
        }));
    }

    // Fallback for legacy documents table (without versioned KB)
    const embeddings = await getEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(query);

    let candidates: CandidateChunk[] = [];
    const { data: hybridLegacyResults, error: hybridLegacyError } = await supabase.rpc(
        "match_hybrid_documents",
        {
            query_text: query,
            query_embedding: queryEmbedding,
            match_count: candidatePoolSize,
        }
    );

    if (!hybridLegacyError && hybridLegacyResults && hybridLegacyResults.length > 0) {
        candidates = hybridLegacyResults.map((row: any) => ({
            id: row.id,
            content: row.content,
            metadata: row.metadata ?? {},
            similarity: row.similarity,
            rrf_score: row.rrf_score,
            dense_rank: row.dense_rank,
            fts_rank: row.fts_rank,
        }));
    } else {
        const vectorStore = await getVectorStore();
        const results = await vectorStore.similaritySearchWithScore(query, candidatePoolSize);
        candidates = results.map(([doc, score], idx) => ({
            content: doc.pageContent,
            metadata: doc.metadata ?? {},
            similarity: score,
            dense_rank: idx + 1,
        }));
    }

    const reranked = await rerankDocuments(query, candidates, matchCount);

    return reranked.map((item) => ({
        content: item.content,
        metadata: item.metadata,
        similarity: item.similarity,
        rrf_score: item.rrf_score,
        rerank_score: item.rerank_score,
        dense_rank: item.dense_rank,
        fts_rank: item.fts_rank,
    }));
}

/**
 * Generate an embedding vector for the given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await getEmbeddings();
    return embeddings.embedQuery(text);
}

/**
 * Insert a document chunk with its embedding into Supabase.
 */
export async function insertDocumentChunk(
    content: string,
    metadata: Record<string, unknown> = {}
) {
    const vectorStore = await getVectorStore();
    const doc: Document = { pageContent: content, metadata };
    await vectorStore.addDocuments([doc]);
}
