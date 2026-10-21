import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export async function writeGallery(output, results) {
  const cards = results.map((result) => {
    const directory = encodeURIComponent(result.profile);
    const poster = `${directory}/01-explore.png`;
    const player = result.clips.length
      ? `<video controls preload="metadata" poster="${poster}" src="${directory}/walkthrough.mp4"></video>`
      : `<img src="${poster}" alt="${escape(result.profile)} preview"><p>Rehearsal only — no video encoded.</p>`;
    return `<section>
      <h2>${escape(result.profile)} · ${result.width} × ${result.height}</h2>
      <p>${escape(result.description)}</p>
      ${player}
      <p>${result.clips.map((clip) => `<a href="${directory}/${encodeURIComponent(clip.file)}">${escape(clip.name)} · ${clip.duration.toFixed(1)}s</a>`).join(' · ')}</p>
      <details><summary>Chapters & stills</summary><ol>
        ${result.chapters.map((chapter) => `<li>${chapter.time.toFixed(1)}s · <a href="${directory}/${encodeURIComponent(chapter.screenshot)}">${escape(chapter.title)}</a></li>`).join('\n')}
      </ol></details>
    </section>`;
  }).join('\n');
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(results, null, 2) + '\n');
  await writeFile(path.join(output, 'index.html'), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wapps recordings</title>
<style>
  body{font:16px/1.6 system-ui;margin:40px auto;padding:0 24px;max-width:1200px;background:#151d2b;color:#eef2ff}
  h1,h2{line-height:1.2} a{color:#b9b1ff}
  main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:32px}
  section{background:#202c3d;padding:24px;border-radius:16px}
  video,img{width:100%;max-height:520px;object-fit:contain;background:#111;border-radius:8px}
  summary{cursor:pointer}
</style>
<h1>Wapps · responsive walkthroughs</h1>
<p>Natural pacing, original viewport dimensions, H.264 MP4. Each recorded layout
includes a full walkthrough, a discovery showcase, and a 15-second excerpt.
Demo content from the local app.</p>
<main>${cards}</main>
</html>\n`);
}
