"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { motion } from "framer-motion"
import { Ruler, Weight, Activity } from "lucide-react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"


const frameworks = [
  "Device 1",
  "Device 2",
  "Device 3",
  "Device 4",
  "Device 5",
] as const

const videoFiles = [
  "04032026-0800.mp4",
  "04032026-1200.mp4",
  "04032026-1600.mp4",
  "04032026-2000.mp4",
]

function generateRandomData() {
  return Array.from({ length: 20 }, (_, i) => ({
    time: i,
    value: Math.floor(Math.random() * 50) + 10,
  }))
}

export default function ShrimpMonitoringDashboard() {
  const [selectedVideo, setSelectedVideo] = useState(videoFiles[0])
  const [cards, setCards] = useState([
    { title: "Avg Body Length (cm)", value: 0, data: generateRandomData(), color: "#22c55e", icon: Ruler },
    { title: "Avg Body Weight (g)", value: 0, data: generateRandomData(), color: "#f59e0b", icon: Weight },
    { title: "Activity Level (%)", value: 0, data: generateRandomData(), color: "#6366f1", icon: Activity },
  ])

  const [deviceStatus, setDeviceStatus] = useState([
    { name: "Device 1", status: "Active", lastUpdate: "2 min ago", battery: "85%" },
    { name: "Device 2", status: "Active", lastUpdate: "1 min ago", battery: "92%" },
    { name: "Device 3", status: "Inactive", lastUpdate: "15 min ago", battery: "12%" },
    { name: "Device 4", status: "Active", lastUpdate: "3 min ago", battery: "67%" },
    { name: "Device 5", status: "Active", lastUpdate: "1 min ago", battery: "78%" },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setCards((prev) =>
        prev.map((card) => ({
          ...card,
          value: parseFloat((Math.random() * 100).toFixed(2)),
          data: generateRandomData(),
        }))
      )
      setDeviceStatus((prev) =>
        prev.map((device) => ({
          ...device,
          status: Math.random() > 0.2 ? "Active" : "Inactive",
          lastUpdate: `${Math.floor(Math.random() * 10) + 1} min ago`,
          battery: `${Math.floor(Math.random() * 60) + 40}%`,
        }))
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="aspect-video bg-black rounded-xl flex items-center justify-center">
                <video
                  src="/car.mp4"
                  controls
                  className="w-full h-full rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Season & Episode Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow h-full">
            <CardContent className="p-6 flex flex-col gap-2">
              <div>
                <h2 className="text-xl font-semibold mb-3 text-foreground">Select Device</h2>
                <Combobox items={frameworks} defaultValue="Device 1">
                  <ComboboxInput placeholder="Select a Device" />
                  <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-3 text-foreground">Select Video</h2>
                <div className="grid grid-cols-2 gap-3">
                  {videoFiles.map((file) => {
                    const name = file.replace(".mp4", "")
                    const date = name.slice(0, 8)
                    const time = name.slice(9)
                    const label = `${date.slice(0, 2)}/${date.slice(2, 4)}/${date.slice(4)} ${time.slice(0, 2)}:${time.slice(2)}`
                    return (
                      <Button
                        key={file}
                        variant={selectedVideo === file ? "default" : "outline"}
                        onClick={() => setSelectedVideo(file)}
                        className="rounded-xl text-xs"
                      >
                        {label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Device Status Table + Realtime Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {/* Device Status Table - spans 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 md:col-span-2"
        >
          <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col h-[208px]">
              <h3 className="text-sm font-semibold text-foreground mb-3">Device Status</h3>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Device</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground">Last Update</th>
                      <th className="pb-2 font-medium text-muted-foreground">Battery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceStatus.map((device) => (
                      <tr key={device.name} className="border-b border-border/50 last:border-0">
                        <td className="py-2 font-medium text-foreground">{device.name}</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${device.status === "Active"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${device.status === "Active" ? "bg-green-500" : "bg-red-500"
                              }`} />
                            {device.status}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{device.lastUpdate}</td>
                        <td className="py-2 text-muted-foreground">{device.battery}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Remaining Metric Cards */}
        {cards.map((card, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index + 1) * 0.1 }}
          >
            <Card className="rounded-2xl py-0 border-border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <h3 className="text-xs font-medium text-muted-foreground">{card.title}</h3>
                  </div>
                  <card.icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
                <div className="h-28 mt-4 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={card.data}>
                      <defs>
                        <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.7} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis
                        hide
                        domain={[
                          (dataMin: number) => dataMin - 10,
                          (dataMax: number) => dataMax + 10,
                        ]}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={card.color}
                        strokeWidth={1.5}
                        fill={`url(#gradient-${index})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}