/**
 * Chat persistence helpers — CRUD operations for chat conversations and messages.
 * Uses Supabase browser client (for client components).
 */
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────
export interface Conversation {
    id: string;
    user_id: string;
    device_id: string | null;
    device_name: string | null;
    title: string | null;
    created_at: string;
    updated_at: string;
}

export interface ChatMessageRow {
    id: string;
    conversation_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: string;
}

// ─── Conversation CRUD ──────────────────────────────────────────

/**
 * Create a new conversation.
 */
export async function createConversation(
    userId: string,
    deviceId?: string,
    deviceName?: string,
    title?: string
): Promise<Conversation | null> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
            user_id: userId,
            device_id: deviceId ?? null,
            device_name: deviceName ?? null,
            title: title ?? null,
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to create conversation:", error);
        return null;
    }
    return data as Conversation;
}

/**
 * Get conversations for a user, ordered by most recent first.
 */
export async function getConversations(
    userId: string,
    limit: number = 30
): Promise<Conversation[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("Failed to fetch conversations:", error);
        return [];
    }
    return (data as Conversation[]) ?? [];
}

/**
 * Update conversation title.
 */
export async function updateConversationTitle(
    conversationId: string,
    title: string
): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
        .from("chat_conversations")
        .update({ title })
        .eq("id", conversationId);

    if (error) {
        console.error("Failed to update conversation title:", error);
    }
}

/**
 * Delete a conversation (cascade deletes messages).
 */
export async function deleteConversation(
    conversationId: string
): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", conversationId);

    if (error) {
        console.error("Failed to delete conversation:", error);
    }
}

// ─── Message CRUD ───────────────────────────────────────────────

/**
 * Save a single message to a conversation.
 */
export async function saveMessage(
    conversationId: string,
    role: "user" | "assistant" | "system",
    content: string
): Promise<ChatMessageRow | null> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("chat_messages")
        .insert({
            conversation_id: conversationId,
            role,
            content,
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to save message:", error);
        return null;
    }
    return data as ChatMessageRow;
}

/**
 * Get all messages for a conversation, ordered chronologically.
 */
export async function getMessages(
    conversationId: string
): Promise<ChatMessageRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Failed to fetch messages:", error);
        return [];
    }
    return (data as ChatMessageRow[]) ?? [];
}
