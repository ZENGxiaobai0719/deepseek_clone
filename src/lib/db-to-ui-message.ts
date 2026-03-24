import type { UIMessage } from "ai";

/** 将 Supabase messages 行转为 AI SDK UIMessage（用于 useChat 初始消息） */
export function dbMessagesToUIMessages(
  rows: { id: number; role: string; content: string }[],
): UIMessage[] {
  return rows.map((row) => ({
    id: `db-${row.id}`,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text" as const, text: row.content }],
  }));
}
