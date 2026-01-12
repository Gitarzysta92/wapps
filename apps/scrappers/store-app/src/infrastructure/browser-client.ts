import puppeteer, { Browser } from "puppeteer";

export class BrowserClient {
  private browser: Browser | null = null;

  constructor(
    private readonly _browser: typeof puppeteer,
  ) { }

  async launch(cfg: { headless: boolean | string }): Promise<Browser> {
    console.log('Launching browser...');
    
    const headlessBool = cfg.headless === 'true' || cfg.headless === true;
    
    this.browser = await this._browser.launch({
      headless: headlessBool,
      args: headlessBool ? ['--no-sandbox', '--disable-setuid-sandbox'] : ['--start-maximized'],
      defaultViewport: { width: 1700, height: 800 },
    });
    
    console.log('✅ Browser launched');
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}