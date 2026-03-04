"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, Bell, Sun, Moon, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/riwayat": "Riwayat Monitoring",
}

export function Navbar() {
    const pathname = usePathname()
    const [darkMode, setDarkMode] = useState(false)
    const [scrolled, setScrolled] = useState(false)

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
                <button className="md:hidden p-2 text-muted-foreground hover:bg-muted rounded-lg">
                    <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-2xl px-4 font-semibold hidden sm:block">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative hidden sm:block">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="h-9 w-48 lg:w-64 rounded-full bg-muted/50 border border-border pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition-all"
                    />
                </div>

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