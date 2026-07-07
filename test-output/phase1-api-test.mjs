import { chromium } from "playwright";

const BASE = "http://localhost:4322";
const log  = (msg) => process.stdout.write(`${msg}\n`);
const ok   = (msg) => log(`  ✅ ${msg}`);
const fail = (msg) => log(`  ❌ ${msg}`);
const info = (msg) => log(`  ℹ  ${msg}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// --- Login przez app (email/password, hasło zmienione przez admin) ---
log("Loguję przez app...");
await page.goto(`${BASE}/auth/signin`);
await page.waitForLoadState("networkidle");
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
await page.fill('input[type="email"]', "bogut20k@gmail.com");
await page.fill('input[type="password"]', "TestPass123!");
await Promise.all([
  page.waitForURL((u) => !u.href.includes("/auth/"), { timeout: 15000 }),
  page.click('button[type="submit"]'),
]);
info(`Zalogowano — URL: ${page.url()}`);

// helper — wywołanie API przez fetch w kontekście przeglądarki (cookies ustawione)
async function api(method, path, body) {
  return page.evaluate(
    async ([method, path, body]) => {
      const opts = { method, headers: { "Content-Type": "application/json" }, credentials: "include" };
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(path, opts);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, body: json ?? text };
    },
    [method, path, body],
  );
}

// -------------------------------------------------------
// 1.3: GET /api/flashcards (zalogowany) → 200
// -------------------------------------------------------
log("\n--- 1.3 GET /api/flashcards (zalogowany) ---");
const r13 = await api("GET", "/api/flashcards");
let firstCard = null;
if (r13.status === 200 && Array.isArray(r13.body?.flashcards)) {
  ok(`status ${r13.status} | fiszek: ${r13.body.flashcards.length}`);
  firstCard = r13.body.flashcards[0] ?? null;
} else {
  fail(`status ${r13.status} | ${JSON.stringify(r13.body)}`);
}
await page.goto(`${BASE}/flashcards`, { waitUntil: "networkidle" });
await page.screenshot({ path: "test-output/1.3-flashcards-page.png" });

// -------------------------------------------------------
// 1.4: GET /api/flashcards (niezalogowany) → 302
// -------------------------------------------------------
log("\n--- 1.4 GET /api/flashcards (niezalogowany) ---");
const r14 = await fetch(`${BASE}/api/flashcards`, { redirect: "manual" });
r14.status === 302
  ? ok(`status 302 (redirect → /auth/signin)`)
  : fail(`status ${r14.status} (oczekiwano 302)`);

// -------------------------------------------------------
// 1.5: PATCH /api/flashcards/<id> (poprawne dane) → 200
// -------------------------------------------------------
log("\n--- 1.5 PATCH /api/flashcards/<id> (poprawne dane) ---");
let patchId = firstCard?.id ?? null;
if (patchId) {
  const r15 = await api("PATCH", `/api/flashcards/${patchId}`, {
    front: firstCard.front + " [TEST]",
    back: firstCard.back,
  });
  if (r15.status === 200 && r15.body?.flashcard?.front?.endsWith("[TEST]")) {
    ok(`status ${r15.status} | front zaktualizowany`);
    await api("PATCH", `/api/flashcards/${patchId}`, { front: firstCard.front, back: firstCard.back });
    info("oryginał przywrócony");
  } else {
    fail(`status ${r15.status} | ${JSON.stringify(r15.body)}`);
  }
} else {
  info("SKIP — brak fiszek; najpierw stwórz fiszkę manualnie");
}

// -------------------------------------------------------
// 1.6: PATCH z pustym front → 400
// -------------------------------------------------------
log("\n--- 1.6 PATCH z pustym front → 400 ---");
if (patchId) {
  const r16 = await api("PATCH", `/api/flashcards/${patchId}`, { front: "   ", back: "coś" });
  r16.status === 400
    ? ok(`status ${r16.status} | "${r16.body?.error}"`)
    : fail(`status ${r16.status} (oczekiwano 400)`);
} else { info("SKIP"); }

// -------------------------------------------------------
// 1.7: PATCH z front > 500 znaków → 400
// -------------------------------------------------------
log("\n--- 1.7 PATCH z front > 500 znaków → 400 ---");
if (patchId) {
  const r17 = await api("PATCH", `/api/flashcards/${patchId}`, { front: "x".repeat(501), back: "coś" });
  r17.status === 400
    ? ok(`status ${r17.status} | "${r17.body?.error}"`)
    : fail(`status ${r17.status} (oczekiwano 400)`);
} else { info("SKIP"); }

// -------------------------------------------------------
// 1.8: DELETE /api/flashcards/<id> → 204
// -------------------------------------------------------
log("\n--- 1.8 DELETE /api/flashcards/<id> → 204 ---");
await api("POST", "/api/flashcards", { cards: [{ front: "TEST_DELETE_FRONT", back: "TEST_DELETE_BACK" }] });
const listForDel = await api("GET", "/api/flashcards");
const testCard = listForDel.body?.flashcards?.find((c) => c.front === "TEST_DELETE_FRONT");
if (testCard) {
  const r18 = await api("DELETE", `/api/flashcards/${testCard.id}`);
  r18.status === 204
    ? ok(`status 204`)
    : fail(`status ${r18.status} (oczekiwano 204)`);
} else {
  fail("nie znaleziono testowej fiszki");
}

// -------------------------------------------------------
// 1.9: DELETE nieistniejącej fiszki → 404
// -------------------------------------------------------
log("\n--- 1.9 DELETE nieistniejącej fiszki → 404 ---");
const r19 = await api("DELETE", "/api/flashcards/00000000-0000-0000-0000-000000000000");
r19.status === 404
  ? ok(`status 404`)
  : fail(`status ${r19.status} (oczekiwano 404)`);

log("\n✅ Faza 1 — testy zakończone");
await browser.close();
