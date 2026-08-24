import { createClient } from "@supabase/supabase-js";

// Helper to get supabase admin client
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

interface SystemConfig {
    llmApiKey: string;
    llmModel: string;
    embeddingApiKey: string;
    embeddingModel: string;
    llmProviderUrl: string;
    embeddingProviderUrl: string;
    ragSimilarityThreshold: number;
}

/**
 * Fetch all system settings from the database with fallback to process.env
 */
export async function getSystemConfig(): Promise<SystemConfig> {
    const config: SystemConfig = {
        llmApiKey: process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "",
        llmModel: process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || "tencent/hy3:free",
        embeddingApiKey: process.env.EMBEDDING_API_KEY || process.env.OPENROUTER_API_KEY || "",
        embeddingModel: "openai/text-embedding-3-small",
        llmProviderUrl: process.env.LLM_PROVIDER_URL || "https://openrouter.ai/api/v1",
        embeddingProviderUrl: "https://openrouter.ai/api/v1",
        ragSimilarityThreshold: 0.35,
    };

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from("system_settings")
            .select("key, value");

        if (!error && data) {
            const settingsMap = new Map<string, string>();
            data.forEach((row) => {
                settingsMap.set(row.key, row.value);
            });

            // If a value is stored in DB and is not empty, use it. Otherwise fall back to env/default
            const dbApiKey = settingsMap.get("llm_api_key") || settingsMap.get("openrouter_api_key");
            if (dbApiKey) config.llmApiKey = dbApiKey;

            const dbModel = settingsMap.get("llm_model") || settingsMap.get("openrouter_model");
            if (dbModel) config.llmModel = dbModel;

            const dbEmbedApiKey = settingsMap.get("embedding_api_key");
            if (dbEmbedApiKey) config.embeddingApiKey = dbEmbedApiKey;

            const dbEmbedModel = settingsMap.get("embedding_model");
            if (dbEmbedModel) config.embeddingModel = dbEmbedModel;

            const dbProviderUrl = settingsMap.get("llm_provider_url") || settingsMap.get("provider_url");
            if (dbProviderUrl) config.llmProviderUrl = dbProviderUrl;

            const dbEmbedProviderUrl = settingsMap.get("embedding_provider_url");
            if (dbEmbedProviderUrl) config.embeddingProviderUrl = dbEmbedProviderUrl;

            const dbThreshold = settingsMap.get("rag_similarity_threshold");
            if (dbThreshold && !isNaN(parseFloat(dbThreshold))) {
                config.ragSimilarityThreshold = parseFloat(dbThreshold);
            }
        }
    } catch (e) {
        console.warn("Failed to fetch system settings from DB, using fallback env:", e);
    }

    return config;
}
