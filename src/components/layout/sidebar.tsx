"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Settings, Globe, History, MessageSquareText, ChevronLeft, ChevronRight } from "lucide-react"
import { useSidebar } from "./sidebar-context"

export function Sidebar() {
    const { collapsed, toggleSidebar } = useSidebar()
    const pathname = usePathname()

    const linkClass = (href: string) => {
        const isActive = pathname.startsWith(href)
        return `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${collapsed ? "justify-center" : ""
            } ${isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`
    }

    return (
        <aside
            className={`bg-sidebar border-r border-sidebar-border h-screen hidden md:flex flex-col fixed left-0 top-0 transition-all duration-300 z-20 ${collapsed ? "w-[72px]" : "w-64"
                }`}
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
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-sidebar-accent text-sidebar-accent-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
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
                    href="#"
                    className={`flex items-center gap-3 px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg font-medium transition-colors ${collapsed ? "justify-center" : ""
                        }`}
                    title="Webgis"
                >
                    <Globe className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>Webgis</span>}
                </Link>

                {/* Penambahan: Chat Agent di atas Settings */}
                <Link
                    href="#"
                    className={`flex items-center gap-3 px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg font-medium transition-colors ${collapsed ? "justify-center" : ""
                        }`}
                    title="Chat Agent"
                >
                    <MessageSquareText className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>Chat Agent</span>}
                </Link>

                <Link
                    href="#"
                    className={`flex items-center gap-3 px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg font-medium transition-colors ${collapsed ? "justify-center" : ""
                        }`}
                    title="Settings"
                >
                    <Settings className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>Settings</span>}
                </Link>
            </nav>
            <div className="p-4 border-t border-sidebar-border">
                <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center font-bold text-sidebar-accent-foreground shrink-0">
                        A
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-sidebar-foreground">Admin</span>
                            <span className="text-xs text-sidebar-foreground/60">Farm Manager</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    )
}