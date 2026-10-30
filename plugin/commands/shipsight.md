---
description: Check a live site after a deploy, the way a client would see it: layout, buttons, images and JS errors at desktop and phone widths, in Chrome and Safari engines
argument-hint: <url> [url...] [--crawl] [--widths 1440,390]
allowed-tools: Bash(node:*), Bash(npm:*), Bash(npx:*), Read, Glob
---

Run ShipSight on the live URL(s) the user gave: `$ARGUMENTS`. If no URL was given, ask for one (the live address, not localhost, unless the user says localhost on purpose).

1. Run it and read the result:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs" $ARGUMENTS --json
```

2. If it exits with code 3, Playwright or a browser is missing. Run exactly the setup command it prints (an `npm install` inside the plugin folder, then `npx playwright install chromium webkit`), then run step 1 again. Do this yourself, do not hand it to the user.

3. Read `report.md` from the `out` folder in the JSON line. For each finding, look at its screenshot (the red box marks the element) before you decide anything.

4. Report to the user in their language, short:
   - what was checked: how many pages, which widths, Chrome and whether Safari's engine (WebKit) ran;
   - the findings grouped by kind and element (the same button shows up at every width), each with the screenshot path;
   - which findings look intentional (a packed segmented control, carousel dots) and why;
   - the folder with the full report.

5. Never say the site is deployed, live, ready or fine while there are findings you have not shown the user. "Clean" is only what the tool printed after a run on the live address in this session.

When the user is fixing findings: fix in the site's repo, run ShipSight on the local build if there is one, deploy, then run it again on the live address. A fix is done when the live run is clean or every remaining finding is explained.
