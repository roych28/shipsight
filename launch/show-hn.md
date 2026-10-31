<!--
הערות לרועי (לא חלק מהפוסט):
- בטופס https://news.ycombinator.com/submit : Title ו-URL בלבד (ה-URL הוא הריפו), בלי טקסט. מיד אחרי השליחה
  מפרסמים את "First comment" כתגובה ראשונה שלך.
- הכותרת 72 תווים (המגבלה 80). HN מוריד "free" מכותרות, לכן החינם רק בתגובה.
- לא לבקש הצבעות ולא לשתף קישור ישיר לפוסט עם בקשה להצביע.
- שעה טובה: בוקר בחוף המזרחי (15:00 עד 17:00 שעון ישראל), שלישי עד חמישי. לא באותו יום של הפוסט ברדיט.
-->

**Title:** Show HN: ShipSight – Check the live site after a deploy, in Chromium and WebKit

**URL:** https://github.com/roych28/shipsight

---

**First comment:**

I hand sites to clients, and a green deploy kept turning into a screenshot from the client's iPhone: a button half off its card, text cut at 390 px, a page scrolling sideways, a picture that never loaded. The code was right; nobody had opened the live page on a phone.

ShipSight is the check I now run after every deploy, as a Claude Code plugin and a VS Code extension. One Node script and Playwright, no server.

How it works:

- Loads each URL in Chromium at every width and in WebKit (Safari's engine) at phone widths, scrolls at a human pace (400 px every 150 ms, a pause at the bottom) so reveal-on-scroll content gets its chance, then inspects the DOM in page context.
- Geometry checks on clickable elements: distance between buttons (< 8 px), a button outside its card/bar/section, outside the viewport, straddling a card edge, overlapping another button, shorter than 40 px on a phone, text overflowing it. Page checks: sideways scroll, images with naturalWidth 0, media drawn transparent or hidden, [hidden] elements drawn anyway, JS errors, 4xx/5xx responses.
- One screenshot per finding with the element boxed, plus report.json and report.md. `--crawl` follows same-origin links.
- The Claude Code skill tells the model to run this after a deploy and not to call anything "deployed" or "clean" while findings exist that it has not shown. That rule did more for me than the checker.

What was hard: false positives. A carousel's waiting slide is a fully transparent image, which looks like a broken one; a fade-in paragraph looks like hidden content. Class-name allowlists (swiper, slick) were not enough. The fix was overlap geometry: a transparent image covered by a visible sibling image on more than half its area is a slide. Each false positive became a fixture page in the tests: a page built to be broken that must be named breakage by breakage, and a page built to be clean, carousel and reveal included, that must come back clean. CI runs it on Linux and macOS, and the extension's integration test runs inside a real VS Code.

Limits: it finds layout breakage and errors, not bad copy. WebKit is not Safari; a few differences remain. No login support yet. Everything runs locally; the only network traffic is the browser loading your URLs.

MIT. Claude Code wrote most of the code from my spec and my corrections; the checker grew out of a private skill I used on my own client sites for a month before this.

VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=roychemo.shipsight
Open VSX: https://open-vsx.org/extension/roychemo/shipsight

Not affiliated with Anthropic, Microsoft or Playwright. I'd like to hear what breaks on your sites that this misses.
