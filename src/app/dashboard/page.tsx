"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { motion } from "framer-motion"
import { Ruler, Weight, Activity, Sparkles } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

interface VideoEntry {
  device_id: string
  device_name: string
  file_url: string
  recorded_at: string
}

interface DeviceMetric {
  device_id: string
  avg_body_length_cm: number
  avg_body_weight_g: number
  activity_level_pct: number
  recorded_at: string
}

interface DeviceStatus {
  name: string
  status: string
  location: string
  last_update_at: string
}

function formatRecordedAt(recorded_at: string) {
  const d = new Date(recorded_at)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export default function ShrimpMonitoringDashboard() {
  const supabase = createClient()
  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>("")
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>("")
  const [metrics, setMetrics] = useState<DeviceMetric[]>([])

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus[]>([])

  // Derive unique device names from API data
  const devices = useMemo(() => {
    const unique = [...new Set(videos.map((v) => v.device_name))]
    return unique as readonly string[]
  }, [videos])

  // Map device_name to device_id for metrics query
  const deviceIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    videos.forEach((v) => {
      if (!map[v.device_name]) map[v.device_name] = v.device_id
    })
    return map
  }, [videos])

  // Get device_id for metrics query
  const selectedDeviceId = deviceIdMap[selectedDeviceName] || ""

  // Filter videos by selected device name
  const filteredVideos = useMemo(() => {
    if (!selectedDeviceName) return videos
    return videos.filter((v) => v.device_name === selectedDeviceName)
  }, [videos, selectedDeviceName])

  // Fetch videos from API
  useEffect(() => {
    async function fetchVideos() {
      try {
        const res = await fetch("https://shrimpie.qzz.io/videos")
        const data: VideoEntry[] = await res.json()
        setVideos(data)
        if (data.length > 0) {
          setSelectedDeviceName(data[0].device_name)
          setSelectedVideoUrl(data[0].file_url)
        }
      } catch (err) {
        console.error("Failed to fetch videos:", err)
      }
    }
    fetchVideos()
  }, [])

  // Fetch device metrics from Supabase using device_id
  useEffect(() => {
    if (!selectedDeviceId) return
    async function fetchMetrics() {
      const { data, error } = await supabase
        .from("device_metrics")
        .select("*")
        .eq("device_id", selectedDeviceId)
        .order("recorded_at", { ascending: true })
      console.log("[DEBUG] metrics fetch result:", { data, error })
      if (error) {
        console.error("Failed to fetch device metrics:", error)
        return
      }
      setMetrics(data ?? [])
    }
    fetchMetrics()
  }, [selectedDeviceId])

  // Build cards from metrics data
  const cards = useMemo(() => {
    console.log("selectedDeviceId:", selectedDeviceId)
    console.log("[DEBUG] metrics state:", metrics.length, "rows", metrics.slice(0, 2))
    const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null
    return [
      {
        title: "Avg Body Length (cm)",
        value: latestMetric?.avg_body_length_cm ?? 0,
        data: metrics.map((m) => ({ time: formatRecordedAt(m.recorded_at), value: m.avg_body_length_cm })),
        color: "#22c55e",
        icon: Ruler,
      },
      {
        title: "Avg Body Weight (g)",
        value: latestMetric?.avg_body_weight_g ?? 0,
        data: metrics.map((m) => ({ time: formatRecordedAt(m.recorded_at), value: m.avg_body_weight_g })),
        color: "#f59e0b",
        icon: Weight,
      },
      {
        title: "Activity Level (%)",
        value: latestMetric?.activity_level_pct ?? 0,
        data: metrics.map((m) => ({ time: formatRecordedAt(m.recorded_at), value: m.activity_level_pct })),
        color: "#6366f1",
        icon: Activity,
      },
    ]
  }, [metrics])

  // Fetch device status from Supabase
  useEffect(() => {
    async function fetchDeviceStatus() {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
      console.log("[DEBUG] devices fetch error:", error)
      console.log("[DEBUG] devices fetch data:", JSON.stringify(data, null, 2))
      if (error) {
        console.error("Failed to fetch device status:", error)
        return
      }
      setDeviceStatus(data ?? [])
    }
    fetchDeviceStatus()
  }, [])

  return (
    <div className="container mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="aspect-video bg-black rounded-xl flex items-center justify-center overflow-hidden">
                {selectedVideoUrl ? (
                  <video
                    key={selectedVideoUrl}
                    src={selectedVideoUrl}
                    controls
                    autoPlay
                    muted
                    className="w-full h-full rounded-xl"
                  />
                ) : (
                  <p className="text-muted-foreground">Loading video...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Season & Episode Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative lg:h-full"
        >
          <div className="lg:absolute lg:inset-0 w-full h-full">
            <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col min-h-0">
              <CardContent className="p-6 flex flex-col gap-3 h-full min-h-0">
                <div className="shrink-0">
                  <h2 className="text-xl font-semibold mb-3 text-foreground">Select Device</h2>
                  <Combobox
                    items={devices}
                    value={selectedDeviceName}
                    onValueChange={(val) => {
                      if (val === null) return
                      setSelectedDeviceName(val)
                      const firstVideo = videos.find((v) => v.device_name === val)
                      if (firstVideo) setSelectedVideoUrl(firstVideo.file_url)
                    }}
                  >
                    <ComboboxInput placeholder="Select a Device" />
                    <ComboboxContent>
                      <ComboboxEmpty>No devices found.</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                  <h2 className="text-xl font-semibold mb-3 text-foreground sticky top-0 bg-card py-1 z-10">Select Video</h2>
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    {filteredVideos.map((video) => (
                      <Button
                        key={video.file_url}
                        variant={selectedVideoUrl === video.file_url ? "default" : "outline"}
                        onClick={() => setSelectedVideoUrl(video.file_url)}
                        className="rounded-xl text-xs"
                      >
                        {formatRecordedAt(video.recorded_at)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/50 shrink-0">
                  <p className="text-xs text-muted-foreground mb-1">
                    Kondisi udang terlihat sehat dengan tingkat keaktifan normal.
                  </p>
                  <Button asChild className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white gap-2">
                    <Link className="text-xs" href="/chat-agent">
                      <Sparkles />
                      Analyze with AI
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Device Status Table + Realtime Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {/* Device Status Table - spans 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 md:col-span-2"
        >
          <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col h-[208px]">
              <h3 className="text-sm font-semibold text-foreground mb-3">Device Status</h3>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Device</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground">Last Update</th>
                      <th className="pb-2 font-medium text-muted-foreground">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...deviceStatus]
                      .sort((a, b) => {
                        const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                        const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                        return numA - numB
                      })
                      .map((device) => (
                        <tr key={device.name} className="border-b border-border/50 last:border-0">
                          <td className="py-2 font-medium text-foreground">{device.name}</td>
                          <td className="py-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${device.status === "Active"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${device.status === "Active" ? "bg-green-500" : "bg-red-500"
                                }`} />
                              {device.status}
                            </span>
                          </td>
                          <td className="py-2 text-muted-foreground">{device.last_update_at ? formatRecordedAt(device.last_update_at) : "-"}</td>
                          <td className="py-2 text-muted-foreground">{device.location || "-"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Remaining Metric Cards */}
        {cards.map((card, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index + 1) * 0.1 }}
          >
            <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <h3 className="text-xs font-medium text-muted-foreground">{card.title}</h3>
                  </div>
                  <card.icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
                <div className="h-28 mt-4 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={card.data}>
                      <defs>
                        <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.7} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis
                        hide
                        domain={[
                          (dataMin: number) => dataMin - 10,
                          (dataMax: number) => dataMax + 10,
                        ]}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={card.color}
                        strokeWidth={1.5}
                        fill={`url(#gradient-${index})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}