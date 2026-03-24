import { createChat } from "@/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string; model?: string };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";

  if (!title || !model) {
    return NextResponse.json({ error: "缺少 title 或 model" }, { status: 400 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const chat = await createChat(title, userId, model);
  return NextResponse.json({ id: chat.id });
}
