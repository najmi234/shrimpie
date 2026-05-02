import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchDocuments } from "@/lib/rag/embeddings.server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(req: Request) {
    try {
        const { messages, parameters, conversationId } = await req.json();

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
                },
            });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
        });

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
        if (metricsHistory.length > 0) {
            // Latest reading
            const latest = metricsHistory[metricsHistory.length - 1];
            pertumbuhanDataSection += `**Data Pertumbuhan Udang Terkini (${new Date(latest.recorded_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}):**
- Rata-rata Berat Udang: ${latest.avg_body_weight_g} gram
- Rata-rata Panjang Udang: ${latest.avg_body_length_cm} cm
- Tingkat Keaktifan: ${latest.activity_level_pct}%

**Riwayat Seluruh Data Pertumbuhan Device (${metricsHistory.length} data, diurutkan dari terlama ke terbaru):**
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
        }

        // System prompt with Pertumbuhan data + RAG context
        const systemPrompt = `Anda adalah "Shrimpie Advisor", seorang ahli akuakultur senior spesialis budidaya udang vaname (Litopenaeus vannamei). Tugas Anda adalah memberikan saran, diagnosis, dan rekomendasi terkait penanganan udang berdasarkan data Pertumbuhan terkini, referensi dokumen pengetahuan, dan best practice (SOP) budidaya udang.

${pertumbuhanDataSection}
${ragContext}

**Aturan Penjawab:**
1. Gunakan bahasa Indonesia yang profesional namun ramah dan mudah dipahami oleh petambak.
2. Selalu kaitkan jawaban Anda dengan data Pertumbuhan saat ini jika relevan. Misalnya, jika berat di bawah 15 gram di umur tertentu, berikan saran pakan. Jika keaktifan di bawah rata-rata, sarankan cek DO (Dissolved Oxygen) atau aerator.
3. Jika ada referensi dokumen pengetahuan yang relevan, gunakan informasi tersebut untuk memperkuat jawaban Anda. Sebutkan bahwa rekomendasi didasarkan pada dokumen/SOP yang ada.
4. Berikan rekomendasi yang praktis dan actionable (bisa langsung diterapkan).
5. Gunakan format Markdown (seperti bullet points, bold text, atau tabel jika perlu membandingkan nilai) agar mudah dibaca.
6. Jika ditanya di luar konteks budidaya udang atau perikanan, tolak dengan sopan dan kembalikan topik ke akuakultur.`;

        // Structure the prompt with conversation history
        let fullPrompt = `${systemPrompt}\n\n`;

        if (historyLength > 1) {
            fullPrompt += `**Konteks Percakapan Sebelumnya:**\n`;
            for (let i = 0; i < historyLength - 1; i++) {
                const msg = messages[i];
                if (msg.role !== "system") {
                    fullPrompt += `${msg.role === "user" ? "Petambak" : "Shrimpie Advisor"}: ${msg.content}\n`;
                }
            }
            fullPrompt += `\n`;
        }

        fullPrompt += `**Pertanyaan Petambak Saat Ini:**\n${currentPrompt}\n\n**Jawaban Anda:**`;

        // ─── Streaming response ─────────────────────────────
        const result = await model.generateContentStream(fullPrompt);

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
