import "@/app/globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { DashboardContent } from "@/components/layout/dashboard-content";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-background">
                <Sidebar />
                <DashboardContent>
                    <Navbar />
                    <main className="flex-1 p-4">
                        {children}
                    </main>
                </DashboardContent>
            </div>
        </SidebarProvider>
    );
}
