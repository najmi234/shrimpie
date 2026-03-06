import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { DashboardContent } from "@/components/layout/dashboard-content";

export const metadata: Metadata = {
    title: "WebGIS Tracker - Shrimpie",
    description: "Interactive map for tracking Shrimpie devices in real-time.",
};

export default function WebGISLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-background">
                {/* Sidebar */}
                <Sidebar />

                {/* Content Area */}
                <DashboardContent>
                    <Navbar />

                    <main className="flex-1 p-0 relative">
                        {children}
                    </main>
                </DashboardContent>
            </div>
        </SidebarProvider>
    );
}
