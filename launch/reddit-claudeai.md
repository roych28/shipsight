<!--
הערות לרועי (לא חלק מהפוסט):
- תת-הפורום: r/ClaudeAI, פלייר "Built with Claude" אם קיים. לפרסם אחרי שהתוסף בחנויות, או למחוק את שתי שורות החנויות בסוף.
- מדיה: launch/demo/finding.png (ממצא עם ריבוע אדום) ותמונה של חלונית הממצאים ב-VS Code.
- לענות על תגובות בעצמך ובאותו טון. לא לפרסם באותו יום גם ב-r/ChatGPTCoding וכדומה.
-->

**Title:** I made a free Claude Code plugin that checks the live site after a deploy, in Chrome and Safari engines at phone width, so Claude stops saying "deployed" when a button is off the screen

---

I build sites for clients with Claude Code. Three times in one month the deploy was green, I sent the link, and the client answered with a screenshot from an iPhone: a button half off its card, text cut, a page scrolling sideways. The code was fine. The layout wasn't, and nobody had opened the live page on a phone.

So I turned the check I was doing by hand into a plugin. It is free and MIT.

What `/shipsight <url>` does:

- Opens the live page in **Chromium and in WebKit** (Safari's engine) at **1440 and 390 px**, scrolls it like a visitor, waits for reveal-on-scroll content.
- Reports what a client would notice: **buttons too close, out of their box, off the screen, too short for a thumb, text cut inside a button, buttons overlapping, a page that scrolls sideways, images that didn't decode, invisible media, JS errors, requests that answered 4xx/5xx.**
- **One screenshot per finding**, with the element boxed in red, plus `report.md` and `report.json`.
- `--crawl` follows same-origin links and checks every page.
- The skill tells Claude to run it after every deploy and before sharing a link, and **not to say "deployed" or "clean" while there are findings it hasn't shown you**. That last part is the point.

There is also a VS Code extension with the same checker: a "Check live site" command, the findings beside your code with their screenshots, and a history of runs.

Honest limits:

- It finds layout breakage, loading failures and errors. It does not judge copy or design.
- WebKit is Safari's engine, not Safari. A few rendering differences (fonts, form controls, video autoplay) can remain.
- Pages behind a login need a test account; it does not sign in.
- Some findings are intentional (a packed segmented control, a sideways card rail). Claude says which, instead of hiding them.

Everything runs locally. The only network traffic is the browser loading the URLs you give it.

Claude wrote it. I described what a good post-deploy check catches, ran it on my clients' real sites, and told it what it missed and what it invented. The hard part was false positives: a carousel's transparent slide looks like a broken image, a fade-in block looks like hidden content. The fix was scrolling at a human pace and detecting carousels by image overlap rather than by class name. Every false positive became a permanent test case: a page built to be broken that must be named breakage by breakage, and a page built to be clean, with a carousel and a reveal block, that must come back clean. CI runs it on Linux and macOS, including the extension inside a real VS Code.

- Source and plugin: https://github.com/roych28/shipsight
- VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=roychemo.shipsight
- Open VSX (Cursor, Windsurf, VSCodium): https://open-vsx.org/extension/roychemo/shipsight

Not affiliated with Anthropic. If you ship sites built with Claude, I'd like to hear what your clients catch that this doesn't.
