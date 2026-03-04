"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface SidebarContextType {
    collapsed: boolean
    toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextType>({
    collapsed: false,
    toggleSidebar: () => { },
})

export function useSidebar() {
    return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)

    const toggleSidebar = () => setCollapsed((prev) => !prev)

    return (
        <SidebarContext.Provider value={{ collapsed, toggleSidebar }}>
            {children}
        </SidebarContext.Provider>
    )
}
