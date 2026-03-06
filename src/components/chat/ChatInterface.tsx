"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
    Send,
    Bot,
    User,
    Loader2,
    Activity,
    Scale,
    Ruler,
    Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Type definitions
export interface PondParameters {
    avg_weight: number;
    avg_length: number;
    activity_level: number;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: Date;
}

interface ChatInterfaceProps {
    parameters: PondParameters;
}

export default function ChatInterface({ parameters }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "welcome",
            role: "assistant",
            content: `Halo! Saya adalah **Shrimpie Advisor** Anda. Saya telah menganalisis data kolam udang terkini.

**Parameter Kolam Saat Ini:**
- Rata-rata Berat: **${parameters.avg_weight.toFixed(1)} gram**
- Rata-rata Panjang: **${parameters.avg_length.toFixed(1)} cm**
- Tingkat Keaktifan: **${parameters.activity_level.toFixed(0)}%**

Ada yang bisa saya bantu terkait penanganan udang Anda hari ini?`,
            createdAt: new Date(),
        }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            createdAt: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            // Context injection happens in the backend, but we send the current parameters with the request
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: messages.map(m => ({ role: m.role, content: m.content })).concat({ role: "user", content: userMessage.content }),
                    parameters: parameters, // Injecting context data here
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to send message");
            }

            const data = await response.json();

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.response || "Maaf, terjadi kesalahan saat memproses permintaan Anda.",
                createdAt: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Maaf, sistem sedang mengalami gangguan. Silakan coba beberapa saat lagi.",
                createdAt: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row bg-background">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-background relative">
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
                                    {message.role === "user" ? "Anda" : "Shrimpie Advisor"}
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
                    {isLoading && (
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
                            placeholder="Tanya rekomendasi penanganan udang, kualitas pakan, dll..."
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
                        AI Advisor dapat membuat kesalahan. Selalu verifikasi rekomendasi penting dengan ahli.
                    </div>
                </div>
            </div>
        </div>
    );
}
