"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface SidebarContextType {
    collapsed: boolean
    toggleSidebar: () => void
    mobileOpen: boolean
    setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
    collapsed: false,
    toggleSidebar: () => { },
    mobileOpen: false,
    setMobileOpen: () => { },
})

export function useSidebar() {
    return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    const toggleSidebar = () => setCollapsed((prev) => !prev)

    return (
        <SidebarContext.Provider value={{ collapsed, toggleSidebar, mobileOpen, setMobileOpen }}>
            {children}
        </SidebarContext.Provider>
    )
}
