import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString().trim() ?? "";

  if (!email) {
    return redirect("/auth/forgot-password?error=Email+is+required");
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return redirect("/auth/forgot-password?error=Service+unavailable");
  }

  const redirectTo = `${url.origin}/auth/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return redirect(`/auth/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  return redirect("/auth/forgot-password?sent=1");
};
