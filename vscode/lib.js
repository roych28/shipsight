// Pure helpers for the ShipSight extension: no vscode import, so the unit tests run under plain Node.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const PLAYWRIGHT_VERSION = '1.64.1'

function parseWidths(text) {
  const ws = String(text ?? '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n >= 240 && n <= 4000)
  return ws.length ? [...new Set(ws)] : [1440, 390]
}

function normalizeUrl(text) {
  let s = String(text ?? '').trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return null
    return u.href
  } catch {
    return null
  }
}

function hostDir(url) {
  return new URL(url).host.replace(/[^a-z0-9.-]/gi, '_')
}

function stamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

// The arguments for scripts/check.mjs from one URL and the user's settings.
function checkerArgs(url, cfg, outDir) {
  const args = [url, '--json', '--out', outDir, '--widths', parseWidths(cfg.widths).join(',')]
  if (cfg.crawl) args.push('--crawl', '--max', String(Math.max(1, Number(cfg.maxPages) || 10)))
  if (cfg.webkit === false) args.push('--no-webkit')
  return args
}

// The checker prints one JSON line last; anything before it is noise from the browsers.
function parseSummary(stdout) {
  const lines = String(stdout ?? '').trim().split('\n').reverse()
  for (const line of lines) {
    try {
      const v = JSON.parse(line)
      if (v && typeof v === 'object' && 'findings' in v) return v
    } catch {}
  }
  return null
}

function readReport(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'))
  } catch {
    return null
  }
}

// Every past run under <home>/runs, newest first, with what it found.
function listRuns(home) {
  const root = path.join(home, 'runs')
  const out = []
  let hosts = []
  try {
    hosts = fs.readdirSync(root)
  } catch {
    return out
  }
  for (const host of hosts) {
    let stamps = []
    try {
      stamps = fs.readdirSync(path.join(root, host))
    } catch {
      continue
    }
    for (const s of stamps) {
      const dir = path.join(root, host, s)
      const report = readReport(dir)
      if (!report) continue
      out.push({ host, stamp: s, dir, findings: report.findings.length, pages: report.pages.length, url: report.pages[0]?.url ?? '' })
    }
  }
  return out.sort((a, b) => (a.stamp < b.stamp ? 1 : -1))
}

function recentSites(list, url, max = 8) {
  return [url, ...(list ?? []).filter(u => u !== url)].slice(0, max)
}

function statusText(run) {
  if (!run) return '$(eye) ShipSight'
  const host = run.url ? new URL(run.url).host : ''
  if (run.running) return `$(sync~spin) ShipSight: ${host}`
  if (run.needsSetup) return '$(warning) ShipSight: install the browsers'
  if (run.error) return `$(error) ShipSight: ${host}`
  const n = run.report?.findings.length ?? 0
  return n ? `$(warning) ${n} finding${n === 1 ? '' : 's'} · ${host}` : `$(check) clean · ${host}`
}

const KIND_WORDS = {
  http: 'the page did not answer 200',
  resource: 'a request failed',
  jserr: 'JavaScript error',
  'broken-image': 'image did not load',
  invisible: 'image or video drawn invisible',
  'dead-video': 'video with no data',
  unrevealed: 'content still hidden after scrolling',
  'hidden-shown': 'hidden element drawn anyway',
  sideways: 'the page scrolls sideways',
  tight: 'buttons too close',
  text: 'button on top of text',
  edge: 'button at the screen edge',
  small: 'button too short for a phone',
  overflow: 'text cut inside a button',
  overlap: 'buttons overlap',
  out: 'button sticks out of its box',
  offscreen: 'button out of the screen',
  straddle: 'button half on, half off a card',
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// Findings grouped by page URL, in the order the checker met them.
function groupByPage(report) {
  const groups = new Map()
  for (const p of report.pages) if (!groups.has(p.url)) groups.set(p.url, { url: p.url, pages: [], findings: [] })
  for (const p of report.pages) groups.get(p.url).pages.push(p)
  for (const f of report.findings) {
    if (!groups.has(f.url)) groups.set(f.url, { url: f.url, pages: [], findings: [] })
    groups.get(f.url).findings.push(f)
  }
  return [...groups.values()]
}

// The results panel. `shotUri(file)` turns a screenshot file name into something the webview may load.
function renderHtml(report, { shotUri, cspSource, nonce }) {
  const groups = groupByPage(report)
  const n = report.findings.length
  const kinds = Object.entries(report.byKind ?? {})
    .map(([k, v]) => `${esc(k)} ${v}`)
    .join(', ')
  const head = n
    ? `<h1 class="bad">${n} finding${n === 1 ? '' : 's'}</h1><p class="muted">${kinds}</p>`
    : `<h1 class="good">Clean</h1><p class="muted">Nothing a visitor would notice.</p>`
  const pagesLine = `${report.pages.length} page load${report.pages.length === 1 ? '' : 's'} · widths ${(report.widths ?? []).join(', ')} px · ${(report.engines ?? []).join(' and ')}`
  const body = groups
    .map(g => {
      const loads = g.pages
        .map(p => `<span class="pill ${p.status === 200 ? '' : 'bad'}">${esc(p.engine)} ${p.width}px · HTTP ${p.status || 'none'} · ${p.images ?? 0} images · ${p.buttons ?? 0} buttons</span>`)
        .join(' ')
      const items = g.findings
        .map(
          f => `<li class="finding">
  <div class="where"><b>${esc(f.kind)}</b> <span class="muted">${esc(KIND_WORDS[f.kind] ?? '')}</span> · ${esc(f.engine)} ${f.width}px</div>
  <div class="what">${f.label ? `<b>"${esc(f.label)}"</b> ` : ''}${esc(f.msg)}</div>
  ${f.sel ? `<code>${esc(f.sel)}</code>` : ''}
  ${f.shot ? `<a href="${esc(shotUri(f.shot))}" title="Open the screenshot"><img src="${esc(shotUri(f.shot))}" alt="Screenshot of ${esc(f.label || f.kind)}" loading="lazy"></a>` : ''}
</li>`,
        )
        .join('\n')
      return `<section>
<h2><a href="${esc(g.url)}">${esc(g.url)}</a></h2>
<p>${loads}</p>
${g.findings.length ? `<ul>${items}</ul>` : '<p class="good">No findings on this page.</p>'}
</section>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>ShipSight</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 20px 40px; max-width: 980px; }
  h1 { margin: 20px 0 4px; } h1.bad { color: var(--vscode-errorForeground); } h1.good, .good { color: var(--vscode-testing-iconPassed, #3fb950); }
  h2 { font-size: 1.05em; margin: 28px 0 6px; word-break: break-all; }
  a { color: var(--vscode-textLink-foreground); }
  .muted { color: var(--vscode-descriptionForeground); }
  .pill { display: inline-block; border: 1px solid var(--vscode-widget-border, #555); border-radius: 12px; padding: 1px 10px; margin: 2px 4px 2px 0; font-size: 0.9em; }
  .pill.bad { border-color: var(--vscode-errorForeground); }
  ul { list-style: none; padding: 0; }
  .finding { border-left: 3px solid var(--vscode-errorForeground); padding: 8px 12px; margin: 10px 0; background: var(--vscode-editorWidget-background); }
  .where { font-size: 0.9em; margin-bottom: 4px; } .what { margin: 4px 0; }
  code { display: block; opacity: 0.8; font-size: 0.85em; margin: 4px 0; word-break: break-all; }
  img { display: block; max-width: 100%; max-height: 360px; margin-top: 8px; border: 1px solid var(--vscode-widget-border, #555); }
  .bar { display: flex; gap: 8px; margin: 14px 0 6px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 6px 14px; border-radius: 3px; cursor: pointer; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
</style>
</head>
<body>
${head}
<p class="muted">${esc(pagesLine)} · ${esc(new Date(report.at).toLocaleString())}</p>
<div class="bar"><button id="again">Check again</button><button id="open" class="secondary">Open report.md</button><button id="folder" class="secondary">Open the run folder</button></div>
${body}
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  for (const id of ['again', 'open', 'folder']) document.getElementById(id).addEventListener('click', () => vscode.postMessage({ cmd: id }));
</script>
</body>
</html>`
}

// How to run a Node script from the extension host: a `node` on PATH, else VS Code's own Electron run as Node.
function nodeCommand(env = process.env) {
  const which = process.platform === 'win32' ? 'where' : 'which'
  try {
    const found = execFileSync(which, ['node'], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map(s => s.trim())
      .find(Boolean)
    if (found) return { file: found, env: { ...env } }
  } catch {}
  return { file: process.execPath, env: { ...env, ELECTRON_RUN_AS_NODE: '1' } }
}

// The two commands that put Playwright and its browsers under `root`, as the checker expects them.
function setupSteps(root) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  return [
    { file: npm, args: ['install', '--no-audit', '--no-fund', `playwright@${PLAYWRIGHT_VERSION}`], cwd: root },
    { file: npx, args: ['playwright', 'install', 'chromium', 'webkit'], cwd: root },
  ]
}

function setupText(root) {
  return setupSteps(root)
    .map(s => `cd "${root}" && ${s.file} ${s.args.join(' ')}`)
    .join('\n')
}

function defaultHome() {
  return process.env.SHIPSIGHT_HOME || path.join(os.homedir(), '.shipsight')
}

module.exports = {
  PLAYWRIGHT_VERSION,
  KIND_WORDS,
  parseWidths,
  normalizeUrl,
  hostDir,
  stamp,
  checkerArgs,
  parseSummary,
  readReport,
  listRuns,
  recentSites,
  statusText,
  groupByPage,
  renderHtml,
  nodeCommand,
  setupSteps,
  setupText,
  defaultHome,
  esc,
}
