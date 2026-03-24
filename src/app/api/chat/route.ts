import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createMessage, getChatByIdForUser } from "@/db";

export const maxDuration = 60;

// 勿使用 NEXT_PUBLIC / 站点自身的 BASE_URL：那会指向 localhost，导致 DeepSeek 请求发到错误地址。
// 仅在你需要自定义网关时设置 DEEPSEEK_API_BASE_URL（例如 https://api.deepseek.com）
const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
  ...(process.env.DEEPSEEK_API_BASE_URL
    ? { baseURL: process.env.DEEPSEEK_API_BASE_URL }
    : {}),
});

function textFromUIMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (p): p is { type: "text"; text: string } => p.type === "text",
    )
    .map((p) => p.text)
    .join("");
}

/** DefaultChatTransport 会把会话 id 放在 body.id；sendMessage 的 body 里可能是 chatId */
function parseChatIdFromBody(body: {
  chatId?: unknown;
  id?: unknown;
}): number {
  const raw = body.chatId ?? body.id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Number.NaN;
}

/** 供前端检测是否已配置密钥（不返回任何敏感值） */
export async function GET() {
  return Response.json({
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
  });
}

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: "缺少 DEEPSEEK_API_KEY 环境变量" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "请先登录后再提问" },
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: {
    messages?: UIMessage[];
    model?: string;
    chatId?: unknown;
    id?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "无效的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, model: modelArg = "deepseek-chat" } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "缺少 messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const modelId =
    modelArg === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat";

  const chatIdNum = parseChatIdFromBody(body);

  let persistChatId: number | null = null;
  try {
    if (Number.isFinite(chatIdNum) && chatIdNum > 0) {
      const chat = await getChatByIdForUser(chatIdNum, userId);
      if (chat) {
        persistChatId = chatIdNum;
      }
    }
  } catch (e) {
    console.error("[chat] 数据库校验/跳过持久化:", e);
  }

  if (persistChatId !== null) {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const userText = textFromUIMessage(last);
      if (userText) {
        try {
          await createMessage(persistChatId, "user", userText);
        } catch (e) {
          console.error("[chat] 保存用户消息失败", e);
        }
      }
    }
  }

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages);
  } catch (e) {
    console.error("[chat] convertToModelMessages", e);
    return new Response(JSON.stringify({ error: "消息格式无法解析" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = streamText({
    model: deepseek(modelId),
    system:
      "You are DeepSeek, a helpful assistant. Reply in the same language as the user when appropriate.",
    messages: modelMessages,
    onFinish: async ({ text }) => {
      if (persistChatId === null || !text?.trim()) return;
      try {
        await createMessage(persistChatId, "assistant", text);
      } catch (e) {
        console.error("[chat] 保存助手消息失败", e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
