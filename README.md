# CodaCV

A resume builder: edit everything in a side panel, see a live A4 preview, publish an
interactive web version, and print a pixel-accurate PDF.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Features

- **Editor (Éditer)** – profile, photo, contacts, and any number of sections:
  - *Chronologie* (timeline: experience, projects, education…) with date, sub-date, flag, city, title, subtitle, link, bullets
  - *Liste* (languages, skills…)
  - *Texte libre* (free markdown text)
  - Drag and drop (grip handle ⋮⋮) to reorder sections, entries, list items and contacts —
    also with the keyboard: focus the grip, Space, arrows, Space. Hide / duplicate / delete.
  - Theme: accent & text colors, font, size, density, date-column width, margins, photo shape & size.
- **Layout on the page** (edit mode, hover the preview):
  - section grip → drop it on a new row, in a new column (left/right edge of a section) or under
    another section in a multi-column row; the blue line shows where it lands
  - entry / list-item grip → reorder, also into another section of the same kind
  - divider between columns → resize (snaps to the date column, ¼ ⅓ ½ ⅔ ¾)
  - bar above a section → its spacing; page edges → page margins
  - Ctrl+Z undoes any drop.
  - Model (`src/layout.ts`): sections keep one ordered list = reading / PDF order, each with a
    `place` (`row` | `column` | `stack`), a column width and a spacing.
- **Click to edit** – click anything on the preview to jump to its fields.
- **Page web** – interactive mode: clicking an entry opens a details panel (bullets + the
  markdown *Détails* field, which never appears in the PDF). `#/view` opens it standalone
  (also the ↗ button in the toolbar).
- **PDF** – the *PDF* button (or Ctrl+P) prints only the resume, A4, with the theme margins and the
  configured file name. In the print dialog choose *Save as PDF* and untick *Headers and footers*.
- **Icons** – every contact (and the summary line) has an icon picker; e-mail and phone links
  (`mailto:` / `tel:`) are created automatically from the text.
- Data is auto-saved in the browser (localStorage). Use **Exporter / Importer** (JSON) for backups,
  versioning, or moving between browsers. Undo / redo with Ctrl+Z / Ctrl+Y.

## Recruiter tools (ATS) & AI agents

The exported PDF is built to be machine-readable:

- Real, selectable text in embedded TrueType fonts (static fonts on purpose: Chrome embeds
  *variable* fonts as Type 3 fonts, which some parsers handle poorly). No ligatures.
- Text is written in reading order: no positioned elements inside the resume (Chrome writes
  positioned elements to the PDF last, which detaches bullets from their job). Keep it that way
  when editing `resume.css`.
- Tagged PDF: `H1` name, `H2` section titles, `L`/`LI` lists, `/Lang` from the page language,
  clickable links (site, LinkedIn, mailto:, tel:, project links).
- Layout *Une colonne* (Mise en page & style → Disposition) is the safest option: it also keeps
  dates next to their entry for layout-analysis parsers (e.g. pdfminer), which split the
  two-column date gutter into separate blocks. With the current content, use density
  *Compacte* to keep it on one page.

Tip: icons are not text, so write contact labels that make sense alone
(e.g. `linkedin.com/in/your-name` rather than just `your-name`).

## Project layout

```
src/
  types.ts               resume data model
  defaultResume.ts       seed resume (fictional example)
  store.ts               state, localStorage persistence, undo/redo
  components/
    ResumeDocument.tsx   the resume itself (shared by preview, web page and print)
    DetailsDrawer.tsx    web-page details panel
    editor/              options panel
  styles/                app UI, resume, and print styles
```
