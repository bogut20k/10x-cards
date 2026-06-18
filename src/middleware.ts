import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_PAGE_ROUTES = ["/dashboard", "/flashcards", "/generate", "/review"];
const PUBLIC_API_PREFIX = "/api/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  const pathname = context.url.pathname;
  const isProtectedPage = PROTECTED_PAGE_ROUTES.some((route) => pathname.startsWith(route));
  const isProtectedApi = pathname.startsWith("/api/") && !pathname.startsWith(PUBLIC_API_PREFIX);

  if ((isProtectedPage || isProtectedApi) && !context.locals.user) {
    return context.redirect("/auth/signin");
  }

  return next();
});
