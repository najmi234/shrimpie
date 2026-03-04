"use client"

import { useSidebar } from "./sidebar-context"

export function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar()

    return (
        <div
            className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? "md:ml-[72px]" : "md:ml-64"
                }`}
        >
            {children}
        </div>
    )
}
