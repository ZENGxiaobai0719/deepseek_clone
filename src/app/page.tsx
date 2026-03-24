"use client";

import { useState } from "react";
import EastIcon from "@mui/icons-material/East";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

function modelToApiId(m: "deepseek-v3" | "deepseek-r1") {
  return m === "deepseek-r1" ? "deepseek-reasoner" : "deepseek-chat";
}

export default function Home() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [input, setInput] = useState("");
  const [model, setModel] = useState<"deepseek-v3" | "deepseek-r1">(
    "deepseek-v3",
  );

  const { mutate: createChatMutation, isPending } = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post<{ id: number }>("/api/create-chat", {
        title: input.trim(),
        model: modelToApiId(model),
      });
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      const firstMessage = input.trim();
      const qs = new URLSearchParams({
        q: firstMessage,
      });
      router.push(`/chat/${data.id}?${qs.toString()}`);
    },
    onError: (err) => {
      console.error("创建会话失败", err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.push("/sign-in");
      }
    },
  });

  const handleSubmit = () => {
    if (input.trim() === "") return;

    if (!user) {
      router.push("/sign-in");
      return;
    }

    createChatMutation();
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6">
        <p className="text-center text-2xl font-bold text-[var(--foreground)]">
          有什么可以帮您吗
        </p>
        {isLoaded && !user && (
          <p className="text-center text-sm text-neutral-500">
            请先登录后再输入并发送，以创建对话
          </p>
        )}

        <div
          className="flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-[var(--chat-input-bg)] shadow-lg"
          style={{ minHeight: "12rem" }}
        >
          <textarea
            className="min-h-[8rem] w-full flex-1 resize-none bg-transparent p-4 text-[var(--foreground)] placeholder:text-neutral-500 focus:outline-none"
            placeholder="给 DeepSeek 发送消息"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-700/80 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setModel(
                    model === "deepseek-r1" ? "deepseek-v3" : "deepseek-r1",
                  )
                }
                className={`cursor-pointer rounded-lg border px-2.5 py-1 text-sm transition-colors ${
                  model === "deepseek-r1"
                    ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-100"
                    : "border-neutral-600 bg-transparent text-neutral-300 hover:bg-neutral-800/50"
                }`}
              >
                深度思考(R1)
              </button>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-neutral-100 bg-neutral-100 text-neutral-900 transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="发送"
              disabled={isPending}
              onClick={handleSubmit}
            >
              <EastIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
