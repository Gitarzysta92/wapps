import { Browser } from "puppeteer";
import { autoScroll } from "./utils";

interface ScrapedApp {
  id?: number;
  name: string;
  url: string;
  tags: string[];
}

export class ScrapAppListFromStoreApp {

  constructor(
    private readonly _browser: Browser
  ) { }

  public async handle(): Promise<ScrapedApp[]> {
    const page = await this._browser.newPage();
    await page.goto("https://store.app/browse", { waitUntil: 'domcontentloaded' });
    await autoScroll(page);
    const result = await page.$$eval('ul.grid.grid-cols-1 li', (elems: Element[]) => {
      const apps: ScrapedApp[] = [];
      for (const elem of elems) {
        const detailsLink = (elem.querySelector('a') as HTMLAnchorElement)?.href;
        const name = elem.querySelector('h3')?.textContent?.trim();
  
        const tags = new Map<string, string>();
        const tagElems = Array.from(elem.querySelectorAll('section div div.flex.flex-wrap div'));
        for (const tagElem of tagElems) {
          const text = tagElem.textContent?.trim();
          if (text && text.length > 0) {
            tags.set(text, text);
          }
        }
        if (name && detailsLink) {
          apps.push({ 
            name, 
            url: detailsLink, 
            tags: Array.from(tags.values())
          });
        }
      }
      return apps;
    });
    return result;
  }
}