import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteChatForUser } from "@/db";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { chatId } = await context.params;
  const id = Number.parseInt(chatId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "无效会话" }, { status: 400 });
  }

  try {
    const ok = await deleteChatForUser(id, userId);
    if (!ok) {
      return NextResponse.json({ error: "未找到会话" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/chats DELETE]", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
