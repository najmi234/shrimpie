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
    ]

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
