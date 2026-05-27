"use client"

import { useState, useEffect, useMemo, Fragment, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts"
import { motion } from "framer-motion"
import { Ruler, Weight, Activity, ChevronDown, ChevronUp, Trash2, MapPin } from "lucide-react"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format, subDays, differenceInDays, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"

// ---------- types ----------

interface PondOption {
    id: string
    name: string
    stocking_date: string | null
}

interface MetricRow {
    id: string
    date: string
    fullDate: string
    time: string
    length: number
    weight: number
    activity: number
    location: string | null
}

interface DailySummary {
    date: string
    fullDate: string
    doc: number | null
    length: number
    weight: number
    activity: number
    location: string | null
    count: number
    details: MetricRow[]
}

// ---------- chart config ----------

const chartConfigs = [
    {
        title: "Avg Body Length (cm)",
        dataKey: "length" as const,
        color: "#22c55e",
        icon: Ruler,
    },
    {
        title: "Avg Body Weight (g)",
        dataKey: "weight" as const,
        color: "#f59e0b",
        icon: Weight,
    },
    {
        title: "Activity Level (px/s)",
        dataKey: "activity" as const,
        color: "#6366f1",
        icon: Activity,
    },
]

// ---------- component ----------

export default function RiwayatPage() {
    const supabase = createClient()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pondParam = searchParams.get("pond")

    const [ponds, setPonds] = useState<PondOption[]>([])
    const [selectedPondName, setSelectedPondName] = useState<string>("")
    const [metricsData, setMetricsData] = useState<MetricRow[]>([])
    const [fromDate, setFromDate] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"))
    const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [expandedDate, setExpandedDate] = useState<string | null>(null)

    // Derive pond names for combobox
    const pondNames = useMemo(() => ponds.map((p) => p.name), [ponds])

    // Map pond_name → pond_id
    const pondIdMap = useMemo(() => {
        const map: Record<string, string> = {}
        ponds.forEach((p) => { map[p.name] = p.id })
        return map
    }, [ponds])

    const selectedPondId = pondIdMap[selectedPondName] || ""

    // Get stocking_date for selected pond
    const stockingDate = useMemo(() => {
        const pond = ponds.find((p) => p.name === selectedPondName)
        console.log("[DEBUG] selected pond:", pond, "stocking_date:", pond?.stocking_date)
        return pond?.stocking_date ? parseISO(pond.stocking_date) : null
    }, [ponds, selectedPondName])

    // Fetch ponds list (including stocking_date)
    useEffect(() => {
        async function fetchPonds() {
            const { data, error } = await supabase
                .from("ponds")
                .select("id, name, stocking_date")
                .order("name")
            if (error) {
                console.error("Failed to fetch ponds:", error)
                return
            }
            const sorted = (data ?? []).sort((a, b) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            })
            setPonds(sorted)
            // If ?pond= query param is present, auto-select that pond
            if (pondParam && sorted.some(p => p.name === pondParam)) {
                setSelectedPondName(pondParam)
            } else if (sorted.length > 0) {
                setSelectedPondName(sorted[0].name)
            }
        }
        fetchPonds()
    }, [])

    // Fetch metrics when pond changes
    const fetchMetrics = async () => {
        if (!selectedPondId) return
        const { data, error } = await supabase
            .from("pond_metrics")
            .select("id, avg_body_length_cm, avg_body_weight_g, activity_level_pct, recorded_at, location")
            .eq("pond_id", selectedPondId)
            .order("recorded_at", { ascending: true })
        if (error) {
            console.error("Failed to fetch metrics:", error)
            return
        }
        const formatted: MetricRow[] = (data ?? []).map((m) => {
            const d = new Date(m.recorded_at)
            return {
                id: m.id,
                date: format(d, "dd MMM"),
                fullDate: format(d, "yyyy-MM-dd"),
                time: format(d, "HH:mm"),
                length: m.avg_body_length_cm ?? 0,
                weight: m.avg_body_weight_g ?? 0,
                activity: m.activity_level_pct ?? 0,
                location: m.location ?? null,
            }
        })
        setMetricsData(formatted)
    }

    useEffect(() => {
        fetchMetrics()
    }, [selectedPondId])

    // Delete a single metric record
    const handleDeleteMetric = async (metricId: string) => {
        if (!confirm("Yakin ingin menghapus data ini?")) return
        const { error } = await supabase
            .from("pond_metrics")
            .delete()
            .eq("id", metricId)
        if (error) {
            console.error("Failed to delete metric:", error)
            return
        }
        // Re-fetch after delete
        await fetchMetrics()
    }

    // Delete all metrics for a specific day
    const handleDeleteDay = async (details: MetricRow[]) => {
        if (!confirm(`Yakin ingin menghapus semua ${details.length} data di hari ini?`)) return
        const ids = details.map((d) => d.id)
        const { error } = await supabase
            .from("pond_metrics")
            .delete()
            .in("id", ids)
        if (error) {
            console.error("Failed to delete day metrics:", error)
            return
        }
        setExpandedDate(null)
        await fetchMetrics()
    }

    // Filter by date range
    const filteredData = useMemo(() => {
        return metricsData.filter((d) => {
            if (fromDate && d.fullDate < fromDate) return false
            if (toDate && d.fullDate > toDate) return false
            return true
        })
    }, [fromDate, toDate, metricsData])

    // Group by date and compute daily summaries (sorted newest first for table)
    const dailySummaries = useMemo(() => {
        const groups: Record<string, MetricRow[]> = {}
        filteredData.forEach((row) => {
            if (!groups[row.fullDate]) groups[row.fullDate] = []
            groups[row.fullDate].push(row)
        })

        const summaries = Object.entries(groups).map(([fullDate, rows]): DailySummary => {
            const count = rows.length
            const avgLength = rows.reduce((s, r) => s + r.length, 0) / count
            const avgWeight = rows.reduce((s, r) => s + r.weight, 0) / count
            const avgActivity = rows.reduce((s, r) => s + r.activity, 0) / count

            let doc: number | null = null
            if (stockingDate) {
                doc = differenceInDays(parseISO(fullDate), stockingDate)
            }

            return {
                date: rows[0].date,
                fullDate,
                doc,
                length: Math.round(avgLength * 100) / 100,
                weight: Math.round(avgWeight * 100) / 100,
                activity: Math.round(avgActivity * 100) / 100,
                location: rows[0].location,
                count,
                details: rows,
            }
        })

        // Sort newest first for table display
        summaries.sort((a, b) => b.fullDate.localeCompare(a.fullDate))
        return summaries
    }, [filteredData, stockingDate])

    // Chart data needs chronological order (oldest first)
    const chartData = useMemo(() => {
        return [...dailySummaries].sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    }, [dailySummaries])

    return (
        <div className="container mx-auto space-y-8">
            {/* Header + Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Pond selector */}
                    <Combobox
                        items={pondNames}
                        value={selectedPondName}
                        onValueChange={(val) => {
                            if (val !== null) setSelectedPondName(val)
                        }}
                    >
                        <ComboboxInput className="w-full bg-background border-border" placeholder="Pilih Kolam" />
                        <ComboboxContent>
                            <ComboboxEmpty>Kolam tidak ditemukan.</ComboboxEmpty>
                            <ComboboxList>
                                {(item) => (
                                    <ComboboxItem key={item} value={item}>
                                        {item}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>

                    {/* Date range inputs */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
                            <Input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="h-9 w-[150px] text-sm border-border"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="h-9 w-[150px] text-sm border-border"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6">
                {chartConfigs.map((cfg, index) => (
                    <motion.div
                        key={cfg.dataKey}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {cfg.title}
                                    </h3>
                                    <cfg.icon
                                        className="w-5 h-5"
                                        style={{ color: cfg.color }}
                                    />
                                </div>
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient
                                                    id={`hist-gradient-${cfg.dataKey}`}
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="0%"
                                                        stopColor={cfg.color}
                                                        stopOpacity={0.7}
                                                    />
                                                    <stop
                                                        offset="100%"
                                                        stopColor={cfg.color}
                                                        stopOpacity={0}
                                                    />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                className="stroke-border"
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 11 }}
                                                className="text-muted-foreground"
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11 }}
                                                className="text-muted-foreground"
                                                tickLine={false}
                                                axisLine={false}
                                                width={35}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: "10px",
                                                    border: "none",
                                                    boxShadow:
                                                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                                    background: "var(--color-popover)",
                                                    color: "var(--color-popover-foreground)",
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey={cfg.dataKey}
                                                stroke={cfg.color}
                                                strokeWidth={2}
                                                fill={`url(#hist-gradient-${cfg.dataKey})`}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Detail Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-foreground mb-4">
                            Detail Data Harian
                        </h3>
                        <div className="overflow-x-auto -mx-5 px-5">
                            <table className="w-full text-sm min-w-[700px]">
                                <thead>
                                    <tr className="border-b border-border text-left">
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                                            Tanggal
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                                            DOC
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                                            Kolam
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                                            Avg Body Length
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                                            Avg Body Weight
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground whitespace-nowrap">
                                            Activity Level
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground text-center whitespace-nowrap">
                                            Rincian
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground text-center whitespace-nowrap">
                                            Aksi
                                        </th>
                                        <th className="pb-3 font-medium text-muted-foreground text-center whitespace-nowrap">
                                            Lokasi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailySummaries.map((summary) => {
                                        const isExpanded = expandedDate === summary.fullDate
                                        return (
                                            <Fragment key={summary.fullDate}>
                                                <tr className="border-b border-border/50">
                                                    <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">
                                                        {summary.date}
                                                    </td>
                                                    <td className="py-3 pr-4 text-foreground whitespace-nowrap">
                                                        {summary.doc !== null ? summary.doc : "-"}
                                                    </td>
                                                    <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                                                        {selectedPondName}
                                                    </td>
                                                    <td className="py-3 pr-4 text-foreground whitespace-nowrap">
                                                        {summary.length} cm
                                                    </td>
                                                    <td className="py-3 pr-4 text-foreground whitespace-nowrap">
                                                        {summary.weight} g
                                                    </td>
                                                    <td className="py-3 pr-4 text-foreground whitespace-nowrap">
                                                        {summary.activity} px/s
                                                    </td>
                                                    <td className="py-3 pr-4 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs gap-1"
                                                            onClick={() => setExpandedDate(isExpanded ? null : summary.fullDate)}
                                                        >
                                                            {summary.count} data
                                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        </Button>
                                                    </td>
                                                    <td className="py-3 pr-4 text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                            onClick={() => handleDeleteDay(summary.details)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {summary.details[0]?.location ? (
                                                            <button
                                                                onClick={() => {
                                                                    const loc = summary.details[0].location!;
                                                                    const match = loc.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
                                                                    if (match) {
                                                                        router.push(`/webgis?highlight_lat=${match[2]}&highlight_lng=${match[1]}`);
                                                                    }
                                                                }}
                                                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                                                title="Lihat di WebGIS"
                                                            >
                                                                <MapPin className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && summary.details.map((detail, idx) => (
                                                    <tr
                                                        key={`${summary.fullDate}-${idx}`}
                                                        className="border-b border-border/30 last:border-0 bg-muted/30"
                                                    >
                                                        <td className="py-2 pr-4 pl-6 text-muted-foreground text-xs whitespace-nowrap">
                                                            {detail.date} — {detail.time}
                                                        </td>
                                                        <td className="py-2 pr-4 text-muted-foreground text-xs">
                                                            —
                                                        </td>
                                                        <td className="py-2 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                                                            {selectedPondName}
                                                        </td>
                                                        <td className="py-2 pr-4 text-foreground text-xs whitespace-nowrap">
                                                            {detail.length} cm
                                                        </td>
                                                        <td className="py-2 pr-4 text-foreground text-xs whitespace-nowrap">
                                                            {detail.weight} g
                                                        </td>
                                                        <td className="py-2 pr-4 text-foreground text-xs whitespace-nowrap">
                                                            {detail.activity} px/s
                                                        </td>
                                                        <td></td>
                                                        <td className="py-2 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                onClick={() => handleDeleteMetric(detail.id)}
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </td>
                                                        <td className="py-2 text-center">
                                                            {detail.location ? (
                                                                <button
                                                                    onClick={() => {
                                                                        const loc = detail.location!;
                                                                        const match = loc.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
                                                                        if (match) {
                                                                            router.push(`/webgis?highlight_lat=${match[2]}&highlight_lng=${match[1]}`);
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                                                    title="Lihat di WebGIS"
                                                                >
                                                                    <MapPin className="w-3 h-3" />
                                                                </button>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}
