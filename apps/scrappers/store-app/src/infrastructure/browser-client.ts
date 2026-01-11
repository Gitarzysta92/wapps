import puppeteer from "puppeteer";

export class BrowserClient {
  close() {
    throw new Error('Method not implemented.');
  }
  constructor(
    private readonly _browser: typeof puppeteer,
  ) { }

  async launch(cfg: { headless: boolean }) {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: headless,
      args: headless ? ['--no-sandbox','--disable-setuid-sandbox'] : ['--start-maximized'],
      defaultViewport: { width: 1700, height: 800 },
    });
    console.log('✅ Browser launched');
    return this._browser.launch();
  }
}