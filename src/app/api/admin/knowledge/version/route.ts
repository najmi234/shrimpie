import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSystemConfig } from "@/lib/settings.server";

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

// GET /api/admin/knowledge/version — List all KB versions
export async function GET() {
    const isAdmin = await verifyAdminUser();
    if (!isAdmin) {
        return NextResponse.json(
            { error: "Unauthorized. Fitur ini hanya untuk Administrator." },
            { status: 403 }
        );
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data: versions, error } = await supabaseAdmin
            .from("knowledge_bases")
            .select("id, version, status, embedding_provider, embedding_model, embedding_dimension, created_at, activated_at, metadata")
            .order("version", { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            versions: versions || [],
        });
    } catch (err: any) {
        console.error("Fetch KB Versions Error:", err);
        return NextResponse.json(
            { error: err.message || "Gagal mengambil daftar versi Knowledge Base." },
            { status: 500 }
        );
    }
}

// POST /api/admin/knowledge/version — Action create / activate
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
        const { action, kbId } = body;
        const supabaseAdmin = getSupabaseAdmin();

        if (action === "create") {
            const config = await getSystemConfig();

            // Find highest version number
            const { data: latestKb } = await supabaseAdmin
                .from("knowledge_bases")
                .select("version")
                .order("version", { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextVersion = (latestKb?.version || 0) + 1;

            const { data: newKb, error: createErr } = await supabaseAdmin
                .from("knowledge_bases")
                .insert({
                    version: nextVersion,
                    status: "BUILDING",
                    embedding_provider: config.embeddingProviderUrl || "default",
                    embedding_model: config.embeddingModel,
                    embedding_dimension: 768,
                    metadata: { total_chunks: 0, created_by: "Admin" },
                })
                .select("*")
                .single();

            if (createErr || !newKb) {
                throw new Error(`Gagal membuat versi Knowledge Base v${nextVersion}: ${createErr?.message}`);
            }

            return NextResponse.json({
                success: true,
                message: `Berhasil membuat Knowledge Base versi v${nextVersion} (Status: BUILDING)`,
                version: newKb,
            });
        } else if (action === "activate") {
            if (!kbId) {
                return NextResponse.json(
                    { error: "Target KB ID tidak diberikan." },
                    { status: 400 }
                );
            }

            // Call atomic RPC for knowledge base activation
            const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("activate_knowledge_base", {
                target_kb_id: kbId,
            });

            if (rpcErr) {
                // Fallback to two-step query if RPC has not been applied yet
                await supabaseAdmin.from("knowledge_bases").update({ status: "INACTIVE" }).eq("status", "ACTIVE");
                const { data: activated, error: activateErr } = await supabaseAdmin
                    .from("knowledge_bases")
                    .update({ status: "ACTIVE", activated_at: new Date().toISOString() })
                    .eq("id", kbId)
                    .select("*")
                    .single();

                if (activateErr || !activated) {
                    throw new Error(`Gagal mengaktifkan versi KB: ${activateErr?.message}`);
                }

                return NextResponse.json({
                    success: true,
                    message: `Berhasil mengaktifkan Knowledge Base v${activated.version}`,
                    activeVersion: activated,
                });
            }

            // Fetch newly activated KB details
            const { data: activatedKb } = await supabaseAdmin
                .from("knowledge_bases")
                .select("*")
                .eq("id", kbId)
                .single();

            return NextResponse.json({
                success: true,
                message: `Berhasil mengaktifkan Knowledge Base v${activatedKb?.version || ""}`,
                activeVersion: activatedKb,
            });
        }

        return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    } catch (err: any) {
        console.error("Manage KB Version Error:", err);
        return NextResponse.json(
            { error: err.message || "Gagal memproses manajemen versi KB." },
            { status: 500 }
        );
    }
}
