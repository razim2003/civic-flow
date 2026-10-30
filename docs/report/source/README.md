# Project report generator

Builds `../CivicFlow_Group15_Project_Report.pdf` and `.docx` from one content model (`content.mjs`).
Long tables (requirements, backlog, user stories, RTM, test cases, defects, threats, controls) are read directly
from `docs/sdlc/*.md`, so the report stays consistent with the SDLC evidence pack.

| File | Purpose |
| --- | --- |
| `content.mjs` | Report text and structure (chapters follow guideline §16) |
| `diagrams.mjs`, `custom.mjs` | Diagram sources: Mermaid (class, ER, sequence, state, architecture…) and hand-drawn SVG (use case, swimlane activity, deployment, wireframes, charts) |
| `render-diagrams.mjs` | Renders every diagram to `fig/*.png` with headless Microsoft Edge |
| `crop-screens.py` | Crops `docs/sdlc/screens` and composes phone views from `assets/` |
| `build-pdf.mjs` + `merge.py` | Print HTML → PDF per portrait/landscape run, merged with page headers, footers, TOC page numbers and bookmarks (PyMuPDF) |
| `build-docx.mjs` | Editable Word version with real headings, TOC / figure / table fields and landscape sections |
| `preview.py` | Contact sheet of PDF pages for visual review |

Requirements: Node.js ≥ 22.18 with the app's dependencies installed (`npm ci` in the repository root, for Playwright),
Microsoft Edge, Python 3 with Pillow and PyMuPDF, and `npm ci` in this folder.

```bash
npm run build            # or step by step:
node render-diagrams.mjs
python crop-screens.py
node build-pdf.mjs
node build-docx.mjs
cp out/CivicFlow_Group15_Project_Report.* ..
```

After editing `content.mjs` or the SDLC documents, rebuild and re-check the pages (`python preview.py out/CivicFlow_Group15_Project_Report.pdf pages.png 1 12`).
When the lecturer's change request (CR-005) arrives, replace the "Lecturer change request" callout in Chapter 12 with its analysis.
