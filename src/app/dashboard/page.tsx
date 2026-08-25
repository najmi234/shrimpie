"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { motion } from "framer-motion"
import { Ruler, Weight, Activity, Sparkles, ExternalLink, Lightbulb } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { parseDateAsLocal } from "@/lib/utils"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

import { useTranslations } from "next-intl"

interface VideoEntry {
  pond_id: string
  pond_name: string
  file_url: string
  recorded_at: string
}

interface PondMetric {
  pond_id: string
  avg_body_length_cm: number
  avg_body_weight_g: number
  activity_level_pct: number
  recorded_at: string
}

// ---------- Feeding Program SOP ----------

interface FeedingStage {
  docMin: number
  docMax: number
  weightMin: number
  weightMax: number
  lengthMin: number
  lengthMax: number
  feedingRate: string
  feedFrequency: string
  phase: string
}

const feedingStages: FeedingStage[] = [
  { docMin: 1, docMax: 10, weightMin: 0, weightMax: 0.1, lengthMin: 0.6, lengthMax: 1.2, feedingRate: "-", feedFrequency: "3x/hari", phase: "Blind Feeding" },
  { docMin: 11, docMax: 20, weightMin: 0.1, weightMax: 1.5, lengthMin: 1.2, lengthMax: 2.0, feedingRate: "-", feedFrequency: "3x/hari", phase: "Blind Feeding" },
  { docMin: 21, docMax: 30, weightMin: 1.5, weightMax: 2.5, lengthMin: 2.0, lengthMax: 3.5, feedingRate: "-", feedFrequency: "4x/hari", phase: "Blind Feeding" },
  { docMin: 30, docMax: 40, weightMin: 2.5, weightMax: 3.5, lengthMin: 3.5, lengthMax: 5.5, feedingRate: "5.8–4.8%", feedFrequency: "4x/hari", phase: "Kontrol Ancho" },
  { docMin: 40, docMax: 60, weightMin: 3.5, weightMax: 8.0, lengthMin: 5.5, lengthMax: 6.5, feedingRate: "4.8–3.2%", feedFrequency: "4–5x/hari", phase: "Kontrol Ancho" },
  { docMin: 60, docMax: 80, weightMin: 8.0, weightMax: 12.5, lengthMin: 6.5, lengthMax: 8.5, feedingRate: "3.2–2.6%", feedFrequency: "5x/hari", phase: "Kontrol Ancho" },
  { docMin: 80, docMax: 100, weightMin: 12.5, weightMax: 17.5, lengthMin: 8.5, lengthMax: 10.0, feedingRate: "2.6–2.2%", feedFrequency: "5x/hari", phase: "Kontrol Ancho" },
  { docMin: 100, docMax: 120, weightMin: 17.5, weightMax: 22.0, lengthMin: 10.0, lengthMax: 11.5, feedingRate: "2.2–1.8%", feedFrequency: "5–6x/hari", phase: "Kontrol Ancho" },
  { docMin: 120, docMax: 999, weightMin: 22.0, weightMax: 999, lengthMin: 11.5, lengthMax: 999, feedingRate: "≤1.8%", feedFrequency: "6x/hari", phase: "Kontrol Ancho" },
]

function getHandlingRecommendation(doc: number | null, weight: number, length: number, activity: number, t: any): string {
  if (doc === null) return t("recommendations.noStockingDate")

  const stage = feedingStages.find((s) => doc >= s.docMin && doc <= s.docMax)
  if (!stage) return t("recommendations.outOfRange")

  const lines: string[] = []
  lines.push(t("recommendations.phase", { doc, phase: stage.phase }))
  const rateText = stage.feedingRate !== "-" ? t("recommendations.rate", { rate: stage.feedingRate }) : ""
  lines.push(t("recommendations.frequency", { frequency: stage.feedFrequency, rate: rateText }))

  // Check weight
  if (weight < stage.weightMin) {
    lines.push(t("recommendations.weightUnder", { weight, min: stage.weightMin, max: stage.weightMax }))
  } else if (weight > stage.weightMax) {
    lines.push(t("recommendations.weightOver", { weight, min: stage.weightMin, max: stage.weightMax }))
  } else {
    lines.push(t("recommendations.weightNormal", { weight, min: stage.weightMin, max: stage.weightMax }))
  }

  // Check length
  if (length < stage.lengthMin) {
    lines.push(t("recommendations.lengthUnder", { length, min: stage.lengthMin, max: stage.lengthMax }))
  } else if (length > stage.lengthMax) {
    lines.push(t("recommendations.lengthOver", { length, min: stage.lengthMin, max: stage.lengthMax }))
  } else {
    lines.push(t("recommendations.lengthNormal", { length, min: stage.lengthMin, max: stage.lengthMax }))
  }

  // Check activity level
  if (activity < 3) {
    lines.push(t("recommendations.activityVeryLow", { activity }))
  } else if (activity < 5) {
    lines.push(t("recommendations.activityLow", { activity }))
  } else if (activity > 15) {
    lines.push(t("recommendations.activityHigh", { activity }))
  } else {
    lines.push(t("recommendations.activityNormal", { activity }))
  }

  return lines.join("\n")
}

function formatRecordedAt(recorded_at: string) {
  const d = parseDateAsLocal(recorded_at)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export default function ShrimpMonitoringDashboard() {
  const supabase = createClient()
  const t = useTranslations("dashboard")
  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [selectedPondName, setSelectedPondName] = useState<string>("")
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>("")
  const [metrics, setMetrics] = useState<PondMetric[]>([])
  const [stockingDate, setStockingDate] = useState<string | null>(null)


  // Derive unique pond names from API data
  const ponds = useMemo(() => {
    const unique = [...new Set(videos.map((v) => v.pond_name))]
    return unique as readonly string[]
  }, [videos])

  // Map pond_name to pond_id for metrics query
  const pondIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    videos.forEach((v) => {
      if (!map[v.pond_name]) map[v.pond_name] = v.pond_id
    })
    return map
  }, [videos])

  // Get pond_id for metrics query
  const selectedPondId = pondIdMap[selectedPondName] || ""

  // Filter videos by selected pond name
  const filteredVideos = useMemo(() => {
    if (!selectedPondName) return videos
    return videos.filter((v) => v.pond_name === selectedPondName)
  }, [videos, selectedPondName])

  // Fetch videos from Supabase
  useEffect(() => {
    async function fetchVideos() {
      try {
        const { data, error } = await supabase
          .from("videos")
          .select("pond_id, pond_name, file_url, recorded_at")
          .order("recorded_at", { ascending: false })
        if (error) throw error
        const videos = (data ?? []) as VideoEntry[]
        setVideos(videos)
        if (videos.length > 0) {
          setSelectedPondName(videos[0].pond_name)
          setSelectedVideoUrl(videos[0].file_url)
        }
      } catch (err) {
        console.error("Failed to fetch videos:", err)
      }
    }
    fetchVideos()
  }, [])

  // Fetch stocking_date for selected pond
  useEffect(() => {
    if (!selectedPondId) return
    async function fetchStockingDate() {
      const { data, error } = await supabase
        .from("ponds")
        .select("stocking_date")
        .eq("id", selectedPondId)
        .single()
      if (error) {
        console.error("Failed to fetch stocking_date:", error)
        setStockingDate(null)
        return
      }
      setStockingDate(data?.stocking_date ?? null)
    }
    fetchStockingDate()
  }, [selectedPondId])

  // Fetch pond metrics from Supabase using pond_id
  useEffect(() => {
    if (!selectedPondId) return
    async function fetchMetrics() {
      const { data, error } = await supabase
        .from("pond_metrics")
        .select("*")
        .eq("pond_id", selectedPondId)
        .order("recorded_at", { ascending: true })
      console.log("[DEBUG] metrics fetch result:", { data, error })
      if (error) {
        console.error("Failed to fetch pond metrics:", error)
        return
      }
      setMetrics(data ?? [])
    }
    fetchMetrics()
  }, [selectedPondId])

  // Build cards from metrics data
  const cards = useMemo(() => {
    console.log("selectedPondId:", selectedPondId)
    console.log("[DEBUG] metrics state:", metrics.length, "rows", metrics.slice(0, 2))
    const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null
    return [
      {
        title: t("avgBodyLength"),
        value: latestMetric?.avg_body_length_cm ?? 0,
        data: metrics.map((m) => ({ time: formatRecordedAt(m.recorded_at), value: m.avg_body_length_cm })),
        color: "#22c55e",
        icon: Ruler,
      },
      {
        title: t("avgBodyWeight"),
        value: latestMetric?.avg_body_weight_g ?? 0,
        data: metrics.map((m) => ({ time: formatRecordedAt(m.recorded_at), value: m.avg_body_weight_g })),
        color: "#f59e0b",
        icon: Weight,
      },
      {
        title: t("activityLevel"),
        value: latestMetric?.activity_level_pct ?? 0,
        data: metrics.map((m) => ({ time: formatRecordedAt(m.recorded_at), value: m.activity_level_pct })),
        color: "#6366f1",
        icon: Activity,
      },
    ]
  }, [metrics, selectedPondId, t])

  // Calculate DOC based on last metric's recorded_at (not current date)
  const latestMetricRecord = metrics.length > 0 ? metrics[metrics.length - 1] : null
  const doc = useMemo(() => {
    if (!stockingDate) return null
    const stocking = new Date(stockingDate)
    const endDate = latestMetricRecord
      ? parseDateAsLocal(latestMetricRecord.recorded_at)
      : new Date()
    return Math.floor((endDate.getTime() - stocking.getTime()) / (1000 * 60 * 60 * 24))
  }, [stockingDate, latestMetricRecord])

  const recommendation = useMemo(() => {
    if (metrics.length === 0) return null
    const latest = metrics[metrics.length - 1]
    return getHandlingRecommendation(doc, latest.avg_body_weight_g, latest.avg_body_length_cm, latest.activity_level_pct, t)
  }, [metrics, doc, t])


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
                  <p className="text-muted-foreground">{t("loadingVideo")}</p>
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
                  <h2 className="text-xl font-semibold mb-3 text-foreground">{t("selectPond")}</h2>
                  <Combobox
                    items={ponds}
                    value={selectedPondName}
                    onValueChange={(val) => {
                      if (val === null) return
                      setSelectedPondName(val)
                      const firstVideo = videos.find((v) => v.pond_name === val)
                      if (firstVideo) setSelectedVideoUrl(firstVideo.file_url)
                    }}
                  >
                    <ComboboxInput className="w-full bg-background border-border" placeholder={t("selectPondPlaceholder")} />
                    <ComboboxContent>
                      <ComboboxEmpty>{t("noPondsFound")}</ComboboxEmpty>
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

                <div className="flex-1 overflow-y-auto min-h-0 max-h-48 lg:max-h-none pr-2 custom-scrollbar">
                  <h2 className="text-xl font-semibold mb-3 text-foreground sticky top-0 bg-card py-1 z-10">{t("selectVideo")}</h2>
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    {filteredVideos.map((video, index) => (
                      <Button
                        key={`${video.file_url}-${video.recorded_at}-${index}`}
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
                    {t("shrimpHealthy")}
                  </p>
                  <Button asChild className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white gap-2">
                    <Link className="text-xs" href="/chat-agent">
                      <Sparkles />
                      {t("analyzeWithAI")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Handling Recommendation + Realtime Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {/* Handling Recommendation Card - spans 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 md:col-span-2"
        >
          <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col h-[208px]">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-foreground">{t("handlingRecommendation")}</h3>
              </div>
              <div className="flex-1 overflow-auto bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 custom-scrollbar">
                {recommendation ? (
                  <>
                    {latestMetricRecord && (
                      <p className="text-[11px] text-muted-foreground mb-2 pb-2">
                        📊 {t("lastData")}: {formatRecordedAt(latestMetricRecord.recorded_at)}
                        {doc !== null ? ` · ${t("docDays", { doc })}` : ""}
                      </p>
                    )}
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {recommendation}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic flex h-full items-center justify-center">
                    {t("noMetrics")}
                  </p>
                )}
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