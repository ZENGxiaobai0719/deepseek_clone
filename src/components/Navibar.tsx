"use client";

import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useClerk, useUser } from "@clerk/nextjs";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import { useState } from "react";

type ChatRow = {
  id: number;
  userId: string;
  title: string;
  model: string;
};

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function maskEmail(email?: string | null) {
  if (!email) return "未公开邮箱";
  const [name, domain] = email.split("@");
  if (!name || !domain) return "未公开邮箱";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export default function Navibar() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [pendingDeleteChat, setPendingDeleteChat] = useState<ChatRow | null>(null);

  const deleteChat = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "删除失败");
      }
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.removeQueries({ queryKey: ["chat-messages", String(id)] });
      if (pathname === `/chat/${id}`) {
        router.push("/");
      }
    },
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const res = await fetch("/api/chats");
      if (!res.ok) {
        throw new Error("加载失败");
      }
      return res.json() as Promise<{ chats: ChatRow[] }>;
    },
    enabled: isLoaded && Boolean(user),
  });

  const chats = data?.chats ?? [];

  function newChat() {
    router.push("/");
  }

  return (
    <div className="relative flex h-full flex-col border-r border-neutral-800/90 bg-[var(--chat-sidebar-bg)] text-neutral-200">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-lg font-semibold tracking-tight text-neutral-100">
          DeepSeek
        </span>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={newChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/40 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-800/80"
        >
          <AddCommentOutlinedIcon sx={{ fontSize: 20 }} />
          新对话
        </button>
      </div>

      <div className="mt-6 px-4 text-xs font-medium uppercase tracking-wide text-neutral-500">
        最近
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
        <Link
          href="/"
          className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-neutral-800/60 hover:text-neutral-200 ${
            pathname === "/"
              ? "bg-neutral-800/50 text-neutral-100"
              : "text-neutral-400"
          }`}
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
          首页
        </Link>

        {!isLoaded && (
          <p className="px-2 py-2 text-xs text-neutral-500">加载中…</p>
        )}
        {isLoaded && !user && (
          <p className="px-2 py-2 text-xs text-neutral-500">
            登录后可查看历史会话
          </p>
        )}
        {user && isPending && (
          <p className="px-2 py-2 text-xs text-neutral-500">加载历史…</p>
        )}
        {user && isError && (
          <p className="px-2 py-2 text-xs text-amber-600/90">历史加载失败</p>
        )}
        {user &&
          !isPending &&
          chats.length === 0 &&
          !isError && (
            <p className="px-2 py-2 text-xs text-neutral-500">暂无会话</p>
          )}

        {chats.map((chat) => {
          const href = `/chat/${chat.id}`;
          const active = pathname === href;
          return (
            <div
              key={chat.id}
              className={`group flex items-start gap-0.5 rounded-lg hover:bg-neutral-800/40 ${
                active ? "bg-neutral-800/50" : ""
              }`}
            >
              <Link
                href={href}
                title={chat.title}
                className={`min-w-0 flex-1 px-2 py-2 text-sm transition-colors hover:text-neutral-200 ${
                  active
                    ? "text-neutral-100"
                    : "text-neutral-400"
                }`}
              >
                <span className="line-clamp-2 break-words">
                  {truncate(chat.title, 48)}
                </span>
              </Link>
              <button
                type="button"
                aria-label="删除会话"
                disabled={deleteChat.isPending}
                className="mt-1 shrink-0 rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-red-950/40 hover:text-red-300 group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPendingDeleteChat(chat);
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-auto border-t border-neutral-800/80 px-4 py-3">
        {isLoaded && user ? (
          <div className="rounded-xl border border-neutral-700/80 bg-neutral-900/40 p-3">
            <p className="truncate text-sm font-medium text-neutral-100">
              {user.fullName || user.primaryEmailAddress?.emailAddress || "已登录用户"}
            </p>
            <p className="mt-1 truncate text-xs text-neutral-400">
              {maskEmail(user.primaryEmailAddress?.emailAddress)}
            </p>
            <button
              type="button"
              onClick={() => void signOut({ redirectUrl: "/sign-in" })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-700/70"
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
              退出登录
            </button>
          </div>
        ) : (
          <p className="text-xs text-neutral-600">仿 DeepSeek 界面 · 本地练习</p>
        )}
      </div>

      {pendingDeleteChat && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-100">删除会话</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              确定要删除
              <span className="mx-1 rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-100">
                {truncate(pendingDeleteChat.title, 28)}
              </span>
              吗？删除后无法恢复。
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteChat(null)}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-800/60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteChat.mutate(pendingDeleteChat.id, {
                    onSettled: () => setPendingDeleteChat(null),
                  });
                }}
                className="rounded-lg border border-red-500/50 bg-red-950/50 px-3 py-1.5 text-sm text-red-200 transition-colors hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={deleteChat.isPending}
              >
                {deleteChat.isPending ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-4 pb-3 text-xs text-neutral-600">
        仿 DeepSeek 界面 · 本地练习
      </div>
    </div>
  );
}
