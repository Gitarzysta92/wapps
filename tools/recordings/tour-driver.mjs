import { Motion, installPointer } from './motion.mjs';

export class TourDriver extends Motion {
  constructor(page, { pace = 1 / 1.5, log = () => {} } = {}) {
    super(page, { width: 768, height: 1024, touch: true });
    this.pace = pace;
    this.log = log;
    this.sequence = 0;
    this.baseUrl = new URL(page.url()).origin;
  }
  hold(ms = 2200) { return super.hold(Math.max(30, ms * this.pace)); }
  scrollTo(top, ms = 3000) { return super.scrollTo(top, Math.max(60, ms * this.pace)); }

  async target(text, selector = 'button,a', { contains = false, index = 0 } = {}) {
    const id = `tour-${++this.sequence}`;
    await this.page.waitForFunction(({ text, selector, contains, index }) => {
      const normalize = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
      return [...document.querySelectorAll(selector)].filter((el) => {
        const box = el.getBoundingClientRect();
        const label = normalize(el.innerText || el.getAttribute('aria-label'));
        return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden' &&
          (contains ? label.includes(text) : label === text);
      }).length > index;
    }, { timeout: 7000 }, { text, selector, contains, index });
    await this.page.evaluate(({ text, selector, contains, index, id }) => {
      const normalize = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
      const element = [...document.querySelectorAll(selector)].filter((el) => {
        const box = el.getBoundingClientRect();
        const label = normalize(el.innerText || el.getAttribute('aria-label'));
        return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden' &&
          (contains ? label.includes(text) : label === text);
      })[index];
      element.setAttribute('data-tour-target', id);
    }, { text, selector, contains, index, id });
    return `[data-tour-target="${id}"]`;
  }

  async reveal(selector) {
    const element = await this.visibleElement(selector);
    await element.evaluate(async (el, duration) => {
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight + 1) continue;
        const box = el.getBoundingClientRect(), area = parent.getBoundingClientRect();
        if (box.top >= area.top + 16 && box.bottom <= area.bottom - 16) continue;
        const from = parent.scrollTop;
        const to = Math.max(0, Math.min(parent.scrollHeight - parent.clientHeight,
          from + box.top - area.top - (parent.clientHeight - box.height) / 2));
        await new Promise((resolve) => {
          const start = performance.now();
          const frame = (now) => {
            const t = Math.min(1, (now - start) / duration);
            parent.scrollTop = from + (to - from) * t * t * (3 - 2 * t);
            if (t < 1) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        });
      }
    }, Math.max(60, 1600 * this.pace));
    const top = await element.evaluate((el) => {
      if (el.closest('.sidebar, tui-dialog, tui-dropdown')) return null;
      const box = el.getBoundingClientRect();
      return box.top < 145 || box.bottom > innerHeight - 90 ? scrollY + box.top - innerHeight * 0.38 : null;
    });
    if (top !== null) await this.scrollTo(top, 1800);
    return element;
  }

  async click(selector, options = {}) {
    this.log('click', selector);
    const element = options.reveal === false ? await this.visibleElement(selector) : await this.reveal(selector);
    await this.page.waitForFunction((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width * 0.52, rect.y + rect.height * 0.5);
      return hit === element || element.contains(hit);
    }, { timeout: 7000 }, element);
    await element.dispose();
    await super.click(selector, { reveal: false });
    await this.hold(650);
  }
  async clickText(text, selector = 'button,a', options = {}) {
    this.log('action', text);
    await this.click(await this.target(text, selector, options));
  }
  async look(text, selector = 'h1,h2,h3,h4,p', ms = 3500, options = {}) {
    this.log('inspect', text);
    const element = await this.reveal(await this.target(text, selector, options));
    await element.dispose();
    await this.hold(ms);
  }
  async fill(selector, value, submit = false) {
    this.log('type', value);
    await this.click(selector);
    await this.page.$eval(selector, (input) => input.select());
    await this.page.keyboard.press('Backspace');
    for (const [index, char] of [...value].entries()) {
      await this.page.keyboard.type(char);
      await this.hold(char === ' ' ? 155 : [90, 115, 80, 100][index % 4]);
    }
    if (submit) await this.page.keyboard.press('Enter');
    await this.ready();
    await this.hold(1200);
  }
  async close() { await this.page.keyboard.press('Escape'); await this.hold(900); }
  async reload() {
    this.log('reload', this.page.url());
    await this.page.reload({ waitUntil: 'networkidle0' });
    await installPointer(this.page, true); await this.ready(); await this.hold(2600);
  }
  async back(forward = false) {
    this.log(forward ? 'forward' : 'back', 'Browser history');
    if (forward) await this.page.goForward(); else await this.page.goBack();
    await this.ready(); await this.hold(1800);
  }
  async panel(side) {
    const label = side === 'left' ? 'navigation' : 'account';
    const selector = `[aria-label="Toggle ${label} sidebar"]`;
    const open = await this.page.$eval(selector, (el) => el.getAttribute('aria-expanded') === 'true');
    if (!open) await this.click(selector, { reveal: false });
    await this.hold(1200);
  }
  async nav(href, side = 'left') {
    this.log('navigate', href);
    await this.panel(side);
    await this.click(`.sidebar.${side} a[href="${href}"]`);
    await this.ready(); await this.hold(2000);
  }
  async account(href) { return this.nav(href, 'right'); }
  async route(href) {
    this.log('shortcut', href);
    await this.page.goto(`${this.baseUrl}${href}`, { waitUntil: 'networkidle0' });
    await installPointer(this.page, true); await this.ready(); await this.hold(2600);
  }
  async exists(text, selector = 'button,a', contains = false) {
    return this.page.evaluate(({ text, selector, contains }) => [...document.querySelectorAll(selector)].some((el) => {
      const value = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      return el.getBoundingClientRect().width > 0 && (contains ? value.includes(text) : value === text);
    }), { text, selector, contains });
  }
  async expect(text) {
    await this.page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 8000 }, text);
  }
  async select(selector, value) {
    const index = await this.page.$eval(selector, (el, value) => [...el.options].findIndex((option) => option.value === value), value);
    if (index < 0) throw new Error(`No option ${value} in ${selector}`);
    const element = await this.reveal(selector); await element.focus(); await element.dispose();
    await this.page.keyboard.press('Home');
    for (let i = 0; i < index; i++) await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter'); await this.ready(); await this.hold(1800);
  }
  async addFilter(name, options = [], query) {
    await this.clickText('Manage filters', 'main button');
    await this.clickText(name, 'filters-multiselect .filters-multiselect button');
    await this.expect('Apply');
    if (query) await this.fill('filter-selection-dialog input[type="text"], .dialog input[type="text"]', query);
    for (const name of options) await this.clickText(name, '.dialog label');
    await this.hold(1800);
    await this.clickText('Apply', '.dialog button');
    await this.ready(); await this.hold(1700);
  }
  async removeFilter(name) {
    await this.click(await this.target(`${name}:`, 'selected-filter-chip .chip-left'));
    await this.hold(1400);
  }
  async favorite(type, slug, saved = true) {
    const selector = `favorite-toggle-button[type="${type}"][slug="${slug}"] button`;
    // Angular inputs need not become DOM attributes: scope by the containing page
    // when there is only one toggle, and verify its visible label before acting.
    let actual = await this.page.$(selector) ? selector : 'main favorite-toggle-button button';
    const label = await this.page.$eval(actual, (el) => el.getAttribute('aria-label') || el.innerText);
    if (saved ? label.includes('Add') : label.includes('Remove')) await this.click(actual);
    await this.hold(1500);
  }
  async settings(href) {
    if (!(await this.page.$('settings-navigation button'))) await this.account('/me/settings');
    await this.click('settings-navigation button');
    await this.click(`[aria-label="Settings sections"] a[href="${href}"]`);
    await this.hold(2200);
  }
  async scan(screens = 1, hold = 3500) {
    await this.scrollBy(screens, 4200); await this.hold(hold);
  }
  async inspect(selector, ms = 3500) {
    const element = await this.reveal(selector); await element.dispose(); await this.hold(ms);
  }
}
