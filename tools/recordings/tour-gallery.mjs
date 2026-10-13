import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function writeTourGallery(output, manifest) {
  const stamp = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const first = manifest.chapters[0];
  await writeFile(path.join(output,'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tablet recordings · 768 × 1024</title><style>
*{box-sizing:border-box}body{margin:0;background:#101319;color:#e8ecf5;font:15px/1.5 system-ui}main{max-width:1200px;margin:auto;padding:32px}h1{font-size:28px;margin:0}h2{font-size:18px;margin:12px 0}p{color:#aeb9cc}.layout{display:grid;grid-template-columns:minmax(0,600px) minmax(260px,1fr);gap:28px}.player{position:sticky;top:20px;align-self:start}video{width:100%;max-height:80vh;background:#090b0e;border-radius:14px}.playlist{display:grid;gap:6px;align-content:start;max-height:90vh;overflow:auto}.clip{display:flex;gap:8px;align-items:center;background:#1c2330;border-radius:8px;padding:2px 10px 2px 0}.clip:has([aria-current=true]){background:#2c405b;outline:1px solid #6ca6ee}button{flex:1;color:inherit;text-align:left;background:transparent;border:0;padding:10px 12px;cursor:pointer;font:inherit}button span{display:block;color:#aeb9cc;font-size:12px}a{color:#8dbdff}.clip a{font-size:12px;text-decoration:none}.meta{font-size:13px}@media(max-width:780px){main{padding:20px}.layout{grid-template-columns:1fr}.player{position:static}.playlist{max-height:none}}
</style><main><h1>Tablet · 768 × 1024</h1><p>${manifest.chapters.length} separate chapter clips · ${manifest.speed}× movement and pauses · 60 fps · silent</p><div class="layout"><div class="player"><video id="video" controls preload="metadata" poster="${first.screenshot}" src="${first.file}"></video><h2 id="current-title">${escape(first.title)}</h2><a id="download" href="${first.file}" download>Download this clip</a><p class="meta">${stamp(manifest.duration)} total footage. Select a chapter to play its individual MP4.</p></div><nav class="playlist" aria-label="Recorded chapters">${manifest.chapters.map(c=>`<div class="clip"><button data-number="${c.number}" data-file="${c.file}" data-poster="${c.screenshot}" data-title="${escape(c.title)}" aria-current="${c.number===first.number}">${String(c.number).padStart(2,'0')} · ${escape(c.title)}<span>${stamp(c.duration)}</span></button><a href="${c.file}" download aria-label="Download chapter ${c.number}">MP4 ↓</a></div>`).join('')}</nav></div><p class="meta">Fixed tablet viewport throughout. Local demo account. Source: ${escape(manifest.origin)}${manifest.sourceRevision?' · '+escape(manifest.sourceRevision.slice(0,8)):''}.</p><p class="meta"><a href="manifest.json">Recording details</a></p></main><script>
const video=document.getElementById('video');
for(const button of document.querySelectorAll('[data-file]')) button.onclick=()=>{
 for(const other of document.querySelectorAll('[data-file]')) other.setAttribute('aria-current',String(other===button));
 video.poster=button.dataset.poster;video.src=button.dataset.file;
 document.getElementById('current-title').textContent=button.dataset.title;
 document.getElementById('download').href=button.dataset.file;
 video.play().catch(()=>{});
};
</script></html>`);
}
