/**
 * Server-side Document Reranker for Shrimpie RAG.
 *
 * Combines Reciprocal Rank Fusion (RRF) scores, Cosine Similarity,
 * Lexical Alignment Density, and optionally Cohere Rerank API (if configured)
 * to re-order candidate chunks and produce high-precision top-K context.
 */

export interface CandidateChunk {
    id?: number | string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
    rrf_score?: number;
    dense_rank?: number | null;
    fts_rank?: number | null;
}

export interface RerankedChunk extends CandidateChunk {
    rerank_score: number;
}

/**
 * Clean and tokenize a text query into normalized terms (ignoring short stop-words).
 */
function tokenizeQuery(text: string): string[] {
    const stopWords = new Set([
        "apa", "bagaimana", "mengapa", "kenapa", "siapa", "kapan", "di", "ke", "dari",
        "yang", "dan", "atau", "pada", "untuk", "dengan", "ini", "itu", "ada", "adalah",
        "bisa", "dapat", "harus", "akan", "dalam", "saat", "jika", "maka", "pada", "secara",
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2 && !stopWords.has(word));
}

/**
 * Calculate lexical token density overlap score (0.0 - 1.0) between query tokens and document content.
 */
function computeLexicalOverlapScore(query: string, content: string): number {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return 0.5;

    const lowerContent = content.toLowerCase();
    let matchedTokens = 0;
    let exactPhraseBonus = 0;

    for (const token of tokens) {
        if (lowerContent.includes(token)) {
            matchedTokens++;
        }
    }

    // Exact phrase match bonus
    const cleanQuery = query.toLowerCase().trim();
    if (cleanQuery.length > 5 && lowerContent.includes(cleanQuery)) {
        exactPhraseBonus = 0.25;
    }

    const baseOverlap = matchedTokens / tokens.length;
    return Math.min(1.0, baseOverlap * 0.75 + exactPhraseBonus);
}

/**
 * Call Cohere Rerank API if API Key is configured in environment.
 */
async function rerankWithCohere(
    query: string,
    candidates: CandidateChunk[],
    topK: number,
    apiKey: string
): Promise<RerankedChunk[] | null> {
    try {
        const response = await fetch("https://api.cohere.com/v1/rerank", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "rerank-v3.5",
                query,
                documents: candidates.map((c) => c.content),
                top_n: topK,
            }),
        });

        if (!response.ok) {
            console.warn(`Cohere Rerank API returned HTTP ${response.status}, falling back to local hybrid reranker.`);
            return null;
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.results)) {
            return null;
        }

        const reranked: RerankedChunk[] = [];
        for (const item of data.results) {
            const original = candidates[item.index];
            if (original) {
                reranked.push({
                    ...original,
                    rerank_score: item.relevance_score,
                });
            }
        }

        return reranked;
    } catch (err) {
        console.warn("Cohere Rerank API error, using local fallback:", err);
        return null;
    }
}

/**
 * Main Reranker function.
 *
 * Takes hybrid search candidates and reranks them to return topK results.
 */
export async function rerankDocuments(
    query: string,
    candidates: CandidateChunk[],
    topK: number = 5
): Promise<RerankedChunk[]> {
    if (!candidates || candidates.length === 0) {
        return [];
    }

    // 1. Try external Cohere Rerank API if configured
    const cohereApiKey = process.env.COHERE_API_KEY || process.env.RERANK_API_KEY;
    if (cohereApiKey) {
        const cohereResults = await rerankWithCohere(query, candidates, topK, cohereApiKey);
        if (cohereResults && cohereResults.length > 0) {
            return cohereResults;
        }
    }

    // 2. High-precision Local Cross-Encoder Relevance Reranking
    // Find min and max RRF scores for normalization
    const rrfScores = candidates.map((c) => c.rrf_score ?? 0);
    const maxRrf = Math.max(...rrfScores, 0.0001);
    const minRrf = Math.min(...rrfScores, 0);
    const rrfRange = maxRrf - minRrf > 0 ? maxRrf - minRrf : 1;

    const scored: RerankedChunk[] = candidates.map((c) => {
        const normRrf = c.rrf_score !== undefined ? (c.rrf_score - minRrf) / rrfRange : 0.5;
        const normSimilarity = Math.max(0, Math.min(1.0, c.similarity));
        const lexicalScore = computeLexicalOverlapScore(query, c.content);

        // Weighted hybrid score: 45% RRF rank, 35% Vector similarity, 20% Lexical alignment
        const compositeScore = 0.45 * normRrf + 0.35 * normSimilarity + 0.20 * lexicalScore;

        return {
            ...c,
            rerank_score: Number(compositeScore.toFixed(4)),
        };
    });

    // 3. Sort by rerank_score descending
    scored.sort((a, b) => b.rerank_score - a.rerank_score);

    // 4. Return topK items
    return scored.slice(0, topK);
}
