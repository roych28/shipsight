#!/usr/bin/env node
/* ShipSight: the eyes-on check of a live site after a deploy.
 *
 *   node check.mjs <url> [url...] [--out <dir>] [--widths 1440,390] [--crawl] [--max 10] [--no-webkit] [--json]
 *
 * Loads every page in a clean Chromium at each width (and in WebKit, Safari's engine, at phone widths when it is
 * installed), scrolls it like a visitor, and reports what a client would notice:
 *
 *   http          the page itself answered 4xx/5xx or did not load
 *   resource      an image, script, style or font answered 4xx/5xx
 *   jserr         a JavaScript error
 *   broken-image  an <img> that did not decode (naturalWidth 0), whatever the server said
 *   invisible     an image or video drawn fully transparent or hidden
 *   dead-video    a <video> with no data
 *   unrevealed    reveal-on-scroll content still hidden after scrolling the whole page
 *   hidden-shown  an element marked hidden that is drawn anyway
 *   sideways      the page scrolls sideways
 *   tight         two buttons closer than 8 px
 *   text          a button closer than 6 px to text that is not part of it, or over it
 *   edge          a button closer than 12 px to the screen edge on a phone
 *   small         a button shorter than 40 px on a phone
 *   overflow      text cut inside a button
 *   overlap       two buttons overlap
 *   out           a button sticks out of the card, bar or section it sits in
 *   offscreen     a button sticks out of the screen
 *   straddle      a button sits half on a card or photo and half off it
 *
 * Writes report.json, report.md and one screenshot per finding (red box) into --out.
 * Exit codes: 0 clean, 1 findings, 2 usage, 3 Playwright or a browser is missing (the message says what to run).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const JSON_OUT = flag('--json');
const CRAWL = flag('--crawl');
const NO_WEBKIT = flag('--no-webkit');
const MAX = Number(opt('--max', 10));
const WIDTHS = opt('--widths', '1440,390').split(',').map(Number).filter(Boolean);
const outArg = opt('--out', null);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const starts = args.filter((a) => /^https?:\/\//.test(a));
const unknown = args.filter((a) => !/^https?:\/\//.test(a));
if (!starts.length || unknown.length) {
  console.error('usage: node check.mjs <url> [url...] [--out <dir>] [--widths 1440,390] [--crawl] [--max 10] [--no-webkit] [--json]');
  if (unknown.length) console.error('not a URL or option: ' + unknown.join(' '));
  process.exit(2);
}
const OUT = path.resolve(outArg || path.join(os.homedir(), '.shipsight', 'runs', new URL(starts[0]).host.replace(/[^a-z0-9.-]/gi, '_'), stamp));

/* Playwright: the plugin's own node_modules first, then the global npm root. */
function loadPlaywright() {
  const roots = [root, process.env.SHIPSIGHT_PLAYWRIGHT_ROOT].filter(Boolean);
  try { roots.push(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().replace(/\/node_modules$/, '')); } catch {}
  for (const r of roots) {
    try { return createRequire(path.join(r, 'package.json'))('playwright'); } catch {}
    try { return createRequire(path.join(r, 'node_modules', 'playwright', 'package.json'))('playwright'); } catch {}
  }
  console.error(`ShipSight needs Playwright. Run once:\n  cd "${root}" && npm install && npx playwright install chromium webkit`);
  process.exit(3);
}
const pw = loadPlaywright();

async function launch(engine, name) {
  try { return await engine.launch(); } catch (e) {
    if (name === 'webkit') return null;
    console.error(`ShipSight could not start ${name}: ${e.message.split('\n')[0]}\nRun once:\n  cd "${root}" && npx playwright install chromium webkit`);
    process.exit(3);
  }
}

const ANALYTICS = /google-analytics|googletagmanager|doubleclick|facebook\.net|connect\.facebook|hotjar|clarity\.ms|segment\.io/;

/* runs in the page after the scroll: media and visibility checks */
function inspectMedia() {
  const hidden = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (Number(s.opacity) < 0.05 || s.visibility === 'hidden') return true; } return false; };
  const shown = (el) => el.getClientRects().length && getComputedStyle(el).display !== 'none';
  const name = (e) => (e.currentSrc || e.src || e.querySelector?.('source')?.src || e.tagName.toLowerCase()).slice(0, 160);
  const imgs = [...document.images].filter(shown);
  // a slideshow keeps its waiting slides transparent on purpose: another image or video that is visible and covers the same
  // spot (in the same parent or grandparent) means this one is a slide, not a broken picture
  const overlap = (a, b) => { const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return x > 0 && y > 0 ? (x * y) / Math.max(1, a.width * a.height) : 0; };
  const carouselSibling = (e) => { const r = e.getBoundingClientRect(); if (r.width < 20 || r.height < 20) return false;
    const c = e.closest('[aria-roledescription="carousel" i], .swiper, .slick-slider, .carousel, .splide') || e.parentElement?.parentElement || e.parentElement;
    return !!c && [...c.querySelectorAll('img, video')].some((o) => o !== e && shown(o) && !hidden(o) && overlap(r, o.getBoundingClientRect()) > 0.5); };
  return {
    images: imgs.length,
    broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map(name),
    invisible: [...imgs, ...document.querySelectorAll('video')].filter((e) => shown(e) && hidden(e) && !e.closest('[aria-hidden="true"]') && !carouselSibling(e)).map(name),
    deadVideo: [...document.querySelectorAll('video')].filter((v) => shown(v) && v.readyState === 0 && !v.poster).map(name),
    unrevealed: [...document.querySelectorAll('[data-aos], .reveal, [data-reveal], .rv, .fade-in, .animate-on-scroll, .wow')].filter((e) => shown(e) && Number(getComputedStyle(e).opacity) < 0.05 && e.getBoundingClientRect().height > 0).length,
    hiddenShown: [...document.querySelectorAll('[hidden]')].filter((e) => { const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0 && !hidden(e); })
      .map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : '') + ' "' + e.textContent.trim().slice(0, 40) + '"'),
    sideways: document.documentElement.scrollWidth - innerWidth,
  };
}

/* runs in the page: every visible button-like control and the spacing checks between them */
function inspectButtons(w) {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05 && el.closest('[hidden],[aria-hidden="true"],dialog:not([open])') === null && !el.closest('details:not([open]) > :not(summary)'); };
  const grouped = (x, y) => { if (x.parentElement !== y.parentElement) return false; const p = x.parentElement, s = getComputedStyle(p);
    const boxed = parseFloat(s.borderTopWidth) >= 1 || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
    const dots = [x, y].every((e) => !e.textContent.trim() && e.getBoundingClientRect().width <= 36);
    return boxed || dots; };
  const isBtn = (el) => {
    if (el.matches('button, [role="button"], input[type="submit"], input[type="button"], .btn, .button, a.button')) return true;
    if (el.tagName !== 'A') return false;
    const s = getComputedStyle(el), bg = s.backgroundColor, bw = parseFloat(s.borderTopWidth);
    const filled = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    return (filled || bw >= 1) && parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) >= 12 && el.getBoundingClientRect().height >= 28;
  };
  const inScroller = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2) return true; } return false; };
  const fixed = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40) || el.tagName.toLowerCase();
  const sel = (el) => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) { let s = e.tagName.toLowerCase(); if (e.id) { s += '#' + e.id; parts.unshift(s); break; } if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).join('.'); parts.unshift(s); } return parts.join(' > '); };
  const all = [...document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]')].filter((el) => vis(el) && isBtn(el) && !fixed(el));
  const btns = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  const gap = (a, b) => { const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)); const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return { dx, dy, overlapX: dx === 0, overlapY: dy === 0, covers: ix > 0.5 && iy > 0.5 }; };
  const union = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) });
  const out = []; const add = (kind, el, msg, box) => out.push({ kind, sel: sel(el), label: label(el), msg, box: box || R(el) });
  const boxes = btns.map(R);
  for (let i = 0; i < btns.length; i++) {
    const a = boxes[i], el = btns[i];
    for (let j = i + 1; j < btns.length; j++) {
      const b = boxes[j], g = gap(a, b);
      if (g.covers) { add('overlap', el, 'overlaps "' + label(btns[j]) + '"', union(a, b)); continue; }
      const d = g.overlapY ? g.dx : g.overlapX ? g.dy : Infinity;
      if (d < 8 && !grouped(el, btns[j])) add('tight', el, Math.round(d) + 'px from "' + label(btns[j]) + '"', union(a, b));
    }
    if (w < 600) {
      if (!inScroller(el) && (a.x < 12 || innerWidth - (a.x + a.w) < 12)) add('edge', el, Math.round(Math.min(a.x, innerWidth - a.x - a.w)) + 'px from the screen edge');
      if (a.h < 40) add('small', el, Math.round(a.h) + 'px tall');
    }
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') add('overflow', el, 'text cut: needs ' + el.scrollWidth + 'px, has ' + el.clientWidth + 'px');
  }
  const shown = (t) => { const r = t.getBoundingClientRect(); let L = r.left, T = r.top, Rt = r.right, B = r.bottom;
    for (let e = t.parentElement; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).overflow === 'visible') continue; const q = e.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); Rt = Math.min(Rt, q.right); B = Math.min(B, q.bottom); }
    return Rt - L > 1 && B - T > 1 ? { x: L + scrollX, y: T + scrollY, w: Rt - L, h: B - T } : null; };
  const texts = [...document.querySelectorAll('p, h1, h2, h3, h4, li, label, small, dd, dt, figcaption')].filter((t) => vis(t) && !fixed(t) && shown(t) && t.textContent.trim().length > 1 && !btns.some((b) => b.contains(t) || t.contains(b)));
  for (let i = 0; i < btns.length; i++) {
    const a = boxes[i];
    for (const t of texts) {
      const b = shown(t), g = gap(a, b);
      if (g.overlapX && g.overlapY) { if (b.w * b.h < a.w * a.h * 4) add('text', btns[i], 'overlaps text "' + label(t) + '"'); continue; }
      const d = g.overlapY ? g.dx : g.overlapX ? g.dy : Infinity;
      if (d < 6) add('text', btns[i], Math.round(d) + 'px from text "' + label(t) + '"');
    }
  }
  const allBtns = [...document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]')].filter((el) => vis(el) && isBtn(el));
  const isBox = (e) => { const s = getComputedStyle(e); return s.overflow !== 'visible' || parseFloat(s.borderTopWidth) >= 1 || parseFloat(s.borderRightWidth) >= 1 || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) || parseFloat(s.borderTopLeftRadius) > 0; };
  for (const el of allBtns) {
    if (allBtns.some((o) => o !== el && o.contains(el))) continue;
    const r = el.getBoundingClientRect();
    const scroller = inScroller(el);
    if (!scroller && (r.left < -1 || r.right > innerWidth + 1)) add('offscreen', el, 'sticks out of the screen by ' + Math.round(Math.max(-r.left, r.right - innerWidth)) + 'px', R(el));
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      if (!isBox(e)) continue;
      const s = getComputedStyle(e), q = e.getBoundingClientRect();
      if (q.width < 4 || q.height < 4) break;
      const xOut = !(/(auto|scroll)/.test(s.overflowX)) && (r.left < q.left - 1 || r.right > q.right + 1);
      const yOut = !(/(auto|scroll)/.test(s.overflowY)) && (r.top < q.top - 1 || r.bottom > q.bottom + 1);
      if (xOut || yOut) {
        const by = Math.round(Math.max(q.left - r.left, r.right - q.right, q.top - r.top, r.bottom - q.bottom));
        add('out', el, 'sticks out of ' + sel(e) + ' by ' + by + 'px' + (s.overflow !== 'visible' ? ' (clipped)' : ''), { x: Math.min(r.left, q.left) + scrollX, y: Math.min(r.top, q.top) + scrollY, w: Math.max(r.right, q.right) - Math.min(r.left, q.left), h: Math.max(r.bottom, q.bottom) - Math.min(r.top, q.top) });
      }
      break;
    }
    if (!fixed(el)) {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); const r2 = el.getBoundingClientRect();
      const pts = [[r2.left + 3, r2.top + r2.height / 2], [r2.right - 3, r2.top + r2.height / 2], [r2.left + r2.width / 2, r2.top + 3], [r2.left + r2.width / 2, r2.bottom - 3]];
      const under = pts.map(([x, y]) => (x < 0 || y < 0 || x > innerWidth || y > innerHeight) ? null : document.elementsFromPoint(x, y).filter((e) => !el.contains(e) && !e.contains(el) && (e.tagName === 'IMG' || e.tagName === 'VIDEO' || (isBox(e) && parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0 && e.getBoundingClientRect().width > r2.width * 2))));
      if (under.every((u) => u)) {
        const cands = new Set(under.flat());
        for (const c of cands) { const n = under.filter((u) => u.includes(c)).length; if (n > 0 && n < 4) { add('straddle', el, 'half over ' + sel(c) + ', half off it', R(el)); break; } }
      }
    }
    if (fixed(el) && w < 600) { const b = R(el); if (b.h < 40 && el.textContent.trim()) add('small', el, Math.round(b.h) + 'px tall (fixed bar)'); }
  }
  scrollTo(0, 0);
  return { items: out, buttons: btns.length };
}

async function crawl(browser, start) {
  const origin = new URL(start).origin, seen = new Set(), queue = [start], pages = [];
  const p = await browser.newPage();
  while (queue.length && pages.length < MAX) {
    const u = queue.shift(); const key = u.split('#')[0]; if (seen.has(key)) continue; seen.add(key);
    try {
      const r = await p.goto(key, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!r || r.status() >= 400 || !(r.headers()['content-type'] || '').includes('html')) continue;
      pages.push(key);
      const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href));
      for (const l of links) { try { const x = new URL(l); if (x.origin === origin && !/\.(pdf|jpe?g|png|webp|gif|svg|mp4|zip|xml|txt|ico)$/i.test(x.pathname) && !x.pathname.startsWith('/api/')) queue.push(x.origin + x.pathname + x.search); } catch {} }
    } catch {}
  }
  await p.close();
  return pages.length ? pages : [start];
}

fs.mkdirSync(OUT, { recursive: true });
const chromium = await launch(pw.chromium, 'chromium');
const webkit = NO_WEBKIT ? null : await launch(pw.webkit, 'webkit');
const findings = []; const pagesChecked = []; let shots = 0;

const pages = [];
for (const s of starts) for (const u of (CRAWL ? await crawl(chromium, s) : [s])) if (!pages.includes(u)) pages.push(u);

const runs = [];
for (const w of WIDTHS) runs.push({ engine: 'chromium', browser: chromium, w });
if (webkit) for (const w of WIDTHS.filter((w) => w < 600)) runs.push({ engine: 'webkit', browser: webkit, w });

for (const url of pages) for (const { engine, browser, w } of runs) {
  const where = { url, width: w, engine };
  const p = await browser.newPage({ viewport: { width: w, height: w > 600 ? 900 : 844 } });
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  p.on('response', (r) => { if (r.status() >= 400 && r.url() !== url && !ANALYTICS.test(r.url())) bad.push(r.status() + ' ' + r.url().slice(0, 160)); });
  let status = 0;
  try { const r = await p.goto(url, { waitUntil: 'load', timeout: 45000 }); status = r ? r.status() : 0; }
  catch (e) { findings.push({ ...where, kind: 'http', msg: 'did not load: ' + e.message.split('\n')[0].slice(0, 160) }); await p.close(); pagesChecked.push({ ...where, status: 0 }); continue; }
  if (status >= 400) findings.push({ ...where, kind: 'http', msg: 'HTTP ' + status });
  try { await p.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  await p.waitForTimeout(800);
  // scroll like a visitor (400 px every 150 ms), rest at the bottom so reveal-on-scroll effects finish, and inspect media there
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } scrollTo(0, document.body.scrollHeight); });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(inspectMedia);
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(600);
  for (const e of errs) findings.push({ ...where, kind: 'jserr', msg: e });
  for (const b of [...new Set(bad)]) findings.push({ ...where, kind: 'resource', msg: b });
  for (const s of m.broken) findings.push({ ...where, kind: 'broken-image', msg: s });
  for (const s of m.invisible) findings.push({ ...where, kind: 'invisible', msg: s });
  for (const s of m.deadVideo) findings.push({ ...where, kind: 'dead-video', msg: s });
  for (const s of m.hiddenShown) findings.push({ ...where, kind: 'hidden-shown', msg: s });
  if (m.unrevealed) findings.push({ ...where, kind: 'unrevealed', msg: m.unrevealed + ' reveal-on-scroll blocks still hidden after scrolling' });
  if (m.sideways > 1) findings.push({ ...where, kind: 'sideways', msg: m.sideways + 'px of sideways scroll' });
  const b = await p.evaluate(inspectButtons, w);
  const seen = new Set();
  for (const it of b.items) {
    const k = it.kind + it.sel + it.msg; if (seen.has(k)) continue; seen.add(k);
    const f = { ...where, ...it };
    try {
      const pad = 40, clip = { x: Math.max(0, it.box.x - pad), y: Math.max(0, it.box.y - pad), width: Math.min(w, it.box.w + pad * 2), height: Math.min(1200, it.box.h + pad * 2) };
      await p.evaluate(([bx]) => { const d = document.createElement('div'); d.id = '__shipsight_box'; Object.assign(d.style, { position: 'absolute', left: bx.x - 3 + 'px', top: bx.y - 3 + 'px', width: bx.w + 6 + 'px', height: bx.h + 6 + 'px', outline: '3px solid #e00', zIndex: 2147483647, pointerEvents: 'none' }); document.body.appendChild(d); }, [it.box]);
      const file = `${String(++shots).padStart(3, '0')}-${it.kind}-${w}-${engine}.png`;
      await p.screenshot({ path: path.join(OUT, file), clip, fullPage: true });
      await p.evaluate(() => document.getElementById('__shipsight_box')?.remove());
      f.shot = file;
    } catch {}
    findings.push(f);
  }
  const n = findings.filter((f) => f.url === url && f.width === w && f.engine === engine).length;
  pagesChecked.push({ ...where, status, images: m.images, buttons: b.buttons, findings: n });
  if (!JSON_OUT) console.log(`${n ? 'FAIL' : 'ok  '} ${engine.padEnd(8)} ${String(w).padStart(4)}  ${url}  (${m.images} images, ${b.buttons} buttons${n ? ', ' + n + ' findings' : ''})`);
  await p.close();
}
await chromium.close();
if (webkit) await webkit.close();

const byKind = findings.reduce((acc, f) => ((acc[f.kind] = (acc[f.kind] || 0) + 1), acc), {});
const report = { tool: 'shipsight', at: new Date().toISOString(), pages: pagesChecked, widths: WIDTHS, engines: [...new Set(runs.map((r) => r.engine))], findings, byKind, out: OUT };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const md = [`# ShipSight ${report.at.slice(0, 16).replace('T', ' ')}`, '',
  `Pages: ${pages.length}. Widths: ${WIDTHS.join(', ')}. Engines: ${report.engines.join(', ')}.`, '',
  findings.length ? `**${findings.length} findings** ${Object.entries(byKind).map(([k, v]) => k + ' ' + v).join(', ')}` : '**Clean.** No findings.', '',
  ...findings.map((f) => `- [${f.kind}] ${f.engine} ${f.width}px ${f.url} — ${f.label ? '"' + f.label + '" ' : ''}${f.msg}${f.sel ? ' (\`' + f.sel + '\`)' : ''}${f.shot ? ' → ' + f.shot : ''}`)];
fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n') + '\n');
if (JSON_OUT) console.log(JSON.stringify({ findings: findings.length, byKind, pages: pages.length, out: OUT, report: path.join(OUT, 'report.md') }));
else console.log(`\n${findings.length ? findings.length + ' findings ' + JSON.stringify(byKind) : 'clean'}\nreport: ${path.join(OUT, 'report.md')}`);
process.exit(findings.length ? 1 : 0);
