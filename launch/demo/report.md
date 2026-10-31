# ShipSight 2026-10-31 12:34

Pages: 1. Widths: 1440, 390. Engines: chromium, webkit.

**38 findings** jserr 3, resource 3, broken-image 3, sideways 3, tight 3, overflow 3, out 3, offscreen 7, edge 4, small 2, overlap 2, text 2

- [jserr] chromium 1440px https://demo.example/broken.html — boom from the page
- [resource] chromium 1440px https://demo.example/broken.html — 404 https://demo.example/missing.png
- [broken-image] chromium 1440px https://demo.example/broken.html — https://demo.example/missing.png
- [sideways] chromium 1440px https://demo.example/broken.html — 1224px of sideways scroll
- [tight] chromium 1440px https://demo.example/broken.html — "Buy now" 2px from "Learn more" (`main > div.tight > a.btn`) → 001-tight-1440-chromium.png
- [overflow] chromium 1440px https://demo.example/broken.html — "A very long button label" text cut: needs 220px, has 70px (`main > a.btn.cut`) → 002-overflow-1440-chromium.png
- [out] chromium 1440px https://demo.example/broken.html — "Card action" sticks out of main > section.card by 59px (`main > section.card > a.btn`) → 003-out-1440-chromium.png
- [offscreen] chromium 1440px https://demo.example/broken.html — "Off the edge" sticks out of the screen by 30px (`main > a.btn.offscreen`) → 004-offscreen-1440-chromium.png
- [jserr] chromium 390px https://demo.example/broken.html — boom from the page
- [resource] chromium 390px https://demo.example/broken.html — 404 https://demo.example/missing.png
- [broken-image] chromium 390px https://demo.example/broken.html — https://demo.example/missing.png
- [sideways] chromium 390px https://demo.example/broken.html — 2034px of sideways scroll
- [tight] chromium 390px https://demo.example/broken.html — "Buy now" 2px from "Learn more" (`main > div.tight > a.btn`) → 005-tight-390-chromium.png
- [edge] chromium 390px https://demo.example/broken.html — "Card action" -35px from the screen edge (`main > section.card > a.btn`) → 006-edge-390-chromium.png
- [small] chromium 390px https://demo.example/broken.html — "Short button" 24px tall (`main > a.btn.short`) → 007-small-390-chromium.png
- [overlap] chromium 390px https://demo.example/broken.html — "A very long button label" overlaps "Off the edge" (`main > a.btn.cut`) → 008-overlap-390-chromium.png
- [overflow] chromium 390px https://demo.example/broken.html — "A very long button label" text cut: needs 220px, has 70px (`main > a.btn.cut`) → 009-overflow-390-chromium.png
- [edge] chromium 390px https://demo.example/broken.html — "Off the edge" -30px from the screen edge (`main > a.btn.offscreen`) → 010-edge-390-chromium.png
- [text] chromium 390px https://demo.example/broken.html — "Card action" overlaps text "A card" (`main > section.card > a.btn`) → 011-text-390-chromium.png
- [offscreen] chromium 390px https://demo.example/broken.html — "Card action" sticks out of the screen by 35px (`main > section.card > a.btn`) → 012-offscreen-390-chromium.png
- [out] chromium 390px https://demo.example/broken.html — "Card action" sticks out of main > section.card by 59px (`main > section.card > a.btn`) → 013-out-390-chromium.png
- [offscreen] chromium 390px https://demo.example/broken.html — "Short button" sticks out of the screen by 11px (`main > a.btn.short`) → 014-offscreen-390-chromium.png
- [offscreen] chromium 390px https://demo.example/broken.html — "Off the edge" sticks out of the screen by 54px (`main > a.btn.offscreen`) → 015-offscreen-390-chromium.png
- [jserr] webkit 390px https://demo.example/broken.html — boom from the page
- [resource] webkit 390px https://demo.example/broken.html — 404 https://demo.example/missing.png
- [broken-image] webkit 390px https://demo.example/broken.html — https://demo.example/missing.png
- [sideways] webkit 390px https://demo.example/broken.html — 2034px of sideways scroll
- [tight] webkit 390px https://demo.example/broken.html — "Buy now" 2px from "Learn more" (`main > div.tight > a.btn`) → 016-tight-390-webkit.png
- [edge] webkit 390px https://demo.example/broken.html — "Card action" -35px from the screen edge (`main > section.card > a.btn`) → 017-edge-390-webkit.png
- [overlap] webkit 390px https://demo.example/broken.html — "Short button" overlaps "Off the edge" (`main > a.btn.short`) → 018-overlap-390-webkit.png
- [small] webkit 390px https://demo.example/broken.html — "Short button" 24px tall (`main > a.btn.short`) → 019-small-390-webkit.png
- [overflow] webkit 390px https://demo.example/broken.html — "A very long button label" text cut: needs 220px, has 70px (`main > a.btn.cut`) → 020-overflow-390-webkit.png
- [edge] webkit 390px https://demo.example/broken.html — "Off the edge" -30px from the screen edge (`main > a.btn.offscreen`) → 021-edge-390-webkit.png
- [text] webkit 390px https://demo.example/broken.html — "Card action" overlaps text "A card" (`main > section.card > a.btn`) → 022-text-390-webkit.png
- [offscreen] webkit 390px https://demo.example/broken.html — "Card action" sticks out of the screen by 35px (`main > section.card > a.btn`) → 023-offscreen-390-webkit.png
- [out] webkit 390px https://demo.example/broken.html — "Card action" sticks out of main > section.card by 59px (`main > section.card > a.btn`) → 024-out-390-webkit.png
- [offscreen] webkit 390px https://demo.example/broken.html — "Short button" sticks out of the screen by 11px (`main > a.btn.short`) → 025-offscreen-390-webkit.png
- [offscreen] webkit 390px https://demo.example/broken.html — "Off the edge" sticks out of the screen by 54px (`main > a.btn.offscreen`) → 026-offscreen-390-webkit.png
