#!/usr/bin/env node
// Pełny test: wyszukaj → otwórz → kliknij Zaloguj → przenieś do kosza → zamknij
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

async function main() {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    channel: 'chrome',
  });

  const page = browser.pages()[0] || await browser.newPage();

  try {
    const session = await browser.newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  } catch { }

  await page.goto(OUTLOOK_URL, { waitUntil: 'domcontentloaded' });

  notify('10x auth rk@omegacode.pl', 'Logowanie do Outlook...');
  console.log('Czekam na zalogowany inbox...');
  try {
    await page.waitForSelector('button[aria-label="New email"]', { timeout: 60_000 });
  } catch {
    console.error('Nie wykryto inboxu.'); await browser.close(); process.exit(1);
  }
  console.log('Inbox załadowany.\n');

  // === KROK 1: Wyszukaj po adresie nadawcy ===
  console.log(`KROK 1: Wyszukuję from:${SENDER}...`);
  const searchBox = page.locator('[placeholder*="Search"], [aria-label*="Search"], input[type="search"]').first();
  await searchBox.click({ timeout: 5_000 });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1_500); // poczekaj aż pole search się aktywuje
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(300);
  await page.keyboard.type(`from:${SENDER}`, { delay: 80 }); // wolniej żeby autocomplete nadążył
  await page.waitForTimeout(1_500); // poczekaj aż Outlook przetworzy tekst
  await page.keyboard.press('Enter');
  // Czekaj na wyniki — Outlook potrzebuje chwili na przeładowanie widoku
  await page.waitForTimeout(2_000);
  await page.waitForSelector('[role="option"]', { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(1_000);

  const rows = page.locator('[role="option"]');
  const count = await rows.count();
  console.log(`  Znaleziono: ${count} wierszy`);
  for (let i = 0; i < Math.min(count, 3); i++) {
    const parts = (await rows.nth(i).innerText().catch(() => '')).trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
    const timeIdx = parts.findIndex(p => /\d{1,2}:\d{2}/.test(p));
    const date = timeIdx >= 0 ? parts[timeIdx] : '?';
    const subject = timeIdx > 1 ? parts[timeIdx - 1] : (parts[2] || parts[1] || '?');
    console.log(`  [${i}] ${subject}  |  ${date}`);
  }

  // Wybierz pierwszy wiersz który ma SENDER ale nie jest bounce od Microsoft Outlook
  const emailRow = rows
    .filter({ hasText: SENDER })
    .filter({ hasNotText: 'FW:' })
    .first();

  if (!await emailRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
    console.log('  Brak maila od właściwego nadawcy.'); await browser.close(); process.exit(1);
  }
  const rowParts = (await emailRow.innerText()).trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
  const rowTimeIdx = rowParts.findIndex(p => /\d{1,2}:\d{2}/.test(p));
  const rowSubject = rowTimeIdx > 1 ? rowParts[rowTimeIdx - 1] : (rowParts[2] || rowParts[1] || '?');
  const rowDate = rowTimeIdx >= 0 ? rowParts[rowTimeIdx] : '?';
  console.log(`  Wybieram: ${rowSubject}  |  ${rowDate}`);

  // === KROK 2: Otwórz email ===
  console.log('\nKROK 2: Otwieram email...');
  await emailRow.click();
  await page.waitForTimeout(3_000);

  // === KROK 3: Wyodrębnij link i otwórz w nowej zakładce ===
  console.log('KROK 3: Wyodrębniam link autoryzacyjny...');
  const content = await page.content();
  const match = content.match(/https?:\/\/[^\s"'<>]+przeprogramowani[^\s"'<>]+/);
  const link = match ? match[0].replace(/&amp;/g, '&') : null;

  if (link) {
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
    console.log('  Zakładka autoryzacyjna zamknięta.');
  } else {
    console.log('  Nie znaleziono linku — pomijam.');
  }

  // === KROK 4: Przenieś do kosza (Delete = Deleted Items, nie permanentne usunięcie) ===
  console.log('\nKROK 4: Przenoszę do kosza (Deleted Items)...');

  // Wróć na email row i użyj przycisku Delete w toolbarze reading pane
  // albo klawisza Delete gdy mail jest zaznaczony
  const deleteBtn = page.locator(
    'button[aria-label*="Delete"], button[title*="Delete"], button[aria-label*="Usuń"], button[title*="Usuń"]'
  ).first();

  if (await deleteBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await deleteBtn.click();
    await page.waitForTimeout(1_500);
    console.log('  Przeniesiono przez przycisk Delete.');
  } else {
    // Prawy przycisk na wierszu → Delete z menu
    await emailRow.click({ button: 'right' });
    await page.waitForTimeout(800);
    const menuDelete = page.getByRole('menuitem', { name: /^delete|^usuń/i }).first();
    if (await menuDelete.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await menuDelete.click();
      await page.waitForTimeout(1_500);
      console.log('  Przeniesiono przez menu kontekstowe.');
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      // Kliknij wiersz i naciśnij Delete
      await emailRow.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(1_500);
      console.log('  Przeniesiono przez klawisz Delete.');
    }
  }

  // === KROK 5: Zamknij Outlook i przeglądarkę ===
  console.log('\nKROK 5: Zamykam przeglądarkę...');
  await browser.close();
  notify('10x auth rk@omegacode.pl', 'Autoryzacja powiodła się');
  await new Promise(r => setTimeout(r, 5_000));
  process.exit(0);
}

main().catch(err => { console.error('Błąd:', err.message); notify('10x auth rk@omegacode.pl', err.message.slice(0, 80), 'Error'); process.exit(1); });
