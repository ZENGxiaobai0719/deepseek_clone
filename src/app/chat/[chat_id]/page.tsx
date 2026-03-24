"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import EastIcon from "@mui/icons-material/East";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import type { UIMessage } from "ai";
import { dbMessagesToUIMessages } from "@/lib/db-to-ui-message";

async function chatFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string };
      if (typeof data.error === "string" && data.error) {
        throw new Error(data.error);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        // 非 JSON
      } else {
        throw e;
      }
    }
    throw new Error(text || "请求失败");
  }
  return res;
}

type ModelKey = "deepseek-v3" | "deepseek-r1";

function modelToApiId(m: ModelKey) {
  return m === "deepseek-r1" ? "deepseek-reasoner" : "deepseek-chat";
}

function ChatSession({
  chatId,
  initialMessages,
  initialPrompt,
  onInitialPromptConsumed,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  initialPrompt: string;
  onInitialPromptConsumed: () => void;
}) {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<ModelKey>("deepseek-v3");
  const [missingApiKey, setMissingApiKey] = useState(false);

  useEffect(() => {
    void fetch("/api/chat")
      .then((r) => r.json() as Promise<{ configured?: boolean }>)
      .then((d) => {
        if (d && d.configured === false) setMissingApiKey(true);
      })
      .catch(() => {});
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: chatFetch,
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const sentInitialPromptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const t = initialPrompt.trim();
    if (!t) return;
    const sendKey = `${chatId}:${t}`;
    if (sentInitialPromptKeyRef.current === sendKey) return;
    if (messages.length > 0) {
      sentInitialPromptKeyRef.current = sendKey;
      onInitialPromptConsumed();
      return;
    }
    if (status !== "ready") return;
    sentInitialPromptKeyRef.current = sendKey;
    sendMessage(
      { text: t },
      {
        body: {
          model: modelToApiId(model),
          chatId,
        },
      },
    );
    onInitialPromptConsumed();
  }, [
    initialPrompt,
    messages.length,
    status,
    sendMessage,
    model,
    chatId,
    onInitialPromptConsumed,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--chat-main-bg)] text-[var(--foreground)]">
      {missingApiKey && (
        <div className="shrink-0 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
          未配置环境变量{" "}
          <code className="rounded bg-neutral-900/80 px-1.5 py-0.5 text-amber-100">
            DEEPSEEK_API_KEY
          </code>
          ，请在项目根目录{" "}
          <code className="rounded bg-neutral-900/80 px-1.5 py-0.5">.env</code>{" "}
          中设置后重启开发服务器。
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-xl font-semibold tracking-tight text-neutral-200">
                有什么可以帮您吗
              </p>
              <p className="text-sm text-neutral-500">
                在下方输入消息开始对话
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--chat-user-bubble)] px-4 py-3 text-[15px] leading-relaxed text-neutral-900 shadow-sm"
                    : "max-w-[min(100%,42rem)] text-[15px] leading-relaxed text-neutral-200"
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <span key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    );
                  }
                  if (part.type === "reasoning") {
                    return (
                      <details
                        key={index}
                        className="mb-3 rounded-lg border border-neutral-700/80 bg-neutral-900/50 px-3 py-2 text-sm text-neutral-400"
                        open={part.state === "streaming"}
                      >
                        <summary className="cursor-pointer select-none text-neutral-500">
                          思考过程
                          {part.state === "streaming" ? " …" : ""}
                        </summary>
                        <div className="mt-2 whitespace-pre-wrap border-t border-neutral-700/60 pt-2 text-neutral-400">
                          {part.text}
                        </div>
                      </details>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-cyan-500/80" />
                正在回复…
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-red-900/40 bg-red-950/30 px-4 py-2 text-center text-sm text-red-300">
          {error.message || "请求出错"}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => clearError()}
          >
            关闭
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-neutral-800/80 bg-[var(--chat-main-bg)] px-4 pb-6 pt-3">
        <form
          className="mx-auto max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            const t = input.trim();
            if (!t || busy) return;
            sendMessage(
              { text: t },
              {
                body: {
                  model: modelToApiId(model),
                  chatId,
                },
              },
            );
            setInput("");
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-neutral-700 bg-[var(--chat-input-bg)] shadow-lg">
            <textarea
              className="min-h-[7.5rem] w-full resize-none bg-transparent px-4 py-3 text-[15px] text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              placeholder="给 DeepSeek 发送消息"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const form = e.currentTarget.form;
                  form?.requestSubmit();
                }
              }}
              disabled={status !== "ready"}
            />
            <div className="flex items-center justify-between gap-3 border-t border-neutral-700/80 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModel((m) =>
                      m === "deepseek-r1" ? "deepseek-v3" : "deepseek-r1",
                    )
                  }
                  className={`rounded-lg border px-2.5 py-1 text-sm transition-colors ${
                    model === "deepseek-r1"
                      ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-100"
                      : "border-neutral-600 bg-transparent text-neutral-300 hover:bg-neutral-800/50"
                  }`}
                >
                  深度思考 (R1)
                </button>
                {busy && (
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded-lg border border-neutral-600 px-2.5 py-1 text-sm text-neutral-300 hover:bg-neutral-800/50"
                  >
                    停止
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={status !== "ready" || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-neutral-100 bg-neutral-100 text-neutral-900 transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="发送"
              >
                <EastIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const chatIdRaw = typeof params.chat_id === "string" ? params.chat_id : "";
  const chatIdNum = Number.parseInt(chatIdRaw, 10);
  const initialPrompt = searchParams.get("q") ?? "";

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["chat-messages", chatIdRaw],
    queryFn: async () => {
      const res = await fetch(`/api/chats/${chatIdRaw}/messages`);
      if (res.status === 401) {
        router.push("/sign-in");
        throw new Error("请先登录");
      }
      if (!res.ok) {
        throw new Error("加载历史失败");
      }
      return res.json() as Promise<{
        messages: { id: number; role: string; content: string }[];
      }>;
    },
    enabled: isLoaded && Boolean(user) && Number.isFinite(chatIdNum) && chatIdNum > 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!chatIdRaw || !Number.isFinite(chatIdNum) || chatIdNum <= 0) {
      router.replace("/");
    }
  }, [isLoaded, user, chatIdRaw, chatIdNum, router]);

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        加载中…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        正在跳转首页…
      </div>
    );
  }

  if (!chatIdRaw || !Number.isFinite(chatIdNum) || chatIdNum <= 0) {
    return null;
  }

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        加载对话历史…
      </div>
    );
  }

  const initialMessages = isError ? [] : dbMessagesToUIMessages(data?.messages ?? []);
  const handleInitialPromptConsumed = () => {
    if (!searchParams.get("q")) return;
    router.replace(`/chat/${chatIdRaw}`);
  };

  return (
    <div className="relative h-full">
      {isError && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
          历史消息加载失败（{error instanceof Error ? error.message : "未知错误"}），
          仍可继续发送新消息。
        </div>
      )}
      <ChatSession
        key={chatIdRaw}
        chatId={chatIdRaw}
        initialMessages={initialMessages}
        initialPrompt={initialPrompt}
        onInitialPromptConsumed={handleInitialPromptConsumed}
      />
    </div>
  );
}
