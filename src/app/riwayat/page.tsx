"use client"

import { useState, useMemo } from "react"
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
import { DateRangePicker } from "@/components/ui/date-range-picker"
import type { DateRange } from "react-day-picker"
import { format, subDays } from "date-fns"

// ---------- dummy data ----------

const devices = [
    "Device 1",
    "Device 2",
    "Device 3",
    "Device 4",
    "Device 5",
] as const

function generateHistoryData(days: number) {
    const today = new Date()
    return Array.from({ length: days }, (_, i) => {
        const date = subDays(today, days - 1 - i)
        return {
            date: format(date, "dd MMM"),
            fullDate: format(date, "yyyy-MM-dd"),
            length: parseFloat((Math.random() * 6 + 4).toFixed(2)),
            weight: parseFloat((Math.random() * 20 + 5).toFixed(2)),
            activity: parseFloat((Math.random() * 100).toFixed(1)),
        }
    })
}

const allData = generateHistoryData(30)

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
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 29),
        to: new Date(),
    })

    const filteredData = useMemo(() => {
        if (!dateRange?.from) return allData
        return allData.filter((d) => {
            const dt = new Date(d.fullDate)
            if (dateRange.from && dt < dateRange.from) return false
            if (dateRange.to && dt > dateRange.to) return false
            return true
        })
    }, [dateRange])

    return (
        <div className="container mx-auto space-y-8">
            {/* Header + Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {/* Device selector */}
                    <Combobox items={devices} defaultValue="Device 1">
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

                    {/* Date range picker */}
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
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
                                                    Device 1
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
