"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, Home, Activity, Map, MessageSquareText, Settings } from "lucide-react"
import { useTranslations } from "next-intl"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"

export function GlobalSearch({
    open,
    setOpen,
}: {
    open: boolean
    setOpen: (open: boolean) => void
}) {
    const router = useRouter()
    const t = useTranslations("globalSearch")

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(true)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [setOpen])

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false)
        command()
    }, [setOpen])

    return (
        <>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder={t("placeholder")} />
                <CommandList>
                    <CommandEmpty>{t("noResults")}</CommandEmpty>
                    <CommandGroup heading={t("pages")}>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/dashboard"))}
                        >
                            <Home className="mr-2 h-4 w-4" />
                            <span>{t("dashboard")}</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/webgis"))}
                        >
                            <Map className="mr-2 h-4 w-4" />
                            <span>{t("webgisTracker")}</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push("/chat-agent"))}
                        >
                            <MessageSquareText className="mr-2 h-4 w-4" />
                            <span>{t("chatAdvisor")}</span>
                        </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading={t("quickActions")}>
                        <CommandItem>
                            <Activity className="mr-2 h-4 w-4" />
                            <span>{t("viewLatestMetrics")}</span>
                        </CommandItem>
                        <CommandItem>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>{t("settings")}</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
