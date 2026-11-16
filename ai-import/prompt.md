# Prompt: convert an existing CV to CodaCV

Give an AI assistant (ChatGPT, Claude, Gemini, Le Chat...) three things:

1. your current CV (PDF, Word file, text, or a LinkedIn profile export),
2. the file [`resume-template.json`](resume-template.json),
3. the prompt below, copied as it is.

Save the JSON it answers with as a file (for example `my-cv.json`), then open
[cv.cfaz.dev](https://cv.cfaz.dev) and click **Import**: your CV is added as a new version. Read
it through, then choose the palette, styles and layout in the app.

Your CV contains personal data: check the AI service's privacy terms before sending it.

---

````text
Convert the attached CV into a JSON file for the CodaCV resume editor.

Use the attached resume-template.json as the model: same structure, same field names, same
allowed values. Every value written as <...> in the template is a placeholder that shows what goes
there. Replace each one with the matching content from my CV, or remove it.

CONTENT
- Copy the content faithfully. Do not invent, embellish, summarise, translate or reorder facts.
  Keep my wording and the language the CV is written in. Fix nothing but obvious typos.
- Leave out any section, entry, contact, item or field that my CV has nothing for. No placeholder
  text may remain in the answer: nothing between < and >.
- Keep the order of my CV: sections in the order they appear, entries in the same order
  (usually most recent first).
- If a piece of content fits no section kind, use a "text" section rather than dropping it.

FIELDS
- meta.locale: the language of the CV, one of "fr", "en" (US), "en-GB", "de", "es", "it", "nl",
  "pl", "pt-PT", "pt-BR". Use "en" for English unless the CV is clearly British.
- meta.fileName: "Firstname-Lastname-CV" (or "-Resume"), ASCII letters, digits and dashes only.
- profile.name: full name. profile.title: the job title in the CV header, or "".
- profile.summary: the profile / about paragraph, or "". profile.photo stays "" (photos are added in
  the app). profile.summaryIcon stays "none".
- profile.contacts: one per contact line. "label" is the text as shown on the CV.
  "url" is the full link (https://...) for web addresses, and "" for e-mail addresses and phone
  numbers (the app links those itself). Write the label of a profile link so it reads on its own,
  e.g. "linkedin.com/in/your-name", not just "your-name".
  "icon" is one of: none, link, globe, mail, at, phone, smartphone, pin, house, linkedin, github, x,
  youtube, message, briefcase, code, gamepad, user, calendar, car, languages, graduation, award,
  star, heart.
- Section "title": the heading used in the CV, in its language.

SECTION KINDS ("kind")
- "timeline": dated entries (jobs, internships, projects, education, volunteering).
  For a job: "title" = company or organisation, "subtitle" = job title.
  For education: "title" = degree, "subtitle" = school.
  For a project: "title" = project name, "subtitle" = context (client, employer, team).
  "description": the text under the entry, as Markdown in one string. Each bullet point is a
  line starting with "- " (lines separated by \n in the JSON string); plain sentences are lines
  without "- ".
  Keep the CV's form: bullets stay bullets, a paragraph stays a paragraph. Use "" when there is
  no description.
  "location": city (or city, region). "country": two-letter code for a flag, only one of
  fr ca us gb be ch de es it nl se fi pl ie pt jp kr cn au sg ro ua ma; otherwise "".
  "subDate": a duration written in the CV ("6 months"), otherwise "".
  "url": a link given for that entry, otherwise "".
- "list": simple items (skills, tools, certifications, interests). "display" is "bullets" (one per
  line), "inline" (short items on one line, e.g. tools or interests) or "chips".
- "levels": items with a level, mostly languages ("C1", "Native", "Fluent") or rated skills.
  "level" is the level as written in the CV. "rating": 1 to 5 when the CV shows a scale or the
  level clearly maps to one (Native / C2 = 5, C1 = 4, B2 = 3, B1 = 2, A2 or below = 1), otherwise 0.
  "meter": "dots" if the CV shows dots, stars or bars, otherwise "none".
- "facts": short "key: value" lines (driving licence, availability, nationality, work permit).
- "text": free text in Markdown (paragraphs, **bold**, *italic*, [links](https://...), "- " lists).
- "references": named references. If the CV only says references are available on request, use
  "onRequest": true, "onRequestText": that sentence, and "items": [].
- "highlights": only if the CV itself puts forward 2 to 4 key figures (e.g. "10 years",
  "1 M users"). Never derive or invent figures.

DATES
- The dates in the template only show the format: take every date from my CV.
- "start" and "end" are written YYYY/MM/DD. Month and year only: use day 01 ("2021/03/01").
  Year only: use "YYYY/01/01". Unknown: "".
- An ongoing entry ("present", "today", "now", "en cours"...) has "current": true and "end": "".
- A single date (e.g. a graduation year): put it in "start" and leave "end" "".
- theme.dateFormat: "year" if the CV gives years only, "month-short" if it gives months,
  "full" if it gives exact days.

FORMAT
- Do not add "id", "hidden", "visible", "place", "colWidth" or any other theme field: the app fills
  them in and the layout is arranged in the app.
- Markdown (**bold**, *italic*, [text](url)) is allowed in the summary, entry descriptions, list
  items and text sections. Keep it only where the CV itself uses emphasis or links.
- Answer with the complete JSON in a single ```json code block: valid JSON, double quotes, no
  comments, no trailing commas. If you can create files, also give it as a downloadable .json file.
- After the code block, list in a few short lines anything you left out, could not read, or were
  unsure about (dates, levels, section kinds).
````
