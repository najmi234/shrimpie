import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSystemConfig } from "@/lib/settings.server";
import { ingestDocumentToKnowledgeBase } from "@/lib/rag/ingestion.server";

export const runtime = "nodejs";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

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

export async function POST(req: Request) {
    const isAdmin = await verifyAdminUser();
    if (!isAdmin) {
        return NextResponse.json(
            { error: "Unauthorized. Fitur ini hanya untuk Administrator." },
            { status: 403 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        let targetKbId = (formData.get("target_kb_id") || formData.get("targetKnowledgeBaseId")) as string | null;

        if (!file) {
            return NextResponse.json(
                { error: "File dokumen tidak ditemukan." },
                { status: 400 }
            );
        }

        const filename = file.name;
        const ext = filename.split(".").pop()?.toLowerCase();

        if (!["pdf", "txt", "md"].includes(ext || "")) {
            return NextResponse.json(
                { error: "Format file tidak didukung. Harap upload file .pdf, .txt, atau .md." },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();
        const config = await getSystemConfig();

        // If target_kb_id not specified, find an existing BUILDING KB or create one
        if (!targetKbId) {
            const { data: buildingKb } = await supabaseAdmin
                .from("knowledge_bases")
                .select("id")
                .eq("status", "BUILDING")
                .order("version", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (buildingKb) {
                targetKbId = buildingKb.id;
            } else {
                // Determine next version number
                const { data: latestKb } = await supabaseAdmin
                    .from("knowledge_bases")
                    .select("version")
                    .order("version", { ascending: false })
                    .limit(1);

                const nextVersion = (latestKb && latestKb.length > 0 ? latestKb[0].version : 0) + 1;

                const { data: newKb, error: createKbErr } = await supabaseAdmin
                    .from("knowledge_bases")
                    .insert({
                        version: nextVersion,
                        status: "BUILDING",
                        embedding_provider: config.embeddingProviderUrl || "default",
                        embedding_model: config.embeddingModel,
                        embedding_dimension: 768,
                        metadata: { total_chunks: 0, created_by: "Admin Ingestion" },
                    })
                    .select("id")
                    .single();

                if (createKbErr || !newKb) {
                    throw new Error(`Gagal membuat Knowledge Base versi BUILDING v${nextVersion}: ${createKbErr?.message}`);
                }

                targetKbId = newKb.id;
            }
        }

        if (!targetKbId) {
            throw new Error("Gagal menentukan target Knowledge Base.");
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Call unified ingestion service
        const result = await ingestDocumentToKnowledgeBase({
            supabaseAdmin,
            knowledgeBaseId: targetKbId,
            filename,
            fileBuffer: buffer,
        });

        if (result.alreadyExists) {
            return NextResponse.json({
                success: true,
                alreadyExists: true,
                filename: filename,
                version: result.version,
                message: `Dokumen "${filename}" sudah di-ingest sebelumnya di KB v${result.version}.`,
                status: "Ready",
            });
        }

        return NextResponse.json({
            success: true,
            filename: filename,
            version: result.version,
            chunkCount: result.chunkCount,
            embeddingModel: config.embeddingModel,
            status: "Ready",
        });
    } catch (err: any) {
        console.error("Knowledge Upload Error:", err);
        return NextResponse.json(
            { error: err.message || "Terjadi kesalahan internal saat pemrosesan dokumen." },
            { status: 400 }
        );
    }
}
