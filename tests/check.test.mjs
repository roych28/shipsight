/* Runs the real checker against fixture pages served from a local HTTP server, and asserts the content of the report.
   A page built to be clean must come back clean; a page with known breakages must name each of them. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.join(here, '..', 'plugin', 'scripts', 'check.mjs');
const FIX = path.join(here, 'fixtures');
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIX, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(FIX) || !fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/* The server lives in this process, so the checker must run without blocking the event loop. */
function run(urls, extra = []) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'shipsight-test-'));
  return new Promise((resolve) => execFile(process.execPath, [CHECK, ...urls, '--out', out, '--json', ...extra], { encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    const r = { status: err && typeof err.code === 'number' ? err.code : err ? 1 : 0, stdout, stderr };
    resolve(finish(r, out));
  }));
}
function finish(r, out) {
  const lines = r.stdout.trim().split('\n');
  let summary = null; try { summary = JSON.parse(lines[lines.length - 1]); } catch {}
  const report = fs.existsSync(path.join(out, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) : null;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, summary, report, out };
}

test('usage without a URL exits 2', () => {
  const r = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});

/* The clean page also carries a slideshow with a transparent waiting slide and a reveal-on-scroll paragraph: both are fine. */
test('a clean page comes back clean at desktop and phone widths', async () => {
  const r = await run([`${base}/clean.html`]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(r.summary.findings, 0);
  assert.equal(r.report.findings.length, 0);
  assert.ok(r.report.pages.length >= 2, 'chromium at two widths at least');
  assert.ok(r.report.pages.every((p) => p.status === 200));
  assert.ok(r.report.pages.every((p) => p.images === 3 && p.buttons === 4), JSON.stringify(r.report.pages));
  assert.match(fs.readFileSync(path.join(r.out, 'report.md'), 'utf8'), /Clean/);
});

test('a broken page names every breakage, with a screenshot for each layout finding', async () => {
  const r = await run([`${base}/broken.html`], ['--no-webkit']);
  assert.equal(r.code, 1);
  const f = r.report.findings;
  const kinds = new Set(f.map((x) => x.kind));
  const at = (kind, w) => f.filter((x) => x.kind === kind && (!w || x.width === w));

  assert.ok(kinds.has('jserr'), 'js error');
  assert.ok(at('jserr').some((x) => x.msg.includes('boom from the page')));
  assert.ok(kinds.has('resource'), 'missing image answered 404');
  assert.ok(at('resource').some((x) => /404 .*missing\.png/.test(x.msg)));
  assert.ok(kinds.has('broken-image'), 'image did not decode');
  assert.ok(at('broken-image').some((x) => x.msg.includes('missing.png')));
  assert.ok(kinds.has('sideways'), 'sideways scroll');
  assert.ok(at('sideways', 1440).length && at('sideways', 390).length, 'sideways at both widths');
  assert.ok(kinds.has('tight'), 'buttons too close');
  assert.ok(at('tight').some((x) => x.label === 'Buy now' && x.msg.includes('"Learn more"')), JSON.stringify(at('tight')));
  assert.ok(kinds.has('out'), 'button sticks out of its card');
  assert.ok(at('out').some((x) => x.label === 'Card action' && /section\.card/.test(x.msg)), JSON.stringify(at('out')));
  assert.ok(kinds.has('small'), 'short button on a phone');
  assert.ok(at('small', 390).some((x) => x.label === 'Short button'));
  assert.equal(at('small', 1440).length, 0, 'height is only checked on phones');
  assert.ok(kinds.has('overflow'), 'cut text');
  assert.ok(at('overflow').some((x) => x.label.startsWith('A very long')));
  assert.ok(kinds.has('offscreen'), 'button out of the screen');
  assert.ok(at('offscreen').some((x) => x.label === 'Off the edge'));
  assert.ok(kinds.has('edge'), 'button hugging the phone edge');
  assert.ok(at('edge', 390).some((x) => x.label === 'Off the edge'));

  for (const x of f.filter((y) => y.sel)) {
    assert.ok(x.shot, 'layout finding has a screenshot: ' + x.kind);
    assert.ok(fs.statSync(path.join(r.out, x.shot)).size > 500, 'screenshot is a real file');
  }
  const md = fs.readFileSync(path.join(r.out, 'report.md'), 'utf8');
  assert.match(md, /\[tight\].*"Buy now"/);
  assert.match(md, /\[jserr\].*boom from the page/);
});

test('a URL that answers 404 is an http finding, not a crash', async () => {
  const r = await run([`${base}/nowhere.html`], ['--no-webkit', '--widths', '1440']);
  assert.equal(r.code, 1);
  assert.ok(r.report.findings.some((x) => x.kind === 'http' && x.msg === 'HTTP 404'), JSON.stringify(r.report.findings));
});

test('--crawl follows same-origin links and checks each page once', async () => {
  const r = await run([`${base}/index.html`], ['--no-webkit', '--widths', '1440', '--crawl', '--max', '5']);
  const urls = [...new Set(r.report.pages.map((p) => p.url))];
  assert.deepEqual(urls.sort(), [`${base}/broken.html`, `${base}/clean.html`, `${base}/index.html`].sort());
});
