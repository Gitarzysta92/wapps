import { setTimeout as pause } from 'node:timers/promises';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const homeSearch = 'input[aria-label="Search applications articles suites"]';
const search = 'main input[aria-label="Search"]';
const thread = '/apps/photo-snap/discussions/how-to-integrate-with-external-apis';
const article = '/articles/design-principles-modern-apps';
const app = '/apps/photo-snap/overview';
const suite = '/suites/creative-tools-suite';
async function preview(d, full=false) {
  await d.click('button[aria-label^="Read and comment:"]');
  await d.hold(4000);
  await d.inspect('[aria-label="Discussion messages"]',4000);
  if(full) await d.clickText('Open full discussion'); else await d.close();
}
async function picker(d,name) {
  await d.clickText('Manage filters','main button,main a');
  await d.clickText(name,'filters-multiselect .filters-multiselect button');
  await d.hold(2600);
}
async function display(d,sort='name-desc',size='3') {
  await d.click('main .display-options-trigger');
  await d.select('.catalog-display-options select:nth-of-type(1)',sort);
  await d.select('.catalog-display-options label:nth-of-type(2) select',size);
  await d.select('.catalog-display-options label:nth-of-type(3) select','list');
  await d.hold(2500); await d.close();
}
export const chapters = [
{title:'Explore — feed and interactions',run:async d=>{
  await d.hold(4000); await d.panel('left'); await d.close(); await d.panel('right'); await d.close();
  await d.scan(.7); await d.click('button[aria-label="Upvote Jane Doe reviewed Photo Snap locally"]');
  await d.hold(1800); await d.click('button[aria-label="Upvote Jane Doe reviewed Photo Snap locally"]');
  await d.click('button[aria-label="Item actions"]'); await d.click('share-toggle-button button'); await d.hold(2200);
  if(await d.exists('Copy link')) await d.clickText('Copy link');
  await d.page.waitForFunction(()=>document.body.innerText.includes('clipboard') || document.querySelector('share-toggle-button input[readonly]'),{timeout:8000});
  let copied;
  if(await d.page.$('share-toggle-button input[readonly]')) {
    await d.click('share-toggle-button input[readonly]');
    await d.page.keyboard.down('Meta'); await d.page.keyboard.press('KeyC'); await d.page.keyboard.up('Meta');
    copied=await d.page.$eval('share-toggle-button input[readonly]',el=>el.value); await d.hold(2400);
  } else copied=await d.page.evaluate(()=>navigator.clipboard.readText());
  if(!copied.startsWith(d.baseUrl+'/')) throw new Error('Copied link left the local portal');
  await d.page.goto(copied,{waitUntil:'networkidle0'}); await d.ready(); await d.hold(3000); await d.back();
  await preview(d); await d.scan(1.4);
  await d.click('button[aria-label="Content attribution for Quick Task: Editorial"]'); await d.hold(3500); await d.close();
  await d.scan(1.1);
  await d.click('button[aria-label="Content attribution for Boost Your Productivity With Quick Task: Sponsored by Quick Task"]');
  await d.hold(3500); await d.close();
  for(let i=0;i<4;i++) await d.scan(.9,2200);
  await d.inspect('footer',3000); await d.scrollTo(0,4200);
}},
{title:'Enter the local demo account',run:async d=>{
  await d.panel('right'); await d.click('[aria-label="Log In"]'); await d.hold(3000);
  await d.clickText('Sign up'); await d.hold(3500); await d.clickText('Sign in');
  await d.clickText('Forgot password'); await d.hold(3500); await d.clickText('Sign in');
  await d.clickText('Continue as Guest');
  await d.page.waitForSelector('[aria-label="My profile"]',{visible:true});
  await d.panel('right'); await d.hold(4000);
  await d.look('Favorite Apps','h3',2600); await d.look('Explore Topics','h3',2600); await d.close();
}},
{title:'Search previews and history',run:async d=>{
  await d.nav('/'); await d.fill(homeSearch,'photo'); await d.hold(4200);
  await d.inspect('home-search-results .group-header',3000);
  await d.click('home-search-results .full-search-redirect'); await d.expect('photo'); await d.hold(3200);
  await d.nav('/'); await d.fill(homeSearch,''); await d.click(homeSearch); await d.hold(3500);
  await d.click('home-recent-searches .recent-search-item'); await d.hold(3200);
}},
{title:'Discover — filters and recovery',run:async d=>{
  await d.nav('/discover'); await d.fill(search,'',true); await d.scan(.7); await d.scrollTo(0);
  await d.fill(search,'photo',true); await d.addFilter('Platform',['Web']);
  await d.click('selected-filter-chip .chip-right'); await d.hold(2400);
  await d.clickText('Desktop','tui-dropdown label'); await d.close();
  await d.removeFilter('Platform');
  await picker(d,'Category'); await d.fill('.dialog input[type="text"]','photo');
  await d.clickText('Photo editing','.dialog label'); await d.clickText('Cancel','.dialog button');
  await picker(d,'Category'); await d.fill('.dialog input[type="text"]','photo');
  await d.clickText('Photo editing','.dialog label'); await d.fill('.dialog input[type="text"]','');
  await d.clickText('Work & Productivity','.dialog label'); await d.clickText('Apply','.dialog button');
  await d.hold(2400); await d.back(); await d.back(true); await d.removeFilter('Category');
  for(const name of ['Device','Monetization','Social','Estimated Users']) { await picker(d,name); await d.clickText('Cancel','.dialog button'); }
  await d.fill(search,'zz-no-such-app',true); await d.expect('No results found'); await d.hold(3200);
  await d.clickText('Clear search and filters','main button,main a');
  await d.nav('/'); await d.fill(homeSearch,'photo'); await d.hold(3000);
  await d.click('home-search-results .group-header'); await d.expect('Search all types');
  await d.clickText('Search all types','main button,main a'); await d.hold(3000);
}},
{title:'Categories — directory browsing',run:async d=>{
  await d.account('/categories'); await d.hold(3500);
  await d.click('[aria-label="List view"]'); await d.hold(2200); await d.click('[aria-label="Grid view"]');
  await d.clickText('Show more categories','main button,main a'); await d.scan(.65);
  await d.fill('input[aria-label="Search categories"]','photo editing'); await d.hold(3500);
  await d.click('main a.featured-app[href="/apps/photo-snap"]'); await d.hold(3500); await d.back();
  await d.fill('input[aria-label="Search categories"]','wireframing'); await d.expect('No apps listed yet'); await d.hold(3000);
  await d.fill('input[aria-label="Search categories"]','');
  await d.click('main a.directory-link[href="/categories/photo-editing"]'); await d.hold(3500);
}},
{title:'Tags — filtering and display options',run:async d=>{
  await d.account('/tags'); await d.fill('input[aria-label="Search tags"]','mobile development');
  await d.click('[aria-label="List view"]'); await d.hold(2200); await d.click('[aria-label="Grid view"]'); await d.hold(3000);
  await d.click('main a.directory-link[href="/tags/mobile-development"]');
  await d.addFilter('Content type',['Applications']); await d.addFilter('Platform',['Web']);
  await d.addFilter('Device',['Mobile']); await d.addFilter('Monetization',['Freemium']); await d.expect('Photo Snap'); await d.hold(3200);
  for(const name of ['Platform','Device','Monetization','Content type']) await d.removeFilter(name);
  await display(d); await d.scan(.5); await d.clickText('Next','main button,main a'); await d.hold(2600); await d.clickText('Previous','main button,main a');
  await d.removeFilter('Tag'); await d.page.waitForSelector('input[aria-label="Search tags"]');
}},
{title:'Photo Snap — application overview',run:async d=>{
  await d.nav('/discover'); await d.fill(search,'photo',true);
  await d.click(`main a[href="${app}"]`); await d.hold(4500);
  await d.favorite('applications','photo-snap',false); await d.favorite('applications','photo-snap');
  await d.look('Quick Access','h2',3500); await d.scan(.7); await d.look('Application Details','h2',4500);
  await d.look('Community Discussions','h2',3000); await d.click(`main a[href="${thread}"]`); await d.hold(3500); await d.back();
  await d.look('Included in Suites','h2',3000); await d.click(`main a[href="${suite}"]`); await d.hold(3500); await d.back();
  await d.scrollTo(0,5000); await d.scan(.8); await d.scrollTo(0,3500);
}},
{title:'Photo Snap — activity timeline',run:async d=>{
  await d.nav('/apps/photo-snap/timeline'); await d.hold(3500); await d.scan(.8);
  await d.click('application-review-feed-item [aria-label="Item actions"]'); await d.clickText('View reviews'); await d.scan(.5); await d.back();
  for(let i=0;i<4;i++) await d.scan(.8,2600);
  await d.scrollTo(0,4500);
}},
{title:'Reviews — ratings and helpful marks',run:async d=>{
  await d.nav('/apps/photo-snap/reviews'); await d.hold(4200); await d.scan(.55);
  const helpful=await d.target('Helpful','main button,main a',{contains:true});
  await d.click(helpful); await d.hold(2500); await d.reload();
  const savedHelpful=await d.target('Helpful','main button,main a',{contains:true});
  await d.page.waitForFunction(selector=>document.querySelector(selector).getAttribute('aria-pressed')==='true',{},savedHelpful);
  await d.inspect(savedHelpful,3500);
  await d.clickText('Helpful','main button,main a',{contains:true});
  if(await d.exists('Load More Reviews','main button,main a')) { await d.clickText('Load More Reviews','main button,main a'); await d.scan(.6); }
  await d.inspect(await d.target('Report','main button,main a'),2000);
  await d.scrollTo(0,4500); await d.inspect(await d.target('Write a Review','main button,main a',{contains:true}),3000);
}},
{title:'Development log — releases',run:async d=>{
  await d.nav('/apps/photo-snap/devlog'); await d.hold(3500); await d.look('Releases','h2',3000);
  await d.click('[aria-label="View release v2.1.0"]'); await d.hold(3500); await d.scan(.6);
  await d.click('[aria-label="View release v2.0.3"]'); await d.hold(3500); await d.clickText('All releases','main a');
  if(await d.exists('Load more','main button,main a')) { await d.clickText('Load more','main button,main a'); await d.scan(.6); }
}},
{title:'Health — history and service reports',run:async d=>{
  await d.nav('/apps/photo-snap/health'); await d.hold(4500); await d.look('30-Day Status History','h2',4000);
  const day=await d.reveal('status-history .status-dot'); const box=await day.boundingBox();
  await d.page.mouse.move(box.x+box.width/2,box.y+box.height/2); await d.hold(3500); await day.dispose();
  await d.look('Service Status','h2',3500); await d.scan(.6); await d.look('Recent Notices','h2',4500);
}},
{title:'Discussions — local replies and creation',run:async d=>{
  await d.nav('/apps/photo-snap/discussions'); await d.hold(3500); await d.scan(.5);
  await d.clickText('How to integrate with external APIs?','discussion-small-card',{contains:true}); await d.hold(4500);
  if(await d.exists('Read more','main button,main a')) await d.clickText('Read more','main button,main a');
  await d.scan(.8); await d.look('Related Discussions','h2',3000); await d.look('Top Authors','h2',3000);
  await d.clickText('Reply locally','discussion-local-reply button');
  await d.fill('textarea[name="reply"]','Thanks — I am testing this workflow in the portal demo.');
  await d.clickText('Save local reply','main button,main a'); await d.expect('Reply saved on this browser.'); await d.hold(3000);
  await d.reload(); await d.look('Thanks — I am testing this workflow in the portal demo.','p',3500);
  await d.nav('/apps/photo-snap/discussions'); await d.clickText('Start Local Discussion','main button,main a');
  await d.fill('input[name="title"]','Portal demo: my photo workflow');
  await d.fill('textarea[name="content"]','I am comparing photo tools and organizing a small creative workflow. Which features do you use most?');
  await d.clickText('Save Local Discussion','main button,main a');
  await d.expect('Portal demo: my photo workflow'); await d.hold(3500);
  await d.account('/me/discussions'); await d.expect('Portal demo: my photo workflow'); await d.scan(.6);
  await d.nav('/');
  await d.inspect('discussion-topic-feed-item',2200);
  await d.click('discussion-topic-feed-item [aria-label="Item actions"]');
  await d.click('favorite-toggle-button button'); await d.close();
  await preview(d,true); await d.hold(3200);
}},
{title:'Digest — article discovery and reading',run:async d=>{
  await d.nav('/digest'); await d.hold(3500);
  for(const title of ['Latest','Articles','Applications','Discussions']) await d.look(title,'h2',3200);
  await d.click(`main a[href="${thread}"]`); await d.hold(3000); await d.back();
  await d.clickText('All articles','main a'); await d.fill('main input[aria-label="Search articles"]','design',true); await d.hold(3000);
  await picker(d,'Category'); await d.hold(2000); await d.clickText('Cancel','.dialog button');
  await display(d,'name','10'); await d.click(`main a[href="${article}"]`);
  await d.hold(4000); await d.favorite('articles','design-principles-modern-apps');
  for(let i=0;i<3;i++) await d.scan(.7,4000);
  await d.clickText('All articles','main a',{contains:true});
}},
{title:'Suites — create a personal collection',run:async d=>{
  await d.nav('/suites'); await d.hold(3200); await d.fill('main input[aria-label="Search suites"]','creative',true); await d.hold(2600);
  await picker(d,'Tag'); await d.clickText('Cancel','.dialog button'); await display(d,'name','10');
  await d.click(`main a[href="${suite}"]`); await d.hold(3500); await d.favorite('suites','creative-tools-suite');
  await d.click('[aria-label="View Photo Snap"]'); await d.hold(3000); await d.back();
  await d.clickText('Create your own suite','main a'); await d.fill('#suite-title','Demo creative toolkit');
  await d.fill('#suite-description','A small collection for planning and editing creative work.');
  await d.click('[aria-label="Include Photo Snap"]'); await d.click('[aria-label="Include Quick Task"]');
  await d.clickText('Save suite locally','main button,main a');
  await d.expect('Demo creative toolkit'); await d.inspect('[aria-label="View Photo Snap"]',2400); await d.inspect('[aria-label="View Quick Task"]',2400);
  await d.clickText('My suites','main a',{contains:true}); await d.reload(); await d.expect('Demo creative toolkit'); await d.hold(3500);
}},
{title:'Favorites — the personal hub',run:async d=>{
  await d.account('/me/favorite'); await d.hold(3500);
  for(const href of ['/apps/photo-snap',article,suite,thread]) { await d.click(`main a[href="${href}"]`); await d.hold(2600); await d.back(); }
  const row=await d.page.$(`main a[href="${article}"]`);
  await row.evaluate(el=>el.parentElement.setAttribute('data-tour-favorite-row','article')); await row.dispose();
  await d.click('[data-tour-favorite-row="article"] favorite-toggle-button button'); await d.reload();
  if(await d.page.$(`main a[href="${article}"]`)) throw new Error('Removed article favorite did not persist');
  await d.hold(3000); await d.panel('right'); await d.look('Favorite Apps','h3',3500); await d.close();
}},
{title:'Workspace — application drafts and ownership notes',run:async d=>{
  await d.account('/my/apps'); await d.clickText('New application draft','main button,main a');
  await d.clickText('Save local draft','main button,main a'); await d.hold(3500);
  await d.fill('#draft-name','Portal Demo App'); await d.fill('#draft-slug','portal-demo-app'); await d.fill('#draft-website','https://example.com');
  await d.fill('#draft-description','A demonstration application used to explore the local registration workflow.');
  await d.clickText('Save local draft','main button,main a'); await d.expect('Draft saved in this browser.');
  await d.clickText('Back to My Apps','main button,main a'); await d.clickText('Edit draft','main button,main a');
  await d.fill('#draft-description','A demonstration application used to explore the local registration workflow. Updated during the tablet tour.');
  await d.clickText('Save local draft','main button,main a'); await d.reload(); await d.page.waitForFunction(()=>document.querySelector('#draft-description').value.includes('Updated during the tablet tour.'));
  await d.clickText('Back to My Apps','main button,main a'); await d.clickText('Prepare ownership notes','main button,main a');
  await d.fill('#draft-evidenceUrl','https://example.com/about');
  await d.fill('#draft-notes','This is sample ownership evidence for the locally created Portal Demo App.');
  await d.clickText('Save local ownership notes','main button,main a'); await d.clickText('Back to My Apps','main button,main a'); await d.hold(3000);
  await d.clickText('Delete draft','main button,main a'); await d.hold(2200); await d.clickText('Keep draft','main button,main a');
  await d.clickText('Delete notes','main button,main a'); await d.hold(2200); await d.clickText('Keep notes','main button,main a');
  await d.clickText('Delete notes','main button,main a'); await d.clickText('Delete local notes','main button,main a');
  await d.clickText('Delete draft','main button,main a'); await d.clickText('Delete local draft','main button,main a'); await d.hold(3000);
}},
{title:'Profile — edits, photo and public preview',run:async d=>{
  await d.panel('right'); await d.click('[aria-label="My profile"]'); await d.clickText('Edit local profile','main a');
  // The avatar asset is a small screenshot of this demo's own current avatar.
  await d.inspect('[aria-label="Profile photo preview"]',2200);
  const avatarPath=path.join(d.output,'demo-avatar.png');
  await (await d.page.$('[aria-label="Profile photo preview"]')).screenshot({path:avatarPath});
  const chooser=d.page.waitForFileChooser(); await d.clickText('Change photo','main button,main a'); await (await chooser).accept([avatarPath]); await d.hold(3200);
  await d.fill('input[name="name"]','Portal Demo'); await d.fill('textarea[name="bio"]','Exploring apps for creative work.');
  await d.fill('input[name="location"]','Warsaw, Poland'); await d.fill('input[name="website"]','https://example.com');
  await d.inspect('input[name="github"]',3200); await d.clickText('Save Changes','main button,main a'); await d.hold(3200);
  await d.panel('right'); await d.click('[aria-label="My profile"]'); await d.expect('Portal Demo'); await d.scan(.6);
  await d.clickText('View public profile preview','main a'); await d.hold(4000); await d.scan(.6); await d.back();
  await d.clickText('Edit local profile','main a'); await d.fill('input[name="name"]','Unsaved example');
  await d.clickText('Cancel','main button,main a'); await d.page.waitForFunction(()=>document.querySelector('input[name="name"]').value==='Portal Demo'); await d.inspect('input[name="name"]',2500); await d.hold(2800);
}},
{title:'Preferences — themes and display defaults',run:async d=>{
  await d.settings('/me/settings/preferences');
  for(const theme of ['Light','Dark','System']) { await d.clickText(theme,'main button,main a'); await d.hold(3000); }
  await d.clickText('YYYY-MM-DD','main button,main a'); await d.clickText('List','main button,main a'); await d.clickText('10','main button,main a');
  await d.clickText('Save Changes','main button,main a');
  await d.click('footer a[href="/articles"]'); await d.hold(3500); await d.scan(.5);
  await d.account('/categories'); await d.hold(3200); await d.click('[aria-label="Grid view"]'); await d.hold(2800);
  await d.settings('/me/settings/preferences'); await d.clickText('Most Popular','main button,main a'); await d.clickText('Save Changes','main button,main a');
  await d.nav('/'); await d.hold(3500); await d.scan(.8);
  await d.settings('/me/settings/preferences'); await d.clickText('Grid','main button,main a'); await d.clickText('Reset to Saved','main button,main a');
  await d.inspect(await d.target('Recommended','main button,main a'),2800); await d.inspect('[aria-label="Show Mature Content"]',2800);
}},
{title:'Notifications, privacy and settings export',run:async d=>{
  await d.settings('/me/settings/notifications'); await d.click('[aria-label="Enable Email Notifications"]'); await d.hold(2800); await d.click('[aria-label="Enable Email Notifications"]');
  await d.clickText('Daily Digest','main button,main a'); await d.scan(.7);
  await d.click('[aria-label="Enable In-App Notifications"]'); await d.hold(2800); await d.click('[aria-label="Enable In-App Notifications"]'); await d.scan(.6);
  await d.clickText('Save Changes','main button,main a'); await d.reload(); await d.clickText('Weekly Digest','main button,main a'); await d.clickText('Reset to Saved','main button,main a');
  await d.settings('/me/settings/privacy');
  for(const name of ['Followers Only','Private','Public']) { await d.clickText(name,'main button,main a',{contains:true}); await d.hold(2500); }
  await d.click('[aria-label="Show Email Address"]'); await d.scan(.8); await d.inspect('[aria-label="Usage Analytics"]',2500);
  await d.click('[aria-label="Personalization"]'); await d.clickText('Save Changes','main button,main a'); await d.reload();
  await d.clickText('Export Local Settings','main button,main a'); await d.expect('Local profile and preferences export downloaded.'); await d.hold(3000);
  let json;
  for(let attempt=0;attempt<40;attempt++) { json=(await readdir(path.join(d.output,'downloads'))).find(file=>file.endsWith('.json')); if(json) break; await pause(200); }
  if(!json) throw new Error('Settings export did not download');
  const exported=JSON.parse(await readFile(path.join(d.output,'downloads',json),'utf8'));
  await writeFile(path.join(d.output,'export-inspected.json'),JSON.stringify(exported,null,2));
  d.log('verified','Downloaded profile/preferences JSON');
  await d.page.goto(new URL('file://' + path.join(d.output,'downloads',json)).href); await d.hold(4000);
  await d.page.screenshot({path:path.join(d.output,'parts','export-preview.png')});
  await d.page.evaluate(duration=>new Promise(resolve=>{
    const from=scrollY,to=Math.max(0,document.documentElement.scrollHeight-innerHeight),start=performance.now();
    const step=now=>{const t=Math.min(1,(now-start)/duration);scrollTo(0,from+(to-from)*t*t*(3-2*t));if(t<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);
  }),Math.max(60,2500*d.pace)); await d.hold(3500);
  await d.back();
  await d.inspect(await d.target('Deletion Unavailable','main button,main a'),3000);
}},
{title:'Tablet navigation, recovery and sign-out',run:async d=>{
  await d.nav('/'); await d.panel('left'); await d.panel('right');
  const leftExpanded=await d.page.$eval('[aria-label="Toggle navigation sidebar"]',el=>el.getAttribute('aria-expanded'));
  if(leftExpanded==='true') throw new Error('Both tablet panels are open');
  await d.close(); await d.hold(2000);
  await d.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Toggle account sidebar',{timeout:3000});
  await d.nav('/discover'); await d.scan(.8); await d.scrollTo(0); await d.nav('/'); await d.scan(.8);
  await d.account('/tags'); await d.click('[aria-label="List view"]'); await d.scan(.7); await d.click('[aria-label="Grid view"]');
  await d.route('/apps/not-a-real-app/overview'); await d.expect('Application not found'); await d.hold(3000); await d.clickText('Browse applications','main a');
  await d.route('/this-page-does-not-exist'); await d.hold(3500); await d.clickText('Back to Explore','main a');
  await d.settings('/me/settings/preferences'); await d.clickText('Dark','main button,main a'); await d.clickText('Grid','main button,main a'); await d.clickText('Most Recent','main button,main a'); await d.clickText('Save Changes','main button,main a');
  await d.nav('/'); await d.panel('right'); await d.click('[aria-label="Log out"]'); await d.hold(3000);
  await d.click('[aria-label="Favorites"]'); await d.hold(4000); await d.close(); await d.scrollTo(0); await d.hold(4000);
}},
];
