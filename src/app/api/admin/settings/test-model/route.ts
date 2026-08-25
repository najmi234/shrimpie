import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSystemConfig } from "@/lib/settings.server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { getEmbeddings } from "@/lib/rag/embeddings.server";

export const runtime = "nodejs";

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

// POST /api/admin/settings/test-model — Test LLM or Embedding model connectivity
export async function POST(req: Request) {
    const isAdmin = await verifyAdminUser();
    if (!isAdmin) {
        return NextResponse.json(
            { error: "Unauthorized. Fitur ini hanya untuk Administrator." },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const config = await getSystemConfig();

        const testType = body.testType || "all"; // 'llm' | 'embedding' | 'all'

        // Retrieve params from request body or fallback to system settings
        const llmApiKey = body.llm_api_key !== undefined ? body.llm_api_key : config.llmApiKey;
        const llmModel = body.llm_model || config.llmModel || "gemini-1.5-flash";
        const llmProviderUrl = body.llm_provider_url || config.llmProviderUrl || "https://openrouter.ai/api/v1";

        const embeddingApiKey = body.embedding_api_key !== undefined ? body.embedding_api_key : config.embeddingApiKey;
        const embeddingModel = body.embedding_model || config.embeddingModel || "openai/text-embedding-3-small";
        const embeddingProviderUrl = body.embedding_provider_url || config.embeddingProviderUrl || "https://openrouter.ai/api/v1";

        const results: {
            llm?: { success: boolean; latencyMs?: number; responseText?: string; error?: string; model?: string };
            embedding?: { success: boolean; latencyMs?: number; dimension?: number; error?: string; model?: string };
        } = {};

        // 1. Test LLM model connectivity
        if (testType === "llm" || testType === "all") {
            const startLlm = Date.now();
            try {
                const model = new ChatOpenAI({
                    model: llmModel,
                    apiKey: llmApiKey || "invalid-key",
                    configuration: {
                        baseURL: llmProviderUrl,
                    },
                    temperature: 0,
                    maxTokens: 15,
                });

                const response = await model.invoke([
                    new HumanMessage("Tes koneksi model Shrimpie RAG. Jawab singkat 'OK'."),
                ]);

                const latencyMs = Date.now() - startLlm;
                const textContent = typeof response.content === "string" ? response.content.trim() : "OK";

                results.llm = {
                    success: true,
                    latencyMs,
                    responseText: textContent,
                    model: llmModel,
                };
            } catch (err: any) {
                results.llm = {
                    success: false,
                    latencyMs: Date.now() - startLlm,
                    error: err.message || "Gagal terhubung ke provider LLM.",
                    model: llmModel,
                };
            }
        }

        // 2. Test Embedding model connectivity
        if (testType === "embedding" || testType === "all") {
            const startEmb = Date.now();
            try {
                let modelName = embeddingModel;
                if (embeddingProviderUrl.includes("api.openai.com") && modelName.startsWith("openai/")) {
                    modelName = modelName.replace("openai/", "");
                }

                const embeddings = await getEmbeddings({
                    model: modelName,
                    providerUrl: embeddingProviderUrl,
                    dimensions: 768,
                });

                if (embeddingApiKey) {
                    (embeddings as any).apiKey = embeddingApiKey;
                }

                const vector = await embeddings.embedQuery("Shrimpie RAG embedding connectivity test");
                const latencyMs = Date.now() - startEmb;

                if (!Array.isArray(vector) || vector.length === 0) {
                    throw new Error("Hasil embedding kosong / tidak membalas array vektor valid.");
                }

                results.embedding = {
                    success: true,
                    latencyMs,
                    dimension: vector.length,
                    model: embeddingModel,
                };
            } catch (err: any) {
                results.embedding = {
                    success: false,
                    latencyMs: Date.now() - startEmb,
                    error: err.message || "Gagal terhubung ke provider Embedding model.",
                    model: embeddingModel,
                };
            }
        }

        return NextResponse.json({
            success: true,
            results,
        });
    } catch (err: any) {
        console.error("Test Model Error:", err);
        return NextResponse.json(
            { error: err.message || "Gagal melakukan pengujian koneksi model." },
            { status: 500 }
        );
    }
}
