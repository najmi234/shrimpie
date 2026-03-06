import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
    try {
        const { messages, parameters } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is not set. Using mock response.");
            return NextResponse.json({
                response: `**[MOCK MODE: API Key Not Found]**\n\nBerdasarkan parameter udang Anda:\n- **Berat**: ${parameters.avg_weight}g\n- **Panjang**: ${parameters.avg_length}cm\n- **Keaktifan**: ${parameters.activity_level}%\n\nRekomendasi:\n1. Tingkatkan pemberian pakan berprotein tinggi\n2. Periksa kincir air karena tingkat keaktifan sedikit di bawah batas optimal.`
            });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // System prompt instructing the AI on its role and injecting the current IoT data
        const systemPrompt = `Anda adalah "Shrimpie Advisor", seorang ahli akuakultur senior spesialis budidaya udang vaname (Litopenaeus vannamei). Tugas Anda adalah memberikan saran, diagnosis, dan rekomendasi terkait penanganan udang berdasarkan data IoT terkini dan best practice (SOP) budidaya udang.

**Data IoT Kolam Saat Ini:**
- Rata-rata Berat Udang: ${parameters.avg_weight} gram
- Rata-rata Panjang Udang: ${parameters.avg_length} cm
- Tingkat Keaktifan: ${parameters.activity_level}%

**Aturan Penjawab:**
1. Gunakan bahasa Indonesia yang profesional namun ramah dan mudah dipahami oleh petambak.
2. Selalu kaitkan jawaban Anda dengan data IoT saat ini jika relevan. Misalnya, jika berat di bawah 15 gram di umur tertentu, berikan saran pakan. Jika keaktifan di bawah 70%, sarankan cek DO (Dissolved Oxygen) atau aerator.
3. Berikan rekomendasi yang praktis dan actionable (bisa langsung diterapkan).
4. Gunakan format Markdown (seperti bullet points, bold text, atau tabel jika perlu membandingkan nilai) agar mudah dibaca.
5. Jika ditanya di luar konteks budidaya udang atau perikanan, tolak dengan sopan dan kembalikan topik ke akuakultur.`;

        // Format history for Gemini
        // We exclude the last message to treat it as the current prompt
        const historyLength = messages.length;
        const currentPrompt = messages[historyLength - 1].content;

        // Structure the prompt with system instructions followed by conversation context
        let fullPrompt = `${systemPrompt}\n\n`;

        if (historyLength > 1) {
            fullPrompt += `**Konteks Percakapan Sebelumnya:**\n`;
            for (let i = 0; i < historyLength - 1; i++) {
                const msg = messages[i];
                if (msg.role !== 'system') {
                    fullPrompt += `${msg.role === 'user' ? 'Petambak' : 'Shrimpie Advisor'}: ${msg.content}\n`;
                }
            }
            fullPrompt += `\n`;
        }

        fullPrompt += `**Pertanyaan Petambak Saat Ini:**\n${currentPrompt}\n\n**Jawaban Anda:**`;

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

        return NextResponse.json({ response: responseText });

    } catch (error: any) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: "Gagal memproses permintaan: " + error.message },
            { status: 500 }
        );
    }
}
