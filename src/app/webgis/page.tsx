"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the Map component, disabling SSR
const MapComponent = dynamic(
    () => import("@/components/webgis/Map"),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center bg-muted/20">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="w-[80vw] max-w-2xl h-[60vh] rounded-xl" />
                    <div className="text-sm text-muted-foreground animate-pulse">Loading Map...</div>
                </div>
            </div>
        )
    }
);

export default function WebGISPage() {
    return (
        <div className="w-full h-[calc(100vh-4rem)]">
            <MapComponent />
        </div>
    );
}
