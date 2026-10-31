// Runs the extension inside a real VS Code against the fixture pages, served from this process over HTTP.
// Playwright comes from ../../../plugin (installed by `npm run setup` at the repo root), so nothing is downloaded here.
// Run with: npm run test:integration
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { runTests } = require('@vscode/test-electron')

const FIX = path.resolve(__dirname, '..', '..', '..', 'tests', 'fixtures')
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }

async function main() {
  // Set when this runs from a terminal inside VS Code; it would start the test VS Code as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE
  const server = http.createServer((req, res) => {
    const file = path.join(FIX, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!file.startsWith(FIX) || !fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('not found')
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(fs.readFileSync(file))
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`

  // Short names: macOS's temp dir plus VS Code's socket name must stay under 103 characters.
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'ss-')))
  const workspace = path.join(tmp, 'work', 'site')
  fs.mkdirSync(workspace, { recursive: true })
  const home = path.join(tmp, 'home')
  fs.mkdirSync(home)
  const pluginRoot = path.resolve(__dirname, '..', '..', '..', 'plugin')

  try {
    await runTests({
      extensionDevelopmentPath: path.resolve(__dirname, '..', '..'),
      extensionTestsPath: path.resolve(__dirname, 'suite.js'),
      launchArgs: [workspace, '--disable-extensions', '--user-data-dir', path.join(tmp, 'ud')],
      extensionTestsEnv: { SHIPSIGHT_TEST_BASE: base, SHIPSIGHT_TEST_ROOT: tmp, SHIPSIGHT_HOME: home, SHIPSIGHT_PLAYWRIGHT_ROOT: pluginRoot },
    })
  } finally {
    server.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
