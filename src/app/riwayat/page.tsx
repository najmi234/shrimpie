"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Ruler, Weight, Activity } from "lucide-react"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { format, subDays } from "date-fns"
import { createClient } from "@/lib/supabase/client"

// ---------- types ----------

interface DeviceOption {
    id: string
    name: string
}

interface MetricRow {
    date: string
    fullDate: string
    length: number
    weight: number
    activity: number
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
        title: "Activity Level (%)",
        dataKey: "activity" as const,
        color: "#6366f1",
        icon: Activity,
    },
]

// ---------- component ----------

export default function RiwayatPage() {
    const supabase = createClient()

    const [devices, setDevices] = useState<DeviceOption[]>([])
    const [selectedDeviceName, setSelectedDeviceName] = useState<string>("")
    const [metricsData, setMetricsData] = useState<MetricRow[]>([])
    const [fromDate, setFromDate] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"))
    const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"))

    // Derive device names for combobox
    const deviceNames = useMemo(() => devices.map((d) => d.name), [devices])

    // Map device_name → device_id
    const deviceIdMap = useMemo(() => {
        const map: Record<string, string> = {}
        devices.forEach((d) => { map[d.name] = d.id })
        return map
    }, [devices])

    const selectedDeviceId = deviceIdMap[selectedDeviceName] || ""

    // Fetch devices list
    useEffect(() => {
        async function fetchDevices() {
            const { data, error } = await supabase
                .from("devices")
                .select("id, name")
                .order("name")
            if (error) {
                console.error("Failed to fetch devices:", error)
                return
            }
            const sorted = (data ?? []).sort((a, b) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            })
            setDevices(sorted)
            if (sorted.length > 0) setSelectedDeviceName(sorted[0].name)
        }
        fetchDevices()
    }, [])

    // Fetch metrics when device changes
    useEffect(() => {
        if (!selectedDeviceId) return
        async function fetchMetrics() {
            const { data, error } = await supabase
                .from("device_metrics")
                .select("avg_body_length_cm, avg_body_weight_g, activity_level_pct, recorded_at")
                .eq("device_id", selectedDeviceId)
                .order("recorded_at", { ascending: true })
            if (error) {
                console.error("Failed to fetch metrics:", error)
                return
            }
            const formatted: MetricRow[] = (data ?? []).map((m) => {
                const d = new Date(m.recorded_at)
                return {
                    date: format(d, "dd MMM"),
                    fullDate: format(d, "yyyy-MM-dd"),
                    length: m.avg_body_length_cm ?? 0,
                    weight: m.avg_body_weight_g ?? 0,
                    activity: m.activity_level_pct ?? 0,
                }
            })
            setMetricsData(formatted)
        }
        fetchMetrics()
    }, [selectedDeviceId])

    // Filter by date range
    const filteredData = useMemo(() => {
        return metricsData.filter((d) => {
            if (fromDate && d.fullDate < fromDate) return false
            if (toDate && d.fullDate > toDate) return false
            return true
        })
    }, [fromDate, toDate, metricsData])

    return (
        <div className="container mx-auto space-y-8">
            {/* Header + Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Device selector */}
                    <Combobox
                        items={deviceNames}
                        value={selectedDeviceName}
                        onValueChange={(val) => {
                            if (val !== null) setSelectedDeviceName(val)
                        }}
                    >
                        <ComboboxInput placeholder="Select a Device" />
                        <ComboboxContent>
                            <ComboboxEmpty>No items found.</ComboboxEmpty>
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
                                className="h-9 w-[150px] text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
                            <Input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="h-9 w-[150px] text-sm"
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
                                        <AreaChart data={filteredData}>
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left">
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground">
                                            Tanggal
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground">
                                            Device
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground">
                                            Avg Body Length
                                        </th>
                                        <th className="pb-3 pr-4 font-medium text-muted-foreground">
                                            Avg Body Weight
                                        </th>
                                        <th className="pb-3 font-medium text-muted-foreground">
                                            Status Aktivitas
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((row) => {
                                        const isActive = row.activity >= 50
                                        return (
                                            <tr
                                                key={row.fullDate}
                                                className="border-b border-border/50 last:border-0"
                                            >
                                                <td className="py-3 pr-4 font-medium text-foreground">
                                                    {row.date}
                                                </td>
                                                <td className="py-3 pr-4 text-muted-foreground">
                                                    {selectedDeviceName}
                                                </td>
                                                <td className="py-3 pr-4 text-foreground">
                                                    {row.length} cm
                                                </td>
                                                <td className="py-3 pr-4 text-foreground">
                                                    {row.weight} g
                                                </td>
                                                <td className="py-3 pr-4 text-foreground">
                                                    {row.activity} %
                                                </td>
                                            </tr>
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
