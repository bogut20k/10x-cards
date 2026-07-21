const { chromium } = require('playwright');
const path = require('path');

const SESSION_DIR = path.join(process.env.USERPROFILE, '.outlook-magic-link-session');

(async () => {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    channel: 'chrome',
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto('https://outlook.office.com/mail/inbox', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const url = page.url();
  console.log('URL:', url);

  // Zbierz wszystkie buttony
  const buttons = await page.locator('button').allInnerTexts();
  console.log('\nPrzyciski na stronie:');
  buttons.slice(0, 20).forEach((b, i) => console.log(`  [${i}] "${b.trim().slice(0, 50)}"`));

  // Zbierz aria-labels przycisków
  const ariaLabels = await page.locator('button[aria-label]').evaluateAll(
    els => els.map(e => e.getAttribute('aria-label'))
  );
  console.log('\nAria-labels przycisków:');
  ariaLabels.slice(0, 20).forEach((a, i) => console.log(`  [${i}] "${a}"`));

  await page.screenshot({ path: 'K:\\@Claude-Code-Workspace\\10xCards\\test-output\\outlook-loggedin.png' });
  console.log('\nScreenshot zapisany.');
  await browser.close();
})().catch(e => console.error(e.message));
