import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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

        // 1. Fetch active KB info
        const { data: activeKb } = await supabaseAdmin
            .from("knowledge_bases")
            .select("id, version, embedding_model, metadata, activated_at")
            .eq("status", "ACTIVE")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();

        // 2. Fetch source documents
        const { data: sourceDocs } = await supabaseAdmin
            .from("source_documents")
            .select(`
                id,
                filename,
                metadata,
                created_at,
                knowledge_bases (
                    version,
                    embedding_model
                )
            `)
            .order("created_at", { ascending: false });

        let documentsList: any[] = [];

        if (sourceDocs && sourceDocs.length > 0) {
            documentsList = sourceDocs.map((doc: any) => ({
                id: doc.id,
                filename: doc.filename || doc.metadata?.source || "document",
                source: doc.metadata?.source || doc.filename,
                version: doc.knowledge_bases?.version || activeKb?.version || 1,
                chunk_count: doc.metadata?.chunk_count || 0,
                embedding_model: doc.knowledge_bases?.embedding_model || activeKb?.embedding_model || "openai/text-embedding-3-small",
                created_at: doc.created_at,
                status: "Ready",
            }));
        } else {
            // Fallback: Query legacy document chunks or documents table
            const { data: legacyChunks } = await supabaseAdmin
                .from("documents")
                .select("metadata, created_at");

            if (legacyChunks && legacyChunks.length > 0) {
                const sourceMap = new Map<string, { count: number; date: string }>();

                legacyChunks.forEach((c: any) => {
                    const sourceName = (c.metadata?.source || c.metadata?.filename || "document.pdf") as string;
                    const existing = sourceMap.get(sourceName);
                    if (existing) {
                        existing.count += 1;
                    } else {
                        sourceMap.set(sourceName, { count: 1, date: c.created_at || new Date().toISOString() });
                    }
                });

                documentsList = Array.from(sourceMap.entries()).map(([sourceName, val], idx) => ({
                    id: `legacy-${idx}`,
                    filename: sourceName,
                    source: sourceName,
                    version: activeKb?.version || 1,
                    chunk_count: val.count,
                    embedding_model: activeKb?.embedding_model || "openai/text-embedding-3-small",
                    created_at: val.date,
                    status: "Ready",
                }));
            }
        }

        const calculatedTotalChunks = activeKb?.metadata?.total_chunks || documentsList.reduce((sum, d) => sum + d.chunk_count, 0);

        return NextResponse.json({
            success: true,
            activeVersion: activeKb?.version || 1,
            embeddingModel: activeKb?.embedding_model || "openai/text-embedding-3-small",
            totalChunks: calculatedTotalChunks,
            documents: documentsList,
        });
    } catch (err: any) {
        console.error("Fetch Knowledge Documents Error:", err);
        return NextResponse.json(
            { error: err.message || "Gagal mengambil daftar dokumen." },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    const isAdmin = await verifyAdminUser();
    if (!isAdmin) {
        return NextResponse.json(
            { error: "Unauthorized. Fitur ini hanya untuk Administrator." },
            { status: 403 }
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const docId = searchParams.get("id");
        const filename = searchParams.get("filename");

        if (!docId && !filename) {
            return NextResponse.json(
                { error: "ID dokumen atau nama file tidak diberikan." },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();

        if (docId && !docId.startsWith("legacy-")) {
            // Delete chunks first
            await supabaseAdmin.from("document_chunks").delete().eq("document_id", docId);
            await supabaseAdmin.from("source_documents").delete().eq("id", docId);
        }

        if (filename) {
            await supabaseAdmin.from("document_chunks").delete().filter("metadata->>filename", "eq", filename);
            await supabaseAdmin.from("documents").delete().filter("metadata->>filename", "eq", filename);
        }

        // Recalculate remaining total chunks for active Knowledge Base
        try {
            const { data: activeKb } = await supabaseAdmin
                .from("knowledge_bases")
                .select("id, metadata")
                .eq("status", "ACTIVE")
                .order("version", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (activeKb) {
                const { count: totalChunks } = await supabaseAdmin
                    .from("document_chunks")
                    .select("*", { count: "exact", head: true })
                    .eq("knowledge_base_id", activeKb.id);

                if (totalChunks !== null) {
                    const existingMeta = activeKb.metadata || {};
                    await supabaseAdmin
                        .from("knowledge_bases")
                        .update({ metadata: { ...existingMeta, total_chunks: totalChunks } })
                        .eq("id", activeKb.id);
                }
            }
        } catch {
            // Ignore metadata update error
        }

        return NextResponse.json({
            success: true,
            message: `Dokumen "${filename || docId}" berhasil dihapus.`,
        });
    } catch (err: any) {
        console.error("Delete Document Error:", err);
        return NextResponse.json(
            { error: err.message || "Gagal menghapus dokumen." },
            { status: 500 }
        );
    }
}
