import { chromium } from "playwright";

const BASE = "http://localhost:4322";
const EMAIL = "bogut20k@gmail.com";
const PASS = process.env.TEST_PASS;

const out = (msg) => console.log(`[TEST] ${msg}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// --- Login ---
out("Loguję się...");
await page.goto(`${BASE}/auth/signin`);
await page.waitForLoadState("networkidle");
await page.waitForSelector('input[type="email"]', { timeout: 15000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.href.includes("/auth/signin"), { timeout: 10000 });
out(`Po logowaniu URL: ${page.url()}`);

// Pobierz cookies sesji dla fetch
const cookies = await context.cookies();
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

async function apiFetch(method, path, body) {
  const opts = {
    method,
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    redirect: "manual",
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(`${BASE}${path}`, opts);
}

// --- 1.3: GET /api/flashcards (zalogowany) ---
out("1.3 GET /api/flashcards (zalogowany)");
const r13 = await apiFetch("GET", "/api/flashcards");
const d13 = await r13.json();
out(`  status: ${r13.status} | flashcards: ${d13.flashcards?.length ?? "brak"}`);
await page.screenshot({ path: "test-output/1.3-get-flashcards.png", fullPage: false });

// --- 1.4: GET /api/flashcards (niezalogowany) ---
out("1.4 GET /api/flashcards (niezalogowany)");
const r14 = await fetch(`${BASE}/api/flashcards`, { redirect: "manual" });
out(`  status: ${r14.status} (oczekiwane: 302)`);

// --- 1.5: PATCH /api/flashcards/<id> poprawny body ---
const firstCard = d13.flashcards?.[0];
let patchedId = null;
if (firstCard) {
  patchedId = firstCard.id;
  out(`1.5 PATCH /api/flashcards/${patchedId}`);
  const r15 = await apiFetch("PATCH", `/api/flashcards/${patchedId}`, {
    front: firstCard.front + " [TEST]",
    back: firstCard.back,
  });
  const d15 = await r15.json();
  out(`  status: ${r15.status} | front: ${d15.flashcard?.front ?? d15.error}`);
  // przywróć oryginał
  await apiFetch("PATCH", `/api/flashcards/${patchedId}`, { front: firstCard.front, back: firstCard.back });
  out(`  przywrócono oryginał`);
} else {
  out("1.5 SKIP — brak fiszek w bazie");
}

// --- 1.6: PATCH z pustym front ---
if (patchedId) {
  out("1.6 PATCH z pustym front");
  const r16 = await apiFetch("PATCH", `/api/flashcards/${patchedId}`, { front: "   ", back: "coś" });
  const d16 = await r16.json();
  out(`  status: ${r16.status} (oczekiwane: 400) | error: ${d16.error}`);
}

// --- 1.7: PATCH z front > 500 znaków ---
if (patchedId) {
  out("1.7 PATCH z front > 500 znaków");
  const r17 = await apiFetch("PATCH", `/api/flashcards/${patchedId}`, { front: "x".repeat(501), back: "coś" });
  const d17 = await r17.json();
  out(`  status: ${r17.status} (oczekiwane: 400) | error: ${d17.error}`);
}

// --- 1.8: DELETE /api/flashcards/<id> (tworzymy kartę testową, usuwamy ją) ---
out("1.8 DELETE — tworzę testową fiszkę...");
const rCreate = await apiFetch("POST", "/api/flashcards", {
  cards: [{ front: "TEST DELETE FRONT", back: "TEST DELETE BACK" }],
});
const dCreate = await rCreate.json();
out(`  POST status: ${rCreate.status}`);

// pobierz nową kartę (jest pierwsza po sortowaniu desc)
const rList2 = await apiFetch("GET", "/api/flashcards");
const dList2 = await rList2.json();
const testCard = dList2.flashcards?.find((c) => c.front === "TEST DELETE FRONT");
if (testCard) {
  const r18 = await apiFetch("DELETE", `/api/flashcards/${testCard.id}`);
  out(`  DELETE status: ${r18.status} (oczekiwane: 204)`);
} else {
  out("  SKIP — nie znaleziono testowej fiszki");
}

// --- 1.9: DELETE cudzej fiszki (losowy UUID) ---
out("1.9 DELETE cudzej fiszki (nieistniejące ID)");
const fakeId = "00000000-0000-0000-0000-000000000000";
const r19 = await apiFetch("DELETE", `/api/flashcards/${fakeId}`);
out(`  status: ${r19.status} (oczekiwane: 404)`);

// --- Screenshot podsumowanie ---
await page.goto(`${BASE}/api/flashcards`);
await page.screenshot({ path: "test-output/1.3-api-response.png", fullPage: false });

out("Wszystkie testy Fazy 1 zakończone.");
await browser.close();
