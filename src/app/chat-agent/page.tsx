"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ChatInterface from "@/components/chat/ChatInterface"
import { createClient } from "@/lib/supabase/client"
import {
    getConversations,
    deleteConversation,
    type Conversation,
} from "@/lib/chat/chat-persistence"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Loader2,
    Plus,
    MessageSquare,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"

interface PondMetric {
    pond_id: string
    avg_body_length_cm: number
    avg_body_weight_g: number
    activity_level_pct: number
    recorded_at: string
}

interface PondOption {
    id: string
    name: string
    stocking_date: string | null
}

function ChatAgentContent() {
    const supabase = createClient()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [metrics, setMetrics] = useState<PondMetric[]>([])
    const [pondList, setPondList] = useState<PondOption[]>([])
    const [selectedPondName, setSelectedPondName] = useState<string>("")
    const [loading, setLoading] = useState(true)

    // ─── User & Conversation state ──────────────────────────
    const [userId, setUserId] = useState<string | null>(null)
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConversationId, setActiveConversationId] = useState<
        string | null
    >(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [conversationsLoading, setConversationsLoading] = useState(false)
    const [initialLoadDone, setInitialLoadDone] = useState(false)

    // ─── Restore conversationId from URL on mount ───────────
    useEffect(() => {
        const convId = searchParams.get("conv")
        if (convId) {
            setActiveConversationId(convId)
        }
        setInitialLoadDone(true)
    }, [])

    // ─── Sync conversationId to URL ─────────────────────────
    useEffect(() => {
        if (!initialLoadDone) return

        const currentConv = searchParams.get("conv")
        if (activeConversationId && activeConversationId !== currentConv) {
            router.replace(`/chat-agent?conv=${activeConversationId}`, {
                scroll: false,
            })
        } else if (!activeConversationId && currentConv) {
            router.replace("/chat-agent", { scroll: false })
        }
    }, [activeConversationId, initialLoadDone])

    // Derive pond names for combobox
    const pondNames = useMemo(() => {
        return pondList.map((p) => p.name) as readonly string[]
    }, [pondList])

    // Map pond_name → pond_id
    const pondIdMap = useMemo(() => {
        const map: Record<string, string> = {}
        pondList.forEach((p) => {
            if (!map[p.name]) map[p.name] = p.id
        })
        return map
    }, [pondList])

    const selectedPondId = pondIdMap[selectedPondName] || ""

    // ─── Fetch current user ─────────────────────────────────
    useEffect(() => {
        async function fetchUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
            } else {
                console.warn("No authenticated user found — chat history will not be saved.")
            }
        }
        fetchUser()
    }, [])

    // ─── Fetch conversations ────────────────────────────────
    const loadConversations = useCallback(async () => {
        if (!userId) return
        setConversationsLoading(true)
        try {
            const convs = await getConversations(userId, 30)
            setConversations(convs)
        } catch (err) {
            console.error("Failed to load conversations:", err)
        }
        setConversationsLoading(false)
    }, [userId])

    useEffect(() => {
        loadConversations()
    }, [loadConversations])

    // ─── Fetch ponds from Supabase ─────────────────
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
            setPondList(sorted)
            if (sorted.length > 0) {
                setSelectedPondName(sorted[0].name)
            }
        }
        fetchPonds()
    }, [])

    // ─── Fetch pond_metrics when selected pond changes ──
    useEffect(() => {
        if (!selectedPondId) return
        setLoading(true)
        async function fetchMetrics() {
            const { data, error } = await supabase
                .from("pond_metrics")
                .select("*")
                .eq("pond_id", selectedPondId)
                .order("recorded_at", { ascending: true })
            if (error) {
                console.error("Failed to fetch pond metrics:", error)
                setLoading(false)
                return
            }
            setMetrics(data ?? [])
            setLoading(false)
        }
        fetchMetrics()
    }, [selectedPondId])

    // Get stocking date of selected pond
    const selectedPond = pondList.find((p) => p.id === selectedPondId)
    const stockingDate = selectedPond?.stocking_date ?? null

    // Calculate DOC based on last metric's recorded_at (not current date)
    const latestMetric =
        metrics.length > 0 ? metrics[metrics.length - 1] : null
    const doc = useMemo(() => {
        if (!stockingDate) return null
        const stocking = new Date(stockingDate)
        const endDate = latestMetric
            ? new Date(latestMetric.recorded_at)
            : new Date()
        const diffDays = Math.floor(
            (endDate.getTime() - stocking.getTime()) / (1000 * 60 * 60 * 24)
        )
        return diffDays >= 0 ? diffDays : null
    }, [stockingDate, latestMetric])

    // Build parameters from latest metric
    const pondParameters = {
        avg_weight: latestMetric?.avg_body_weight_g ?? 0,
        avg_length: latestMetric?.avg_body_length_cm ?? 0,
        activity_level: latestMetric?.activity_level_pct ?? 0,
        pondName: selectedPondName || undefined,
        metricsHistory: metrics,
        doc: doc ?? undefined,
        stocking_date: stockingDate ?? undefined,
        lastRecordedAt: latestMetric?.recorded_at ?? undefined,
    }

    // ─── Conversation handlers ──────────────────────────────
    const handleNewChat = () => {
        setActiveConversationId(null)
    }

    const handleSelectConversation = (convId: string) => {
        setActiveConversationId(convId)
    }

    const handleDeleteConversation = async (
        e: React.MouseEvent,
        convId: string
    ) => {
        e.stopPropagation()
        await deleteConversation(convId)
        if (activeConversationId === convId) {
            setActiveConversationId(null)
        }
        await loadConversations()
    }

    const handleConversationCreated = (id: string, title: string) => {
        setActiveConversationId(id)
        // Add to top of list optimistically
        setConversations((prev) => [
            {
                id,
                user_id: userId!,
                device_id: null,
                device_name: selectedPondName || null,
                title,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            ...prev,
        ])
    }

    const formatConversationDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "Baru saja"
        if (diffMins < 60) return `${diffMins} menit lalu`
        if (diffHours < 24) return `${diffHours} jam lalu`
        if (diffDays < 7) return `${diffDays} hari lalu`

        const dd = String(date.getDate()).padStart(2, "0")
        const mm = String(date.getMonth() + 1).padStart(2, "0")
        return `${dd}/${mm}/${date.getFullYear()}`
    }

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* ─── Conversation Sidebar ─────────────────────── */}
            <div
                className={`${sidebarOpen ? "w-72" : "w-0"
                    } shrink-0 transition-all duration-300 overflow-hidden border-r border-border/50 bg-muted/5`}
            >
                <div className="w-72 h-full flex flex-col">
                    {/* Sidebar Header */}
                    <div className="shrink-0 px-3 py-3 border-b border-border/50">
                        <Button
                            onClick={handleNewChat}
                            className="w-full justify-start gap-2"
                            variant="outline"
                            size="sm"
                        >
                            <Plus className="w-4 h-4" />
                            Chat Baru
                        </Button>
                    </div>

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto py-2">
                        {conversationsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="px-3 py-8 text-center">
                                <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                                <p className="text-xs text-muted-foreground">
                                    Belum ada riwayat percakapan
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-0.5 px-2">
                                {conversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        onClick={() =>
                                            handleSelectConversation(conv.id)
                                        }
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group relative ${activeConversationId === conv.id
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium text-xs leading-snug">
                                                    {conv.title ||
                                                        "Percakapan tanpa judul"}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    {conv.device_name && (
                                                        <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                                                            {conv.device_name}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] opacity-60">
                                                        {formatConversationDate(
                                                            conv.updated_at
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delete button */}
                                        <button
                                            onClick={(e) =>
                                                handleDeleteConversation(
                                                    e,
                                                    conv.id
                                                )
                                            }
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                            title="Hapus percakapan"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Main Content ──────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Device Selector Bar */}
                <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
                    <div className="max-w-4xl mx-auto flex items-center gap-3">
                        {/* Sidebar toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title={
                                sidebarOpen
                                    ? "Tutup sidebar"
                                    : "Buka sidebar"
                            }
                        >
                            {sidebarOpen ? (
                                <ChevronLeft className="w-4 h-4" />
                            ) : (
                                <ChevronRight className="w-4 h-4" />
                            )}
                        </Button>

                        <span className="text-sm font-medium text-muted-foreground shrink-0">
                            Pond:
                        </span>
                        <div className="w-64">
                            <Combobox
                                items={pondNames}
                                value={selectedPondName}
                                onValueChange={(val) => {
                                    if (val === null) return
                                    setSelectedPondName(val)
                                }}
                            >
                                <ComboboxInput className="w-full bg-background border-border" placeholder="Pilih Kolam" />
                                <ComboboxContent>
                                    <ComboboxEmpty>
                                        Tidak ada kolam.
                                    </ComboboxEmpty>
                                    <ComboboxList>
                                        {(item) => (
                                            <ComboboxItem
                                                key={item}
                                                value={item}
                                            >
                                                {item}
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                </ComboboxContent>
                            </Combobox>
                        </div>
                        {loading && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="flex-1 min-h-0">
                    <ChatInterface
                        parameters={pondParameters}
                        conversationId={activeConversationId}
                        userId={userId}
                        onConversationCreated={handleConversationCreated}
                    />
                </div>
            </div>
        </div>
    )
}

export default function ChatAgentPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <ChatAgentContent />
        </Suspense>
    )
}
