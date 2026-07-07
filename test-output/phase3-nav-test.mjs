import { chromium } from "playwright";

const BASE = "http://localhost:4322";
const log  = (msg) => process.stdout.write(`${msg}\n`);
const ok   = (msg) => log(`  ✅ ${msg}`);
const fail = (msg) => log(`  ❌ ${msg}`);
const shot = async (page, name) => page.screenshot({ path: `test-output/${name}.png`, fullPage: false });

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  "https://uebytioeeilxnsurhrwg.supabase.co",
  "sb_publishable_ygWKT00HLdDcZE0_HPGoyA_8lWEV-Hm",
);
const { error: authError } = await sb.auth.signInWithPassword({
  email: "bogut20k@gmail.com", password: "TestPass123!",
});
if (authError) { log(`FATAL: ${authError.message}`); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Login przez formularz
await page.goto(`${BASE}/auth/signin`);
await page.waitForLoadState("networkidle");
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
await page.fill('input[type="email"]', "bogut20k@gmail.com");
await page.fill('input[type="password"]', "TestPass123!");
await page.click('button[type="submit"]');
await page.waitForFunction(() => !window.location.href.includes("/auth/signin"), { timeout: 15000, polling: 500 });
log(`Zalogowano — ${page.url()}`);

const hasNav = async () => page.locator("nav").isVisible();

// -------------------------------------------------------
// 3.3: Nav bar widoczny na /dashboard, /generate, /flashcards
// -------------------------------------------------------
log("\n--- 3.3 Nav bar na chronionych stronach ---");
for (const route of ["/dashboard", "/generate", "/flashcards"]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const visible = await hasNav();
  await shot(page, `3.3-nav-${route.slice(1)}`);
  visible ? ok(`nav widoczny na ${route}`) : fail(`nav BRAK na ${route}`);
}

// -------------------------------------------------------
// 3.4: Nav bar NIEWIDOCZNY na /auth/signin (zalogowany user)
// -------------------------------------------------------
log("\n--- 3.4 Nav bar niewidoczny na /auth/signin ---");
await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const navOnSignin = await page.locator("nav").count();
await shot(page, "3.4-nav-signin");
navOnSignin === 0 ? ok("nav niewidoczny na /auth/signin") : fail(`nav widoczny (${navOnSignin}x) — nie powinno być`);

// -------------------------------------------------------
// 3.5: Wylogowanie z nav baru działa
// -------------------------------------------------------
log("\n--- 3.5 Wylogowanie z nav baru ---");
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const logoutBtn = page.locator("nav button:has-text('Wyloguj')");
await logoutBtn.waitFor({ timeout: 5000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === "Wyloguj");
  btn?.closest("form")?.submit();
});
await page.waitForURL((u) => !u.href.includes("/dashboard"), { timeout: 10000 });
await shot(page, "3.5-after-logout");
// weryfikuj wylogowanie: chroniony endpoint zwraca 302
const testAuth = await page.evaluate(async () => {
  const r = await fetch("/api/flashcards", { redirect: "manual", credentials: "include" });
  return r.status;
});
testAuth === 0 || testAuth === 302 || testAuth === 401
  ? ok(`wylogowanie OK — /api/flashcards zwraca ${testAuth}, redirect na ${page.url()}`)
  : fail(`wylogowanie wątpliwe — status ${testAuth}, URL: ${page.url()}`);

// -------------------------------------------------------
// 3.6: Dashboard nie pokazuje duplikatu email/logout
// -------------------------------------------------------
log("\n--- 3.6 Dashboard bez duplikatu email/logout ---");
// po wylogowaniu (3.5) → idź na signin i zaloguj ponownie
await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle" });
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
await page.fill('input[type="email"]', "bogut20k@gmail.com");
await page.fill('input[type="password"]', "TestPass123!");
await page.click('button[type="submit"]');
await page.waitForFunction(() => !window.location.href.includes("/auth/signin"), { timeout: 15000, polling: 500 });
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const logoutBtns = await page.locator("button:has-text('Wyloguj')").count();
const emailTexts = await page.locator(`text=bogut20k@gmail.com`).count();
await shot(page, "3.6-dashboard-no-duplicate");
logoutBtns === 1 ? ok(`jeden przycisk Wyloguj (${logoutBtns}x)`) : fail(`${logoutBtns}x przycisk Wyloguj — duplikat!`);
emailTexts <= 1   ? ok(`email wyświetlony ${emailTexts}x (brak duplikatu)`) : fail(`email pojawia się ${emailTexts}x — duplikat!`);

log("\n✅ Faza 3 — testy zakończone");
await browser.close();
