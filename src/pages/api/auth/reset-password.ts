import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirm")?.toString() ?? "";

  if (!password || password.length < 8) {
    return redirect("/auth/reset-password?error=Password+must+be+at+least+8+characters");
  }

  if (password !== confirm) {
    return redirect("/auth/reset-password?error=Passwords+do+not+match");
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return redirect("/auth/reset-password?error=Service+unavailable");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  return redirect("/auth/reset-password?success=1");
};
