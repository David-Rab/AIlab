// UI wiring test: clicks every control in a real browser and checks the game state changed.
// Run: npm run build && node scripts/uitest.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';

const url = 'file:///' + path.resolve('dist/index.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole('button', { name: 'New game' }).click();
await page.getByRole('button', { name: /Start/ }).click();

const get = (expr) => page.evaluate((e) => String(JSON.stringify(new Function('s', 'store', `return ${e}`)(window.ai27.state, window.ai27))), expr);
const closeModals = async () => {
  for (let i = 0; i < 10; i++) {
    const m = await page.$('.modal-choices .choice');
    if (!m) return;
    await m.click();
    await page.waitForTimeout(50);
  }
};
let pass = 0;
let fail = 0;
async function check(name, expr, action) {
  await closeModals();
  const before = await get(expr);
  try {
    await action();
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`);
    fail++;
    return;
  }
  await page.waitForTimeout(120);
  const after = await get(expr);
  const ok = before !== after;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(30)} ${before.slice(0, 50)} -> ${after.slice(0, 50)}`);
}
const row = (text) => page.locator('.row', { hasText: text });
const slider = async (idx, value) => {
  const el = page.locator('.strategy input[type=range]').nth(idx);
  await el.evaluate((node, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(node, String(v));
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
};

// Time controls
await check('Speed 3', 'store.speed', () => page.locator('.speed-pip').nth(2).click());
await check('Pause button', 'store.speed', () => page.locator('.speeds .btn').click());
await check('Space key', 'store.speed', () => page.keyboard.press('Space'));
await page.waitForTimeout(1500);
await page.keyboard.press('Digit5');
await page.waitForTimeout(3000);
await page.keyboard.press('Space');
await page.evaluate(() => { window.ai27.speed = 0; });
await closeModals();
await page.evaluate(() => { const s = window.ai27.state; s.p = Math.max(s.p, s.model.publicP + 0.3); window.ai27.notify(); });

// Strategy panel
await check('Release', 's.model.publicP', () => page.getByRole('button', { name: 'Release', exact: true }).click());
await page.evaluate(() => { const s = window.ai27.state; s.p += 0.3; window.ai27.notify(); });
await check('Release mini', 's.model.publicP', () => page.getByRole('button', { name: 'Release mini' }).click());
await check('Raise capital', 's.company.cash', () => page.getByRole('button', { name: /^Raise/ }).click());
await check('Pause frontier R&D', 's.flags.paused', () => row('Pause frontier').locator('.toggle').click());
await check('Brief: Full', 's.policies.govBriefing', () => page.getByRole('button', { name: 'Full', exact: true }).click());
await check('Brief: Hide', 's.policies.govBriefing', () => page.getByRole('button', { name: 'Hide', exact: true }).click());
await check('Lobby: Dereg', 's.policies.lobbying', () => page.getByRole('button', { name: 'Dereg' }).click());
await check('Lobby: Safety', 's.policies.lobbying', () => page.locator('.row', { hasText: 'Lobbying' }).getByRole('button', { name: 'Safety' }).click());
await check('Siloing: Strict', 's.policies.siloing', () => page.getByRole('button', { name: 'Strict' }).click());
await check('Whistleblower', 's.policies.whistleblowerProtection', () => row('Whistleblower').locator('.toggle').click());
await check('Open-source old', 's.policies.openWeightsOld', () => row('Open-source').locator('.toggle').click());
await check('Military work', 's.policies.militaryWork', () => row('Military').locator('.toggle').click());
await check('Share with allies', 's.policies.shareWithAllies', () => row('Share with').locator('.toggle').click());
await check('Slider: capabilities', 's.allocation', () => slider(0, 0.4));
await check('Slider: alignment', 's.allocation', () => slider(1, 0.2));
await check('Slider: product', 's.allocation', () => slider(2, 0.25));
await check('Slider: security', 's.allocation', () => slider(3, 0.1));
await check('Slider: staff capabilities', 's.staffSplit', () => slider(4, 0.6));
await check('Slider: staff safety', 's.staffSplit', () => slider(5, 0.25));
await check('Slider: staff security', 's.staffSplit', () => slider(6, 0.15));
await check('Slider: expansion', 's.policies.expansion', () => slider(7, 3));
await check('Slider: hires', 's.policies.hiringPerMonth', () => slider(8, 200));
await check('Slider: PR', 's.policies.prPerMonth', () => slider(9, 1));

// Tabs + research
for (const t of ['Model', 'Research', 'World', 'Log', 'Overview']) await check(`Tab ${t}`, 'store.panel', () => page.getByRole('button', { name: t, exact: true }).click());
await page.getByRole('button', { name: 'Research', exact: true }).click();
await check('Queue a technique', 's.researchQueue', () => page.locator('.tech.avail:not(.queued) .tech-row').first().click());
await check('Unqueue (x)', 's.researchQueue', () => page.locator('.queue-item .mini').last().click());
await page.evaluate(() => { const s = window.ai27.state; s.techs.honeypots.done = true; s.techs.honeypots.active = true; window.ai27.notify(); });
await check('Tech on/off', 's.techs.honeypots.active', () => page.locator('.tech', { hasText: 'Honeypots' }).locator('.toggle').first().click());
await check('Train against', 's.techs.honeypots.trainAgainst', () => page.locator('.tech', { hasText: 'Honeypots' }).locator('.toggle').nth(1).click());
await page.getByRole('button', { name: 'Log', exact: true }).click();
await check('Log filter', 'document.querySelectorAll(".log-item").length', () => page.locator('.seg-btn', { hasText: 'company' }).click());

// Event modal: force one, click each choice index 0
await check('Event modal + choice', 's.log[s.log.length - 1].text', async () => {
  await page.evaluate(() => { const s = window.ai27.state; s.policies.militaryWork = false; s.events = [{ id: 'dodContract', day: s.day }]; window.ai27.notify(); });
  await page.waitForTimeout(150);
  await page.locator('.modal-choices .choice').first().click();
});

// Save / menu
await check('Save button', 'localStorage.getItem("ai27.save.v1")?.length', async () => { await page.evaluate(() => { window.ai27.state.day += 1; }); await page.locator('button[title=Save]').click(); });
await check('Home button', 'store.screen', () => page.locator('button[title^="Menu"]').click());
await check('Continue', 'store.screen', () => page.getByRole('button', { name: 'Continue' }).click());

console.log(`\n${pass} passed, ${fail} failed${errors.length ? '\nPAGE ERRORS:\n' + errors.join('\n') : ''}`);
await browser.close();
