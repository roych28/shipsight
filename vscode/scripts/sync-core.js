// The extension ships its own copy of the checker so the .vsix is self-contained. The plugin's file is the source;
// this copies it in, and the unit tests fail when the two drift apart.
const fs = require('fs')
const path = require('path')
const src = path.join(__dirname, '..', '..', 'plugin', 'scripts', 'check.mjs')
const dst = path.join(__dirname, 'check.mjs')
fs.copyFileSync(src, dst)
console.log(`copied ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dst)}`)
