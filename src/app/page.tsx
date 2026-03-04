"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion, useInView, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion"
import {
  Eye,
  Cpu,
  Wifi,
  BarChart3,
  Bot,
  ArrowRight,
  Waves,
  Zap,
  Globe,
  Github,
  Mail,
  MapPin,
  ChevronRight,
  Ruler,
  Weight,
  Activity,
  MonitorSmartphone,
} from "lucide-react"

// --------------- Animation Wrappers ---------------

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const typingWords = ["Kecerdasan Buatan", "Artificial Intelligence"]

function TypingText() {
  const [wordIndex, setWordIndex] = useState(0)
  const [text, setText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const currentWord = typingWords[wordIndex]
    let timeout: NodeJS.Timeout

    if (!isDeleting && text === currentWord) {
      // Pause at full word, then start deleting
      timeout = setTimeout(() => setIsDeleting(true), 5000)
    } else if (isDeleting && text === "") {
      // Switch to next word
      setIsDeleting(false)
      setWordIndex((prev) => (prev + 1) % typingWords.length)
    } else {
      const speed = isDeleting ? 100 : 150
      timeout = setTimeout(() => {
        setText(isDeleting
          ? currentWord.substring(0, text.length - 1)
          : currentWord.substring(0, text.length + 1)
        )
      }, speed)
    }

    return () => clearTimeout(timeout)
  }, [text, isDeleting, wordIndex])

  return (
    <span className="inline-flex items-center">
      <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-600 bg-clip-text text-transparent">
        {text}
      </span>
      <motion.span
        className="inline-block w-[3px] h-[0.85em] bg-primary rounded-full ml-1 align-middle"
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
      />
    </span>
  )
}

function FloatingOrb({ className, delay = 0, duration = 6 }: { className: string; delay?: number; duration?: number }) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -20, 0, 15, 0],
        x: [0, 10, -5, 8, 0],
        scale: [1, 1.05, 0.97, 1.03, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

function AnimatedCounter({ value, suffix = "" }: { value: string; suffix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const numericPart = parseFloat(value.replace(/[^0-9.]/g, ""))
  const prefix = value.replace(/[0-9.+%<>s]/g, "")
  const hasLt = value.includes("<")
  const hasPlus = value.includes("+")

  const motionVal = useMotionValue(0)
  const spring = useSpring(motionVal, { stiffness: 50, damping: 20 })
  const [display, setDisplay] = useState("0")

  useEffect(() => {
    if (isInView) {
      motionVal.set(numericPart)
    }
  }, [isInView, motionVal, numericPart])

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (value.includes(".")) {
        setDisplay(v.toFixed(1))
      } else {
        setDisplay(Math.round(v).toString())
      }
    })
    return unsub
  }, [spring, value])

  return (
    <span ref={ref}>
      {hasLt && "<"}{prefix}{display}{value.includes("%") ? "%" : ""}{value.includes("s") && !value.includes("%") ? "s" : ""}{hasPlus ? "+" : ""}{suffix}
    </span>
  )
}

// --------------- Ocean Decorative Components ---------------

function Bubbles({ className = "", count = 6 }: { className?: string; count?: number }) {
  const bubbles = Array.from({ length: count }, (_, i) => ({
    cx: 30 + (i % 3) * 60 + Math.sin(i) * 20,
    cy: 40 + Math.floor(i / 3) * 70 + Math.cos(i) * 15,
    r: 8 + (i % 4) * 6,
    delay: i * 0.6,
  }))
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      <svg width="220" height="240" viewBox="0 0 220 240" fill="none">
        {bubbles.map((b, i) => (
          <motion.circle
            key={i}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.12"
            fill="none"
            animate={{ cy: [b.cy, b.cy - 18, b.cy], scale: [1, 1.08, 1] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: b.delay }}
          />
        ))}
        {/* Tiny filled bubbles */}
        {[{ cx: 80, cy: 180, r: 3 }, { cx: 150, cy: 60, r: 4 }, { cx: 45, cy: 130, r: 2.5 }].map((b, i) => (
          <motion.circle
            key={`fill-${i}`}
            cx={b.cx} cy={b.cy} r={b.r}
            fill="currentColor" opacity="0.08"
            animate={{ cy: [b.cy, b.cy - 25, b.cy], opacity: [0.05, 0.12, 0.05] }}
            transition={{ duration: 5, repeat: Infinity, delay: i * 1.2 }}
          />
        ))}
      </svg>
    </div>
  )
}

function SeaweedSilhouette({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <div className={`absolute pointer-events-none ${className}`} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <svg width="120" height="320" viewBox="0 0 120 320" fill="none">
        <motion.path
          d="M60,320 C60,280 30,260 40,220 C50,180 70,170 55,130 C40,90 65,60 50,20 C48,14 52,8 50,0"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.06"
          fill="none"
          strokeLinecap="round"
          animate={{
            d: [
              "M60,320 C60,280 30,260 40,220 C50,180 70,170 55,130 C40,90 65,60 50,20 C48,14 52,8 50,0",
              "M60,320 C55,280 35,260 45,220 C55,180 65,170 50,130 C35,90 60,60 55,20 C53,14 47,8 50,0",
              "M60,320 C60,280 30,260 40,220 C50,180 70,170 55,130 C40,90 65,60 50,20 C48,14 52,8 50,0",
            ]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Leaf fronds */}
        <motion.path
          d="M40,220 C20,210 10,195 25,185"
          stroke="currentColor" strokeWidth="1.5" opacity="0.05" fill="none" strokeLinecap="round"
          animate={{ d: ["M40,220 C20,210 10,195 25,185", "M45,220 C25,208 15,195 30,185", "M40,220 C20,210 10,195 25,185"] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <motion.path
          d="M55,130 C75,120 90,105 80,95"
          stroke="currentColor" strokeWidth="1.5" opacity="0.05" fill="none" strokeLinecap="round"
          animate={{ d: ["M55,130 C75,120 90,105 80,95", "M50,130 C70,118 85,105 75,95", "M55,130 C75,120 90,105 80,95"] }}
          transition={{ duration: 5.5, repeat: Infinity }}
        />
      </svg>
    </div>
  )
}

function OceanWaves({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      <svg width="300" height="100" viewBox="0 0 300 100" fill="none">
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d={`M0,${40 + i * 20} C50,${25 + i * 20} 100,${55 + i * 20} 150,${40 + i * 20} C200,${25 + i * 20} 250,${55 + i * 20} 300,${40 + i * 20}`}
            stroke="currentColor"
            strokeWidth="1.5"
            opacity={0.06 - i * 0.015}
            fill="none"
            strokeLinecap="round"
            animate={{
              d: [
                `M0,${40 + i * 20} C50,${25 + i * 20} 100,${55 + i * 20} 150,${40 + i * 20} C200,${25 + i * 20} 250,${55 + i * 20} 300,${40 + i * 20}`,
                `M0,${40 + i * 20} C50,${55 + i * 20} 100,${25 + i * 20} 150,${40 + i * 20} C200,${55 + i * 20} 250,${25 + i * 20} 300,${40 + i * 20}`,
                `M0,${40 + i * 20} C50,${25 + i * 20} 100,${55 + i * 20} 150,${40 + i * 20} C200,${25 + i * 20} 250,${55 + i * 20} 300,${40 + i * 20}`,
              ],
            }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
    </div>
  )
}

function ShrimpSilhouette({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      <motion.svg
        width="140" height="80" viewBox="0 0 140 80" fill="none"
        animate={{ y: [0, -8, 0], rotate: [0, 2, -1, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Simplified shrimp body */}
        <path
          d="M110,40 C100,25 80,18 60,20 C40,22 25,30 15,40 C25,50 40,58 60,60 C80,62 100,55 110,40 Z"
          stroke="currentColor" strokeWidth="1.5" opacity="0.06" fill="none"
        />
        {/* Tail */}
        <path
          d="M15,40 C8,35 3,38 5,45 C7,52 12,48 15,40"
          stroke="currentColor" strokeWidth="1" opacity="0.05" fill="none"
        />
        {/* Antennae */}
        <path d="M110,38 C120,30 130,25 138,22" stroke="currentColor" strokeWidth="1" opacity="0.05" fill="none" strokeLinecap="round" />
        <path d="M110,42 C120,48 128,52 135,58" stroke="currentColor" strokeWidth="1" opacity="0.05" fill="none" strokeLinecap="round" />
      </motion.svg>
    </div>
  )
}

function ShellOrnament({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      <motion.svg
        width="80" height="80" viewBox="0 0 80 80" fill="none"
        animate={{ rotate: [0, 5, -3, 0], scale: [1, 1.03, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Spiral shell */}
        <path
          d="M40,70 C20,70 5,55 5,40 C5,20 20,5 40,5 C55,5 65,15 65,30 C65,42 55,50 45,50 C38,50 32,44 32,38 C32,33 36,29 40,29"
          stroke="currentColor" strokeWidth="1.5" opacity="0.07" fill="none" strokeLinecap="round"
        />
        {/* Ridges */}
        <path d="M15,55 C25,45 35,50" stroke="currentColor" strokeWidth="1" opacity="0.04" fill="none" />
        <path d="M10,45 C20,38 30,42" stroke="currentColor" strokeWidth="1" opacity="0.04" fill="none" />
      </motion.svg>
    </div>
  )
}

function WaveDivider({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-[0] ${flip ? "rotate-180" : ""} ${className}`}>
      <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-16 md:h-24">
        <path
          d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z"
          className="fill-background"
        />
      </svg>
    </div>
  )
}

// --------------- Data ---------------

const features = [
  {
    icon: Eye,
    title: "AI Growth Monitoring",
    description: "Deteksi otomatis panjang dan berat udang menggunakan model YOLOv11 dan regresi presisi tinggi.",
    color: "#22c55e",
    gradient: "from-green-500/10 to-green-500/5",
  },
  {
    icon: Wifi,
    title: "IoT Smart Control",
    description: "Monitoring daya listrik (PZEM-004T) dan kontrol otomatis kincir air (paddlewheel) menggunakan ESP32.",
    color: "#f59e0b",
    gradient: "from-orange-500/10 to-orange-500/5",
  },
  {
    icon: Cpu,
    title: "Edge Computing",
    description: "Integrasi mulus dengan hardware Jetson Nano untuk pemrosesan video langsung di lokasi tambak.",
    color: "#6366f1",
    gradient: "from-indigo-500/10 to-indigo-500/5",
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Visualisasi data interaktif untuk memantau kesehatan ekosistem tambak secara real-time.",
    color: "#ec4899",
    gradient: "from-pink-500/10 to-pink-500/5",
  },
]

const techStack = [
  { name: "Next.js", category: "Frontend" },
  { name: "Python", category: "AI/ML" },
  { name: "FastAPI", category: "Backend" },
  { name: "YOLOv11", category: "Computer Vision" },
  { name: "ESP32", category: "IoT" },
  { name: "Jetson Nano", category: "Edge AI" },
  { name: "PostgreSQL", category: "Database" },
  { name: "TensorFlow", category: "Deep Learning" },
]

const stats = [
  { label: "Akurasi Deteksi", value: "96.8%", icon: Eye },
  { label: "Waktu Respons", value: "<2s", icon: Zap },
  { label: "Device Terhubung", value: "50+", icon: MonitorSmartphone },
  { label: "Tambak Aktif", value: "12", icon: Waves },
]

// --------------- Component ---------------

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ====== NAVBAR ====== */}
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div whileHover={{ rotate: 15, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
              <Image src="/Shrimpy-Logo.png" alt="Shrimpie" width={32} height={32} />
            </motion.div>
            <span className="text-xl font-bold text-foreground">Shrimpie</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {["Fitur", "Teknologi", "WebGIS", "Tentang Kami"].map((item, i) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(/\s/g, "-")}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary rounded-full transition-all duration-300 group-hover:w-full" />
              </motion.a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="rounded-full">
                Masuk
              </Button>
            </Link>
            <Link href="/dashboard">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="sm" className="rounded-full">
                  Daftar
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ====== HERO ====== */}
      <section className="relative py-20 md:py-30 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 -z-10">
          <FloatingOrb
            className="absolute top-20 left-[15%] w-80 h-80 bg-primary/8 rounded-full blur-3xl"
            delay={0}
            duration={8}
          />
          <FloatingOrb
            className="absolute bottom-10 right-[15%] w-72 h-72 bg-green-500/8 rounded-full blur-3xl"
            delay={2}
            duration={7}
          />
          <FloatingOrb
            className="absolute top-1/3 right-[30%] w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"
            delay={1}
            duration={9}
          />
          <FloatingOrb
            className="absolute bottom-1/4 left-[10%] w-48 h-48 bg-orange-500/5 rounded-full blur-3xl"
            delay={3}
            duration={6}
          />
        </div>

        {/* Ocean ornaments — bubbles, seaweed, waves, shrimp */}
        <Bubbles className="top-20 right-6 text-primary hidden md:block" count={7} />
        <Bubbles className="bottom-16 left-4 text-indigo-500 hidden md:block" count={5} />
        <SeaweedSilhouette className="bottom-0 left-[5%] text-green-600 hidden md:block" />
        <SeaweedSilhouette className="bottom-0 right-[6%] text-green-600 hidden md:block" flip />
        <OceanWaves className="top-28 left-[8%] text-primary hidden md:block" />
        <ShrimpSilhouette className="bottom-28 right-[10%] text-orange-500 hidden md:block" />
        <ShellOrnament className="top-36 right-[25%] text-indigo-500 hidden lg:block" />

        <div className="max-w-7xl mx-auto px-6 text-center relative">
          <FadeUp>
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8"
              animate={{ boxShadow: ["0 0 0 0 rgba(99,102,241,0)", "0 0 0 8px rgba(99,102,241,0.05)", "0 0 0 0 rgba(99,102,241,0)"] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Waves className="w-4 h-4" />
              </motion.div>
              <span>Solusi Cerdas untuk Tambak Udang</span>
            </motion.div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="flex items-center justify-center gap-4 mb-2">
              <motion.div
                animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <motion.div
                  className="absolute -inset-3 rounded-2xl bg-primary/10 blur-lg"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <Bot className="w-12 h-12 md:w-16 md:h-16 text-primary relative z-10" />
              </motion.div>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight max-w-5xl mx-auto">
              Revolusi Tambak Udang dengan
            </h1>
            <div className="min-h-[2.5rem] md:min-h-[3.5rem] lg:min-h-[4.5rem] flex items-center justify-center">
              <span className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                <TypingText />
              </span>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Monitoring pertumbuhan udang Vannamei secara real-time menggunakan
              Computer Vision dan kontrol IoT yang presisi.
            </p>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="rounded-full px-8 gap-2 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                    Buka Dashboard
                    <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </Button>
                </motion.div>
              </Link>
              <a href="#fitur">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="outline" size="lg" className="rounded-full px-8 text-base">
                    Pelajari Teknologi Kami
                  </Button>
                </motion.div>
              </a>
            </div>
          </FadeUp>

          {/* Hero metric cards */}
          <FadeUp delay={0.4} className="mt-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1, duration: 0.5, type: "spring" }}
                  whileHover={{ y: -4, scale: 1.03 }}
                >
                  <Card className="rounded-2xl py-0 border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300 hover:border-primary/20">
                    <CardContent className="p-4 text-center">
                      <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
                      >
                        <stat.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                      </motion.div>
                      <p className="text-2xl font-bold text-foreground">
                        <AnimatedCounter value={stat.value} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Wave divider */}
      <WaveDivider flip className="-mt-1 text-background" />

      {/* ====== FEATURES ====== */}
      <section id="fitur" className="py-20 md:py-28 relative">
        {/* Section ornaments */}
        <FloatingOrb
          className="absolute top-20 right-0 w-64 h-64 bg-green-500/3 rounded-full blur-3xl"
          delay={1}
          duration={7}
        />

        <div className="max-w-7xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <motion.span
                className="inline-block text-sm font-semibold text-primary uppercase tracking-wider"
                initial={{ opacity: 0, letterSpacing: "0em" }}
                whileInView={{ opacity: 1, letterSpacing: "0.1em" }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                Fitur Utama
              </motion.span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
                Teknologi Mutakhir untuk Tambak Modern
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Empat pilar teknologi yang bekerja sinergis untuk meningkatkan efisiensi dan produktivitas tambak.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <FadeUp key={feature.title} delay={index * 0.1}>
                <motion.div whileHover={{ y: -6, scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Card className={`rounded-2xl py-0 border-border/50 hover:shadow-xl transition-all duration-300 group bg-gradient-to-br ${feature.gradient} hover:border-border relative overflow-hidden`}>
                    {/* Hover glow effect */}
                    <div
                      className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                      style={{ backgroundColor: feature.color }}
                    />
                    <CardContent className="p-8 relative z-10">
                      <motion.div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                        style={{ backgroundColor: `${feature.color}15` }}
                        whileHover={{ rotate: 5, scale: 1.1 }}
                      >
                        <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-foreground transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                      {/* Bottom accent line */}
                      <div
                        className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500"
                        style={{ backgroundColor: feature.color }}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
        <Bubbles className="top-10 right-10 text-foreground" count={4} />
        <OceanWaves className="bottom-10 left-10 text-foreground" />

        <div className="max-w-7xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Cara Kerja</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
                Dari Kamera ke Dashboard dalam Hitungan Detik
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line ornament */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {[
              {
                step: "01",
                icon: Eye,
                title: "Capture & Analyze",
                desc: "Kamera menangkap gambar udang, lalu AI mengidentifikasi ukuran dan berat secara otomatis.",
                color: "#22c55e",
              },
              {
                step: "02",
                icon: Cpu,
                title: "Edge Processing",
                desc: "Data diproses langsung di Jetson Nano, mengurangi latensi dan kebutuhan koneksi internet.",
                color: "#f59e0b",
              },
              {
                step: "03",
                icon: BarChart3,
                title: "Visualize & Act",
                desc: "Hasil analisis ditampilkan di dashboard real-time dan perangkat IoT merespons secara otomatis.",
                color: "#6366f1",
              },
            ].map((item, i) => (
              <FadeUp key={item.step} delay={i * 0.15}>
                <motion.div
                  className="relative text-center"
                  whileHover={{ y: -4 }}
                >
                  <motion.div
                    className="text-6xl font-black text-muted/50 mb-4"
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2, type: "spring" }}
                  >
                    {item.step}
                  </motion.div>
                  <motion.div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative"
                    style={{ backgroundColor: `${item.color}15` }}
                    whileHover={{ rotate: 10, scale: 1.1 }}
                  >
                    <item.icon className="w-7 h-7" style={{ color: item.color }} />
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl"
                      style={{ border: `2px solid ${item.color}` }}
                      animate={{ scale: [1, 1.4, 1.4], opacity: [0.3, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                    />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ====== MONITORING PREVIEW ====== */}
      <section className="py-20 md:py-28 relative">
        <FloatingOrb
          className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/3 rounded-full blur-3xl"
          delay={2}
          duration={8}
        />

        <div className="max-w-7xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Live Preview</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
                Metrik yang Dipantau Secara Real-time
              </h2>
            </div>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Avg Body Length", value: "7.82 cm", icon: Ruler, color: "#22c55e", change: "+0.12 cm" },
              { title: "Avg Body Weight", value: "14.5 g", icon: Weight, color: "#f59e0b", change: "+0.8 g" },
              { title: "Activity Level", value: "78.3%", icon: Activity, color: "#6366f1", change: "+5.2%" },
            ].map((metric, i) => (
              <FadeUp key={metric.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -6, scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Card className="rounded-2xl py-0 border-border/50 hover:shadow-xl transition-all group overflow-hidden relative">
                    {/* Background glow */}
                    <div
                      className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                      style={{ backgroundColor: metric.color }}
                    />
                    <CardContent className="p-6 relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <motion.div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${metric.color}15` }}
                          whileHover={{ rotate: 15 }}
                        >
                          <metric.icon className="w-5 h-5" style={{ color: metric.color }} />
                        </motion.div>
                        <motion.span
                          className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-600"
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {metric.change}
                        </motion.span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{metric.title}</p>
                      {/* Animated gradient bar */}
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-1"
                        style={{ background: `linear-gradient(to right, ${metric.color}, transparent)` }}
                        initial={{ scaleX: 0, originX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.15 }}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ====== TECH STACK ====== */}
      <section id="teknologi" className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
        <motion.div
          className="absolute top-[50%] left-[50%] w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-[50%] left-[50%] w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
        />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <FadeUp>
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Tech Stack</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
                Dibangun dengan Teknologi Terbaik
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Kombinasi framework dan hardware canggih untuk performa optimal.
              </p>
            </div>
          </FadeUp>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {techStack.map((tech, i) => (
              <FadeUp key={tech.name} delay={i * 0.05}>
                <motion.div whileHover={{ y: -4, scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Card className="rounded-xl py-0 border-border/50 hover:shadow-md hover:border-primary/30 transition-all text-center group bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {tech.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{tech.category}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ====== WEBGIS ====== */}
      <section id="webgis" className="py-20 md:py-28 relative">
        <FloatingOrb className="absolute top-20 right-10 w-48 h-48 bg-primary/3 rounded-full blur-3xl" delay={1} duration={7} />

        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">WebGIS</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
                Pemetaan Tambak Berbasis Web
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Visualisasikan lokasi semua tambak Anda dalam satu peta interaktif.
                Pantau status setiap kolam, perangkat terhubung, dan kondisi lingkungan
                secara spasial.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "Lokasi tambak real-time dengan koordinat GPS",
                  "Overlay data kualitas air per kolam",
                  "Analisis spasial area sekitar tambak",
                ].map((item, i) => (
                  <motion.div
                    key={item}
                    className="flex items-center gap-3 text-sm text-foreground"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                  >
                    <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}>
                      <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                    </motion.div>
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-8">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" className="rounded-full gap-2">
                    <Globe className="w-4 h-4" />
                    Lihat WebGIS
                  </Button>
                </motion.div>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 200 }}>
                <Card className="rounded-2xl py-0 border-border/50 overflow-hidden group">
                  <CardContent className="p-0 aspect-video bg-muted/50 flex items-center justify-center relative">
                    {/* Animated map pin dots */}
                    {[
                      { top: "30%", left: "25%" },
                      { top: "50%", left: "60%" },
                      { top: "65%", left: "35%" },
                    ].map((pos, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-3 h-3 bg-primary rounded-full"
                        style={pos}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-primary rounded-full"
                          animate={{ scale: [1, 3], opacity: [0.4, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                        />
                      </motion.div>
                    ))}
                    <div className="text-center p-8 relative z-10">
                      <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                        <Globe className="w-16 h-16 text-primary/30 mx-auto mb-4" />
                      </motion.div>
                      <p className="text-sm text-muted-foreground">Peta Interaktif Tambak</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ====== CTA ====== */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <FadeUp>
            <motion.div whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 200 }}>
              <Card className="rounded-3xl py-0 border-0 bg-gradient-to-br from-primary via-indigo-600 to-purple-700 overflow-hidden relative group">
                {/* Animated shimmer */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
                  animate={{ x: ["-200%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />

                {/* Floating particles */}
                {[
                  { top: "25%", left: "15%", dur: 3.5 },
                  { top: "45%", left: "75%", dur: 4.2 },
                  { top: "65%", left: "35%", dur: 3.8 },
                  { top: "35%", left: "55%", dur: 4.5 },
                  { top: "55%", left: "25%", dur: 3.2 },
                  { top: "40%", left: "85%", dur: 4.0 },
                ].map((p, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-white/20 rounded-full"
                    style={{ top: p.top, left: p.left }}
                    animate={{
                      y: [0, -20, 0],
                      opacity: [0, 0.5, 0],
                    }}
                    transition={{
                      duration: p.dur,
                      repeat: Infinity,
                      delay: i * 0.5,
                    }}
                  />
                ))}

                <CardContent className="p-12 md:p-16 text-center relative z-10">
                  <motion.h2
                    className="text-3xl md:text-4xl font-bold text-white mb-4"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    Siap Mengoptimalkan Tambak Anda?
                  </motion.h2>
                  <p className="text-white/80 text-lg max-w-lg mx-auto mb-8">
                    Mulai monitoring cerdas sekarang dan tingkatkan produktivitas tambak udang Anda.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/dashboard">
                      <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                        <Button size="lg" variant="secondary" className="rounded-full px-8 gap-2 text-base font-semibold shadow-lg">
                          Mulai Sekarang
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    </Link>
                    <a href="mailto:info@shrimpie.id">
                      <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                        <Button size="lg" variant="ghost" className="rounded-full px-8 text-white hover:bg-white/10 hover:text-white text-base">
                          Hubungi Kami
                        </Button>
                      </motion.div>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </FadeUp>
        </div>
      </section>

      {/* ====== ABOUT ====== */}
      <section id="tentang-kami" className="py-20 md:py-28 bg-muted/30 relative">
        <FloatingOrb className="absolute top-10 left-10 w-48 h-48 bg-primary/3 rounded-full blur-3xl" delay={0} duration={6} />

        <div className="max-w-7xl mx-auto px-6">
          <FadeUp>
            <div className="text-center mb-12">
              <span className="text-sm font-semibold text-primary uppercase tracking-wider">Tentang Kami</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-foreground">
                Tim di Balik Shrimpie
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Kami adalah tim mahasiswa dan peneliti yang bersemangat menggabungkan
                kecerdasan buatan dengan akuakultur untuk membantu petambak Indonesia
                meningkatkan hasil panen secara berkelanjutan.
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-4 group">
                <motion.div whileHover={{ rotate: 15, scale: 1.1 }}>
                  <Image src="/Shrimpy-Logo.png" alt="Shrimpie" width={28} height={28} />
                </motion.div>
                <span className="text-lg font-bold text-foreground">Shrimpie</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                Solusi cerdas untuk manajemen tambak udang Vannamei menggunakan AI Computer Vision dan IoT.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Produk</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
                <li><Link href="/riwayat" className="hover:text-foreground transition-colors">Riwayat</Link></li>
                <li><a href="#webgis" className="hover:text-foreground transition-colors">WebGIS</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Kontak</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>info@shrimpie.id</span>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Indonesia</span>
                </li>
                <li className="flex items-center gap-2">
                  <Github className="w-4 h-4 shrink-0" />
                  <span>github.com/shrimpie</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Shrimpie. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
