import { createClient } from "@supabase/supabase-js";
import { parseDateAsLocal } from "@/lib/utils";

export interface TrustedPondMetric {
    avg_body_weight_g: number;
    avg_body_length_cm: number;
    activity_level_pct: number;
    recorded_at: string;
}

export interface TrustedPondContext {
    pondId: string;
    pondName: string;
    stockingDate: string | null;
    doc: number | null;
    latestMetric: {
        avgWeightGram: number;
        avgLengthCm: number;
        activitySpeedPxS: number;
        recordedAt: string;
    } | null;
    metricsHistory: TrustedPondMetric[];
}

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
}

/**
 * Fetch and verify pond context server-side.
 * Returns null if pond is not found, or throws an authorization error if user doesn't own the pond.
 */
export async function getAuthorizedPondContext(
    userId: string,
    pondId: string
): Promise<{ context: TrustedPondContext | null; error?: string; status?: number }> {
    const supabase = getSupabaseAdmin();

    // 1. Fetch pond record and verify user ownership
    const { data: pond, error: pondError } = await supabase
        .from("ponds")
        .select("id, name, stocking_date, user_id")
        .eq("id", pondId)
        .single();

    if (pondError || !pond) {
        return { context: null, error: "Pond not found", status: 404 };
    }

    if (pond.user_id && pond.user_id !== userId) {
        return {
            context: null,
            error: "Access Denied: Anda tidak memiliki akses ke data kolam ini.",
            status: 403,
        };
    }

    // 2. Fetch metrics history directly from database
    const { data: rawMetrics, error: metricsError } = await supabase
        .from("pond_metrics")
        .select("avg_body_weight_g, avg_body_length_cm, activity_level_pct, recorded_at")
        .eq("pond_id", pondId)
        .order("recorded_at", { ascending: true });

    if (metricsError) {
        console.error("Failed to fetch pond metrics for pond", pondId, metricsError);
    }

    // 3. Sanitize and validate metrics data
    const now = new Date().getTime();
    const validatedMetrics: TrustedPondMetric[] = (rawMetrics || [])
        .filter((m) => {
            // Reject negative values and future dates
            const recordedTime = parseDateAsLocal(m.recorded_at).getTime();
            if (isNaN(recordedTime) || recordedTime > now + 300000) return false; // 5 min grace
            if (m.avg_body_weight_g < 0 || m.avg_body_length_cm < 0 || m.activity_level_pct < 0) return false;
            return true;
        })
        .map((m) => ({
            avg_body_weight_g: Number(m.avg_body_weight_g) || 0,
            avg_body_length_cm: Number(m.avg_body_length_cm) || 0,
            activity_level_pct: Number(m.activity_level_pct) || 0,
            recorded_at: m.recorded_at,
        }));

    const latest = validatedMetrics.length > 0 ? validatedMetrics[validatedMetrics.length - 1] : null;

    // 4. Calculate Days of Culture (DOC) safely
    let doc: number | null = null;
    if (pond.stocking_date) {
        const stockingTime = new Date(pond.stocking_date).getTime();
        const endTime = latest ? parseDateAsLocal(latest.recorded_at).getTime() : now;
        const diffDays = Math.floor((endTime - stockingTime) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
            doc = diffDays;
        }
    }

    return {
        context: {
            pondId: pond.id,
            pondName: pond.name,
            stockingDate: pond.stocking_date,
            doc,
            latestMetric: latest
                ? {
                      avgWeightGram: latest.avg_body_weight_g,
                      avgLengthCm: latest.avg_body_length_cm,
                      activitySpeedPxS: latest.activity_level_pct,
                      recordedAt: latest.recorded_at,
                  }
                : null,
            metricsHistory: validatedMetrics,
        },
    };
}
