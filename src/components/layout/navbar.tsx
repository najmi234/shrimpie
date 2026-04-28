"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, Bell, Sun, Moon, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "./sidebar-context"
import { GlobalSearch } from "./global-search"

const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/riwayat": "Riwayat Monitoring",
    "/webgis": "WebGIS Tracker",
    "/chat-agent": "AI Recommendation"
}

export function Navbar() {
    const pathname = usePathname()
    const { setMobileOpen } = useSidebar()
    const [darkMode, setDarkMode] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)

    const title = pageTitles[pathname] ?? "Shrimpie"

    // Load saved theme
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark")
            setDarkMode(true)
        }
    }, [])

    // Detect scroll for shadow
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 0)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const toggleTheme = () => {
        if (darkMode) {
            document.documentElement.classList.remove("dark")
            localStorage.setItem("theme", "light")
        } else {
            document.documentElement.classList.add("dark")
            localStorage.setItem("theme", "dark")
        }
        setDarkMode(!darkMode)
    }

    return (
        <header className={`h-16 bg-background flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10 w-full transition-shadow duration-300 ${scrolled ? "shadow-md" : ""}`}>
            <div className="flex items-center gap-4">
                <button
                    className="md:hidden p-2 text-muted-foreground hover:bg-muted rounded-lg active:scale-90 transition-transform"
                    onClick={() => setMobileOpen(true)}
                >
                    <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold sm:text-2xl truncate">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* Search Icon (Mobile) */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden rounded-full"
                    onClick={() => setSearchOpen(true)}
                >
                    <Search className="w-5 h-5" />
                </Button>

                {/* Search Bar Trigger (Desktop) */}
                <div className="relative hidden sm:block sm:max-w-[200px] lg:max-w-xs w-full">
                    <Button
                        variant="outline"
                        className="w-full justify-start text-sm text-muted-foreground h-9 rounded-full px-4 pr-1.5 bg-muted/50 border-border hover:bg-accent/50 group"
                        onClick={() => setSearchOpen(true)}
                    >
                        <Search className="mr-2 h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left line-clamp-1">Search...</span>
                        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex ml-2 transition-colors group-hover:bg-background">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </Button>
                </div>

                <GlobalSearch open={searchOpen} setOpen={setSearchOpen} />

                {/* Theme Switch */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="rounded-full"
                >
                    {darkMode ? (
                        <Sun className="w-5 h-5" />
                    ) : (
                        <Moon className="w-5 h-5" />
                    )}
                </Button>

                {/* Notification */}
                <button className="p-2 text-muted-foreground hover:bg-muted rounded-full relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-background"></span>
                </button>
            </div>
        </header>
    )
}