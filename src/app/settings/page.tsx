"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft,
    Shell,
    Cpu,
    Save,
    Check,
    Loader2,
    MapPin,
    Pencil,
    Trash2,
    Plus,
    Shield,
    Bot,
    BookOpen,
    UploadCloud,
    FileText,
    Layers,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Search,
    Sliders,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useTranslations } from "next-intl"
import { parseDateAsLocal } from "@/lib/utils"

// ---------- types ----------

interface Pond {
    id: string
    name: string
    stocking_date: string | null
    location: string | null
}

interface Device {
    id: string
    name: string
    status: string
    location: string | null
    last_update_at: string | null
    pond_id: string | null
}

interface KnowledgeDocument {
    id: string
    filename: string
    source: string
    version: number
    chunk_count: number
    embedding_model: string
    created_at: string
    status: string
}

// ---------- settings menu ----------

interface SettingsCategory {
    id: string
    label: string
    description: string
    icon: React.ElementType
}

// ---------- component ----------

export default function SettingsPage() {
    const supabase = createClient()
    const t = useTranslations("settings")
    const tCommon = useTranslations("common")
    const categories: SettingsCategory[] = [
        {
            id: "pond",
            label: t("pondSettings.label"),
            description: t("pondSettings.description"),
            icon: Shell,
        },
        {
            id: "device",
            label: t("deviceSettings.label"),
            description: t("deviceSettings.description"),
            icon: Cpu,
        },
        {
            id: "rag_ai",
            label: t("aiSettings.label"),
            description: t("aiSettings.description"),
            icon: Bot,
        },
        {
            id: "knowledge_base",
            label: "Knowledge Base & Dokumen SOP",
            description: "Upload dokumen PDF/MD/TXT dan inspeksi status chunking vector database.",
            icon: BookOpen,
        },
    ]

    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [authorized, setAuthorized] = useState<boolean | null>(null)

    // ----- Check user authorization -----
    useEffect(() => {
        async function checkRole() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setAuthorized(false)
                return
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("user_role")
                .eq("id", user.id)
                .single()

            if (profile?.user_role === "admin") {
                setAuthorized(true)
            } else {
                setAuthorized(false)
            }
        }
        checkRole()
    }, [supabase])

    // ----- Pond state -----
    const [ponds, setPonds] = useState<Pond[]>([])
    const [editedPonds, setEditedPonds] = useState<Record<string, Partial<Pond>>>({})
    const [pondSaving, setPondSaving] = useState<Record<string, boolean>>({})
    const [pondSaved, setPondSaved] = useState<Record<string, boolean>>({})

    // ----- Device state -----
    const [devices, setDevices] = useState<Device[]>([])
    const [editedDevices, setEditedDevices] = useState<Record<string, Partial<Device>>>({})
    const [deviceSaving, setDeviceSaving] = useState<Record<string, boolean>>({})
    const [deviceSaved, setDeviceSaved] = useState<Record<string, boolean>>({})

    // ----- RAG/AI state -----
    const [aiSettings, setAiSettings] = useState({
        llm_api_key: "",
        llm_model: "",
        embedding_api_key: "",
        embedding_model: "",
        llm_provider_url: "",
        embedding_provider_url: "",
        rag_similarity_threshold: "0.35",
    })
    const [aiLoading, setAiLoading] = useState(false)
    const [aiSaving, setAiSaving] = useState(false)
    const [aiSaved, setAiSaved] = useState(false)
    const [showApiKey, setShowApiKey] = useState(false)
    const [showEmbeddingApiKey, setShowEmbeddingApiKey] = useState(false)

    // ----- Knowledge Base state -----
    const [kbDocuments, setKbDocuments] = useState<KnowledgeDocument[]>([])
    const [docSearchQuery, setDocSearchQuery] = useState<string>("")
    const [docVersionFilter, setDocVersionFilter] = useState<string>("all")
    const [kbVersions, setKbVersions] = useState<any[]>([])
    const [selectedKbVersionId, setSelectedKbVersionId] = useState<string>("")
    const [versionLoading, setVersionLoading] = useState<boolean>(false)
    const [kbVersion, setKbVersion] = useState<number>(1)
    const [kbTotalChunks, setKbTotalChunks] = useState<number>(0)
    const [kbEmbeddingModel, setKbEmbeddingModel] = useState<string>("openai/text-embedding-3-small")
    const [kbLoading, setKbLoading] = useState<boolean>(false)
    const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
    const [uploadStatus, setUploadStatus] = useState<"idle" | "Processing" | "Ready" | "Failed">("idle")
    const [uploadProgressMsg, setUploadProgressMsg] = useState<string>("")
    const [uploading, setUploading] = useState<boolean>(false)
    const [deleteDocTarget, setDeleteDocTarget] = useState<KnowledgeDocument | null>(null)
    const [deleteDocLoading, setDeleteDocLoading] = useState<boolean>(false)

    // ----- Add/Delete state -----
    const [addPondOpen, setAddPondOpen] = useState(false)
    const [newPondName, setNewPondName] = useState("")
    const [newPondStockingDate, setNewPondStockingDate] = useState("")
    const [newPondLocation, setNewPondLocation] = useState("")
    const [addPondLoading, setAddPondLoading] = useState(false)

    const [addDeviceOpen, setAddDeviceOpen] = useState(false)
    const [newDeviceName, setNewDeviceName] = useState("")
    const [newDevicePondId, setNewDevicePondId] = useState("")
    const [addDeviceLoading, setAddDeviceLoading] = useState(false)

    const [deleteTarget, setDeleteTarget] = useState<{ type: "pond" | "device"; id: string; name: string } | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // ----- Fetch ponds -----
    useEffect(() => {
        if (activeCategory !== "pond") return
        async function fetchPonds() {
            const { data, error } = await supabase
                .from("ponds")
                .select("id, name, stocking_date, location")
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
        }
        fetchPonds()
    }, [activeCategory])

    // ----- Fetch devices -----
    useEffect(() => {
        if (activeCategory !== "device") return
        async function fetchDevices() {
            const { data, error } = await supabase
                .from("device_status_monitor")
                .select("id, name, status, location, last_update_at")
            if (error) {
                console.error("Failed to fetch devices:", error)
                return
            }

            // Fetch pond_id from the actual devices table
            const { data: devicesData, error: devicesError } = await supabase
                .from("devices")
                .select("id, pond_id")
            if (devicesError) {
                console.error("Failed to fetch device pond assignments:", devicesError)
            }

            const pondIdMap = new Map<string, string | null>()
            for (const d of devicesData ?? []) {
                pondIdMap.set(d.id, d.pond_id)
            }

            const sorted = (data ?? []).map((d: any) => ({
                ...d,
                pond_id: pondIdMap.get(d.id) ?? null,
            })).sort((a: any, b: any) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            })
            setDevices(sorted)
        }
        async function fetchPondsForDevices() {
            const { data, error } = await supabase
                .from("ponds")
                .select("id, name, stocking_date, location")
                .order("name")
            if (error) {
                console.error("Failed to fetch ponds for devices:", error)
                return
            }
            const sorted = (data ?? []).sort((a: any, b: any) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            })
            setPonds(sorted)
        }
        fetchDevices()
        fetchPondsForDevices()
    }, [activeCategory])

    // ----- Fetch RAG/AI settings -----
    useEffect(() => {
        if (activeCategory !== "rag_ai") return
        async function fetchAiSettings() {
            setAiLoading(true)
            const { data, error } = await supabase
                .from("system_settings")
                .select("key, value")
            setAiLoading(false)
            if (error) {
                console.error("Failed to fetch system settings:", error)
                return
            }
            const settingsMap = new Map<string, string>()
            data?.forEach((row) => {
                settingsMap.set(row.key, row.value)
            })
            setAiSettings({
                llm_api_key: settingsMap.get("llm_api_key") ?? settingsMap.get("openrouter_api_key") ?? "",
                llm_model: settingsMap.get("llm_model") ?? settingsMap.get("openrouter_model") ?? "tencent/hy3:free",
                embedding_api_key: settingsMap.get("embedding_api_key") ?? "",
                embedding_model: settingsMap.get("embedding_model") ?? "openai/text-embedding-3-small",
                llm_provider_url: settingsMap.get("llm_provider_url") ?? settingsMap.get("provider_url") ?? "https://openrouter.ai/api/v1",
                embedding_provider_url: settingsMap.get("embedding_provider_url") ?? "https://openrouter.ai/api/v1",
                rag_similarity_threshold: settingsMap.get("rag_similarity_threshold") ?? "0.35",
            })
        }
        fetchAiSettings()
    }, [activeCategory])

    // ----- Fetch Knowledge Base documents -----
    const fetchKbDocuments = async () => {
        setKbLoading(true)
        try {
            const res = await fetch("/api/admin/knowledge/list")
            const data = await res.json()
            if (data.success) {
                setKbDocuments(data.documents || [])
                setKbVersion(data.activeVersion || 1)
                setKbTotalChunks(data.totalChunks || 0)
                setKbEmbeddingModel(data.embeddingModel || "openai/text-embedding-3-small")
            }
        } catch (err) {
            console.error("Failed to fetch KB documents:", err)
        } finally {
            setKbLoading(false)
        }
    }

    // ----- Fetch KB Versions -----
    const fetchKbVersions = async () => {
        try {
            const res = await fetch("/api/admin/knowledge/version")
            const data = await res.json()
            if (data.success && data.versions) {
                setKbVersions(data.versions)
                const active = data.versions.find((v: any) => v.status === "ACTIVE")
                if (active) setSelectedKbVersionId(active.id)
            }
        } catch (err) {
            console.error("Failed to fetch KB versions:", err)
        }
    }

    const handleCreateNewVersion = async () => {
        setVersionLoading(true)
        try {
            const res = await fetch("/api/admin/knowledge/version", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create" }),
            })
            const data = await res.json()
            if (data.success) {
                await fetchKbVersions()
                await fetchKbDocuments()
            }
        } catch (err) {
            console.error("Create version error:", err)
        } finally {
            setVersionLoading(false)
        }
    }

    const handleActivateVersion = async (targetId: string) => {
        setVersionLoading(true)
        try {
            const res = await fetch("/api/admin/knowledge/version", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "activate", kbId: targetId }),
            })
            const data = await res.json()
            if (data.success) {
                await fetchKbVersions()
                await fetchKbDocuments()
            }
        } catch (err) {
            console.error("Activate version error:", err)
        } finally {
            setVersionLoading(false)
        }
    }

    useEffect(() => {
        if (activeCategory === "knowledge_base") {
            fetchKbDocuments()
            fetchKbVersions()
        }
    }, [activeCategory])

    // ----- Upload Knowledge File handler -----
    const handleUploadKnowledgeFile = async () => {
        if (!selectedUploadFile) return
        setUploading(true)
        setUploadStatus("Processing")
        setUploadProgressMsg("Membaca dokumen, mengekstrak teks, chunking, & generating embeddings...")

        try {
            const formData = new FormData()
            formData.append("file", selectedUploadFile)

            const res = await fetch("/api/admin/knowledge/upload", {
                method: "POST",
                body: formData,
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Gagal mengunggah dokumen.")
            }

            setUploadStatus("Ready")
            setUploadProgressMsg(`Dokumen "${data.filename}" berhasil diproses (${data.chunkCount} chunks, Knowledge Base v${data.version}).`)
            setSelectedUploadFile(null)
            fetchKbDocuments()
        } catch (err: any) {
            setUploadStatus("Failed")
            setUploadProgressMsg(err.message || "Gagal mengunggah dokumen.")
        } finally {
            setUploading(false)
        }
    }

    // ----- Delete Knowledge Document handler -----
    const handleDeleteKnowledgeDoc = async () => {
        if (!deleteDocTarget) return
        setDeleteDocLoading(true)
        try {
            const params = new URLSearchParams()
            if (deleteDocTarget.id) params.set("id", deleteDocTarget.id)
            if (deleteDocTarget.filename) params.set("filename", deleteDocTarget.filename)

            const res = await fetch(`/api/admin/knowledge/list?${params.toString()}`, {
                method: "DELETE",
            })
            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Gagal menghapus dokumen.")
            }

            setKbDocuments((prev) => prev.filter((d) => d.id !== deleteDocTarget.id && d.filename !== deleteDocTarget.filename))
            setDeleteDocTarget(null)
        } catch (err: any) {
            console.error("Delete doc error:", err)
        } finally {
            setDeleteDocLoading(false)
        }
    }

    const handleSaveAiSettings = async () => {
        setAiSaving(true)
        const keysToSave = Object.entries(aiSettings)
        const upsertData = keysToSave.map(([key, value]) => ({
            key,
            value,
            updated_at: new Date().toISOString()
        }))

        const { error } = await supabase
            .from("system_settings")
            .upsert(upsertData, { onConflict: "key" })

        setAiSaving(false)
        if (error) {
            console.error("Failed to save AI settings:", error)
            return
        }

        setAiSaved(true)
        setTimeout(() => setAiSaved(false), 2000)
    }

    // ----- Pond handlers -----
    const handlePondFieldChange = (pondId: string, field: keyof Pond, value: string) => {
        setEditedPonds((prev) => ({
            ...prev,
            [pondId]: { ...prev[pondId], [field]: value },
        }))
        // Clear saved state when editing
        setPondSaved((prev) => ({ ...prev, [pondId]: false }))
    }

    const handleSavePond = async (pond: Pond) => {
        const edits = editedPonds[pond.id]
        if (!edits) return

        setPondSaving((prev) => ({ ...prev, [pond.id]: true }))
        const { error } = await supabase
            .from("ponds")
            .update({
                name: edits.name ?? pond.name,
                stocking_date: edits.stocking_date ?? pond.stocking_date,
                location: edits.location ?? pond.location,
            })
            .eq("id", pond.id)

        setPondSaving((prev) => ({ ...prev, [pond.id]: false }))

        if (error) {
            console.error("Failed to save pond:", error)
            return
        }

        // Update local state
        setPonds((prev) =>
            prev.map((p) =>
                p.id === pond.id
                    ? {
                        ...p,
                        name: edits.name ?? p.name,
                        stocking_date: edits.stocking_date ?? p.stocking_date,
                        location: edits.location ?? p.location,
                    }
                    : p
            )
        )
        setEditedPonds((prev) => {
            const next = { ...prev }
            delete next[pond.id]
            return next
        })
        setPondSaved((prev) => ({ ...prev, [pond.id]: true }))
        setTimeout(() => setPondSaved((prev) => ({ ...prev, [pond.id]: false })), 2000)
    }

    // ----- Device handlers -----
    const handleDeviceFieldChange = (deviceId: string, field: keyof Device, value: string) => {
        setEditedDevices((prev) => ({
            ...prev,
            [deviceId]: { ...prev[deviceId], [field]: value },
        }))
        setDeviceSaved((prev) => ({ ...prev, [deviceId]: false }))
    }

    const handleSaveDevice = async (device: Device) => {
        const edits = editedDevices[device.id]
        if (!edits) return

        setDeviceSaving((prev) => ({ ...prev, [device.id]: true }))

        // Save name to device_status_monitor
        if (edits.name) {
            const { error } = await supabase
                .from("device_status_monitor")
                .update({ name: edits.name })
                .eq("id", device.id)
            if (error) {
                console.error("Failed to save device name:", error)
                setDeviceSaving((prev) => ({ ...prev, [device.id]: false }))
                return
            }
        }

        // Save pond_id to the devices table
        if (edits.pond_id !== undefined) {
            const { error } = await supabase
                .from("devices")
                .update({ pond_id: edits.pond_id })
                .eq("id", device.id)
            if (error) {
                console.error("Failed to save device pond assignment:", error)
                setDeviceSaving((prev) => ({ ...prev, [device.id]: false }))
                return
            }
        }

        setDeviceSaving((prev) => ({ ...prev, [device.id]: false }))

        setDevices((prev) =>
            prev.map((d) =>
                d.id === device.id
                    ? {
                        ...d,
                        name: edits.name ?? d.name,
                        pond_id: edits.pond_id !== undefined ? edits.pond_id : d.pond_id,
                    }
                    : d
            )
        )
        setEditedDevices((prev) => {
            const next = { ...prev }
            delete next[device.id]
            return next
        })
        setDeviceSaved((prev) => ({ ...prev, [device.id]: true }))
        setTimeout(() => setDeviceSaved((prev) => ({ ...prev, [device.id]: false })), 2000)
    }

    // ----- Add Pond handler -----
    const handleAddPond = async () => {
        if (!newPondName.trim()) return
        setAddPondLoading(true)
        const { data, error } = await supabase
            .from("ponds")
            .insert({
                name: newPondName.trim(),
                stocking_date: newPondStockingDate || null,
                location: newPondLocation.trim() || null,
            })
            .select("id, name, stocking_date, location")
            .single()
        setAddPondLoading(false)
        if (error) {
            console.error("Failed to add pond:", error)
            return
        }
        if (data) {
            setPonds((prev) => [...prev, data].sort((a, b) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            }))
        }
        setNewPondName("")
        setNewPondStockingDate("")
        setNewPondLocation("")
        setAddPondOpen(false)
    }

    // ----- Add Device handler -----
    const handleAddDevice = async () => {
        if (!newDeviceName.trim()) return
        setAddDeviceLoading(true)
        const { data, error } = await supabase
            .from("device_status_monitor")
            .insert({
                name: newDeviceName.trim(),
                status: "inactive",
            })
            .select("id, name, status, location, last_update_at")
            .single()
        setAddDeviceLoading(false)
        if (error) {
            console.error("Failed to add device:", error)
            return
        }
        if (data) {
            const newDevice: Device = { ...data, pond_id: newDevicePondId || null }
            // Also insert into devices table if pond_id is set
            if (newDevicePondId) {
                await supabase.from("devices").insert({ id: data.id, pond_id: newDevicePondId })
            }
            setDevices((prev) => [...prev, newDevice].sort((a, b) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            }))
        }
        setNewDeviceName("")
        setNewDevicePondId("")
        setAddDeviceOpen(false)
    }

    // ----- Delete handler -----
    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleteLoading(true)
        const table = deleteTarget.type === "pond" ? "ponds" : "device_status_monitor"
        const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id)
        setDeleteLoading(false)
        if (error) {
            console.error(`Failed to delete ${deleteTarget.type}:`, error)
            return
        }
        if (deleteTarget.type === "pond") {
            setPonds((prev) => prev.filter((p) => p.id !== deleteTarget.id))
        } else {
            setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id))
        }
        setDeleteTarget(null)
    }

    // ----- Render: main menu -----
    const renderMenu = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
            {categories.map((cat, index) => (
                <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                >
                    <Card
                        className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-primary/30"
                        onClick={() => setActiveCategory(cat.id)}
                    >
                        <CardContent className="p-6 flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                <cat.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground mb-1">{cat.label}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            ))}
        </motion.div>
    )

    // ----- Render: pond settings -----
    const renderPondSettings = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
        >
            {/* Add Pond Button */}
            <div className="flex justify-end">
                <Dialog open={addPondOpen} onOpenChange={setAddPondOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 rounded-xl">
                            <Plus className="w-4 h-4" />
                            {t("pondSettings.addPond")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{t("pondSettings.addPondTitle")}</DialogTitle>
                            <DialogDescription>{t("pondSettings.addPondDescription")}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t("pondSettings.pondName")} *</label>
                                <Input value={newPondName} onChange={(e) => setNewPondName(e.target.value)} placeholder="Kolam 1" className="h-9 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t("pondSettings.stockingDate")}</label>
                                <Input type="date" value={newPondStockingDate} onChange={(e) => setNewPondStockingDate(e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t("pondSettings.locationLabel")}</label>
                                <Input value={newPondLocation} onChange={(e) => setNewPondLocation(e.target.value)} placeholder="112.820783, -7.270499" className="h-9 text-sm" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddPondOpen(false)}>{tCommon("cancel")}</Button>
                            <Button onClick={handleAddPond} disabled={!newPondName.trim() || addPondLoading} className="gap-2">
                                {addPondLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {tCommon("add")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {ponds.length === 0 ? (
                <Card className="rounded-2xl py-0 border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        {t("pondSettings.noPonds")}
                    </CardContent>
                </Card>
            ) : (
                ponds.map((pond, index) => {
                    const edited = editedPonds[pond.id]
                    const hasChanges = !!edited
                    const saving = pondSaving[pond.id]
                    const saved = pondSaved[pond.id]

                    return (
                        <motion.div
                            key={pond.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                                                <Shell className="w-5 h-5 text-teal-500" />
                                            </div>
                                            <div className="sm:hidden">
                                                <p className="text-xs text-muted-foreground">{t("pondSettings.pondName")}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("pondSettings.pondName")}</label>
                                                <Input
                                                    value={edited?.name ?? pond.name}
                                                    onChange={(e) => handlePondFieldChange(pond.id, "name", e.target.value)}
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("pondSettings.stockingDate")}</label>
                                                <Input
                                                    type="date"
                                                    value={edited?.stocking_date ?? pond.stocking_date ?? ""}
                                                    onChange={(e) => handlePondFieldChange(pond.id, "stocking_date", e.target.value)}
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("pondSettings.locationLabel")}</label>
                                                <Input
                                                    value={edited?.location ?? pond.location ?? ""}
                                                    onChange={(e) => handlePondFieldChange(pond.id, "location", e.target.value)}
                                                    placeholder="112.820783, -7.270499"
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div className="flex items-end gap-2">
                                                <Button
                                                    size="sm"
                                                    disabled={!hasChanges || saving}
                                                    onClick={() => handleSavePond(pond)}
                                                    className="h-9 gap-2 flex-1 sm:flex-none"
                                                    variant={saved ? "outline" : "default"}
                                                >
                                                    {saving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : saved ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Save className="w-4 h-4" />
                                                    )}
                                                    {saving ? tCommon("saving") : saved ? tCommon("saved") : tCommon("save")}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                                                    onClick={() => setDeleteTarget({ type: "pond", id: pond.id, name: pond.name })}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )
                })
            )}
        </motion.div>
    )

    // ----- Render: device settings -----
    const renderDeviceSettings = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
        >
            {/* Add Device Button */}
            <div className="flex justify-end">
                <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 rounded-xl">
                            <Plus className="w-4 h-4" />
                            {t("deviceSettings.addDevice")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{t("deviceSettings.addDeviceTitle")}</DialogTitle>
                            <DialogDescription>{t("deviceSettings.addDeviceDescription")}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t("deviceSettings.deviceName")} *</label>
                                <Input value={newDeviceName} onChange={(e) => setNewDeviceName(e.target.value)} placeholder="Device 1" className="h-9 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">{t("deviceSettings.pondOptional")}</label>
                                <Combobox
                                    items={ponds.map(p => p.name)}
                                    value={ponds.find(p => p.id === newDevicePondId)?.name ?? ""}
                                    onValueChange={(val) => {
                                        if (val !== null) {
                                            const selectedPond = ponds.find(p => p.name === val)
                                            if (selectedPond) setNewDevicePondId(selectedPond.id)
                                        }
                                    }}
                                >
                                    <ComboboxInput className="w-full bg-background border-border h-9 text-sm" placeholder={t("deviceSettings.selectPondPlaceholder")} />
                                    <ComboboxContent>
                                        <ComboboxEmpty>{t("deviceSettings.noPondFound")}</ComboboxEmpty>
                                        <ComboboxList>
                                            {(item) => (
                                                <ComboboxItem key={item} value={item}>{item}</ComboboxItem>
                                            )}
                                        </ComboboxList>
                                    </ComboboxContent>
                                </Combobox>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddDeviceOpen(false)}>{tCommon("cancel")}</Button>
                            <Button onClick={handleAddDevice} disabled={!newDeviceName.trim() || addDeviceLoading} className="gap-2">
                                {addDeviceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {tCommon("add")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {devices.length === 0 ? (
                <Card className="rounded-2xl py-0 border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        {t("deviceSettings.noDevices")}
                    </CardContent>
                </Card>
            ) : (
                devices.map((device, index) => {
                    const edited = editedDevices[device.id]
                    const hasChanges = !!edited
                    const saving = deviceSaving[device.id]
                    const saved = deviceSaved[device.id]

                    const statusColor = device.status?.toLowerCase() === "active"
                        ? "bg-green-500"
                        : "bg-red-500"
                    const statusLabel = device.status?.toLowerCase() === "active"
                        ? t("deviceSettings.active")
                        : t("deviceSettings.inactive")

                    const lastUpdate = device.last_update_at
                        ? parseDateAsLocal(device.last_update_at).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "-"

                    return (
                        <motion.div
                            key={device.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                                <Cpu className="w-5 h-5 text-indigo-500" />
                                            </div>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("deviceSettings.deviceName")}</label>
                                                <Input
                                                    value={edited?.name ?? device.name}
                                                    onChange={(e) => handleDeviceFieldChange(device.id, "name", e.target.value)}
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("deviceSettings.pondLabel")}</label>
                                                <Combobox
                                                    items={ponds.map(p => p.name)}
                                                    value={(() => {
                                                        const pid = edited?.pond_id !== undefined ? edited.pond_id : device.pond_id;
                                                        return ponds.find(p => p.id === pid)?.name ?? "";
                                                    })()}
                                                    onValueChange={(val) => {
                                                        if (val !== null) {
                                                            const selectedPond = ponds.find(p => p.name === val);
                                                            if (selectedPond) {
                                                                handleDeviceFieldChange(device.id, "pond_id", selectedPond.id);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <ComboboxInput className="w-full bg-background border-border h-9 text-sm" placeholder={t("deviceSettings.selectPondPlaceholder")} />
                                                    <ComboboxContent>
                                                        <ComboboxEmpty>{t("deviceSettings.noPondFound")}</ComboboxEmpty>
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
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("deviceSettings.status")}</label>
                                                <div className="h-9 flex items-center gap-2 px-3 rounded-md bg-muted/50 border border-border">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                                                    <span className="text-sm text-foreground">{statusLabel}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">{t("deviceSettings.lastUpdate")}</label>
                                                <div className="h-9 flex items-center px-3 rounded-md bg-muted/50 border border-border">
                                                    <span className="text-sm text-muted-foreground">{lastUpdate}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-end gap-2">
                                                <Button
                                                    size="sm"
                                                    disabled={!hasChanges || saving}
                                                    onClick={() => handleSaveDevice(device)}
                                                    className="h-9 gap-2 flex-1 sm:flex-none"
                                                    variant={saved ? "outline" : "default"}
                                                >
                                                    {saving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : saved ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Save className="w-4 h-4" />
                                                    )}
                                                    {saving ? tCommon("saving") : saved ? tCommon("saved") : tCommon("save")}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                                                    onClick={() => setDeleteTarget({ type: "device", id: device.id, name: device.name })}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )
                })
            )}
        </motion.div>
    )

    // ----- Render: RAG/AI settings -----
    const renderAiSettings = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
        >
            {aiLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                    {t("aiSettings.apiKey")}
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showApiKey ? "text" : "password"}
                                        value={aiSettings.llm_api_key}
                                        onChange={(e) =>
                                            setAiSettings((prev) => ({
                                                ...prev,
                                                llm_api_key: e.target.value,
                                            }))
                                        }
                                        className="h-9 text-sm pr-10"
                                        placeholder="..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium"
                                    >
                                        {showApiKey ? tCommon("hide") || "Sembunyikan" : tCommon("show") || "Tampilkan"}
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                    {t("aiSettings.embeddingApiKey")}
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showEmbeddingApiKey ? "text" : "password"}
                                        value={aiSettings.embedding_api_key}
                                        onChange={(e) =>
                                            setAiSettings((prev) => ({
                                                ...prev,
                                                embedding_api_key: e.target.value,
                                            }))
                                        }
                                        className="h-9 text-sm pr-10"
                                        placeholder="..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowEmbeddingApiKey(!showEmbeddingApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-medium"
                                    >
                                        {showEmbeddingApiKey ? tCommon("hide") || "Sembunyikan" : tCommon("show") || "Tampilkan"}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                    {t("aiSettings.llmModel")}
                                </label>
                                <Input
                                    value={aiSettings.llm_model}
                                    onChange={(e) =>
                                        setAiSettings((prev) => ({
                                            ...prev,
                                            llm_model: e.target.value,
                                        }))
                                    }
                                    className="h-9 text-sm"
                                    placeholder="tencent/hy3:free"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                    {t("aiSettings.embeddingModel")}
                                </label>
                                <Input
                                    value={aiSettings.embedding_model}
                                    onChange={(e) =>
                                        setAiSettings((prev) => ({
                                            ...prev,
                                            embedding_model: e.target.value,
                                        }))
                                    }
                                    className="h-9 text-sm"
                                    placeholder="openai/text-embedding-3-small"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                    {t("aiSettings.llmProviderUrl")}
                                </label>
                                <Input
                                    value={aiSettings.llm_provider_url}
                                    onChange={(e) =>
                                        setAiSettings((prev) => ({
                                            ...prev,
                                            llm_provider_url: e.target.value,
                                        }))
                                    }
                                    className="h-9 text-sm"
                                    placeholder="https://openrouter.ai/api/v1"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                    {t("aiSettings.embeddingProviderUrl")}
                                </label>
                                <Input
                                    value={aiSettings.embedding_provider_url}
                                    onChange={(e) =>
                                        setAiSettings((prev) => ({
                                            ...prev,
                                            embedding_provider_url: e.target.value,
                                        }))
                                    }
                                    className="h-9 text-sm"
                                    placeholder="https://openrouter.ai/api/v1"
                                />
                            </div>

                            <div className="md:col-span-2 pt-2 border-t border-border/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5 text-teal-500" />
                                        Sensitivitas Relevansi RAG (Cutoff Threshold Abstensi):
                                    </label>
                                    <span className="font-mono text-xs text-teal-600 dark:text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded">
                                        {parseFloat(aiSettings.rag_similarity_threshold || "0.35").toFixed(2)}
                                    </span>
                                </div>
                                <Input
                                    type="number"
                                    step="0.05"
                                    min="0.1"
                                    max="0.9"
                                    value={aiSettings.rag_similarity_threshold}
                                    onChange={(e) =>
                                        setAiSettings((prev) => ({
                                            ...prev,
                                            rag_similarity_threshold: e.target.value,
                                        }))
                                    }
                                    className="h-9 text-sm font-mono"
                                    placeholder="0.35"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Nilai ambang batas similarity (0.1 - 0.9). Jika skor pencarian vektor di bawah angka ini, bot tidak akan mengarang jawaban dan langsung memberitahu bahwa informasi tidak ditemukan.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t">
                            <Button
                                disabled={aiSaving}
                                onClick={handleSaveAiSettings}
                                className="h-9 gap-2 min-w-[120px]"
                                variant={aiSaved ? "outline" : "default"}
                            >
                                {aiSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : aiSaved ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {aiSaving ? tCommon("saving") : aiSaved ? tCommon("saved") : tCommon("save")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </motion.div>
    )

    // ----- Render: Knowledge Base settings -----
    const renderKnowledgeSettings = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            {/* Header Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                            <Layers className="w-5 h-5 text-teal-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">v{kbVersion}</p>
                            <p className="text-xs text-muted-foreground">KB Version Aktif</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{kbDocuments.length}</p>
                            <p className="text-xs text-muted-foreground">Total Dokumen SOP</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Bot className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{kbTotalChunks}</p>
                            <p className="text-xs text-muted-foreground">Total Chunks Vektor</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Document Upload Box */}
            <Card className="rounded-2xl py-0 border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <UploadCloud className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground text-sm">Upload Dokumen Pengetahuan Baru</h3>
                            <p className="text-xs text-muted-foreground">Dukungan file PDF, Markdown (.md), atau Teks (.txt) hingga 20MB</p>
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-2xl p-6 text-center space-y-3 bg-muted/20">
                        <input
                            type="file"
                            id="kb-file-input"
                            accept=".pdf,.md,.txt"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    setSelectedUploadFile(file)
                                    setUploadStatus("idle")
                                    setUploadProgressMsg("")
                                }
                            }}
                        />
                        <label
                            htmlFor="kb-file-input"
                            className="cursor-pointer flex flex-col items-center gap-2"
                        >
                            <FileText className="w-8 h-8 text-muted-foreground" />
                            <span className="text-xs font-medium text-primary hover:underline">
                                {selectedUploadFile ? selectedUploadFile.name : "Klik untuk memilih file PDF / MD / TXT"}
                            </span>
                            {selectedUploadFile && (
                                <span className="text-[11px] text-muted-foreground">
                                    {(selectedUploadFile.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                            )}
                        </label>
                    </div>

                    {uploadStatus !== "idle" && (
                        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 ${uploadStatus === "Processing"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                                : uploadStatus === "Ready"
                                    ? "bg-green-500/10 border-green-500/30 text-green-600"
                                    : "bg-red-500/10 border-red-500/30 text-red-600"
                            }`}>
                            {uploadStatus === "Processing" && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                            {uploadStatus === "Ready" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                            {uploadStatus === "Failed" && <AlertCircle className="w-4 h-4 shrink-0" />}
                            <div className="flex-1">
                                <span className="font-semibold uppercase tracking-wider text-[10px] block">
                                    Status: {uploadStatus}
                                </span>
                                <span>{uploadProgressMsg}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            onClick={handleUploadKnowledgeFile}
                            disabled={!selectedUploadFile || uploading}
                            className="h-9 gap-2 text-xs rounded-xl"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                            {uploading ? "Memproses Embedding..." : "Proses & Ingest Dokumen"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* KB Version Management Bar */}
            <Card className="rounded-2xl py-0 border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                                <Layers className="w-5 h-5 text-teal-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground text-sm">Manajemen Versi Knowledge Base</h3>
                                <p className="text-xs text-muted-foreground">Pilih versi KB yang aktif untuk melayani pencarian RAG atau buat versi baru</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleCreateNewVersion}
                                disabled={versionLoading}
                                variant="outline"
                                className="h-9 gap-1.5 text-xs rounded-xl"
                            >
                                {versionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Buat Versi KB Baru (v{(kbVersions[0]?.version || kbVersion) + 1})
                            </Button>
                        </div>
                    </div>

                    {kbVersions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground">Pilih Versi:</span>
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                <select
                                    value={selectedKbVersionId}
                                    onChange={(e) => setSelectedKbVersionId(e.target.value)}
                                    className="h-9 text-xs rounded-xl bg-background border border-border px-3 font-mono flex-1"
                                >
                                    {kbVersions.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            v{v.version} — [{v.status}] ({v.embedding_model})
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    onClick={() => handleActivateVersion(selectedKbVersionId)}
                                    disabled={versionLoading || !selectedKbVersionId}
                                    size="sm"
                                    className="h-9 text-xs rounded-xl"
                                >
                                    {versionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Aktifkan Versi
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Document Management Inspector Table */}
            <Card className="rounded-2xl py-0 border-border shadow-sm overflow-hidden">
                <CardContent className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" />
                            <h3 className="font-semibold text-foreground text-sm">Document Management Inspector</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={docSearchQuery}
                                    onChange={(e) => setDocSearchQuery(e.target.value)}
                                    placeholder="Cari nama dokumen SOP..."
                                    className="h-8 text-xs pl-8 pr-3 rounded-xl"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={fetchKbDocuments}
                                disabled={kbLoading}
                                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${kbLoading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {kbLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : kbDocuments.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            Belum ada dokumen SOP yang di-ingest. Silakan upload file pertama di atas.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-border/60 rounded-xl">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                                    <tr>
                                        <th className="px-4 py-3">Filename / Source</th>
                                        <th className="px-3 py-3">Version</th>
                                        <th className="px-3 py-3">Chunks</th>
                                        <th className="px-3 py-3">Embedding Model</th>
                                        <th className="px-3 py-3">Ingestion Date</th>
                                        <th className="px-3 py-3">Status</th>
                                        <th className="px-3 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {kbDocuments
                                        .filter((d) => !docSearchQuery.trim() || d.filename.toLowerCase().includes(docSearchQuery.toLowerCase()))
                                        .map((doc) => (
                                            <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-teal-500 shrink-0" />
                                                        <span className="truncate max-w-[180px]" title={doc.filename}>{doc.filename}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 font-mono">v{doc.version}</td>
                                                <td className="px-3 py-3 font-semibold text-primary">{doc.chunk_count}</td>
                                                <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{doc.embedding_model}</td>
                                                <td className="px-3 py-3 text-muted-foreground">
                                                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString("id-ID", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    }) : "-"}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-600 border border-green-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                                                        <CheckCircle2 className="w-3 h-3" /> Ready
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                                                        onClick={() => setDeleteDocTarget(doc)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Document Confirmation Dialog */}
            <Dialog open={!!deleteDocTarget} onOpenChange={(open) => { if (!open) setDeleteDocTarget(null) }}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Hapus Dokumen Knowledge Base?</DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus dokumen <strong className="text-foreground">{deleteDocTarget?.filename}</strong>? Seluruh chunk embedding dokumen ini akan dihapus dari vector database.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDocTarget(null)} disabled={deleteDocLoading}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteKnowledgeDoc} disabled={deleteDocLoading} className="gap-2">
                            {deleteDocLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Hapus Dokumen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    )

    // ----- Active category info -----
    const activeCat = categories.find((c) => c.id === activeCategory)

    if (authorized === null) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!authorized) {
        return (
            <div className="container mx-auto max-w-2xl pt-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
                        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <Shield className="w-8 h-8" />
                                </motion.div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-foreground">
                                    {t("unauthorizedTitle")}
                                </h2>
                                <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                                    {t("unauthorizedDescription")}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-4xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                {activeCategory && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setActiveCategory(null)
                            setEditedPonds({})
                            setEditedDevices({})
                        }}
                        className="h-9 px-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                )}
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {activeCat ? activeCat.label : t("title")}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {activeCat ? activeCat.description : t("description")}
                    </p>
                </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {!activeCategory && renderMenu()}
                {activeCategory === "pond" && renderPondSettings()}
                {activeCategory === "device" && renderDeviceSettings()}
                {activeCategory === "rag_ai" && renderAiSettings()}
                {activeCategory === "knowledge_base" && renderKnowledgeSettings()}
            </AnimatePresence>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("deleteConfirmDescription", {
                                type: deleteTarget?.type === "pond" ? t("deleteTypePond") : t("deleteTypeDevice"),
                                name: deleteTarget?.name || ""
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>{tCommon("cancel")}</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading} className="gap-2">
                            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {tCommon("delete")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
