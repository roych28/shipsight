# ShipSight [![ci](https://github.com/roych28/shipsight/actions/workflows/ci.yml/badge.svg)](https://github.com/roych28/shipsight/actions)

The eyes-on check of a live site after a deploy, for Claude Code.

A green deploy means the files uploaded. It does not mean the page your client opens looks right: a button half off its card, text cut on a phone, a page that scrolls sideways, a picture that never loaded, a JavaScript error that killed the menu. ShipSight loads the live page the way a visitor does, at desktop and phone widths, in Chrome's engine and in Safari's, scrolls it, and reports what the visitor would notice, with a screenshot of each finding.

Built for people who hand sites to clients: freelancers, small agencies, anyone shipping landing pages and storefronts built with AI tools.

## Install

In Claude Code:

```
/plugin marketplace add roych28/shipsight
/plugin install shipsight@shipsight
```

The first run installs Playwright and its Chromium and WebKit browsers into the plugin folder (Claude does this itself when the tool asks for it). Nothing else is installed on your machine.

## Use

After a deploy, in Claude Code:

```
/shipsight https://your-client-site.com/
```

Claude runs the check on the live address, reads the report and the screenshots, and tells you what a client would notice, grouped by element, with what looks intentional called out. It will not call the deploy done while there are findings it has not shown you.

Add `--crawl` to follow the site's own links (10 pages by default), and `--widths 1728,1440,1024,768,390,320` for a full release check.

The skill also makes Claude run the check on its own after it deploys a site for you, before it says "deployed".

### From a terminal

```
node plugin/scripts/check.mjs <url> [url...] [--crawl] [--max 10] [--widths 1440,390] [--out <dir>] [--no-webkit] [--json]
```

Exit code 0 when clean, 1 with findings. The report folder (default `~/.shipsight/runs/<host>/<time>/`) holds `report.md`, `report.json` and one PNG per layout finding with the element in a red box.

## What it checks

| kind | what a visitor sees |
|---|---|
| `http`, `resource` | the page or one of its files answered 4xx/5xx or did not load |
| `jserr` | a JavaScript error |
| `broken-image` | an `<img>` whose picture did not decode, whatever the server said |
| `invisible`, `dead-video`, `unrevealed`, `hidden-shown` | media drawn transparent, a video with no data, reveal-on-scroll content that never revealed, hidden content that shows anyway |
| `sideways` | the page scrolls sideways at that width |
| `tight`, `text`, `overlap` | buttons closer than 8 px to each other, closer than 6 px to text, or overlapping |
| `edge`, `small` | on a phone: a button hugging the screen edge, or shorter than 40 px |
| `overflow` | text cut inside a button |
| `out`, `offscreen`, `straddle` | a button sticking out of its card, bar or section, out of the screen, or sitting half on a card or photo |

Widths default to 1440 (desktop) and 390 (phone). WebKit, Safari's engine, runs at phone widths when it is installed; `--no-webkit` skips it.

## Honest limits

- It finds layout breakage, loading failures and errors. It does not judge copy, colors or taste.
- WebKit on Linux and Windows is Safari's engine, not Safari itself; real Safari rendering differences in fonts and form controls can remain.
- A page behind a login needs a test account; ShipSight does not sign in yet.
- Some findings are intentional (a packed segmented control, carousel dots, a sideways card rail). Claude says which, and why, instead of hiding them.

## Tests

```
npm run setup
npm test
```

The tests serve pages built to be clean and pages built to be broken from a local server, run the real checker on them, and assert the content of the report: the broken page must name every breakage with the right label, the clean page must come back clean.

## Roadmap

- VS Code and Open VSX extension: a "Check live site" button and the findings in a panel.
- ShipSight Pro: a daily check of every client site from a server, real Safari, a branded PDF report in your client's language, and an alert when a page breaks.

## Privacy

Everything runs on your machine. The only network traffic is the browser loading the URLs you give it.

## License

MIT. Not affiliated with Anthropic; Claude and Claude Code are trademarks of Anthropic. Made by [Roy Chemo](https://github.com/roych28). See also [Billable](https://github.com/roych28/billable), Claude Code accounts and cost per client.
