const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const lib = require('../lib')

test('the bundled checker is the plugin checker, byte for byte', () => {
  const plugin = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'scripts', 'check.mjs'), 'utf8')
  const bundled = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'check.mjs'), 'utf8')
  assert.equal(bundled, plugin, 'run `npm run sync` in vscode/ after changing plugin/scripts/check.mjs')
})

test('widths: defaults, trimming, de-duplication, nonsense dropped', () => {
  assert.deepEqual(lib.parseWidths('1440,390'), [1440, 390])
  assert.deepEqual(lib.parseWidths(' 1728 , 390,390 ,abc, 10 '), [1728, 390])
  assert.deepEqual(lib.parseWidths(''), [1440, 390])
  assert.deepEqual(lib.parseWidths(undefined), [1440, 390])
})

test('a URL typed without a scheme gets https, junk is refused', () => {
  assert.equal(lib.normalizeUrl('example.com/page'), 'https://example.com/page')
  assert.equal(lib.normalizeUrl('  http://localhost:3000 '), 'http://localhost:3000/')
  assert.equal(lib.normalizeUrl(''), null)
  assert.equal(lib.normalizeUrl('not a url'), null)
  assert.equal(lib.normalizeUrl('ftp://x.y'), null)
})

test('checker arguments follow the settings', () => {
  const a = lib.checkerArgs('https://x.y/', { widths: '1440,390', webkit: true, crawl: false, maxPages: 10 }, '/tmp/o')
  assert.deepEqual(a, ['https://x.y/', '--json', '--out', '/tmp/o', '--widths', '1440,390'])
  const b = lib.checkerArgs('https://x.y/', { widths: '1728', webkit: false, crawl: true, maxPages: 3 }, '/tmp/o')
  assert.deepEqual(b, ['https://x.y/', '--json', '--out', '/tmp/o', '--widths', '1728', '--crawl', '--max', '3', '--no-webkit'])
})

test('the summary is the last JSON line, whatever the browsers print before it', () => {
  const s = lib.parseSummary('warning: something\n{"not":"it"}\n{"findings":2,"byKind":{"tight":2},"pages":2,"out":"/r"}\n')
  assert.deepEqual(s, { findings: 2, byKind: { tight: 2 }, pages: 2, out: '/r' })
  assert.equal(lib.parseSummary('nothing here'), null)
})

test('status bar text for every state', () => {
  assert.equal(lib.statusText(null), '$(eye) ShipSight')
  assert.equal(lib.statusText({ url: 'https://a.b/', running: true }), '$(sync~spin) ShipSight: a.b')
  assert.equal(lib.statusText({ url: 'https://a.b/', needsSetup: true }), '$(warning) ShipSight: install the browsers')
  assert.equal(lib.statusText({ url: 'https://a.b/', error: 'x' }), '$(error) ShipSight: a.b')
  assert.equal(lib.statusText({ url: 'https://a.b/', report: { findings: [] } }), '$(check) clean · a.b')
  assert.equal(lib.statusText({ url: 'https://a.b/', report: { findings: [{}] } }), '$(warning) 1 finding · a.b')
  assert.equal(lib.statusText({ url: 'https://a.b/', report: { findings: [{}, {}] } }), '$(warning) 2 findings · a.b')
})

test('recent sites: newest first, no duplicates, capped', () => {
  assert.deepEqual(lib.recentSites(['b', 'a'], 'a'), ['a', 'b'])
  assert.deepEqual(lib.recentSites(['b', 'a'], 'c'), ['c', 'b', 'a'])
  assert.equal(lib.recentSites(Array.from({ length: 20 }, (_, i) => 's' + i), 'new').length, 8)
})

const report = {
  tool: 'shipsight',
  at: '2026-10-31T12:00:00.000Z',
  widths: [1440, 390],
  engines: ['chromium', 'webkit'],
  pages: [
    { url: 'https://a.b/', width: 1440, engine: 'chromium', status: 200, images: 3, buttons: 4, findings: 1 },
    { url: 'https://a.b/', width: 390, engine: 'chromium', status: 200, images: 3, buttons: 4, findings: 0 },
    { url: 'https://a.b/p', width: 1440, engine: 'chromium', status: 404, images: 0, buttons: 0, findings: 1 },
  ],
  findings: [
    { url: 'https://a.b/', width: 1440, engine: 'chromium', kind: 'tight', label: 'Buy <now>', msg: '4px from "Learn more"', sel: 'a.btn', shot: 'shot-1.png' },
    { url: 'https://a.b/p', width: 1440, engine: 'chromium', kind: 'http', msg: 'HTTP 404' },
  ],
  byKind: { tight: 1, http: 1 },
}

test('findings group by page, pages without findings included', () => {
  const g = lib.groupByPage(report)
  assert.deepEqual(
    g.map(x => [x.url, x.pages.length, x.findings.length]),
    [
      ['https://a.b/', 2, 1],
      ['https://a.b/p', 1, 1],
    ],
  )
})

test('the panel names each finding, shows its screenshot, escapes HTML and carries a CSP', () => {
  const html = lib.renderHtml(report, { shotUri: f => 'vscode-resource://run/' + f, cspSource: 'vscode-resource:', nonce: 'n0nce' })
  assert.match(html, /<h1 class="bad">2 findings<\/h1>/)
  assert.match(html, /tight 1, http 1/)
  assert.match(html, /"Buy &lt;now&gt;"/, 'label is escaped')
  assert.doesNotMatch(html, /Buy <now>/)
  assert.match(html, /4px from &quot;Learn more&quot;/)
  assert.match(html, /<img src="vscode-resource:\/\/run\/shot-1\.png"/)
  assert.match(html, /HTTP 404/)
  assert.match(html, /buttons too close/, 'the kind is explained in words')
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /script-src 'nonce-n0nce'/)
  assert.match(html, /3 page loads · widths 1440, 390 px · chromium and webkit/)
  const clean = lib.renderHtml({ ...report, findings: [], byKind: {}, pages: report.pages.slice(0, 2) }, { shotUri: f => f, cspSource: 'x', nonce: 'n' })
  assert.match(clean, /<h1 class="good">Clean<\/h1>/)
  assert.match(clean, /No findings on this page/)
})

test('listRuns reads every report under home/runs, newest first, and skips folders without one', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'shipsight-lib-'))
  const mk = (host, stamp, findings) => {
    const dir = path.join(home, 'runs', host, stamp)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ pages: [{ url: `https://${host}/` }], findings }))
  }
  mk('a.b', '2026-10-30T10-00-00', [])
  mk('c.d', '2026-10-31T09-00-00', [{}, {}])
  fs.mkdirSync(path.join(home, 'runs', 'e.f', '2026-10-31T10-00-00'), { recursive: true })
  const runs = lib.listRuns(home)
  assert.deepEqual(
    runs.map(r => [r.host, r.findings, r.url]),
    [
      ['c.d', 2, 'https://c.d/'],
      ['a.b', 0, 'https://a.b/'],
    ],
  )
  assert.deepEqual(lib.listRuns(path.join(home, 'nowhere')), [])
})

test('setup text names the install commands inside the chosen root', () => {
  const t = lib.setupText('/some/root')
  assert.match(t, /cd "\/some\/root" && npm(\.cmd)? install .*playwright@1\.64\.1/)
  assert.match(t, /npx(\.cmd)? playwright install chromium webkit/)
})

test('nodeCommand finds node on PATH, and falls back to Electron as Node', () => {
  const found = lib.nodeCommand()
  assert.ok(found.file, 'a file to run')
  const none = lib.nodeCommand({ PATH: '/nonexistent' })
  assert.equal(none.file, process.execPath)
  assert.equal(none.env.ELECTRON_RUN_AS_NODE, '1')
})
