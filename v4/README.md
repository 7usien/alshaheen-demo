# Homepage v4 demo — "from blueprint to building"

Static demo for client review (not the production site). Arabic: `v4/index.html` · English: `v4/en/index.html`.

## Files
- `assets/home-v4.css` — one stylesheet for RTL and LTR (logical properties; `[dir]` overrides only where geometry mirrors).
- `assets/home-v4.js` — vanilla JS, no libraries: motion switch, sticky bar, phone menu, project filter, steps, sector autoplay, quote form (demo).
- Images come from `../images/` (shared with v3.4), with `srcset`/`sizes` and `width`/`height` on every image.

## SEO and sharing
- The block between `SEO block start/end` is the same production block used by v3.4 (it becomes the Smarty `header.tpl` block):
  title, description, canonical, `hreflang` ar / en / x-default, Open Graph (incl. image size and alt, locale + alternate),
  Twitter card, and Organization + WebSite JSON-LD.
- canonical / hreflang / og:url point to the live site on purpose. The demo itself is `noindex, nofollow` and `robots.txt` blocks all crawling.
- One `h1`, `h2` per section, meaningful `alt` text, `lang`/`dir` on `<html>`, skip link, landmarks.

## Responsive and accessibility
- Breakpoints 1120 (menu button), 960 (tablet: 2-column grids, stacked sections), 640 (phone: 1 column, call/quote bar).
- Hero preload with portrait crops on phones; below-the-fold images lazy-load.
- Pause button (WCAG 2.2.2) stops every animation and is remembered; `prefers-reduced-motion` shows a static page.
- Keyboard: focus styles, Esc closes the menu, focus is kept inside it, hover-only content also opens on focus.

## Demo limits
- The quote form validates and shows the success state; it does not send anything yet (destination to be decided).
- The hero effect is CSS. The planned live version uses Three.js with depth maps (see the canvas storyboard).
- Client logos are text tiles until the SVG logos are supplied.
- Section links (`#about-page`, `#project-…`, PDFs) are placeholders until the inner pages exist.
