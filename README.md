# CodaCV

A resume builder: edit everything in a side panel, arrange the layout directly on a live A4
preview, and print a pixel-accurate, ATS-friendly PDF.

**Try it online: [cv.cfaz.dev](https://cv.cfaz.dev)**

## Use it online

CodaCV runs at **[cv.cfaz.dev](https://cv.cfaz.dev)**. Nothing to install and no account needed:
open the page and start editing the example resume, or import a JSON file you exported earlier.

- **Your data stays on your device.** The app is a static site with no backend: resumes and
  photos are saved in your browser's local storage and are never uploaded anywhere.
- **Storage is per browser.** A resume made in one browser (or a private window) does not show up
  in another. Use **Export** to keep a JSON backup or move your resumes to another computer, and
  **Import** to bring them back. Clearing the site data in your browser deletes them.
- **Best in Chrome or Edge** on a computer. The PDF is made by the browser's own print dialog
  (*Save as PDF*, *Headers and footers* unticked), and the ATS-friendly output was tuned on
  Chromium.
- The interface is in French or English (switch in the top bar); each resume has its own language
  for dates and the PDF.

## Run it locally

To work on the code or host your own copy:

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Features

- **Editor** – profile, photo, contacts, and any number of sections:
  - *Chronologie* (timeline: experience, projects, education…) with start / end dates (or ongoing), sub-date, flag, city, title, subtitle, link, and a Markdown description (lines starting with `- ` are bullet points)
  - *Liste* (languages, skills…) shown as bullets, inline tags (`C++ · Unity · Git`) or chips;
    pasting `A, B, C` into an item splits it into several items
  - *Texte libre* (free markdown text)
  - *Niveaux*: skills / languages with a level written as text ("Anglais — C1"), optional dots or bar
  - *Infos clés*: key / value facts ("Permis : B"), *Références* (or one "sur demande" line),
    *Chiffres clés*: 2–4 big figures in a row under the header
  - Any section title can be hidden
  - Drag and drop (grip handle ⋮⋮) to reorder sections, entries, list items and contacts —
    also with the keyboard: focus the grip, Space, arrows, Space. Hide / duplicate / delete.
  - Apparence: 12 curated palettes (or custom colours), header style (photo left / centered / colour band /
    sidebar), section titles (underline / small caps / left bar / icon), entries (dates left / dates right /
    timeline / cards), photo ring and initials, font, size, density, date column, margins.
  - Language and dates: each version has its own resume language (French, English US / UK, German,
    Spanish, Italian, Dutch, Polish, Portuguese PT / BR). Dates are written in that language with the
    chosen precision (year, numeric month, short or full month name, full date): "sept. 2022 -
    aujourd'hui", "Sep 2022 - Present", "Sept. 2022 - heute"…
- **Interface language** – French or English, switched in the top bar (remembered per browser).
- **Layout on the page** (edit mode, hover the preview):
  - section grip → drop it on a new row, in a new column (left/right edge of a section) or under
    another section in a multi-column row; the blue line shows where it lands
  - entry / list-item grip → reorder, also into another section of the same kind
  - divider between columns → resize (snaps to the date column, ¼ ⅓ ½ ⅔ ¾)
  - page edges → page margins
  - Ctrl+Z undoes any drop.
  - Model (`src/layout.ts`): sections keep one ordered list = reading / PDF order, each with a
    `place` (`row` | `column` | `stack`) and a column width.
- **Click to edit** – click anything on the preview to jump to its fields.
- **PDF** – the *PDF* button (or Ctrl+P) prints only the resume, A4, with the theme margins and the
  configured file name. In the print dialog choose *Save as PDF* and untick *Headers and footers*.
- **Icons** – every contact (and the summary line) has an icon picker; e-mail and phone links
  (`mailto:` / `tel:`) are created automatically from the text.
- **Versions** tab: several complete CVs (content, layout, style, language, PDF file name), e.g. one
  per language or per company. Duplicate, rename, reorder, delete; the top bar shows the active one.
- Data is auto-saved in the browser (localStorage). **Export** saves the active version as JSON,
  **Import** adds a JSON file as a new version. Dates in the JSON are always `YYYY/MM/DD`. Undo / redo with Ctrl+Z / Ctrl+Y.

## Recruiter tools (ATS) & AI agents

The exported PDF is built to be machine-readable:

- Real, selectable text in embedded TrueType fonts (static fonts on purpose: Chrome embeds
  *variable* fonts as Type 3 fonts, which some parsers handle poorly). No ligatures.
- Text is written in reading order: no positioned elements inside the resume (Chrome writes
  positioned elements to the PDF last, which detaches bullets from their job). Keep it that way
  when editing `resume.css`.
- Tagged PDF: `H1` name, `H2` section titles, `L`/`LI` lists, `/Lang` from the CV language,
  clickable links (site, LinkedIn, mailto:, tel:, project links).
- Known limit: parsers that rebuild the reading order from the page layout (e.g. pdfminer)
  treat the left date gutter and side-by-side columns as separate blocks, so dates can end up
  away from their entry. Stream-order readers (pypdf, most ATS and AI loaders) are unaffected.

Tip: icons are not text, so write contact labels that make sense alone
(e.g. `linkedin.com/in/your-name` rather than just `your-name`).

## Project layout

```
src/
  types.ts               resume data model
  defaultResume.ts       seed resume (fictional example)
  store.ts               state, localStorage persistence (safe across tabs), undo/redo
  migrate.ts             reads saved / imported JSON field by field (old formats, bad values)
  layout.ts              rows / columns / stacks; every change to the sections order goes through it
  components/
    ResumeDocument.tsx   the resume itself (shared by preview and print)
    LayoutOverlay.tsx    on-page layout handles (edit only, never printed)
    editor/              options panel
  styles/                app UI, resume, and print styles
```
