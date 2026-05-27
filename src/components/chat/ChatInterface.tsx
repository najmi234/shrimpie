"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
    Send,
    Bot,
    User,
    Loader2,
    Activity,
    Weight,
    Ruler,
    Clock,
    Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    saveMessage,
    createConversation,
    updateConversationTitle,
    getMessages,
    type ChatMessageRow,
} from "@/lib/chat/chat-persistence";

// Type definitions
interface PondMetric {
    pond_id: string;
    avg_body_length_cm: number;
    avg_body_weight_g: number;
    activity_level_pct: number;
    recorded_at: string;
}

export interface PondParameters {
    avg_weight: number;
    avg_length: number;
    activity_level: number;
    pondName?: string;
    metricsHistory?: PondMetric[];
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: Date;
}

interface ChatInterfaceProps {
    parameters: PondParameters;
    conversationId: string | null;
    userId: string | null;
    onConversationCreated: (id: string, title: string) => void;
}

// function formatDate(dateStr: string) {
//     const d = new Date(dateStr);
//     const dd = String(d.getDate()).padStart(2, "0");
//     const mm = String(d.getMonth() + 1).padStart(2, "0");
//     const yyyy = d.getFullYear();
//     const hh = String(d.getHours()).padStart(2, "0");
//     const min = String(d.getMinutes()).padStart(2, "0");
//     return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
// }

// function buildWelcomeMessage(parameters: PondParameters): ChatMessage {
//     return {
//         id: "welcome",
//         role: "assistant",
//         content: `Halo! Saya adalah **Shrimpie Advisor** Anda.${parameters.pondName ? ` Saya telah menganalisis data dari kolam **${parameters.pondName}**.` : ""}

// **Parameter Kolam Saat Ini:**
// - Rata-rata Berat: **${parameters.avg_weight.toFixed(1)} gram**
// - Rata-rata Panjang: **${parameters.avg_length.toFixed(1)} cm**
// - Tingkat Keaktifan: **${parameters.activity_level.toFixed(1)} px/s**

// Ada yang bisa saya bantu terkait penanganan udang Anda hari ini?`,
//         createdAt: new Date(),
//     };
// }

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function buildWelcomeMessage(parameters: PondParameters): ChatMessage {
    return {
        id: "welcome",
        role: "assistant",
        content: `Hello! I am your **Shrimpie Advisor**.${parameters.pondName ? ` I have analyzed the data from the **${parameters.pondName}** pond.` : ""}

**Current Pond Parameters:**
- Average Weight: **${parameters.avg_weight.toFixed(1)} grams**
- Average Length: **${parameters.avg_length.toFixed(1)} cm**
- Activity Level: **${parameters.activity_level.toFixed(1)} px/s**

Is there anything I can help you with regarding your shrimp management today?`,
        createdAt: new Date(),
    };
}

export default function ChatInterface({
    parameters,
    conversationId,
    userId,
    onConversationCreated,
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Load messages from Supabase when conversationId changes
    useEffect(() => {
        if (!conversationId) {
            // New conversation — show welcome message
            setMessages([buildWelcomeMessage(parameters)]);
            return;
        }

        // Load persisted messages
        let cancelled = false;
        async function loadMessages() {
            const rows = await getMessages(conversationId!);
            if (cancelled) return;

            if (rows.length === 0) {
                setMessages([buildWelcomeMessage(parameters)]);
                return;
            }

            const loaded: ChatMessage[] = rows.map((r: ChatMessageRow) => ({
                id: r.id,
                role: r.role,
                content: r.content,
                createdAt: new Date(r.created_at),
            }));
            setMessages(loaded);
        }
        loadMessages();

        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    // Reset to welcome when parameters change and no conversation loaded
    useEffect(() => {
        if (!conversationId) {
            setMessages([buildWelcomeMessage(parameters)]);
        }
    }, [
        parameters.avg_weight,
        parameters.avg_length,
        parameters.activity_level,
        parameters.pondName,
    ]);

    // Auto-scroll to bottom of chat
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userContent = input.trim();
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: userContent,
            createdAt: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // ─── Ensure conversation exists ─────────────────────
        let activeConversationId = conversationId;

        if (!activeConversationId && userId) {
            // Create a new conversation
            const title =
                userContent.length > 60
                    ? userContent.slice(0, 60) + "..."
                    : userContent;
            const conv = await createConversation(
                userId,
                undefined,
                parameters.pondName,
                title
            );
            if (conv) {
                activeConversationId = conv.id;
                onConversationCreated(conv.id, title);
            }
        }

        // ─── Save user message to database ──────────────────
        if (activeConversationId) {
            await saveMessage(activeConversationId, "user", userContent);
        }

        // ─── Stream AI response ─────────────────────────────
        const assistantId = (Date.now() + 1).toString();
        setMessages((prev) => [
            ...prev,
            {
                id: assistantId,
                role: "assistant",
                content: "",
                createdAt: new Date(),
            },
        ]);
        setIsStreaming(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const allMessages = messages
                .filter((m) => m.id !== "welcome")
                .map((m) => ({ role: m.role, content: m.content }))
                .concat({ role: "user", content: userContent });

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: allMessages,
                    parameters: parameters,
                    conversationId: activeConversationId,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new Error("Failed to send message");
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE lines from the buffer
                const lines = buffer.split("\n");
                // Keep the last potentially incomplete line in the buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data: ")) continue;

                    const payload = trimmed.slice(6);
                    if (payload === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                        if (parsed.text) {
                            fullText += parsed.text;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? { ...m, content: fullText }
                                        : m
                                )
                            );
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }

            // Handle any remaining data in the buffer
            if (buffer.trim().startsWith("data: ")) {
                const payload = buffer.trim().slice(6);
                if (payload !== "[DONE]") {
                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.text) {
                            fullText += parsed.text;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? { ...m, content: fullText }
                                        : m
                                )
                            );
                        }
                    } catch {
                        // Skip
                    }
                }
            }

            // If no text was received, show fallback
            if (!fullText) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? {
                                ...m,
                                content:
                                    "Maaf, terjadi kesalahan saat memproses permintaan Anda.",
                            }
                            : m
                    )
                );
            }
        } catch (error: any) {
            if (error.name === "AbortError") return;

            console.error("Chat error:", error);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                            ...m,
                            content:
                                "Maaf, sistem sedang mengalami gangguan. Silakan coba beberapa saat lagi.",
                        }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const metricCards = [
        {
            label: "Average Weight",
            value: parameters.avg_weight.toFixed(1),
            unit: "gram",
            icon: Weight,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
        },
        {
            label: "Average Length",
            value: parameters.avg_length.toFixed(1),
            unit: "cm",
            icon: Ruler,
            color: "text-green-500",
            bg: "bg-green-500/10",
        },
        {
            label: "Activity Level",
            value: parameters.activity_level.toFixed(1),
            unit: "px/s",
            icon: Activity,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
        },
    ];

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Top Metrics Bar */}
            <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-muted/10">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Pond Info */}
                    <div className="flex items-center gap-3 shrink-0">
                        {parameters.pondName && (
                            <div className="flex items-center gap-1.5 bg-background border border-border/50 rounded-full px-3 py-1 shadow-sm">
                                <Circle className="w-2 h-2 fill-current text-teal-500" />
                                <span className="text-xs font-medium text-foreground">
                                    Pond {parameters.pondName}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Metric Cards */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                        {metricCards.map((card) => (
                            <div
                                key={card.label}
                                className="bg-background border border-border/50 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0 shadow-sm"
                            >
                                <div className={`w-7 h-7 rounded-md ${card.bg} flex items-center justify-center shrink-0`}>
                                    <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-sm font-bold text-foreground leading-none">
                                        {card.value} <span className="font-normal text-[10px] text-muted-foreground">{card.unit}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {card.label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex gap-4 max-w-4xl mx-auto ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border text-foreground"}`}>
                                {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>

                            <div className={`flex flex-col gap-1 min-w-0 ${message.role === "user" ? "items-end" : "items-start"}`}>
                                <span className="text-xs text-muted-foreground px-1">
                                    {message.role === "user" ? "You" : "Shrimpie Advisor"}
                                </span>
                                <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm prose dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 ${message.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-muted/50 border rounded-tl-sm text-foreground"
                                    }`}>
                                    {message.role === "user" ? (
                                        <div className="whitespace-pre-wrap">{message.content}</div>
                                    ) : (
                                        <ReactMarkdown
                                            components={{
                                                table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full border-collapse border text-sm" {...props} /></div>,
                                                th: ({ node, ...props }) => <th className="border bg-muted/50 px-3 py-2 text-left font-semibold" {...props} />,
                                                td: ({ node, ...props }) => <td className="border px-3 py-2" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                                                li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            }}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && !isStreaming && (
                        <div className="flex gap-4 max-w-4xl mx-auto">
                            <div className="w-8 h-8 rounded-full bg-muted border text-foreground flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0 items-start">
                                <span className="text-xs text-muted-foreground px-1">Shrimpie Advisor</span>
                                <div className="px-5 py-4 border bg-muted/30 rounded-2xl rounded-tl-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Menganalisis data...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-4 md:p-6 bg-background/80 backdrop-blur-xl border-t border-border/50">
                    <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-muted/30 p-2 rounded-2xl border shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about shrimp management recommendations, feed quality, etc..."
                            className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent py-3 px-4 shadow-none focus-visible:ring-0 w-full"
                            rows={1}
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isLoading}
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-xl mb-1 mr-1"
                        >
                            <Send className="w-4 h-4" />
                            <span className="sr-only">Kirim pesan</span>
                        </Button>
                    </div>
                    <div className="text-center mt-2 text-[10px] text-muted-foreground">
                        AI Advisor can make mistakes. Always verify important recommendations with an expert.
                    </div>
                </div>
            </div>
        </div>
    );
}
