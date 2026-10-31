// ShipSight for VS Code: run the checker on a live site, show the findings with their screenshots, keep the history.
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const vscode = require('vscode')
const lib = require('./lib')

const CHECKER = path.join(__dirname, 'scripts', 'check.mjs')
const RECENT = 'shipsight.recentSites'
const LAST = 'shipsight.lastUrl'

function activate(context) {
  const out = vscode.window.createOutputChannel('ShipSight')
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50)
  status.command = 'shipsight.check'
  status.tooltip = 'ShipSight: check a live site'
  context.subscriptions.push(out, status)

  const home = lib.defaultHome()
  // Playwright lives in the extension's own storage, installed once by `ShipSight: Install the browsers`.
  // A root given in the environment wins, so a developer can point it at a checkout that has one.
  let playwrightRoot = process.env.SHIPSIGHT_PLAYWRIGHT_ROOT || path.join(context.globalStorageUri.fsPath, 'playwright')
  let last = null
  let panel = null
  let panelHtml = ''

  const show = run => {
    last = run
    status.text = lib.statusText(run)
    status.show()
  }
  show(null)

  function settings() {
    const c = vscode.workspace.getConfiguration('shipsight')
    return { widths: c.get('widths'), webkit: c.get('webkit'), crawl: c.get('crawl'), maxPages: c.get('maxPages') }
  }

  function runChecker(url) {
    const outDir = path.join(home, 'runs', lib.hostDir(url), lib.stamp())
    const args = lib.checkerArgs(url, settings(), outDir)
    const node = lib.nodeCommand()
    const env = { ...node.env, SHIPSIGHT_PLAYWRIGHT_ROOT: playwrightRoot }
    out.appendLine(`$ node ${path.basename(CHECKER)} ${args.join(' ')}`)
    return new Promise(resolve => {
      execFile(node.file, [CHECKER, ...args], { env, timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
        const code = err && typeof err.code === 'number' ? err.code : err ? 1 : 0
        if (stderr) out.append(stderr)
        const summary = lib.parseSummary(stdout)
        const report = summary?.out ? lib.readReport(summary.out) : null
        if (code === 3) return resolve({ url, needsSetup: true, stderr })
        if (!report) return resolve({ url, error: (stderr || stdout || `exit ${code}`).trim().split('\n').slice(-3).join(' ').slice(0, 300) })
        resolve({ url, dir: summary.out, report })
      })
    })
  }

  async function check(url) {
    url = lib.normalizeUrl(url)
    if (!url) {
      vscode.window.showErrorMessage('ShipSight: that is not a web address.')
      return null
    }
    await context.globalState.update(RECENT, lib.recentSites(context.globalState.get(RECENT, []), url))
    await context.workspaceState.update(LAST, url)
    show({ url, running: true })
    const run = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `ShipSight: checking ${new URL(url).host}` },
      () => runChecker(url),
    )
    show(run)
    if (run.needsSetup) {
      // Not awaited: the answer may never come, and the caller gets the run now.
      vscode.window.showWarningMessage('ShipSight needs Playwright and its browsers. Install them now? It takes a minute or two.', 'Install', 'Show the commands').then(async pick => {
        if (pick === 'Install') {
          if (await setup()) check(url)
        } else if (pick === 'Show the commands') {
          out.appendLine(lib.setupText(playwrightRoot))
          out.show()
        }
      })
      return run
    }
    if (run.error) {
      vscode.window.showErrorMessage(`ShipSight could not check ${url}: ${run.error}`, 'Open the log').then(p => p && out.show())
      return run
    }
    openPanel(run)
    const n = run.report.findings.length
    if (n) vscode.window.showWarningMessage(`ShipSight: ${n} finding${n === 1 ? '' : 's'} on ${new URL(url).host}. Do not call it shipped yet.`)
    return run
  }

  async function setup() {
    fs.mkdirSync(playwrightRoot, { recursive: true })
    out.show(true)
    const ok = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'ShipSight: installing Playwright and the browsers', cancellable: false }, async () => {
      for (const step of lib.setupSteps(playwrightRoot)) {
        out.appendLine(`$ ${step.file} ${step.args.join(' ')}   (in ${step.cwd})`)
        const code = await new Promise(resolve => {
          const child = execFile(step.file, step.args, { cwd: step.cwd, env: process.env, shell: process.platform === 'win32', timeout: 20 * 60_000, maxBuffer: 64 * 1024 * 1024 }, err => resolve(err ? (typeof err.code === 'number' ? err.code : 1) : 0))
          child.stdout?.on('data', d => out.append(String(d)))
          child.stderr?.on('data', d => out.append(String(d)))
        })
        if (code !== 0) {
          out.appendLine(`\nexit ${code}. Run these in a terminal, then try again:\n${lib.setupText(playwrightRoot)}`)
          return false
        }
      }
      return true
    })
    if (ok) vscode.window.showInformationMessage('ShipSight: browsers installed.')
    else vscode.window.showErrorMessage('ShipSight: the install did not finish. The commands to run by hand are in the ShipSight output.')
    return ok
  }

  function openPanel(run) {
    const dir = run.dir
    if (!panel) {
      panel = vscode.window.createWebviewPanel('shipsight', 'ShipSight', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(home, 'runs'))], retainContextWhenHidden: true })
      panel.onDidDispose(() => {
        panel = null
      })
      panel.webview.onDidReceiveMessage(async m => {
        const current = panel?.run
        if (!current) return
        if (m.cmd === 'again') check(current.url)
        if (m.cmd === 'open') vscode.window.showTextDocument(vscode.Uri.file(path.join(current.dir, 'report.md')), { preview: false })
        if (m.cmd === 'folder') vscode.env.openExternal(vscode.Uri.file(current.dir))
      })
    }
    panel.run = run
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36)
    panelHtml = lib.renderHtml(run.report, {
      shotUri: f => panel.webview.asWebviewUri(vscode.Uri.file(path.join(dir, f))).toString(),
      cspSource: panel.webview.cspSource,
      nonce,
    })
    panel.title = `ShipSight: ${new URL(run.url).host}`
    panel.webview.html = panelHtml
    panel.reveal(vscode.ViewColumn.Beside, true)
  }

  async function pickUrl() {
    const recent = context.globalState.get(RECENT, [])
    const lastHere = context.workspaceState.get(LAST)
    const items = [
      { label: '$(edit) Enter a URL…', url: null },
      ...[lastHere, ...recent.filter(u => u !== lastHere)].filter(Boolean).map(u => ({ label: `$(globe) ${u}`, description: u === lastHere ? 'last in this folder' : '', url: u })),
    ]
    const picked = items.length > 1 ? await vscode.window.showQuickPick(items, { placeHolder: 'Which live site should ShipSight check?' }) : items[0]
    if (!picked) return null
    if (picked.url) return picked.url
    return vscode.window.showInputBox({ prompt: 'The live address to check, as a visitor would open it', placeHolder: 'https://example.com/', value: lastHere ?? '', validateInput: v => (lib.normalizeUrl(v) ? null : 'Enter a web address such as https://example.com/') })
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('shipsight.check', async () => {
      const url = await pickUrl()
      if (url) await check(url)
    }),
    vscode.commands.registerCommand('shipsight.checkUrl', url => check(url)),
    vscode.commands.registerCommand('shipsight.checkAgain', async () => {
      const url = last?.url ?? context.workspaceState.get(LAST)
      if (url) await check(url)
      else vscode.commands.executeCommand('shipsight.check')
    }),
    vscode.commands.registerCommand('shipsight.setup', () => setup()),
    vscode.commands.registerCommand('shipsight.history', async () => {
      const runs = lib.listRuns(home)
      if (!runs.length) return vscode.window.showInformationMessage('ShipSight has not checked anything yet.')
      const picked = await vscode.window.showQuickPick(
        runs.map(r => ({ label: `${r.findings ? '$(warning) ' + r.findings + ' findings' : '$(check) clean'} · ${r.host}`, description: r.stamp.replace('T', ' ').replace(/-(\d\d)-(\d\d)$/, ':$1:$2'), detail: r.url, run: r })),
        { placeHolder: 'A past ShipSight run', matchOnDescription: true, matchOnDetail: true },
      )
      if (!picked) return
      const report = lib.readReport(picked.run.dir)
      if (report) openPanel({ url: picked.run.url || report.pages[0]?.url, dir: picked.run.dir, report })
    }),
  )

  return {
    lastRun: () => last,
    statusBar: () => ({ text: status.text, tooltip: String(status.tooltip ?? '') }),
    panelHtml: () => panelHtml,
    checkUrl: url => check(url),
    setPlaywrightRoot: root => {
      playwrightRoot = root
    },
    playwrightRoot: () => playwrightRoot,
    home,
  }
}

function deactivate() {}

module.exports = { activate, deactivate }
