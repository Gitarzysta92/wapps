import { setTimeout as pause } from 'node:timers/promises';

// These decorations exist only in the isolated recording browser.
export async function installPointer(page, touch) {
  await page.evaluate((touch) => {
    const cursor = document.createElement('div');
    cursor.id = 'walkthrough-pointer';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:28px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 1px 2px #0008)';
    cursor.innerHTML = '<svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg"><path d="M3 2v22l5.5-5 4 9 4-2-4-8h8Z" fill="white" stroke="#202735" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    cursor.style.display = touch ? 'none' : 'block';
    document.body.append(cursor);
    window.walkthroughPointer = { x: innerWidth * 0.72, y: innerHeight * 0.7 };
    cursor.style.transform = `translate(${window.walkthroughPointer.x}px,${window.walkthroughPointer.y}px)`;
    const style = document.createElement('style');
    style.textContent = '* { cursor: none !important; }';
    document.head.append(style);
  }, touch);
}

export class Motion {
  constructor(page, profile) { this.page = page; this.profile = profile; }

  hold(ms) { return pause(ms); }

  async ready() {
    await this.page.waitForSelector('main', { visible: true });
    await this.page.evaluate(async () => {
      await document.fonts.ready;
      const visibleImages = [...document.images].filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;
      });
      await Promise.all(visibleImages.map((image) => Promise.race([
        image.decode().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])));
    });
    if (await this.page.$('#webpack-dev-server-client-overlay, vite-error-overlay')) {
      throw new Error('The app has a compiler error overlay. Build successfully before recording.');
    }
    await pause(250);
  }

  async scrollTo(top, duration = 3000) {
    await this.page.evaluate(({ top, duration }) => new Promise((resolve) => {
      const element = document.scrollingElement;
      const from = element.scrollTop;
      const to = Math.max(0, Math.min(top, element.scrollHeight - innerHeight));
      if (Math.abs(to - from) < 2) return resolve();
      const start = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // Quintic smoothstep: zero velocity and acceleration at both ends.
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        window.scrollTo({ top: from + (to - from) * eased, behavior: 'instant' });
        if (t < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    }), { top, duration });
    await this.ready();
  }

  async scrollBy(screens = 0.65, duration = 3000) {
    const top = await this.page.evaluate((screens) => scrollY + innerHeight * screens, screens);
    await this.scrollTo(top, duration);
  }

  async visibleElement(selector) {
    await this.page.waitForFunction((selector) => [...document.querySelectorAll(selector)].some((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    }), { timeout: 10000 }, selector);
    const handle = await this.page.evaluateHandle((selector) => [...document.querySelectorAll(selector)].find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    }), selector);
    return handle.asElement();
  }

  async reveal(selector) {
    const element = await this.visibleElement(selector);
    const target = await element.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const bottomSafe = innerHeight - 110;
      const topSafe = 125;
      return r.top < topSafe || r.bottom > bottomSafe
        ? scrollY + r.top - innerHeight * 0.34 : null;
    });
    if (target !== null) await this.scrollTo(target, 1600);
    return element;
  }

  async move(x, y) {
    if (this.profile.touch) return;
    await this.page.evaluate(({ x, y }) => new Promise((resolve) => {
      const from = window.walkthroughPointer;
      const dx = x - from.x, dy = y - from.y;
      const distance = Math.hypot(dx, dy);
      const duration = Math.max(380, Math.min(950, distance * 0.9));
      const bend = Math.min(60, distance * 0.12);
      const c1 = { x: from.x + dx * 0.3 - dy / (distance || 1) * bend,
        y: from.y + dy * 0.3 + dx / (distance || 1) * bend };
      const c2 = { x: from.x + dx * 0.75, y: from.y + dy * 0.75 };
      const cursor = document.getElementById('walkthrough-pointer');
      const start = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = t * t * (3 - 2 * t), u = 1 - e;
        const px = u ** 3 * from.x + 3 * u ** 2 * e * c1.x + 3 * u * e ** 2 * c2.x + e ** 3 * x;
        const py = u ** 3 * from.y + 3 * u ** 2 * e * c1.y + 3 * u * e ** 2 * c2.y + e ** 3 * y;
        cursor.style.transform = `translate(${px}px,${py}px)`;
        if (t < 1) requestAnimationFrame(frame);
        else { window.walkthroughPointer = { x, y }; resolve(); }
      };
      requestAnimationFrame(frame);
    }), { x, y });
    await this.page.mouse.move(x, y);
  }

  async click(selector, { reveal = true } = {}) {
    const element = reveal ? await this.reveal(selector) : await this.visibleElement(selector);
    try {
      const box = await element.boundingBox();
      if (!box) throw new Error(`No click target for ${selector}`);
      const x = box.x + box.width * 0.52, y = box.y + box.height * 0.5;
      const reachable = await element.evaluate((el, point) => {
        const target = document.elementFromPoint(point.x, point.y);
        return target === el || el.contains(target);
      }, { x, y });
      if (!reachable) throw new Error(`Click target is obscured or offscreen: ${selector}`);
      await this.move(x, y);
      await pause(160);
      if (this.profile.touch) {
        await this.page.evaluate(({ x, y }) => {
          const dot = document.createElement('div');
          dot.setAttribute('aria-hidden', 'true');
          dot.style.cssText = `position:fixed;left:${x - 12}px;top:${y - 12}px;width:24px;height:24px;border:2px solid #ffffff99;border-radius:50%;background:#ffffff20;pointer-events:none;z-index:2147483647`;
          document.body.append(dot);
          dot.animate([{ opacity: 0.65, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 360 }).finished.then(() => dot.remove());
        }, { x, y });
        await this.page.touchscreen.tap(x, y);
      } else {
        await this.page.mouse.down(); await pause(70); await this.page.mouse.up();
      }
      await this.ready();
    } finally { await element.dispose(); }
  }

  async type(selector, value) {
    await this.click(selector);
    for (const [index, character] of [...value].entries()) {
      await this.page.keyboard.type(character);
      await pause(character === ' ' ? 170 : [80, 105, 65, 95, 75][index % 5]);
    }
    await pause(250);
    await this.page.keyboard.press('Enter');
    await this.ready();
  }

  async navigate(href) {
    const { width } = this.profile;
    if (width >= 768 && width <= 1040) {
      await this.click('[aria-label="Toggle navigation sidebar"]', { reveal: false });
      await pause(450);
    }
    const region = width < 768 ? '.bottom-bar' : '.sidebar.left';
    await this.click(`${region} a[href="${href}"]`, { reveal: false });
    await this.page.waitForFunction((href) => location.pathname === href, {}, href);
    await this.ready();
  }
}
