import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import ffmpeg from 'ffmpeg-static';
const directory=path.resolve(process.argv[2]);
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
if(manifest.status!=='complete'||manifest.chapters.length!==20||manifest.errors.length) throw new Error('Tour is incomplete or has runtime errors');
const report=[];
for(const chapter of manifest.chapters) {
  const file=path.join(directory,chapter.file);
  const log=await new Promise((resolve,reject)=>{
    const child=spawn(ffmpeg,['-hide_banner','-nostats','-xerror','-i',file,'-map','0:v:0','-f','null','-']);
    let output=''; child.stderr.on('data',data=>output+=data); child.once('error',reject);
    child.once('close',code=>code===0?resolve(output):reject(new Error(output)));
  });
  const [_,hh,mm,ss]=log.match(/Duration: (\d+):(\d+):([\d.]+)/)??[];
  const duration=+hh*3600 + +mm*60 + +ss;
  if(!log.includes('768x1024')||!log.includes('60 fps')||Math.abs(duration-chapter.duration)>.1) throw new Error(`Video dimensions, fps or duration mismatch: ${chapter.file}`);
  report.push({chapter:chapter.number,file:chapter.file,decoded:true,width:768,height:1024,fps:60,duration,bytes:(await stat(file)).size});
  console.log(`Decoded ${chapter.number}: ${chapter.title}`);
}
const browser=await puppeteer.launch({headless:true});
try {
  const page=await browser.newPage(); await page.setViewport({width:1200,height:1100});
  await page.goto(pathToFileURL(path.join(directory,'index.html')).href);
  await mkdir(path.join(directory,'verification'),{recursive:true});
  for(const chapter of manifest.chapters) {
    await page.click(`button[data-number="${chapter.number}"]`);
    await page.waitForFunction(file=>{const v=document.querySelector('video');return v.currentSrc.endsWith(file)&&v.readyState>=2;},{},chapter.file);
    const at=chapter.duration/2;
    await page.$eval('video',async(video,at)=>{video.pause();video.currentTime=at;await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));await video.play();await new Promise(resolve=>setTimeout(resolve,300));video.pause();},at);
    const state=await page.$eval('video',video=>({width:video.videoWidth,height:video.videoHeight,time:video.currentTime,error:video.error?.message??null}));
    if(state.width!==768||state.height!==1024||state.error||state.time<=at) throw new Error(`Playback failed for chapter ${chapter.number}`);
    await (await page.$('video')).screenshot({path:path.join(directory,'verification',`${String(chapter.number).padStart(2,'0')}.png`)});
    report[chapter.number-1].playback=state;
    console.log(`Played ${chapter.number}: ${chapter.title}`);
  }
  await page.click('button[data-number="1"]'); await page.$eval('video',v=>v.pause());
  await page.screenshot({path:path.join(directory,'verification','gallery.png')});
} finally {await browser.close();}
await writeFile(path.join(directory,'verification.json'),JSON.stringify(report,null,2));
console.log(`Verified ${report.length} separate 768×1024 clips at 60 fps.`);
