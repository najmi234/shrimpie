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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// ---------- types ----------

interface Pond {
    id: string
    name: string
    stocking_date: string | null
}

interface Device {
    id: string
    name: string
    status: string
    location: string | null
    last_update_at: string | null
}

// ---------- settings menu ----------

interface SettingsCategory {
    id: string
    label: string
    description: string
    icon: React.ElementType
}

const categories: SettingsCategory[] = [
    {
        id: "pond",
        label: "Pond Settings",
        description: "Kelola data kolam, stocking date, dan nama kolam",
        icon: Shell,
    },
    {
        id: "device",
        label: "Device Settings",
        description: "Lihat dan kelola informasi perangkat monitoring",
        icon: Cpu,
    },
]

// ---------- component ----------

export default function SettingsPage() {
    const supabase = createClient()
    const [activeCategory, setActiveCategory] = useState<string | null>(null)

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

    // ----- Fetch ponds -----
    useEffect(() => {
        if (activeCategory !== "pond") return
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
            const sorted = (data ?? []).sort((a: any, b: any) => {
                const numA = parseInt(a.name.match(/\d+/)?.[0] || "0")
                const numB = parseInt(b.name.match(/\d+/)?.[0] || "0")
                return numA - numB
            })
            setDevices(sorted)
        }
        fetchDevices()
    }, [activeCategory])

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
        const { error } = await supabase
            .from("device_status_monitor")
            .update({
                name: edits.name ?? device.name,
            })
            .eq("id", device.id)

        setDeviceSaving((prev) => ({ ...prev, [device.id]: false }))

        if (error) {
            console.error("Failed to save device:", error)
            return
        }

        setDevices((prev) =>
            prev.map((d) =>
                d.id === device.id
                    ? { ...d, name: edits.name ?? d.name }
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
            {ponds.length === 0 ? (
                <Card className="rounded-2xl py-0 border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        Tidak ada data kolam.
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
                                                <p className="text-xs text-muted-foreground">Nama Kolam</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">Nama Kolam</label>
                                                <Input
                                                    value={edited?.name ?? pond.name}
                                                    onChange={(e) => handlePondFieldChange(pond.id, "name", e.target.value)}
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">Stocking Date</label>
                                                <Input
                                                    type="date"
                                                    value={edited?.stocking_date ?? pond.stocking_date ?? ""}
                                                    onChange={(e) => handlePondFieldChange(pond.id, "stocking_date", e.target.value)}
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <Button
                                                    size="sm"
                                                    disabled={!hasChanges || saving}
                                                    onClick={() => handleSavePond(pond)}
                                                    className="h-9 gap-2 w-full sm:w-auto"
                                                    variant={saved ? "outline" : "default"}
                                                >
                                                    {saving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : saved ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Save className="w-4 h-4" />
                                                    )}
                                                    {saving ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan"}
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
            {devices.length === 0 ? (
                <Card className="rounded-2xl py-0 border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        Tidak ada data perangkat.
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
                        ? "Active"
                        : "Inactive"

                    const lastUpdate = device.last_update_at
                        ? new Date(device.last_update_at).toLocaleString("id-ID", {
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
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">Nama Device</label>
                                                <Input
                                                    value={edited?.name ?? device.name}
                                                    onChange={(e) => handleDeviceFieldChange(device.id, "name", e.target.value)}
                                                    className="h-9 text-sm border-border"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                                                <div className="h-9 flex items-center gap-2 px-3 rounded-md bg-muted/50 border border-border">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                                                    <span className="text-sm text-foreground">{statusLabel}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">Last Update</label>
                                                <div className="h-9 flex items-center px-3 rounded-md bg-muted/50 border border-border">
                                                    <span className="text-sm text-muted-foreground">{lastUpdate}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-end">
                                                <Button
                                                    size="sm"
                                                    disabled={!hasChanges || saving}
                                                    onClick={() => handleSaveDevice(device)}
                                                    className="h-9 gap-2 w-full sm:w-auto"
                                                    variant={saved ? "outline" : "default"}
                                                >
                                                    {saving ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : saved ? (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    ) : (
                                                        <Save className="w-4 h-4" />
                                                    )}
                                                    {saving ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan"}
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

    // ----- Active category info -----
    const activeCat = categories.find((c) => c.id === activeCategory)

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
                        {activeCat ? activeCat.label : "Settings"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {activeCat ? activeCat.description : "Kelola pengaturan aplikasi monitoring udang"}
                    </p>
                </div>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {!activeCategory && renderMenu()}
                {activeCategory === "pond" && renderPondSettings()}
                {activeCategory === "device" && renderDeviceSettings()}
            </AnimatePresence>
        </div>
    )
}
