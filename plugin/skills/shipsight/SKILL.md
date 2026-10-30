---
name: shipsight
description: The eyes-on check of a live site after a deploy. Use it after every deploy of a website or landing page, before telling the user the deploy is done, before sharing a link with a client, and whenever the user asks to check a site, a page, buttons, spacing, mobile layout or "why does it look broken". Runs Playwright on the live URL at desktop and phone widths in Chrome and Safari engines and reports buttons out of place or too close, cut text, sideways scroll, images that did not load, hidden content, JS errors and failed requests, each with a screenshot.
---

# ShipSight

A green deploy means the files uploaded. It does not mean the page a client opens looks right. ShipSight loads the live page the way a visitor does, scrolls it, and reports what the visitor would notice.

## When to run it

- After every deploy of a site, landing page or storefront, on the live address, before saying "deployed".
- Before showing a link to a client or to the user.
- Before a deploy, on the local build, when there is one.
- When the user reports "it looks broken", "the button is cut", "the page scrolls sideways", "the images are missing".

## How to run it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check.mjs" <url> [url...] [--crawl] [--widths 1440,390] [--out <dir>] [--no-webkit] [--json]
```

- Default: the URLs given, at 1440 and 390 px, in Chromium, and in WebKit (Safari's engine) at phone widths when it is installed.
- `--crawl` follows same-origin links from each URL, up to `--max` pages (10 by default). Use it after a deploy that touched a shared layout, header, footer or stylesheet.
- `--widths` for more widths, for example `1728,1440,1024,768,390,320` on a full release check.
- `--json` prints one JSON line at the end with the counts and the report folder; read `report.md` and the screenshots from there.
- Exit codes: 0 clean, 1 findings, 2 usage, 3 Playwright or a browser is missing. On 3, run the setup command the tool prints, then run again. Do the setup yourself.

## What the findings mean

| kind | what a visitor sees |
|---|---|
| http, resource | the page or one of its files answered 4xx/5xx or did not load |
| jserr | a JavaScript error; often the real cause of several other findings |
| broken-image | an image tag whose picture did not decode, whatever the server said (a 200 with the wrong content is still broken) |
| invisible, dead-video, unrevealed, hidden-shown | media drawn transparent, a video with no data, reveal-on-scroll content that never revealed, or hidden content that shows anyway |
| sideways | the page scrolls sideways at that width |
| tight, text, overlap | buttons closer than 8 px to each other, closer than 6 px to text, or overlapping |
| edge, small | on a phone: a button hugging the screen edge or shorter than 40 px |
| overflow | text cut inside a button |
| out, offscreen, straddle | a button sticking out of its card, bar or section, out of the screen, or sitting half on a card or photo |

## How to read a result

1. Group the findings by kind and element (`sel`): one misplaced button appears at every width and in both engines; it is one fix.
2. Open the screenshot of each group. The red box marks the element. Decide from the picture, not from the message.
3. Some findings are intentional: a segmented control whose buttons share one pill, carousel dots, a sideways card rail. Say so to the user in one sentence each; do not hide them.
4. Report in the user's language: what was checked (pages, widths, engines), what was found, what looks intentional, the folder with the report.

## Rules

- Never say deployed, live, ready or clean while there are findings you have not shown the user.
- "Clean" is what the tool printed after a run on the live address in this session, not an earlier run and not a local run.
- A fix is done when the live run is clean or every remaining finding is explained.
- When the user points at something the tool missed, note it in the report; it is a missing check, not a user mistake.
