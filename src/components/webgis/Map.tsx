"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
import { Loader2, MapPin, Activity, Navigation, PanelLeftClose, PanelLeftOpen, ChevronUp, ChevronDown, X, Ruler, Weight, Waves, ExternalLink } from "lucide-react";
import Link from "next/link";

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

interface Device {
    id: string;
    name: string;
    status: string;
    location: any;
    last_update_at: string;
    parsedLocation: [number, number] | null;
}

interface PondWithMetrics {
    id: string;
    name: string;
    stocking_date: string;
    location: string;
    parsedLocation: [number, number] | null;
    latestMetrics: {
        avg_body_length_cm: string;
        avg_body_weight_g: string;
        activity_level_pct: string;
        recorded_at: string;
    } | null;
}

const createPondIcon = () => {
    return L.divIcon({
        className: "bg-transparent border-none",
        html: `<div class="relative flex items-center justify-center w-8 h-8">
             <div class="absolute w-5 h-5 rotate-45 bg-blue-500 opacity-20 animate-ping" style="top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg)"></div>
             <svg class="relative" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M10 1 L18 10 L10 19 L2 10 Z" fill="#3b82f6" stroke="white" stroke-width="2"/>
             </svg>
           </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

function parseLocation(locationData: any): [number, number] | null {
    if (!locationData) return null;

    try {
        const parsed = JSON.parse(locationData);
        if (Array.isArray(parsed) && parsed.length >= 2) {
            return [Number(parsed[1]), Number(parsed[0])]; // FIX (swap!)
        }
    } catch { }

    const match = locationData.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (match) {
        return [Number(match[2]), Number(match[1])]; // tetap swap
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
    const searchParams = useSearchParams();
    const targetDeviceId = searchParams.get("device");
    const highlightLat = searchParams.get("highlight_lat");
    const highlightLng = searchParams.get("highlight_lng");

    const highlightPosition: [number, number] | null =
        highlightLat && highlightLng
            ? [Number(highlightLat), Number(highlightLng)]
            : null;

    const [devices, setDevices] = useState<Device[]>([]);
    const [ponds, setPonds] = useState<PondWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCenter, setActiveCenter] = useState<[number, number] | null>(null);
    const [mapType, setMapType] = useState<"normal" | "satellite">("normal");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const mapRef = useRef<L.Map>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const supabase = createClient();

                // Fetch devices
                const { data, error } = await supabase
                    .from("device_status_monitor")
                    .select("id, name, status, location, last_update_at");

                if (error) throw error;

                const formattedData: Device[] = (data || []).map((device: any) => ({
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    location: device.location,
                    last_update_at: device.last_update_at,
                    parsedLocation: parseLocation(device.location)
                })).sort((a, b) => {
                    const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
                    const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
                    return numA - numB;
                });

                setDevices(formattedData);

                // Fetch ponds
                const { data: pondsData, error: pondsError } = await supabase
                    .from("ponds")
                    .select("id, name, stocking_date, location");

                if (pondsError) throw pondsError;

                // Fetch latest metric per pond
                const { data: metricsData, error: metricsError } = await supabase
                    .from("pond_metrics")
                    .select("pond_id, avg_body_length_cm, avg_body_weight_g, activity_level_pct, recorded_at")
                    .order("recorded_at", { ascending: false });

                if (metricsError) throw metricsError;

                // Group by pond_id, take latest (first after order desc)
                const latestMetricsMap = new Map<string, any>();
                for (const m of metricsData || []) {
                    if (!latestMetricsMap.has(m.pond_id)) {
                        latestMetricsMap.set(m.pond_id, m);
                    }
                }

                const formattedPonds: PondWithMetrics[] = (pondsData || []).map((pond: any) => {
                    const metric = latestMetricsMap.get(pond.id) || null;
                    return {
                        id: pond.id,
                        name: pond.name,
                        stocking_date: pond.stocking_date,
                        location: pond.location,
                        parsedLocation: parseLocation(pond.location),
                        latestMetrics: metric ? {
                            avg_body_length_cm: metric.avg_body_length_cm,
                            avg_body_weight_g: metric.avg_body_weight_g,
                            activity_level_pct: metric.activity_level_pct,
                            recorded_at: metric.recorded_at,
                        } : null,
                    };
                }).sort((a: PondWithMetrics, b: PondWithMetrics) => {
                    const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
                    const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
                    return numA - numB;
                });

                setPonds(formattedPonds);

                // Auto-center: prioritize highlight point, then target device, then first valid device, then first pond
                if (highlightPosition) {
                    setActiveCenter(highlightPosition);
                } else {
                    const targetDevice = targetDeviceId
                        ? formattedData.find(d => d.id === targetDeviceId && d.parsedLocation !== null)
                        : null;
                    const focusDevice = targetDevice || formattedData.find(d => d.parsedLocation !== null);
                    if (focusDevice?.parsedLocation) {
                        setActiveCenter(focusDevice.parsedLocation);
                    } else {
                        const focusPond = formattedPonds.find(p => p.parsedLocation !== null);
                        if (focusPond?.parsedLocation) {
                            setActiveCenter(focusPond.parsedLocation);
                        } else {
                            setActiveCenter([-2.5489, 118.0149]);
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching map data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
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

            <div className="absolute top-4 right-4 z-[500] flex bg-background/95 backdrop-blur-md border border-border/50 rounded-lg shadow-md overflow-hidden">
                <button
                    onClick={() => setMapType("normal")}
                    className={`px-3 py-1.5 text-xs font-medium transition ${mapType === "normal"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                        }`}
                >
                    Normal
                </button>
                <button
                    onClick={() => setMapType("satellite")}
                    className={`px-3 py-1.5 text-xs font-medium transition ${mapType === "satellite"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                        }`}
                >
                    Satellite
                </button>
            </div>

            {/* ─── Desktop Sidebar Toggle Button ─── */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden md:flex absolute top-4 left-4 z-[501] w-9 h-9 items-center justify-center rounded-lg bg-background/95 backdrop-blur-md border border-border/50 shadow-md hover:bg-muted transition-colors"
                style={{ left: sidebarOpen ? '21.5rem' : '1rem' }}
                title={sidebarOpen ? 'Hide panel' : 'Show panel'}
            >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            {/* ─── Mobile Bottom Sheet Toggle ─── */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden absolute left-1/2 -translate-x-1/2 z-[701] flex items-center gap-2 px-4 py-2 rounded-full bg-background/95 backdrop-blur-md border border-border/50 shadow-lg hover:bg-muted transition-all duration-300 ease-in-out"
                style={{ bottom: sidebarOpen ? 'calc(55vh + 1rem)' : '1rem' }}
            >
                <Navigation className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Lokasi ({devices.length + ponds.length})</span>
                {sidebarOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {/* ─── Map Sidebar / Bottom Sheet ─── */}
            <div
                className={`absolute z-[500] bg-background/95 backdrop-blur-md border border-border/50 shadow-lg shadow-black/5 overflow-hidden transition-all duration-300 ease-in-out
                    flex flex-col md:top-4 md:left-4 md:w-80 md:rounded-xl md:max-h-[calc(100%-2rem)]
                    ${sidebarOpen
                        ? 'bottom-0 left-0 right-0 max-h-[55vh] md:bottom-auto md:right-auto md:opacity-100 md:translate-x-0 rounded-t-2xl md:rounded-xl'
                        : 'bottom-0 left-0 right-0 max-h-0 md:max-h-[calc(100%-2rem)] md:-translate-x-[calc(100%+2rem)] md:opacity-0 border-transparent'}
                `}
            >
                {/* Header */}
                <div className="p-4 border-b border-border/50 bg-muted/30 shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <Navigation className="w-4 h-4 text-primary" />
                            Device Tracking
                        </h2>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="md:hidden p-1 rounded-md hover:bg-muted transition-colors"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Real-time shrimp pond locations</p>
                </div>

                {/* Device & Pond List */}
                <div className="flex-1 overflow-y-auto p-2 pb-6 md:pb-2 space-y-2 custom-scrollbar">
                    {devices.length === 0 && ponds.length === 0 && !loading && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            Tidak ada data lokasi ditemukan.
                        </div>
                    )}

                    {/* Pond Section */}
                    {ponds.length > 0 && (
                        <>
                            <div className="px-2 pt-1 pb-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Kolam ({ponds.length})</span>
                            </div>
                            {ponds.map((pond) => {
                                const hasLocation = pond.parsedLocation !== null;
                                return (
                                    <button
                                        key={pond.id}
                                        onClick={() => { handleFlyTo(pond.parsedLocation); if (window.innerWidth < 768) setSidebarOpen(false); }}
                                        disabled={!hasLocation}
                                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200
                          ${!hasLocation ? 'opacity-50 cursor-not-allowed bg-muted/30 border-transparent' : 'bg-card hover:bg-accent hover:border-accent-foreground/20 cursor-pointer shadow-sm'}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                                    <Waves className="w-3.5 h-3.5 text-blue-500" />
                                                    {pond.name}
                                                    {!hasLocation && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">No GPS</span>}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">Kolam</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-[10px] text-muted-foreground">Update Terakhir</span>
                                                <span className="text-[10px] font-medium text-foreground">{pond.latestMetrics?.recorded_at ? new Date(pond.latestMetrics.recorded_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* Device Section */}
                    {devices.length > 0 && (
                        <>
                            <div className="px-2 pt-2 pb-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-green-500">Device ({devices.length})</span>
                            </div>
                            {devices.map((device) => {
                                const hasLocation = device.parsedLocation !== null;
                                return (
                                    <button
                                        key={device.id}
                                        onClick={() => { handleFlyTo(device.parsedLocation); if (window.innerWidth < 768) setSidebarOpen(false); }}
                                        disabled={!hasLocation}
                                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200
                          ${!hasLocation ? 'opacity-50 cursor-not-allowed bg-muted/30 border-transparent' : 'bg-card hover:bg-accent hover:border-accent-foreground/20 cursor-pointer shadow-sm'}`}
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
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-[10px] text-muted-foreground">Last Update</span>
                                                <span className="text-[10px] font-medium text-foreground">{device.last_update_at ? new Date(device.last_update_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </>
                    )}
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

                {mapType === "normal" ? (
                    <TileLayer
                        attribution='&copy; OpenStreetMap & CARTO'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        maxZoom={19}
                    />
                ) : (
                    <TileLayer
                        attribution='&copy; Esri &mdash; Source: Esri, Maxar'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                    />
                )}

                {devices.map(device => {
                    if (!device.parsedLocation) return null;

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

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                            <Activity className="w-3.5 h-3.5" />
                                            Status Info
                                        </div>
                                        <div className="bg-muted/40 p-2 rounded-lg text-xs">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Last Updated</p>
                                            <p className="font-medium text-foreground">{device.last_update_at ? new Date(device.last_update_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Highlight Marker from Riwayat */}
                {highlightPosition && (
                    <Marker
                        position={highlightPosition}
                        icon={L.divIcon({
                            className: "bg-transparent border-none",
                            html: `<div class="relative flex items-center justify-center w-10 h-10">
                                    <div class="absolute w-full h-full rounded-full bg-amber-500 opacity-20 animate-ping"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#f59e0b" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                                    <circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/>
                                    </svg>
                                </div>`,
                            iconSize: [20, 20],
                            iconAnchor: [20, 36],  // anchor di ujung bawah pin
                        })}
                    >
                        <Popup className="rounded-xl overflow-hidden shadow-xl border-none p-0 !my-1">
                            <div className="p-3 bg-background text-foreground min-w-[180px]">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                    <MapPin className="w-4 h-4 text-amber-500" />
                                    <span className="font-semibold text-sm">Lokasi Riwayat</span>
                                </div>
                                <div className="bg-muted/40 p-2 rounded-lg text-xs">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Koordinat</p>
                                    <p className="font-medium text-foreground">{highlightPosition[0].toFixed(6)}, {highlightPosition[1].toFixed(6)}</p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Pond Markers */}
                {ponds.map(pond => {
                    if (!pond.parsedLocation) return null;
                    return (
                        <Marker
                            key={`pond-${pond.id}`}
                            position={pond.parsedLocation}
                            icon={createPondIcon()}
                        >
                            <Popup className="rounded-xl overflow-hidden shadow-xl border-none p-0 !my-1">
                                <div className="p-3 bg-background text-foreground min-w-[220px]">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b">
                                        <div className="font-semibold text-sm flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-blue-500" />
                                            {pond.name}
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            Kolam
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                            <Activity className="w-3.5 h-3.5" />
                                            Metrik Terbaru
                                        </div>

                                        {pond.latestMetrics ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <div className="bg-muted/40 p-2 rounded-lg text-xs">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1"><Ruler className="w-3 h-3" /> Panjang</p>
                                                        <p className="font-medium text-foreground">{pond.latestMetrics.avg_body_length_cm} cm</p>
                                                    </div>
                                                    <div className="bg-muted/40 p-2 rounded-lg text-xs">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1"><Weight className="w-3 h-3" /> Berat</p>
                                                        <p className="font-medium text-foreground">{pond.latestMetrics.avg_body_weight_g} g</p>
                                                    </div>
                                                </div>
                                                <div className="bg-muted/40 p-2 rounded-lg text-xs">
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1"><Activity className="w-3 h-3" /> Aktivitas</p>
                                                    <p className="font-medium text-foreground">{pond.latestMetrics.activity_level_pct}%</p>
                                                </div>
                                                <div className="bg-muted/40 p-2 rounded-lg text-xs">
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Waktu Rekam</p>
                                                    <p className="font-medium text-foreground">{new Date(pond.latestMetrics.recorded_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-muted/40 p-2 rounded-lg text-xs text-center text-muted-foreground">
                                                Belum ada data metrik
                                            </div>
                                        )}
                                    </div>

                                    <Link
                                        href={`/riwayat?pond=${encodeURIComponent(pond.name)}`}
                                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Lihat Riwayat
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
