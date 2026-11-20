# OptimoLMS landing page

The marketing page for OptimoLMS. Static HTML and CSS on Vite: no framework, no data, one
`index.html` and one stylesheet. Everything it shows is a mock of the product's own screens,
drawn in CSS rather than pasted as images.

```bash
npm run dev      # http://localhost:5174 (from this folder)
npm run build    # static files in dist/
npm run preview  # serve dist/
```

From the repo root: `npm run dev:landing`.

## What is here

| Path               | What it is                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`       | The page: nav, hero, product frame, gradebook, assistant band, access cards, questions, close and footer                              |
| `src/page.css`     | The mocks and the page's own layout (app shell, gradebook sheet, chat, permissions, TOTP, notifications)                              |
| `public/assets/`   | The design kit: tokens and type (`system.css`), cards (`cards.css`), layout deals (`layout.css`), motion, the cursor-spotlight moment |
| `public/share.jpg` | 1200×630 social image, a screenshot of the hero                                                                                       |
| `shots/`           | Local screenshots from design review (git-ignored)                                                                                    |

The page is a stack of one-screen sections (`--h: 1`, and `--hm: 2` on `#access` for a phone).
Every section is verified to fit exactly its screens at 1440×900, 768×1024 and 390×844.

## Design notes

- **Colour** is the product's own: `#f5f7fa` ground, `#171b20` ink, `#156cdd` action, `#ffffff`
  surface, so the marketing page and the app read as one product.
- **Type**: Schibsted Grotesk for text, JetBrains Mono for numbers, codes and tool names.
- **Mocks, not screenshots**: the app window, the gradebook sheet, the assistant chat and the
  permission matrix are HTML, so they stay sharp at any zoom and can be read by a screen reader
  through their `aria-label`s.
- **One action** on the page: "Book a walkthrough", a `mailto:` to `hello@optimolms.example`.
  The domain is a stand-in until the real one exists.

## Content to fill in before this goes live

- The real contact address, in `index.html` (search for `hello@optimolms.example`).
- `og:image` is site-relative (`/share.jpg`); social crawlers want an absolute URL once a domain
  is chosen.
- A privacy line, if the deployment collects anything at all (it currently serves no scripts
  beyond the kit's own).

## Checks used

From the design kit (`design-taste-frontend`), run against `dist/`:

```bash
node <kit>/assets/layout/check.mjs --url dist/index.html --root dist --sizes 1440x900,768x1024,390x844
node <kit>/scripts/copy-lint.mjs index.html --kind software
```

Both pass with no findings.
