import { Browser } from "puppeteer";
import { ScrapedApp } from "../scraped-app.dto";

type AppInput = {
  url: string;
  name: string;
  tags: string[];
}

export class ScrapAppDetailsFromStoreApp {
  constructor(
    private readonly _browser: Browser
  ) { }

  public async handle(input: AppInput): Promise<ScrapedApp> {
    const page = await this._browser.newPage();
    await page.goto(input.url, { waitUntil: 'domcontentloaded' });
    
    const item = await page.$$eval('main', (elems: Element[], baseData: AppInput) => {
      function getSocialId(href: string): number {
        return href.includes('x.com') || href.includes('twitter.com') ? 0 : 1;
      }
      
      const result: ScrapedApp = {
        name: baseData.name || '',
        slug: baseData.name.trim().toLowerCase().replaceAll(' ', '-'),
        detailsLink: baseData.url,
        tags: baseData.tags || [],
        description: '',
        links: [],
        assets: []
      };

      for (const elem of elems) {
        // Get social links
        const socialLinks = Array.from(elem.querySelectorAll('a[rel="noreferrer noopener"]'));
        for (const link of socialLinks) {
          const href = (link as HTMLAnchorElement).href;
          if (href) {
            result.links.push({
              id: getSocialId(href),
              link: href
            });
          }
        }
        
        // Get description
        const description = document.querySelector('main section.rounded-lg.p-6.text-sm.bg-white.text-gray-900');
        if (description) {
          result.description = description.textContent?.trim() || '';
        }

        // Get assets (images)
        const assets = new Map<string, { src: string, type: 'logo' | 'gallery' }>();
        const images = Array.from(document.querySelectorAll('main [srcset]'));
        for (const image of images) {
          const src = (image as HTMLImageElement).src;
          if (src) {
            assets.set(src, {
              src: src,
              type: (image as HTMLImageElement).alt.includes('icon') ? 'logo' : 'gallery' as const
            });
          }
        }

        result.assets = Array.from(assets.values());
      }
      return result;
    }, input);

    await page.close();
    return item;
  }
}