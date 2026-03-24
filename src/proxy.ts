import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

// 首页可浏览；提问在页面与 API 内校验登录。/api/chat GET 用于检测密钥；/api/chats 未登录返回空列表
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/",
  "/api/chat",
  "/api/chats(.*)",
])

const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkProxy(req, event)
}

export default proxy


export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}