import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const { chatsTable, messagesTable } = schema;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle({ client, schema });

/** 新建会话 */
export const createChat = async (
  title: string,
  userId: string,
  model: string,
) => {
  try {
    const [newChat] = await db
      .insert(chatsTable)
      .values({ title, userId, model })
      .returning();
    return newChat;
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
};

/** 某用户的会话列表（按 id 倒序） */
export const getChatsForUser = async (userId: string) => {
  try {
    return await db
      .select()
      .from(chatsTable)
      .where(eq(chatsTable.userId, userId))
      .orderBy(desc(chatsTable.id));
  } catch (error) {
    console.error("Error getting chats:", error);
    throw error;
  }
};

/** 按 id + userId 取单条（避免读到别人的会话） */
export const getChatByIdForUser = async (chatId: number, userId: string) => {
  try {
    const rows = await db
      .select()
      .from(chatsTable)
      .where(
        and(eq(chatsTable.id, chatId), eq(chatsTable.userId, userId)),
      );
    return rows[0] ?? null;
  } catch (error) {
    console.error("Error getting chat:", error);
    throw error;
  }
};

/** 写入一条消息 */
export const createMessage = async (
  chatId: number,
  role: string,
  content: string,
) => {
  try {
    const [newMessage] = await db
      .insert(messagesTable)
      .values({ chatId, role, content })
      .returning();
    return newMessage;
  } catch (error) {
    console.error("Error creating message:", error);
    throw error;
  }
};

/**
 * 按会话拉取消息（升序）。仅适用于已确认权限的场景（例如已用 {@link getChatByIdForUser} 校验）。
 * 对外 API 请优先使用 {@link getMessagesByChatIdForUser}。
 */
export const getMessagesByChatId = async (chatId: number) => {
  try {
    return await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.chatId, chatId))
      .orderBy(asc(messagesTable.id));
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
};

/** 校验会话归属后再拉取消息，避免仅凭 chatId 越权读取 */
export const getMessagesByChatIdForUser = async (
  chatId: number,
  userId: string,
) => {
  const chat = await getChatByIdForUser(chatId, userId);
  if (!chat) return [];
  return getMessagesByChatId(chatId);
};

/** 删除会话及其消息（先删 messages 再删 chats） */
export const deleteChatForUser = async (
  chatId: number,
  userId: string,
): Promise<boolean> => {
  const chat = await getChatByIdForUser(chatId, userId);
  if (!chat) return false;
  await db.delete(messagesTable).where(eq(messagesTable.chatId, chatId));
  await db.delete(chatsTable).where(eq(chatsTable.id, chatId));
  return true;
};