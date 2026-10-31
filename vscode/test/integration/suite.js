const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vscode = require('vscode')

const base = process.env.SHIPSIGHT_TEST_BASE
const tmp = process.env.SHIPSIGHT_TEST_ROOT
const home = process.env.SHIPSIGHT_HOME

const checks = []
const check = (name, fn) => checks.push({ name, fn })
let api

check('the extension activates, registers its commands and shows the status bar item', async () => {
  const ext = vscode.extensions.getExtension('roychemo.shipsight')
  assert.ok(ext, 'extension found')
  api = await ext.activate()
  const all = await vscode.commands.getCommands(true)
  for (const c of ['check', 'checkUrl', 'checkAgain', 'history', 'setup']) assert.ok(all.includes(`shipsight.${c}`), `missing shipsight.${c}`)
  assert.strictEqual(api.statusBar().text, '$(eye) ShipSight')
  assert.strictEqual(api.home, home)
})

check('a broken page: the findings arrive with screenshots, the panel names them, the status bar counts them', async () => {
  const run = await api.checkUrl(`${base}/broken.html`)
  assert.ok(run.report, `no report: ${JSON.stringify(run)}`)
  const kinds = new Set(run.report.findings.map(f => f.kind))
  for (const k of ['tight', 'sideways', 'jserr', 'resource', 'broken-image', 'out']) assert.ok(kinds.has(k), `missing ${k} in ${[...kinds]}`)
  const tight = run.report.findings.find(f => f.kind === 'tight' && f.label === 'Buy now')
  assert.ok(tight && tight.shot, 'tight finding has a screenshot')
  assert.ok(fs.statSync(path.join(run.dir, tight.shot)).size > 500, 'the screenshot is a real file')
  assert.ok(run.dir.startsWith(path.join(home, 'runs', '127.0.0.1_')), run.dir)
  const s = api.statusBar()
  assert.match(s.text, /^\$\(warning\) \d+ findings · 127\.0\.0\.1:\d+$/, s.text)
  const html = api.panelHtml()
  assert.ok(html.includes('"Buy now"'), 'panel names the button')
  assert.ok(html.includes('boom from the page'), 'panel shows the JS error')
  assert.ok(/<img src="https:\/\/[^"]*vscode-resource[^"]*\.png"/.test(html) || /<img src="vscode-webview-resource:[^"]*\.png"/.test(html), 'screenshot goes through a webview URI: ' + (html.match(/<img src="[^"]*"/) || [''])[0])
  assert.ok(html.includes('buttons too close'), 'the kind is explained')
})

check('a clean page comes back clean', async () => {
  const run = await api.checkUrl(`${base}/clean.html`)
  assert.ok(run.report, JSON.stringify(run))
  assert.deepStrictEqual(run.report.findings, [])
  assert.match(api.statusBar().text, /^\$\(check\) clean · 127\.0\.0\.1:\d+$/)
  assert.ok(api.panelHtml().includes('<h1 class="good">Clean</h1>'))
})

check('a URL that answers 404 is a finding, not an error', async () => {
  const run = await api.checkUrl(`${base}/nowhere.html`)
  assert.ok(run.report, JSON.stringify(run))
  assert.ok(run.report.findings.some(f => f.kind === 'http' && f.msg === 'HTTP 404'))
})

check('a bad address is refused before anything runs', async () => {
  const run = await api.checkUrl('not a url at all')
  assert.strictEqual(run, null)
})

check('the history lists every run, newest first', async () => {
  const { listRuns } = require('../../lib')
  const runs = listRuns(home)
  assert.strictEqual(runs.length, 3, JSON.stringify(runs))
  assert.ok(runs[0].url.endsWith('/nowhere.html'))
  assert.strictEqual(runs[2].findings > 0, true)
})

check('without Playwright the run asks for the setup instead of failing', async () => {
  const empty = path.join(tmp, 'no-playwright')
  fs.mkdirSync(empty, { recursive: true })
  const before = api.playwrightRoot()
  api.setPlaywrightRoot(empty)
  // The checker also looks in the global npm root; the test machine must not have Playwright there for this to hold.
  const run = await api.checkUrl(`${base}/clean.html`)
  api.setPlaywrightRoot(before)
  if (run.report) {
    console.log('  (skipped: a global Playwright is installed on this machine)')
    return
  }
  assert.strictEqual(run.needsSetup, true, JSON.stringify(run))
  assert.strictEqual(api.statusBar().text, '$(warning) ShipSight: install the browsers')
})

async function run() {
  let failed = 0
  for (const { name, fn } of checks) {
    try {
      await fn()
      console.log(`  ok   ${name}`)
    } catch (err) {
      failed++
      console.log(`  FAIL ${name}\n       ${err.stack ?? err}`)
    }
  }
  if (failed) throw new Error(`${failed} integration check(s) failed`)
}

module.exports = { run }
