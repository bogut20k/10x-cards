import { chromium } from "playwright";

const BASE = "http://localhost:4322";
const EMAIL = "test@10xcards.test";
const PASS = "TestPass123!";

const out = (msg) => console.log(`[TEST] ${msg}`);
const pass = (msg) => console.log(`[PASS] ${msg}`);
const fail = (msg) => console.error(`[FAIL] ${msg}`);

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

// Przejdź na dashboard
await page.goto(`${BASE}/dashboard`);
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "test-output/s03-1.3-dashboard.png", fullPage: true });

// --- 1.3: Dashboard renderuje formularz ---
out("1.3 Sprawdzam formularz na dashboardzie...");
const frontField = await page.locator("textarea#front");
const backField = await page.locator("textarea#back");
const frontVisible = await frontField.isVisible();
const backVisible = await backField.isVisible();
if (frontVisible && backVisible) {
  pass("1.3 Formularz z polami Przód i Tył widoczny");
} else {
  fail(`1.3 Brak pól: front=${frontVisible} back=${backVisible}`);
}

// --- 1.4: Oba pola puste → przycisk disabled ---
out("1.4 Sprawdzam przycisk z pustymi polami...");
await frontField.fill("");
await backField.fill("");
const submitBtn = page.locator('button[type="submit"]:has-text("Zapisz fiszkę")');
const disabledWhenEmpty = await submitBtn.isDisabled();
if (disabledWhenEmpty) {
  pass("1.4 Przycisk disabled gdy oba pola puste");
} else {
  fail("1.4 Przycisk NIE jest disabled przy pustych polach");
}

// --- 1.5 (dodatkowy z planu): Tylko Przód wypełniony → nadal disabled ---
out("1.5 Sprawdzam przycisk z tylko Przód wypełnionym...");
await frontField.fill("Testowe pytanie");
await backField.fill("");
const disabledOnlyFront = await submitBtn.isDisabled();
if (disabledOnlyFront) {
  pass("1.5 Przycisk disabled gdy tylko Przód wypełniony");
} else {
  fail("1.5 Przycisk NIE jest disabled gdy tylko Przód wypełniony");
}
await frontField.fill("");

// --- 1.5: Submit z wypełnionymi polami → baner sukcesu, pola wyczyszczone ---
out("1.5 Submit z wypełnionymi polami...");
await frontField.fill("Testowe pytanie S03");
await backField.fill("Testowa odpowiedź S03");
await page.screenshot({ path: "test-output/s03-1.5-before-submit.png" });
await submitBtn.click();

// czekaj na baner sukcesu
const successBanner = page.locator("text=Fiszka zapisana!");
await successBanner.waitFor({ timeout: 8000 });
const successVisible = await successBanner.isVisible();
if (successVisible) {
  pass("1.5 Baner sukcesu 'Fiszka zapisana!' widoczny");
} else {
  fail("1.5 Brak banera sukcesu");
}

// sprawdź pola wyczyszczone
const frontAfter = await frontField.inputValue();
const backAfter = await backField.inputValue();
if (frontAfter === "" && backAfter === "") {
  pass("1.5 Pola wyczyszczone po zapisie");
} else {
  fail(`1.5 Pola nie wyczyszczone: front='${frontAfter}' back='${backAfter}'`);
}
await page.screenshot({ path: "test-output/s03-1.5-after-submit.png" });

// --- 1.6: Pisanie po sukcesie → baner znika ---
out("1.6 Sprawdzam znikanie banera po rozpoczęciu pisania...");
await frontField.fill("x");
const successGone = await successBanner.isHidden();
if (successGone) {
  pass("1.6 Baner znika po rozpoczęciu pisania");
} else {
  fail("1.6 Baner NIE znika po rozpoczęciu pisania");
}

// --- 1.7: Link "Generuj z AI" prowadzi do /generate ---
out("1.7 Sprawdzam link 'Generuj z AI'...");
await frontField.fill("");
const aiLink = page.locator('a[href="/generate"]:has-text("Generuj z AI")');
const aiLinkVisible = await aiLink.isVisible();
if (aiLinkVisible) {
  pass("1.7 Link 'Generuj z AI' widoczny i href=/generate");
} else {
  fail("1.7 Brak linku 'Generuj z AI'");
}
await page.screenshot({ path: "test-output/s03-1.7-ai-link.png" });

out("Testy Phase 1 S-03 zakończone.");
await browser.close();
