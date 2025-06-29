import fs from "fs";

export function getJsonFromFile<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export async function autoScroll(page: any){
  await page.evaluate(async () => {
    let prevHeight = 0;
    const timer = await new Promise((r) => {
      let counter = 0;
      const timer: any = setInterval(() => {
        window.scrollBy(0, 2000);
        if (prevHeight === document.body.scrollHeight) {
          counter++
        } else {
          counter = 0;
          prevHeight = document.body.scrollHeight
        }

        if (counter > 10) {
          r(timer)
        }

        console.log(document.body.scrollHeight, counter)
      }, 100)
    })
    clearInterval(timer as any)
  });
}
