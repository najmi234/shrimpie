"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Settings, Globe, History, MessageSquareText, ChevronLeft, ChevronRight, LogOut, ChevronsUpDown, UserPen, MonitorCog } from "lucide-react"
import { useSidebar } from "./sidebar-context"
import { createClient } from "@/lib/supabase/client"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

export function Sidebar() {
    const { collapsed, toggleSidebar, mobileOpen, setMobileOpen } = useSidebar()
    const pathname = usePathname()
    const router = useRouter()

    const [user, setUser] = useState<{ email: string; name: string } | null>(null)

    // Close mobile sidebar when route changes
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname, setMobileOpen])

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUser({
                    email: user.email ?? "",
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
                })
            }
        })
    }, [])

    const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U"
    const userName = user?.name || "User"
    const userEmail = user?.email || ""

    const handleSignOut = async () => {
        await fetch("/auth/signout", { method: "POST" })
        router.push("/login")
    }

    const linkClass = (href: string) => {
        const isActive = pathname.startsWith(href)
        return `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${collapsed ? "justify-center" : ""
            } ${isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
    }

    return (
        <>
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={`bg-sidebar border-r border-sidebar-border h-screen flex flex-col fixed left-0 top-0 transition-all duration-300 z-30 ${collapsed ? "w-[72px]" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
            >
                <div className="h-16 flex items-center px-6 font-bold text-xl text-sidebar-foreground justify-center relative">
                    {collapsed ? (
                        <Image src="/Shrimpy-Logo.png" alt="Shrimpie" width={32} height={32} className="object-contain" />
                    ) : (
                        <>
                            <Image src="/Shrimpie-Black.png" alt="Shrimpie" width={125} height={25} className="object-contain dark:hidden" />
                            <Image src="/Shrimpie-White.png" alt="Shrimpie" width={125} height={25} className="object-contain hidden dark:block" />
                        </>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-sidebar-accent text-sidebar-accent-foreground rounded-full hidden md:flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    >
                        {collapsed ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronLeft className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
                <nav className="flex-1 p-4 flex flex-col gap-2">
                    <Link
                        href="/dashboard"
                        className={linkClass("/dashboard")}
                        title="Dashboard"
                    >
                        <LayoutDashboard className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>Dashboard</span>}
                    </Link>

                    <Link
                        href="/riwayat"
                        className={linkClass("/riwayat")}
                        title="Riwayat"
                    >
                        <History className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>Riwayat</span>}
                    </Link>

                    <Link
                        href="/webgis"
                        className={linkClass("/webgis")}
                        title="Webgis"
                    >
                        <Globe className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>Webgis</span>}
                    </Link>

                    {/* Penambahan: Chat Agent di atas Settings */}
                    <Link
                        href="#"
                        className={linkClass("/chat-agent")}
                        title="Chat Agent"
                    >
                        <MessageSquareText className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>Chat Agent</span>}
                    </Link>

                    <Link
                        href="#"
                        className={linkClass("/settings")}
                        title="Settings"
                    >
                        <Settings className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>Settings</span>}
                    </Link>
                </nav>
                <div className="p-4 border-t border-sidebar-border">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={`flex items-center gap-3 w-full rounded-lg p-2 text-left hover:bg-sidebar-accent transition-colors outline-none ${collapsed ? "justify-center" : ""}`}
                            >
                                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-accent-foreground shrink-0">
                                    {userInitial}
                                </div>
                                {!collapsed && (
                                    <>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-sm font-semibold text-sidebar-foreground truncate">{userName}</span>
                                            <span className="text-xs text-sidebar-foreground/60 truncate">{userEmail}</span>
                                        </div>
                                        <ChevronsUpDown className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />
                                    </>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            align={collapsed ? "center" : "start"}
                            sideOffset={8}
                            className="w-56"
                        >
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-accent-foreground shrink-0">
                                        {userInitial}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-semibold truncate">{userName}</span>
                                        <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="#" className="cursor-pointer">
                                    <UserPen className="w-4 h-4" />
                                    Profil
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="#" className="cursor-pointer">
                                    <MonitorCog className="w-4 h-4" />
                                    Admin Panel
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onSelect={(e) => {
                                    e.preventDefault()
                                    handleSignOut()
                                }}
                            >
                                <LogOut className="w-4 h-4" />
                                Keluar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>
        </>
    )
}