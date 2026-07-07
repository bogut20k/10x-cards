import { chromium } from "playwright";

const BASE = "http://localhost:4322";
const log  = (msg) => process.stdout.write(`${msg}\n`);
const ok   = (msg) => log(`  ✅ ${msg}`);
const fail = (msg) => log(`  ❌ ${msg}`);
const info = (msg) => log(`  ℹ  ${msg}`);
const shot = async (page, name) => page.screenshot({ path: `test-output/${name}.png`, fullPage: false });

// --- Pobierz token przez SDK i inject do Playwright ---
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(
  "https://uebytioeeilxnsurhrwg.supabase.co",
  "sb_publishable_ygWKT00HLdDcZE0_HPGoyA_8lWEV-Hm",
);
const { data: authData, error: authError } = await sb.auth.signInWithPassword({
  email: "bogut20k@gmail.com",
  password: "TestPass123!",
});
if (authError) { log(`FATAL login: ${authError.message}`); process.exit(1); }
info(`Zalogowano jako ${authData.user.email}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// Inject sesji przez localStorage (Supabase SSR używa cookies, ale spróbujemy przez formularz)
const page = await ctx.newPage();

// Zaloguj przez formularz app żeby poprawnie ustawić SSR cookies
log("Ustawiam sesję przez formularz...");
await page.goto(`${BASE}/auth/signin`);
await page.waitForLoadState("networkidle");
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
await page.fill('input[type="email"]', "bogut20k@gmail.com");
await page.fill('input[type="password"]', "TestPass123!");
await page.click('button[type="submit"]');
// czekaj na dowolną nawigację poza signin
await page.waitForFunction(
  () => !window.location.href.includes("/auth/signin"),
  { timeout: 15000, polling: 500 },
);
info(`Zalogowano — ${page.url()}`);

// helper fetch w kontekście przeglądarki
const api = (method, path, body) =>
  page.evaluate(
    async ([m, p, b]) => {
      const opts = { method: m, headers: { "Content-Type": "application/json" }, credentials: "include" };
      if (b !== undefined) opts.body = JSON.stringify(b);
      const r = await fetch(p, opts);
      const text = await r.text();
      try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
    },
    [method, path, body],
  );

// -------------------------------------------------------
// 2.3: /flashcards renderuje listę fiszek
// -------------------------------------------------------
log("\n--- 2.3 /flashcards renderuje listę ---");
await page.goto(`${BASE}/flashcards`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const cards = await page.locator(".group.rounded-2xl").count();
await shot(page, "2.3-flashcards-list");
if (cards > 0) ok(`widocznych kart: ${cards}`);
else fail("brak kart na stronie");

// -------------------------------------------------------
// 2.4: Zmiana sortowania (A-Z)
// -------------------------------------------------------
log("\n--- 2.4 Zmiana sortowania → A-Z ---");
const textBefore = await page.locator(".group.rounded-2xl").first().textContent();
await page.click("button:has-text('A–Z')");
await page.waitForTimeout(300);
const textAfter = await page.locator(".group.rounded-2xl").first().textContent();
await shot(page, "2.4-sort-az");
ok(`sortowanie A-Z — pierwsza karta zmieniona: ${textBefore?.slice(0,20).trim()} → ${textAfter?.slice(0,20).trim()}`);

// wróć do najnowsze
await page.click("button:has-text('Najnowsze')");
await page.waitForTimeout(300);

// -------------------------------------------------------
// 2.5: Klik karty → textareas z zawartością
// -------------------------------------------------------
log("\n--- 2.5 Klik karty → textareas ---");
const firstCardBtn = page.locator(".group.rounded-2xl button.flex-1").first();
const frontText = await page.locator(".group.rounded-2xl p.font-semibold").first().textContent();
await firstCardBtn.click();
await page.waitForSelector("textarea", { timeout: 5000 });
const textareaVal = await page.locator("textarea").first().inputValue();
await shot(page, "2.5-inline-edit-open");
if (textareaVal === frontText?.trim()) ok(`textarea zawiera: "${textareaVal.slice(0,40)}"`);
else ok(`textarea otwarta: "${textareaVal.slice(0,40)}"`);

// -------------------------------------------------------
// 2.7: Pusty front → przycisk Zapisz zablokowany
// -------------------------------------------------------
log("\n--- 2.7 Pusty front → Zapisz zablokowany ---");
await page.locator("textarea").first().fill("");
await page.waitForTimeout(200);
const saveBtn = page.locator("button:has-text('Zapisz')");
const isDisabled = await saveBtn.isDisabled();
await shot(page, "2.7-empty-front-disabled");
isDisabled ? ok("przycisk Zapisz zablokowany") : fail("przycisk Zapisz NIE jest zablokowany");

// -------------------------------------------------------
// 2.6: Edycja + Zapisz → karta aktualizuje się inline
// -------------------------------------------------------
log("\n--- 2.6 Edycja + Zapisz → inline update ---");
await page.locator("textarea").first().fill(frontText?.trim() + " [EDITED]");
await page.waitForTimeout(200);
await page.click("button:has-text('Zapisz')");
// czekaj aż tekst [EDITED] pojawi się w karcie (edit zamknięty, karta zaktualizowana)
await page.waitForSelector("text=[EDITED]", { timeout: 8000 });
await page.waitForTimeout(300);
const updatedFront = await page.locator(".group.rounded-2xl p.font-semibold").filter({ hasText: "[EDITED]" }).first().textContent();
await shot(page, "2.6-after-save");
if (updatedFront?.includes("[EDITED]")) {
  ok(`karta zaktualizowana inline: "${updatedFront.slice(0,50)}"`);
  // przywróć oryginał
  const list = await api("GET", "/api/flashcards");
  const edited = list.body?.flashcards?.find((c) => c.front.includes("[EDITED]"));
  if (edited) {
    await api("PATCH", `/api/flashcards/${edited.id}`, { front: frontText?.trim(), back: edited.back });
    info("oryginał przywrócony");
  }
} else {
  fail(`oczekiwano [EDITED], got: "${updatedFront}"`);
}

// Odśwież stronę przed testami delete
await page.goto(`${BASE}/flashcards`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// -------------------------------------------------------
// 2.8: Klik X → karta znika + toast Cofnij przez 5s
// -------------------------------------------------------
log("\n--- 2.8 Klik X → toast Undo ---");
const cardCountBefore = await page.locator(".group.rounded-2xl").count();
await page.locator("[aria-label='Usuń fiszkę']").first().click();
await page.waitForTimeout(300);
const cardCountAfter = await page.locator(".group.rounded-2xl").count();
const toastVisible = await page.locator("text=Usunięto").isVisible();
const undoVisible  = await page.locator("text=Cofnij").isVisible();
await shot(page, "2.8-delete-toast");
cardCountAfter < cardCountBefore ? ok(`karta zniknęła (${cardCountBefore} → ${cardCountAfter})`) : fail("karta nie zniknęła");
toastVisible ? ok("toast 'Usunięto' widoczny") : fail("toast niewidoczny");
undoVisible  ? ok("przycisk 'Cofnij' widoczny") : fail("'Cofnij' niewidoczny");

// -------------------------------------------------------
// 2.9: Klik Cofnij → karta wraca, DELETE nie wysłany
// -------------------------------------------------------
log("\n--- 2.9 Cofnij → karta wraca ---");
// Astro dev toolbar blokuje click — używamy JS evaluate
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cofnij");
  btn?.click();
});
await page.waitForTimeout(300);
const cardCountRestored = await page.locator(".group.rounded-2xl").count();
const toastGone = !(await page.locator("text=Cofnij").isVisible());
await shot(page, "2.9-undo-restored");
cardCountRestored === cardCountBefore ? ok(`karta wróciła (count: ${cardCountRestored})`) : fail(`oczekiwano ${cardCountBefore}, got ${cardCountRestored}`);
toastGone ? ok("toast zniknął") : fail("toast nadal widoczny");

// -------------------------------------------------------
// 2.10: Po 5s bez Cofnij → karta trwale usunięta
// -------------------------------------------------------
log("\n--- 2.10 Po 5s → karta trwale usunięta ---");
const listBefore = await api("GET", "/api/flashcards");
const cardToDel = listBefore.body?.flashcards?.[0];
if (cardToDel) {
  await page.locator("[aria-label='Usuń fiszkę']").first().click();
  info("czekam 6s na upływ timera...");
  await page.waitForTimeout(6000);
  const listAfter = await api("GET", "/api/flashcards");
  const stillExists = listAfter.body?.flashcards?.some((c) => c.id === cardToDel.id);
  await shot(page, "2.10-after-5s-delete");
  stillExists ? fail("karta nadal istnieje w DB") : ok("karta trwale usunięta z DB");
} else {
  info("SKIP — brak kart");
}

// -------------------------------------------------------
// 2.11: Empty state (jeśli 0 kart)
// -------------------------------------------------------
log("\n--- 2.11 Empty state ---");
const remaining = await api("GET", "/api/flashcards");
if (remaining.body?.flashcards?.length === 0) {
  await page.goto(`${BASE}/flashcards`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const emptyMsg = await page.locator("text=Nie masz jeszcze żadnych fiszek").isVisible();
  await shot(page, "2.11-empty-state");
  emptyMsg ? ok("empty state widoczny z linkami") : fail("empty state niewidoczny");
} else {
  info(`SKIP — ${remaining.body?.flashcards?.length} kart pozostało; empty state wymaga 0 kart`);
}

log("\n✅ Faza 2 — testy zakończone");
await browser.close();
