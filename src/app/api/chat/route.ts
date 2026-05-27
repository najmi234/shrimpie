import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchDocuments } from "@/lib/rag/embeddings.server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { chatRateLimiter } from "@/lib/rate-limit";

import { z } from "zod";

const messageSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1, "Pesan tidak boleh kosong"),
});

const metricHistoryItemSchema = z.object({
    avg_body_weight_g: z.number(),
    avg_body_length_cm: z.number(),
    activity_level_pct: z.number(),
    recorded_at: z.string(),
});

const parametersSchema = z.object({
    avg_weight: z.number(),
    avg_length: z.number(),
    activity_level: z.number(),
    pondName: z.string().optional().nullable(),
    metricsHistory: z.array(metricHistoryItemSchema).optional().nullable(),
    doc: z.number().optional().nullable(),
    stocking_date: z.string().optional().nullable(),
});

// ---------- Feeding Program SOP ----------
interface FeedingStage {
    docMin: number;
    docMax: number;
    weightMin: number;
    weightMax: number;
    lengthMin: number;
    lengthMax: number;
    feedingRate: string;
    feedFrequency: string;
    phase: string;
}

const feedingStages: FeedingStage[] = [
    { docMin: 1, docMax: 10, weightMin: 0, weightMax: 0.1, lengthMin: 0.6, lengthMax: 1.2, feedingRate: "-", feedFrequency: "3x/hari", phase: "Blind Feeding" },
    { docMin: 11, docMax: 20, weightMin: 0.1, weightMax: 1.5, lengthMin: 1.2, lengthMax: 2.0, feedingRate: "-", feedFrequency: "3x/hari", phase: "Blind Feeding" },
    { docMin: 21, docMax: 30, weightMin: 1.5, weightMax: 2.5, lengthMin: 2.0, lengthMax: 3.5, feedingRate: "-", feedFrequency: "4x/hari", phase: "Blind Feeding" },
    { docMin: 30, docMax: 40, weightMin: 2.5, weightMax: 3.5, lengthMin: 3.5, lengthMax: 5.5, feedingRate: "5.8–4.8%", feedFrequency: "4x/hari", phase: "Kontrol Ancho" },
    { docMin: 40, docMax: 60, weightMin: 3.5, weightMax: 8.0, lengthMin: 5.5, lengthMax: 6.5, feedingRate: "4.8–3.2%", feedFrequency: "4–5x/hari", phase: "Kontrol Ancho" },
    { docMin: 60, docMax: 80, weightMin: 8.0, weightMax: 12.5, lengthMin: 6.5, lengthMax: 8.5, feedingRate: "3.2–2.6%", feedFrequency: "5x/hari", phase: "Kontrol Ancho" },
    { docMin: 80, docMax: 100, weightMin: 12.5, weightMax: 17.5, lengthMin: 8.5, lengthMax: 10.0, feedingRate: "2.6–2.2%", feedFrequency: "5x/hari", phase: "Kontrol Ancho" },
    { docMin: 100, docMax: 120, weightMin: 17.5, weightMax: 22.0, lengthMin: 10.0, lengthMax: 11.5, feedingRate: "2.2–1.8%", feedFrequency: "5–6x/hari", phase: "Kontrol Ancho" },
    { docMin: 120, docMax: 999, weightMin: 22.0, weightMax: 999, lengthMin: 11.5, lengthMax: 999, feedingRate: "≤1.8%", feedFrequency: "6x/hari", phase: "Kontrol Ancho" },
];

function getHandlingRecommendation(doc: number | null, weight: number, length: number, activity: number): string {
    if (doc === null) return "Data stocking_date belum tersedia untuk kolam ini. Silakan isi tanggal tebar di database.";

    const stage = feedingStages.find((s) => doc >= s.docMin && doc <= s.docMax);
    if (!stage) return "DOC di luar jangkauan program pakan.";

    const lines: string[] = [];
    lines.push(`📅 DOC ${doc} — Fase ${stage.phase}`);
    lines.push(`🍤 Frekuensi pakan: ${stage.feedFrequency}${stage.feedingRate !== "-" ? ` | Feeding rate: ${stage.feedingRate}` : ""}`);

    // Check weight
    if (weight < stage.weightMin) {
        lines.push(`⚠️ Berat (${weight}g) di bawah target (${stage.weightMin}–${stage.weightMax}g). Pertimbangkan tingkatkan kualitas pakan dan cek kualitas air.`);
    } else if (weight > stage.weightMax) {
        lines.push(`✅ Berat (${weight}g) melebihi target (${stage.weightMin}–${stage.weightMax}g). Pertumbuhan sangat baik.`);
    } else {
        lines.push(`✅ Berat (${weight}g) sesuai target (${stage.weightMin}–${stage.weightMax}g).`);
    }

    // Check length
    if (length < stage.lengthMin) {
        lines.push(`⚠️ Panjang (${length}cm) di bawah target (${stage.lengthMin}–${stage.lengthMax}cm). Evaluasi nutrisi pakan.`);
    } else if (length > stage.lengthMax) {
        lines.push(`✅ Panjang (${length}cm) melebihi target (${stage.lengthMin}–${stage.lengthMax}cm).`);
    } else {
        lines.push(`✅ Panjang (${length}cm) sesuai target (${stage.lengthMin}–${stage.lengthMax}cm).`);
    }

    // Check activity level
    if (activity < 3) {
        lines.push(`🚨 Aktivitas (${activity} px/s) sangat rendah. Segera cek kualitas air (DO, pH, salinitas) dan pastikan aerasi berjalan optimal. Kurangi porsi pakan sementara.`);
    } else if (activity < 5) {
        lines.push(`⚠️ Aktivitas (${activity} px/s) cukup rendah. Pantau kualitas air dan perhatikan tanda-tanda stres pada udang.`);
    } else if (activity > 15) {
        lines.push(`⚠️ Aktivitas (${activity} px/s) sangat tinggi. Kemungkinan udang stres atau ada perubahan lingkungan mendadak. Periksa suhu dan parameter air.`);
    } else {
        lines.push(`✅ Aktivitas (${activity} px/s) normal.`);
    }

    return lines.join("\n");
}

const requestSchema = z.object({
    messages: z.array(messageSchema).min(1, "Riwayat percakapan tidak boleh kosong"),
    parameters: parametersSchema,
    conversationId: z.string().uuid("ID percakapan tidak valid").optional().nullable(),
});

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Get a Supabase admin client for server-side operations.
 */
function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

/**
 * Authenticate the request using Supabase session cookies.
 * Returns the user object if authenticated, or null.
 */
async function authenticateRequest(): Promise<{ id: string } | null> {
    try {
        const supabase = await createServerClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return null;
        }

        return { id: user.id };
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    // ─── 1. Autentikasi: Validasi user session ──────────────
    const user = await authenticateRequest();

    if (!user) {
        return new Response(
            JSON.stringify({
                error: "Unauthorized. Silakan login terlebih dahulu.",
            }),
            {
                status: 401,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    // ─── 2. Rate Limiting: Cek batas request per user ───────
    const rateLimitResult = chatRateLimiter.check(user.id);

    if (!rateLimitResult.allowed) {
        const retryAfterSeconds = Math.ceil(
            (rateLimitResult.resetAt - Date.now()) / 1000
        );
        return new Response(
            JSON.stringify({
                error: `Terlalu banyak permintaan. Silakan tunggu ${retryAfterSeconds} detik sebelum mencoba lagi.`,
            }),
            {
                status: 429,
                headers: {
                    "Content-Type": "application/json",
                    "Retry-After": String(retryAfterSeconds),
                    "X-RateLimit-Limit": "20",
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": String(rateLimitResult.resetAt),
                },
            }
        );
    }

    // ─── 3. Proses & Validasi chat request ──────────────────
    try {
        const body = await req.json();
        const validationResult = requestSchema.safeParse(body);

        if (!validationResult.success) {
            return new Response(
                JSON.stringify({
                    error: "Format data tidak valid: " + validationResult.error.issues.map(e => e.message).join(", "),
                }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        const { messages, parameters, conversationId } = validationResult.data;

        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set. Using mock response.");
            const mockText = `**[MOCK MODE: API Key Not Found]**\n\nBerdasarkan parameter udang Anda:\n- **Berat**: ${parameters.avg_weight}g\n- **Panjang**: ${parameters.avg_length}cm\n- **Keaktifan**: ${parameters.activity_level}%\n\nRekomendasi:\n1. Tingkatkan pemberian pakan berprotein tinggi\n2. Periksa kincir air karena tingkat keaktifan sedikit di bawah batas optimal.`;

            // Even in mock mode, stream the response for consistent UX
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    // Simulate streaming by sending word-by-word
                    const words = mockText.split(" ");
                    for (const word of words) {
                        controller.enqueue(
                            encoder.encode(
                                `data: ${JSON.stringify({ text: word + " " })}\n\n`
                            )
                        );
                    }
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                    controller.close();
                },
            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
                },
            });
        }

        // Extract current user prompt
        const historyLength = messages.length;
        const currentPrompt = messages[historyLength - 1].content;

        // ─── RAG: Retrieve relevant documents ─────────────────
        let ragContext = "";
        try {
            const relevantDocs = await searchDocuments(currentPrompt, 3);
            if (relevantDocs.length > 0) {
                ragContext = `\n\n**Referensi dari Dokumen Pengetahuan:**\n${relevantDocs
                    .map(
                        (d, i) =>
                            `[${i + 1}] (similarity: ${d.similarity.toFixed(2)}) ${d.content}`
                    )
                    .join("\n\n")}`;
            }
        } catch (ragError) {
            console.warn(
                "RAG search failed, proceeding without document context:",
                ragError
            );
        }

        // ─── Build data pertumbuhan context from all metrics ─────────
        const metricsHistory: Array<{
            avg_body_weight_g: number;
            avg_body_length_cm: number;
            activity_level_pct: number;
            recorded_at: string;
        }> = parameters.metricsHistory ?? [];

        let pertumbuhanDataSection = "";
        const resolvedDoc = parameters.doc !== undefined && parameters.doc !== null 
            ? parameters.doc 
            : (parameters.stocking_date 
                ? Math.floor((Date.now() - new Date(parameters.stocking_date).getTime()) / (1000 * 60 * 60 * 24)) 
                : null);

        if (resolvedDoc !== null && resolvedDoc >= 0) {
            pertumbuhanDataSection += `**Days of Culture (DOC) saat ini:** ${resolvedDoc} hari\n\n`;
        }

        if (metricsHistory.length > 0) {
            // Latest reading
            const latest = metricsHistory[metricsHistory.length - 1];
            pertumbuhanDataSection += `**Data Pertumbuhan Udang Terkini (${new Date(latest.recorded_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}):**
- Rata-rata Berat Udang: ${latest.avg_body_weight_g} gram
- Rata-rata Panjang Udang: ${latest.avg_body_length_cm} cm
- Tingkat Keaktifan: ${latest.activity_level_pct}%
`;
            if (resolvedDoc !== null && resolvedDoc >= 0) {
                pertumbuhanDataSection += `- Umur Udang (DOC): ${resolvedDoc} hari\n`;
            }
            pertumbuhanDataSection += `\n**Riwayat Seluruh Data Pertumbuhan Device (${metricsHistory.length} data, diurutkan dari terlama ke terbaru):**
| No | Waktu Pencatatan | Berat (g) | Panjang (cm) | Keaktifan (%) |
|----|-----------------|-----------|-------------|--------------|
`;
            metricsHistory.forEach((m, i) => {
                const date = new Date(m.recorded_at).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                });
                pertumbuhanDataSection += `| ${i + 1} | ${date} | ${m.avg_body_weight_g} | ${m.avg_body_length_cm} | ${m.activity_level_pct} |\n`;
            });
        } else {
            // Fallback to single parameters if no history available
            pertumbuhanDataSection = `**Data Pertumbuhan Udang Saat Ini:**
- Rata-rata Berat Udang: ${parameters.avg_weight} gram
- Rata-rata Panjang Udang: ${parameters.avg_length} cm
- Tingkat Keaktifan: ${parameters.activity_level}%`;
            if (resolvedDoc !== null && resolvedDoc >= 0) {
                pertumbuhanDataSection += `\n- Umur Udang (DOC): ${resolvedDoc} hari`;
            }
        }

        // ─── Rule-Based Recommendation integration ───────────────
        let ruleBasedSection = "";
        if (resolvedDoc !== null && resolvedDoc >= 0) {
            const ruleRec = getHandlingRecommendation(
                resolvedDoc,
                parameters.avg_weight,
                parameters.avg_length,
                parameters.activity_level
            );
            ruleBasedSection = `\n**Rekomendasi Berbasis Aturan SOP (Rule-Based Recommendation):**\n${ruleRec}\n`;
        }

        // System prompt with Pertumbuhan data + RAG context + Rule-Based SOP
        const systemPrompt = `Anda adalah "Shrimpie Advisor", seorang ahli akuakultur senior spesialis budidaya udang vaname (Litopenaeus vannamei). Tugas Anda adalah memberikan saran, diagnosis, dan rekomendasi terkait penanganan udang berdasarkan data Pertumbuhan terkini, Rekomendasi Berbasis Aturan SOP, referensi dokumen pengetahuan, dan best practice (SOP) budidaya udang.

${pertumbuhanDataSection}
${ruleBasedSection}
${ragContext}

**Aturan Penjawab:**
1. Gunakan bahasa Indonesia yang profesional namun ramah dan mudah dipahami oleh petambak.
2. Selalu kaitkan jawaban Anda dengan data Pertumbuhan saat ini dan Rekomendasi Berbasis Aturan SOP jika relevan. Rekomendasi Berbasis Aturan SOP adalah hasil evaluasi sistem aturan baku terhadap DOC, berat, panjang, dan aktivitas udang saat ini. Gunakan itu sebagai acuan dasar analisis Anda, lalu kembangkan analisanya dengan penjelasan ilmiah yang mudah dipahami atau referensi dokumen pengetahuan yang relevan.
3. Jika ada referensi dokumen pengetahuan yang relevan, gunakan informasi tersebut untuk memperkuat jawaban Anda. Sebutkan bahwa rekomendasi didasarkan pada dokumen/SOP yang ada.
4. Berikan rekomendasi yang praktis dan actionable (bisa langsung diterapkan).
5. Gunakan format Markdown (seperti bullet points, bold text, atau tabel jika perlu membandingkan nilai) agar mudah dibaca.
6. Jika ditanya di luar konteks budidaya udang atau perikanan, tolak dengan sopan dan kembalikan topik ke akuakultur.`;

        // Initialize Gemini model with dynamic system instruction
        const chatModel = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            systemInstruction: systemPrompt,
        });

        // Map previous messages to Gemini Chat history format
        const chatHistory = messages.slice(0, historyLength - 1).map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Start multi-turn chat session
        const chat = chatModel.startChat({
            history: chatHistory,
        });

        // ─── Streaming response using multi-turn sendMessageStream ──
        const result = await chat.sendMessageStream(currentPrompt);

        const encoder = new TextEncoder();
        let fullResponseText = "";

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            fullResponseText += text;
                            controller.enqueue(
                                encoder.encode(
                                    `data: ${JSON.stringify({ text })}\n\n`
                                )
                            );
                        }
                    }

                    // Save assistant message to database if conversationId provided
                    if (conversationId && fullResponseText) {
                        try {
                            const supabase = getSupabaseAdmin();
                            await supabase.from("chat_messages").insert({
                                conversation_id: conversationId,
                                role: "assistant",
                                content: fullResponseText,
                            });
                        } catch (dbError) {
                            console.error(
                                "Failed to save assistant message:",
                                dbError
                            );
                        }
                    }

                    controller.enqueue(
                        encoder.encode(`data: [DONE]\n\n`)
                    );
                    controller.close();
                } catch (streamError) {
                    console.error("Streaming error:", streamError);
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ error: "Streaming gagal" })}\n\n`
                        )
                    );
                    controller.enqueue(
                        encoder.encode(`data: [DONE]\n\n`)
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            },
        });
    } catch (error: any) {
        console.error("Chat API error:", error);
        return new Response(
            JSON.stringify({
                error: "Gagal memproses permintaan: " + error.message,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
