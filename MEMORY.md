# CodaCV — project memory

Knowledge for agents (and humans) picking up this project. The README describes features for
users; this file records how things work, why, and what was learned the hard way.

## What it is

A client-only resume builder (Vite + React 19 + TypeScript, no backend). Sidebar editor on the left,
live A4 preview on the right with on-page layout editing, print-to-PDF tuned for ATS / AI parsers,
several resume "versions" stored in the browser. UI text is in **French**; code and comments in English.

```bash
npm install
npm run dev        # http://localhost:5173 (also .claude/launch.json "codacv")
npm run build      # tsc --noEmit && vite build → dist/
npm run typecheck
```

There are no automated tests in the repo. Verification so far was manual: type check + build,
headless printing, and PDF text extraction (see "Testing" below).

## Map of the code

| File | Role |
|---|---|
| `src/types.ts` | Data model: `Resume`, `Theme`, `Section` union (`timeline`, `list`, `text`, `levels`, `facts`, `references`, `highlights`), style enums |
| `src/defaultResume.ts` | Fictional generic example (digital project manager). Used on first launch, "Réinitialiser", "Partir du modèle" |
| `src/store.ts` | Versions library in localStorage (per-version loading, quarantine, cross-tab revision check), undo/redo |
| `src/migrate.ts` | `migrate()`: turns any saved / imported JSON into a valid `Resume`, field by field (old formats, bad values) |
| `src/layout.ts` | Page layout model: rows → columns → stacked sections; every change to the sections order goes through it |
| `src/components/StorageBanner.tsx`, `ErrorBoundary.tsx` | Storage warnings (other tab, unreadable data) and the crash screen |
| `src/components/ResumeDocument.tsx` | Renders the resume (preview **and** print). All style variants live here |
| `src/components/LayoutOverlay.tsx` | On-page handles drawn over the preview (edit only, never printed) |
| `src/components/editor/Editor.tsx` | Sidebar: tabs Contenu / Apparence / Versions, section cards, item editors, theme editor |
| `src/components/editor/VersionsPanel.tsx` | Versions tab |
| `src/components/editor/Sortable.tsx` | dnd-kit vertical sortable list (grip handle, keyboard support) |
| `src/components/editor/fields.tsx`, `IconPicker.tsx`, `icons.tsx` | Form fields, icon picker, icon set (lucide + a few hand-drawn brand SVGs) |
| `src/App.tsx` | Top bar, preview pane (zoom, page-break guides), print setup (`@page` rules, PDF file name) |
| `src/styles/resume.css` | Resume styles (mm/pt units), `print.css` print overrides, `app.css` editor UI |

## Data model and storage

- **Versions library**: localStorage key `codacv.library.v1` = `{ activeId, versions: [{ id, name, updatedAt, resume }], photos }`.
  Photo data URLs are stored once in `photos` (key = hash + length) and versions hold
  `"photo:<key>"`; `loadLibrary` puts them back before `migrate()`. Libraries without `photos`
  (older saves) load as they are. Photos are 480 px JPEGs; imported ones over 150 k characters
  are downscaled the same way. A failed save (storage full) shows a banner until a save succeeds.
  The old single-resume key `codacv.resume.v1` is read once to seed the library ("Principal") and
  then left untouched as a backup — never delete it automatically.
- Other keys: `codacv.sidebarTab` (last sidebar tab, written only after the tab rendered),
  `codacv.library.rev` (revision, bumped on every save), `codacv.quarantine.<ISO date>` (versions
  that could not be read, kept aside; an identical copy is reused).
- Everything loaded (library entries, imported JSON) goes through `migrate()` in `migrate.ts`, which
  rebuilds every field with a type check and a default (`Theme` / `Meta` are object literals, so a
  new field is a compile error until it is handled). Ids are made `[\w-]{1,64}` and unique per
  resume (they end up in CSS selectors). Unknown section kinds are skipped. Past migrations handled:
  contact `kind` → `icon`, boolean `summaryIcon`, `pairWithNext` → layout `place`, removed
  `details` fields (web page feature), removed `spaceBefore`, removed theme `layout`.
- `resume.version` is still `1`; migrations are shape-based, not version-based.
- Import adds the JSON as a **new version** (5 MB max); export / reset act on the active version.
- Undo history is per session and resets when switching versions. Rapid edits within 600 ms are
  grouped into one undo step only when they touch the same thing (`changeKey` in `store.ts`: a
  profile / theme field, one section, the sections order).
- Loading reads each version on its own; a bad one goes to quarantine with a banner, the others load.
  Nothing is written until something changes, so a fallback never overwrites stored data.
- Several tabs: a save first checks `codacv.library.rev`; `storage` events warn the other tabs. A
  stale tab stops saving and offers "Recharger" or "Garder cet onglet" (StorageBanner).
- A render error shows the ErrorBoundary screen; the crashed tree never commits, so nothing is saved.

## Layout model (`src/layout.ts`)

- `sections` array order **is** the reading order and the PDF text order.
- Each section has `place`: `row` (new full-width row) · `column` (new column to the right) ·
  `stack` (under the previous section, same column); `colWidth` (fraction) on a column's first section.
- `buildRows()` derives rows/columns for rendering; `normalizeLayout()` cleans flags
  (a single-column row is always plain `row`s).
- `place` is relative to the previous section, so **never filter or reorder `sections` by hand**:
  a `column` section after a removed row start would join the previous row. Use `removeSection`,
  `reorderSections` (side-panel list: the moved section becomes a full-width row), `moveSection`.
- Header style `sidebar`: sections with `sidebar ?? (kind is list | levels | facts)` render in the
  coloured column, in array order. Choosing the style does **not** reorder the array: the main
  column is `mainLayout()` (full layout minus sidebar sections), so switching styles back and forth
  keeps the layout. Only an on-page section drag in sidebar mode (`moveSectionAnywhere()`) rebuilds
  the array as main column first, then sidebar sections as plain rows.
- In a multi-column row the last section of each column grows to fill the column height.

## PDF / ATS rules (learned by testing — do not regress)

Printing is Chrome's own print (`window.print()`), so the PDF mirrors the DOM paint order. Checked
with **pypdf** (stream order, like most ATS / LLM loaders) and **pdfminer** (layout analysis).

1. **No `position: relative/absolute` inside the resume.** Chrome paints (and writes to the PDF)
   positioned elements last, which detached every bullet from its job. Use grid/flex, margins,
   and background gradients (the timeline line + dots are backgrounds).
2. **No `opacity` on text** (also paints last). Use a mixed colour instead.
3. **Static fonts only** (`@fontsource/*`, not `@fontsource-variable/*`): variable fonts are embedded
   as Type 3 fonts, which older parsers read badly. Ligatures are disabled.
4. **Hidden separators** (chips comma, key-figures comma, contacts comma) must be transparent and zero-width but
   **not clipped**: `overflow: hidden` / fully clipped text is dropped from the PDF. Prefer visible
   separators when possible ("Anglais — C1" uses a visible dash because an invisible one overlapped
   the next glyph for one reader).
5. **Keep related text close on the same line** (e.g. level name + level text) or layout readers
   split them into separate blocks.
6. **Letter-spacing** splits words in extraction: keep it ≤ ~0.05em (small-caps titles use 0.045em).
7. **No text in images that should not be read**: initials are drawn to a PNG on a canvas — SVG
   `<text>` stays real PDF text.
8. **Never wrap e-mails / contacts** (a wrapped address is not detected) — sidebar contacts use `nowrap`.
9. **No `role="button"` on content elements**: it flattens headings/lists in the tagged PDF.
10. `<html lang>` follows `meta.locale` → PDF `/Lang`. The `<h1>` holds the **name only**; the job
    title is an inline `<em>` after it with a real space (inline elements, so no "NameTitle").
11. Band / sidebar bleed to the paper edge via per-style `@page` rules in `App.tsx`
    (`margin: my 0`, `:first { margin-top: 0 }`); negative margins at the top of a page are
    truncated by Chrome, and `@page` backgrounds are not painted.
12. Known limit: layout-analysis readers (pdfminer) still separate the left date column and
    side-by-side columns; the "Dates à droite" entry style is the most ATS-friendly.

## UI conventions and decisions

- Sidebar tabs: **Contenu** (personal info, sections), **Apparence** (palettes, styles, typography,
  layout, photo, export), **Versions**. Switching to Apparence / Versions clears the page selection;
  back to Contenu restores it. Clicking the page switches to Contenu.
- On-page overlay shows only the tools for what is under the pointer: item grip over an item; section
  outline + grip + column divider over a section title / its empty space; margin guides only when
  hovering that page edge. Hover stays "sticky" in a small band so grips stay reachable.
- Keyboard alternative to the on-page handles: each section card has "Placement sur la page"
  (row / column / under the previous section, `setPlacement`) and, for a column's first section,
  "Largeur de la colonne" (`setColumnWidth`). Page margins are sliders in Apparence. The overlay is
  `aria-hidden` and its grips are `tabIndex={-1}` (mouse only).
- Keyboard on the preview: Tab stops on the header and sections; arrow keys move through every
  clickable entry / item (`clickable()` in ResumeDocument). Side-panel tabs follow the WAI tabs
  pattern (one tab stop, arrows / Home / End).
- Selected section = dashed frame around the whole `<section>` (not the title). The overlay's hover
  frame steps aside when the section is selected.
- Removed on purpose (don't bring back unless asked): the "Page web" / `#/view` interactive page and
  per-item "Détails", per-section spacing, the one-column layout option, sidebar Position select.
- 12 curated palettes, each accent ≥ 5.3:1 contrast on white (WCAG AA), text ≥ 13:1.
- Markdown (`inlineMd` / `blockMd` in `utils.ts`): DOMPurify with a tag / attribute allow-list (no
  `style`, `class`, `id`, forms or media; images only in free-text sections). Markdown headings start
  at H3 so the tagged PDF keeps one H1 (name) and H2 section titles.

## Gotchas hit while developing

- **Vite watcher on Windows misses `sed -i` edits** (sed replaces the file). The dev server then
  serves stale modules (seen as `X is not defined` for a newly imported symbol). Edit files with
  normal writes, or restart the dev server.
- Multi-file edits produce transient HMR errors in the console; reload before judging.
- Headless Edge (`--headless=new`) hung on reload / second navigation when the Versions tab was the
  remembered tab; a normal browser tab is fine. Treat as a harness quirk, verify in a real tab.
- The browser preview pane is shared with the user: they often edit while an agent tests. Don't
  rely on synthetic hover there, and undo any test change made to their data.

## Testing approach used (scripts were not committed)

- Print: headless Edge via the DevTools protocol, `Page.printToPDF` with `preferCSSPageSize`,
  `printBackground`, `generateTaggedPDF` — same output as Chrome's "Save as PDF". Set test data by
  writing `codacv.library.v1` (or importing modules like `/src/utils.ts` in the dev server) before printing.
- Check: Python venv with `pypdf` + `pdfminer.six`; assert reading order of key strings, fonts are
  `Type0`, structure tags (H1/H2/L/LI), links, no stray text. Run Python with `-I` on downloaded files.
- Overlay / hover: real mouse events through CDP `Input.dispatchMouseEvent` in headless.

## Working agreements with the repo owner

- The GitHub repo is **public** and must stay anonymous: the example CV is fictional (example.com
  links, phone in the French fiction range). The owner's real CV lives only in their browser
  storage and must never be committed or written into the repo (or into this file).
- Commit after each completed change (attribution trailer as configured); **ask before every push**.
- Keep the owner's data safe: no destructive storage changes without migration, and keep backups.
- Communicate in English; the app UI stays French.

## Open ideas / not done

- Netlify hosting works as a static site (`npm run build`, publish `dist`); a `netlify.toml` and a
  way to publish one's own CV (deploy-only `resume.json`, git-ignored) were proposed, not built.
- Sidebar style is tuned for one page; on page 2 the column sits inside the page margins.
- No automated test suite; the PDF checks above would be a good first one.
