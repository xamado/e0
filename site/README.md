# Event Zero site

Static site built with [Hugo](https://gohugo.io). All copy lives in Markdown under `content/`;
the main-menu design is the one template `layouts/all.html` (no external theme). Every section
is its own page (`/services/`, `/shipped/`…) that arrives with its screen rendered (`layouts/_partials/pane.html`),
including every item's text; items are selections on that screen, not pages. Switching tabs swaps in the other
sections' screens, fetched from their pages.

## Commands

    hugo server          # live preview at http://localhost:1313, rebuilds on save
    hugo --gc --minify   # production build into public/ (upload that folder anywhere)

## Editing content

Each menu entry is a folder in `content/`, ordered by `weight` in its `_index.md`:

- `services/`, `clients/`, `engage/` (How we work), `contact/`: one `.md` file per item in the list.
  The body text is the description; front matter holds `meta`, `kicker`, `bullets`, `tags`, `facts`.
- `shipped/`: one folder per game with `index.md` (`year`, `platforms`, `role`, optional `tag`)
  and `poster.jpg`; add `role: "…"` to show your role on that game. Games are ordered by `weight`. Any poster image works: Hugo crops it to 2:3 and converts it to WebP at build time.
- `content/_index.md`: tagline and the title-screen prompt.
- `hugo.toml`: site title, description and contact `email` (used wherever `{email}` appears).

## Code

- `assets/css/site.css`: styles
- `assets/js/shaders.js`, `engine.js`: WebGL2 background (Lorenz attractor particles, backdrop, trails)
- `assets/js/raycaster.js`: the hidden ASCII game in the contact terminal (`./do-not-run`)
- `assets/js/app.js`: menu, input, sounds and scene lab; takes the site's structure (sections, page URLs) from
  `<script id="site-data">` in the page and each section's screen from its page
