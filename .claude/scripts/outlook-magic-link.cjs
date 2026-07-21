#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const { exec } = require('child_process');

const WPUSH = 'C:\\Users\\Radoslaw\\.claude\\.global\\windows-push-notification\\windows_notification.ps1';
const CALLER_PID = process.ppid;

function notify(title, message, status = 'Success') {
  exec(`powershell -File "${WPUSH}" -Title "${title}" -Message "${message}" -Status "${status}" -CallerPid ${CALLER_PID} -AppId "Microsoft.Windows.Explorer"`);
}

const SESSION_DIR = path.join(process.env.USERPROFILE, '.outlook-magic-link-session');
const SENDER = 'noreply@notifications.przeprogramowani.pl';
const OUTLOOK_URL = 'https://outlook.office.com/mail/inbox';
const LOGIN_TIMEOUT_MS = 300_000;
const POLL_TIMEOUT_MS = 80_000;
const POLL_MS = 6_000;

// Outlook pokazuje czas dla maili z dziś: "3:57 PM" (en-US) lub "15:57" (PL 24h), datę dla starych.
// Mail jest "nowy" jeśli przyszedł po startTime.
function isRecentEmail(rowText, startTime) {
  let hours, minutes;

  // Format 24h: "15:04" (polski Outlook)
  const time24 = rowText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:AM|PM))/i);
  // Format 12h: "3:04 PM" (angielski Outlook)
  const time12 = rowText.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);

  if (time12) {
    hours = parseInt(time12[1]);
    minutes = parseInt(time12[2]);
    const isPM = time12[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  } else if (time24) {
    hours = parseInt(time24[1]);
    minutes = parseInt(time24[2]);
  } else {
    return false; // stary mail (ma datę, nie godzinę)
  }

  const start = new Date(startTime);
  const emailTime = new Date(startTime);
  emailTime.setHours(hours, minutes, 0, 0);

  // Mail musi być z po czasie startu (z marginesem -30s na zegar Outlooka)
  return emailTime >= new Date(start.getTime() - 30_000);
}

async function openSearch(page) {
  const searchBox = page.locator('[placeholder*="Search"], [aria-label*="Search"], input[type="search"]').first();
  await searchBox.click({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(300);
  await page.keyboard.type(`from:${SENDER}`, { delay: 80 });
  await page.waitForTimeout(1_500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4_000); // Outlook potrzebuje czasu na załadowanie wyników
  await page.waitForSelector('[role="option"]', { timeout: 6_000 }).catch(() => {});
  await page.waitForTimeout(1_000);
}

async function extractLink(page) {
  const content = await page.content();
  if (!content.includes(SENDER)) return null;
  const match = content.match(/https?:\/\/[^\s"'<>]+przeprogramowani[^\s"'<>]+/);
  return match ? match[0].replace(/&amp;/g, '&') : null;
}

async function moveToTrash(page, emailRow) {
  try {
    // Prawy przycisk na wierszu → Delete (= Deleted Items, nie permanentne usunięcie)
    await emailRow.click({ button: 'right' });
    await page.waitForTimeout(800);
    const menuDelete = page.getByRole('menuitem', { name: /^delete|^usuń/i }).first();
    if (await menuDelete.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await menuDelete.click();
      await page.waitForTimeout(1_000);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Fallback: Delete z toolbara reading pane
    const deleteBtn = page.locator('button[aria-label*="Delete"], button[title*="Delete"]').first();
    if (await deleteBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(1_000);
      return;
    }
    // Ostatni fallback: klawisz Delete
    await emailRow.click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1_000);
  } catch { /* ignoruj błędy sprzątania */ }
}

async function main() {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    channel: 'chrome',
    args: ['--start-minimized'],
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Pobierz windowId raz — będziemy go używać do minimalizacji po każdym goto
  let cdpSession = null;
  let windowId = null;
  try {
    cdpSession = await browser.newCDPSession(page);
    ({ windowId } = await cdpSession.send('Browser.getWindowForTarget'));
    await cdpSession.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  } catch { /* ignoruj — nie krytyczne */ }

  const minimize = async () => {
    if (!cdpSession || !windowId) return;
    try { await cdpSession.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } }); } catch { }
  };

  await page.goto(OUTLOOK_URL, { waitUntil: 'domcontentloaded' });
  await minimize();

  notify('10x auth rk@omegacode.pl', 'Logowanie do Outlook...');
  console.log('Czekam na zalogowany inbox...');
  try {
    await page.waitForSelector('button[aria-label="New email"]', { timeout: LOGIN_TIMEOUT_MS });
  } catch {
    console.error('Nie wykryto zalogowanego inboxu — zamykam.');
    await browser.close(); process.exit(1);
  }
  console.log('Inbox załadowany.\n');

  const startTime = Date.now();
  console.log(`Szukam maila od "${SENDER}" wysłanego po ${new Date(startTime).toLocaleTimeString()} (max ${POLL_TIMEOUT_MS / 1000}s)...\n`);

  const rowLabel = (parts) => {
    const timeIdx = parts.findIndex(p => /\d{1,2}:\d{2}/.test(p));
    const date = timeIdx >= 0 ? parts[timeIdx] : '?';
    const subject = timeIdx > 1 ? parts[timeIdx - 1] : (parts[2] || parts[1] || '?');
    return `${subject}  |  ${date}`;
  };

  let iteration = 0;
  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await page.waitForTimeout(POLL_MS);
    iteration++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // Przeładuj inbox — nowe maile są zawsze na górze, bez typing search
    await page.goto(OUTLOOK_URL, { waitUntil: 'domcontentloaded' });
    await minimize();
    await page.waitForSelector('[role="option"]', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(2_000);

    const allRows = page.locator('[role="option"]').filter({ hasText: SENDER });
    const rows = allRows.filter({ hasNotText: 'FW:' });
    const count = await rows.count();
    console.log(`[${elapsed}s] Sprawdzam inbox — znaleziono: ${count} maili od nadawcy`);

    for (let i = 0; i < Math.min(count, 3); i++) {
      const parts = (await rows.nth(i).innerText().catch(() => '')).trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
      console.log(`  [${i}] ${rowLabel(parts)}`);
    }

    // Szukaj maila który przyszedł PO starcie skryptu
    let firstRow = null;
    let firstRowLabel = '';
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.innerText().catch(() => '');
      if (isRecentEmail(text, startTime)) {
        firstRow = row;
        const parts = text.trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
        firstRowLabel = rowLabel(parts);
        break;
      }
    }
    if (!firstRow) { console.log('  Brak nowego maila — czekam...\n'); continue; }
    if (!await firstRow.isVisible({ timeout: 1_000 }).catch(() => false)) continue;

    console.log(`  Wybieram: ${firstRowLabel}\n`);

    console.log('KROK 2: Otwieram email...');
    await firstRow.click();
    await page.waitForTimeout(2_500);

    console.log('KROK 3: Wyodrębniam link autoryzacyjny...');
    const link = await extractLink(page);
    if (!link) {
      console.log('  Nie znaleziono linku — czekam dalej.\n');
      continue;
    }
    console.log(`  URL: ${link}`);

    const authPage = await browser.newPage();
    try {
      const s = await browser.newCDPSession(authPage);
      const { windowId } = await s.send('Browser.getWindowForTarget');
      await s.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
    } catch { }
    await authPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    console.log(`  URL po załadowaniu: ${authPage.url()}`);
    await authPage.waitForTimeout(5_000);
    await authPage.close();
    console.log('  Zakładka autoryzacyjna zamknięta.\n');

    console.log('KROK 4: Przenoszę do kosza (Deleted Items)...');
    await moveToTrash(page, firstRow);
    console.log('  Przeniesiono.\n');

    console.log('KROK 5: Zamykam przeglądarkę...');
    await browser.close();
    notify('10x auth rk@omegacode.pl', 'Zalogowano pomyślnie');
    await new Promise(r => setTimeout(r, 5_000));
    process.exit(0);
  }

  console.error(`\nTimeout — magic link nie dotarł w ciągu ${POLL_TIMEOUT_MS / 1000}s`);
  notify('10x auth rk@omegacode.pl', `Timeout — brak maila po ${POLL_TIMEOUT_MS / 1000}s`);
  await browser.close();
  process.exit(1);
}

main().catch(err => {
  console.error('Błąd:', err.message);
  notify('10x auth rk@omegacode.pl', err.message.slice(0, 80), 'Error');
  process.exit(1);
});
