import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getChatsForUser } from "@/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ chats: [] });
  }

  try {
    const chats = await getChatsForUser(userId);
    return NextResponse.json({ chats });
  } catch (e) {
    console.error("[api/chats]", e);
    return NextResponse.json(
      { error: "无法加载会话列表", chats: [] },
      { status: 500 },
    );
  }
}
