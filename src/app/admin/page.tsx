"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import {
    Users,
    Shield,
    Search,
    ChevronDown,
    Loader2,
    Check,
    UserCog,
    AtSign,
    Calendar,
    Mail,
    Crown,
    User as UserIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// ---------- types ----------

interface UserProfile {
    id: string
    username: string | null
    avatar_url: string | null
    birth_date: string | null
    gender: string | null
    user_role: string | null
    email?: string
}

const ROLE_OPTIONS = [
    { value: "admin", label: "Admin", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    { value: "guest", label: "Guest", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
]

// ---------- component ----------

export default function AdminPage() {
    const supabase = createClient()
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: UserProfile; newRole: string } | null>(null)
    const [roleChangeLoading, setRoleChangeLoading] = useState(false)
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    // ----- Fetch current user -----
    useEffect(() => {
        async function fetchCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser()
            setCurrentUserId(user?.id ?? null)
        }
        fetchCurrentUser()
    }, [])

    // ----- Fetch all profiles -----
    useEffect(() => {
        async function fetchUsers() {
            setLoading(true)
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, birth_date, gender, user_role")
                .order("username")

            if (error) {
                console.error("Failed to fetch profiles:", error)
                setLoading(false)
                return
            }
            setUsers(data ?? [])
            setLoading(false)
        }
        fetchUsers()
    }, [])

    // ----- Role change handler -----
    const handleRoleChange = async () => {
        if (!roleChangeTarget) return
        setRoleChangeLoading(true)

        const { error } = await supabase
            .from("profiles")
            .update({ user_role: roleChangeTarget.newRole })
            .eq("id", roleChangeTarget.user.id)

        setRoleChangeLoading(false)
        if (error) {
            console.error("Failed to update role:", error)
            return
        }

        setUsers((prev) =>
            prev.map((u) =>
                u.id === roleChangeTarget.user.id
                    ? { ...u, user_role: roleChangeTarget.newRole }
                    : u
            )
        )
        setSavedIds((prev) => new Set(prev).add(roleChangeTarget.user.id))
        setTimeout(() => {
            setSavedIds((prev) => {
                const next = new Set(prev)
                next.delete(roleChangeTarget!.user.id)
                return next
            })
        }, 2000)
        setRoleChangeTarget(null)
    }

    // ----- Filter users -----
    const filteredUsers = users.filter((u) => {
        const q = searchQuery.toLowerCase()
        return (
            (u.username?.toLowerCase() || "").includes(q) ||
            u.id.toLowerCase().includes(q)
        )
    })

    const adminCount = users.filter((u) => u.user_role === "admin").length
    const guestCount = users.filter((u) => u.user_role === "guest").length

    const getRoleBadge = (role: string | null) => {
        const opt = ROLE_OPTIONS.find((r) => r.value === role)
        return opt
            ? { label: opt.label, color: opt.color }
            : { label: role || "-", color: "bg-muted text-muted-foreground border-border" }
    }

    return (
        <div className="container mx-auto max-w-4xl space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Kelola pengguna dan hak akses aplikasi
                </p>
            </div>

            {/* Stats Cards */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{users.length}</p>
                            <p className="text-xs text-muted-foreground">Total Pengguna</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Crown className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{adminCount}</p>
                            <p className="text-xs text-muted-foreground">Administrator</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                            <UserIcon className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{guestCount}</p>
                            <p className="text-xs text-muted-foreground">Guest</p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Search */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari pengguna berdasarkan username atau ID..."
                        className="h-10 pl-10 text-sm border-border rounded-xl"
                    />
                </div>
            </motion.div>

            {/* Users List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-3"
            >
                {loading ? (
                    <Card className="rounded-2xl py-0 border-border">
                        <CardContent className="p-8 flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                ) : filteredUsers.length === 0 ? (
                    <Card className="rounded-2xl py-0 border-border">
                        <CardContent className="p-8 text-center text-muted-foreground">
                            {searchQuery ? "Tidak ada pengguna yang cocok." : "Tidak ada data pengguna."}
                        </CardContent>
                    </Card>
                ) : (
                    filteredUsers.map((userProfile, index) => {
                        const badge = getRoleBadge(userProfile.user_role)
                        const initial = (userProfile.username || userProfile.id).charAt(0).toUpperCase()
                        const isExpanded = expandedId === userProfile.id
                        const justSaved = savedIds.has(userProfile.id)
                        const isCurrentUser = userProfile.id === currentUserId

                        return (
                            <motion.div
                                key={userProfile.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                            >
                                <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-0">
                                        {/* Main Row */}
                                        <button
                                            type="button"
                                            className="w-full p-4 flex items-center gap-4 text-left cursor-pointer"
                                            onClick={() => setExpandedId(isExpanded ? null : userProfile.id)}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                                                {initial}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground truncate">
                                                        {userProfile.username || "Tanpa Username"}
                                                    </span>
                                                    {isCurrentUser && (
                                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Anda</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    ID: {userProfile.id.slice(0, 8)}...
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {justSaved && (
                                                    <span className="text-xs text-green-500 flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" /> Tersimpan
                                                    </span>
                                                )}
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                            </div>
                                        </button>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 pt-0 border-t border-border/50">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                                            <div className="flex items-center gap-3">
                                                                <AtSign className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Username</p>
                                                                    <p className="text-sm text-foreground">{userProfile.username || "-"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tanggal Lahir</p>
                                                                    <p className="text-sm text-foreground">
                                                                        {userProfile.birth_date
                                                                            ? new Date(userProfile.birth_date).toLocaleDateString("id-ID", {
                                                                                day: "2-digit",
                                                                                month: "long",
                                                                                year: "numeric",
                                                                            })
                                                                            : "-"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gender</p>
                                                                    <p className="text-sm text-foreground capitalize">{userProfile.gender || "-"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                                                                <div>
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</p>
                                                                    <p className="text-sm text-foreground capitalize">{userProfile.user_role || "-"}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Role Change Actions */}
                                                        <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                                                            {ROLE_OPTIONS.map((role) => (
                                                                <Button
                                                                    key={role.value}
                                                                    size="sm"
                                                                    variant={userProfile.user_role === role.value ? "default" : "outline"}
                                                                    className="h-8 gap-1.5 text-xs"
                                                                    disabled={userProfile.user_role === role.value}
                                                                    onClick={() =>
                                                                        setRoleChangeTarget({
                                                                            user: userProfile,
                                                                            newRole: role.value,
                                                                        })
                                                                    }
                                                                >
                                                                    <UserCog className="w-3.5 h-3.5" />
                                                                    {userProfile.user_role === role.value
                                                                        ? `${role.label} (aktif)`
                                                                        : `Jadikan ${role.label}`}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )
                    })
                )}
            </motion.div>

            {/* Role Change Confirmation Dialog */}
            <Dialog open={!!roleChangeTarget} onOpenChange={(open) => { if (!open) setRoleChangeTarget(null) }}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Perubahan Role</DialogTitle>
                        <DialogDescription>
                            Ubah role pengguna{" "}
                            <span className="font-semibold text-foreground">{roleChangeTarget?.user.username || "user"}</span>
                            {" "}menjadi{" "}
                            <span className="font-semibold text-foreground capitalize">{roleChangeTarget?.newRole}</span>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRoleChangeTarget(null)} disabled={roleChangeLoading}>
                            Batal
                        </Button>
                        <Button onClick={handleRoleChange} disabled={roleChangeLoading} className="gap-2">
                            {roleChangeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                            Konfirmasi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
