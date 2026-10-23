# Event Zero site

Static site built with [Hugo](https://gohugo.io). All copy lives in Markdown under `content/`;
the main-menu design is the template in `layouts/home.html` (no external theme).

## Commands

    hugo server          # live preview at http://localhost:1313, rebuilds on save
    hugo --gc --minify   # production build into public/ (upload that folder anywhere)

## Editing content

Each menu entry is a folder in `content/`, ordered by `weight` in its `_index.md`:

- `services/`, `clients/`, `engage/` (How we work), `contact/`: one `.md` file per item in the list.
  The body text is the description; front matter holds `meta`, `kicker`, `bullets`, `tags`, `facts`.
- `shipped/`: one folder per game with `index.md` (`year`, `platforms`, `role`, optional `tag`)
  and `poster.jpg`. Any poster image works: Hugo crops it to 2:3 and converts it to WebP at build time.
- `content/_index.md`: tagline and the title-screen prompt.
- `hugo.toml`: site title, description, contact `email` (used wherever `{email}` appears),
  and `testFiller` (extra placeholder posters for testing; set to `0` before launch).

## Code

- `assets/css/site.css`: styles
- `assets/js/scenes.js`, `engine.js`: WebGL background scenes and particle simulation
- `assets/js/app.js`: menu, input, sounds and scene lab; reads the compiled content from
  `<script id="site-data">` in the page
