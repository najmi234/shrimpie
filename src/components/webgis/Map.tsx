"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Activity, Navigation } from "lucide-react";

// Fix for default Leaflet icons in Webpack/Next.js
const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const createCustomIcon = (status: string) => {
    const color = status?.toLowerCase() === "active" ? "bg-green-500" : "bg-red-500";
    return L.divIcon({
        className: "bg-transparent border-none",
        html: `<div class="relative flex items-center justify-center w-8 h-8">
             <div class="absolute w-full h-full rounded-full ${color} opacity-20 animate-ping"></div>
             <div class="relative w-4 h-4 rounded-full ${color} border-2 border-white shadow-md"></div>
           </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

interface DeviceMetric {
    body_length: number | null;
    weight: number | null;
    created_at: string;
}

interface Device {
    id: string;
    name: string;
    status: string;
    location: any;
    device_metrics: DeviceMetric[];
    parsedLocation: [number, number] | null;
}

function parseLocation(locationData: any): [number, number] | null {
    if (!locationData) return null;

    if (Array.isArray(locationData) && locationData.length >= 2) {
        return [Number(locationData[0]), Number(locationData[1])];
    }

    if (typeof locationData === 'string') {
        try {
            const parsed = JSON.parse(locationData);
            if (Array.isArray(parsed) && parsed.length >= 2) return [Number(parsed[0]), Number(parsed[1])];
        } catch { }

        // Check for PostGIS POINT string e.g., "POINT(lng lat)"
        const match = locationData.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
        if (match) {
            if (locationData.toUpperCase().includes("POINT")) {
                return [Number(match[2]), Number(match[1])]; // POINT(lng lat)
            }
            return [Number(match[1]), Number(match[2])]; // lat, lng
        }
    }

    if (typeof locationData === "object" && locationData !== null) {
        if ("lat" in locationData && "lng" in locationData) {
            return [Number(locationData.lat), Number(locationData.lng)];
        }
        if (locationData.type === "Point" && Array.isArray(locationData.coordinates)) {
            return [Number(locationData.coordinates[1]), Number(locationData.coordinates[0])]; // GeoJSON [lng, lat]
        }
    }

    return null;
}

// Controller component to smoothly pan map via state bounds
function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 15, { duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

export default function WebGISMap() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCenter, setActiveCenter] = useState<[number, number] | null>(null);
    const mapRef = useRef<L.Map>(null);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const supabase = createClient();

                // Fetch devices and their latest metrics
                const { data, error } = await supabase
                    .from("devices")
                    .select(`
            id, name, status, location,
            device_metrics (
              body_length,
              weight,
              created_at
            )
          `);

                if (error) throw error;

                // Process locations and sort metrics
                const formattedData: Device[] = (data || []).map((device: any) => {
                    // Sort device_metrics to get the latest one safely
                    const sortedMetrics = Array.isArray(device.device_metrics)
                        ? [...device.device_metrics].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        : [];

                    return {
                        id: device.id,
                        name: device.name,
                        status: device.status,
                        location: device.location,
                        device_metrics: sortedMetrics,
                        parsedLocation: parseLocation(device.location)
                    };
                });

                setDevices(formattedData);

                // Auto-center map to first valid location initially
                const firstValidLoc = formattedData.find(d => d.parsedLocation !== null);
                if (firstValidLoc?.parsedLocation) {
                    setActiveCenter(firstValidLoc.parsedLocation);
                } else {
                    setActiveCenter([-2.5489, 118.0149]); // Default center string on Indonesia
                }
            } catch (err) {
                console.error("Error fetching map data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDevices();
    }, []);

    const handleFlyTo = (loc: [number, number] | null) => {
        if (loc) {
            setActiveCenter(loc);
        }
    };

    const centerPoint: [number, number] = activeCenter || [-2.5489, 118.0149]; // Center of Indonesia as fallback

    return (
        <div className="relative w-full h-full flex overflow-hidden bg-muted/20">
            {loading && (
                <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Map Sidebar Overlay */}
            <div className="absolute top-4 left-4 z-[500] w-80 max-h-[calc(100%-2rem)] flex flex-col bg-background/95 backdrop-blur-md border border-border/50 rounded-xl shadow-lg shadow-black/5 overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-muted/30">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-primary" />
                        Device Tracking
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">Real-time shrimp pond locations</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {devices.length === 0 && !loading && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No assigned devices found.
                        </div>
                    )}

                    {devices.map((device) => {
                        const hasLocation = device.parsedLocation !== null;
                        const latestMetric = device.device_metrics?.[0];

                        return (
                            <button
                                key={device.id}
                                onClick={() => handleFlyTo(device.parsedLocation)}
                                disabled={!hasLocation}
                                className={`w-full text-left p-3 rounded-lg border transition-all duration-200
                  ${!hasLocation ? 'opacity-50 cursor-not-allowed bg-muted/30 border-transparent' : 'bg-card hover:bg-accent hover:border-accent-foreground/20 cursor-pointer shadow-sm'}
                `}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                            {device.name}
                                            {!hasLocation && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">No GPS</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="relative flex h-2 w-2">
                                                {device.status?.toLowerCase() === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                                <span className={`relative inline-flex rounded-full h-2 w-2 ${device.status?.toLowerCase() === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            </span>
                                            <span className="text-xs text-muted-foreground capitalize">{device.status || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>

                                {latestMetric && (
                                    <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-2">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="block mb-0.5">Length</span>
                                            <span className="font-medium text-foreground">{latestMetric.body_length ?? '-'} mm</span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="block mb-0.5">Weight</span>
                                            <span className="font-medium text-foreground">{latestMetric.weight ?? '-'} g</span>
                                        </div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Valid zoom range for typical CartoDB Positron maps */}
            <MapContainer
                center={centerPoint}
                zoom={activeCenter ? 15 : 5}
                scrollWheelZoom={true}
                className="w-full h-full z-0 font-sans"
                zoomControl={false}
            >
                <MapController center={activeCenter} />

                {/* CartoDB Positron - Clean, fast, and matches Shadcn aesthetic well */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    maxZoom={19}
                />

                {devices.map(device => {
                    if (!device.parsedLocation) return null;

                    const latestMetric = device.device_metrics?.[0];

                    return (
                        <Marker
                            key={device.id}
                            position={device.parsedLocation}
                            icon={createCustomIcon(device.status)}
                        >
                            <Popup className="rounded-xl overflow-hidden shadow-xl border-none p-0 !my-1">
                                <div className="p-3 bg-background text-foreground min-w-[200px]">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b">
                                        <div className="font-semibold text-sm flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            {device.name}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${device.status?.toLowerCase() === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                            }`}>
                                            {device.status || 'Unknown'}
                                        </span>
                                    </div>

                                    {latestMetric ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                <Activity className="w-3.5 h-3.5" />
                                                Latest Metrics
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2 rounded-lg">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Length</p>
                                                    <p className="font-semibold text-sm">{latestMetric.body_length ?? '-'} <span className="text-xs font-normal text-muted-foreground">mm</span></p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Weight</p>
                                                    <p className="font-semibold text-sm">{latestMetric.weight ?? '-'} <span className="text-xs font-normal text-muted-foreground">g</span></p>
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-right mt-1.5 text-muted-foreground/60">
                                                Updated {new Date(latestMetric.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground italic py-2 text-center">
                                            No metrics available
                                        </div>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
