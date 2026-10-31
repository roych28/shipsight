# ShipSight for VS Code

The eyes-on check of a live site after a deploy, from the editor.

Your deploy went green. Before you send the link, ShipSight opens the live page the way a visitor does, in Chromium and in WebKit (Safari's engine), at desktop and phone widths, scrolls through it, and shows you what a client would notice: buttons out of their box or too close together, text cut inside a button, a page that scrolls sideways, images that did not load, JavaScript errors, requests that failed. One screenshot per finding, with the element boxed in red.

## Use

1. `ShipSight: Check live site` from the Command Palette, or click the eye in the status bar.
2. Enter the address, or pick one you checked before.
3. The findings open beside your code, with their screenshots. The status bar keeps the count until the next run.

`ShipSight: Check the last site again` re-runs the last address of this folder. `ShipSight: Open a past report` lists every run on this machine.

The first run asks to install Playwright and the two browsers into the extension's own storage (a minute or two, once). It needs `node` and `npm` on your PATH. `ShipSight: Install the browsers` does the same on demand.

## What it checks

| Finding | Meaning |
|---|---|
| `tight` | two buttons closer than 8 px |
| `out` | a button sticks out of the card, bar or section it sits in |
| `offscreen` | a button sticks out of the screen |
| `edge` | a button closer than 12 px to the screen edge on a phone |
| `small` | a button shorter than 40 px on a phone |
| `overflow` | text cut inside a button |
| `overlap` | two buttons overlap |
| `straddle` | a button half on a card or photo and half off it |
| `text` | a button on top of text that is not part of it |
| `sideways` | the page scrolls sideways |
| `broken-image` | an image that did not decode, whatever the server said |
| `invisible` | an image or video drawn fully transparent or hidden |
| `dead-video` | a video with no data |
| `unrevealed` | reveal-on-scroll content still hidden after scrolling the whole page |
| `jserr` | a JavaScript error |
| `resource` | an image, script, style or font that answered 4xx or 5xx |
| `http` | the page itself answered 4xx or 5xx, or did not load |

## Settings

- `shipsight.widths`: viewport widths in pixels, default `1440,390`.
- `shipsight.webkit`: also check phone widths in WebKit, default on.
- `shipsight.crawl`: follow same-origin links from the start page, default off.
- `shipsight.maxPages`: the most pages one crawl checks, default 10.

## Honest limits

- It finds layout breakage and errors, not wrong content or bad design.
- WebKit is Safari's engine, not Safari itself. Real Safari differs in a few places (video autoplay, some form controls).
- A site behind a login needs a public page or a test user; the extension does not sign in.
- Reports and screenshots stay on your machine, under `~/.shipsight/runs`. The extension makes no network calls of its own; the browsers it starts load only the pages you ask for.

## Also a Claude Code plugin

The same checker runs as `/shipsight <url>` inside Claude Code, so Claude checks what it just deployed before it tells you it is done: https://github.com/roych28/shipsight

MIT. Built by [Roy Chemo](https://github.com/roych28), who also makes [Billable](https://marketplace.visualstudio.com/items?itemName=roychemo.billable). Not affiliated with Anthropic, Microsoft or the Playwright team.
