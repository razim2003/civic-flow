# Merge chunk PDFs, stamp header/footer, locate headings for the TOC and add bookmarks.
import json, sys, re, pymupdf
m = json.load(open(sys.argv[1], encoding='utf-8'))
doc = pymupdf.open()
for f in m['files']:
    doc.insert_pdf(pymupdf.open(f))
N = doc.page_count - 1  # cover is not numbered
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
texts = [norm(p.get_text()) for p in doc]
first_body = next(i for i, t in enumerate(texts) if 'Introduction and Problem Domain' in t and 'Table of contents' not in t and 'List of' not in t and '1.1' in t and i > 3)
def find(needle):
    n = norm(needle)
    for i in range(first_body, len(texts)):
        if n in texts[i]: return i
    return None
pages = {}
for e in m['toc']:
    i = find(f"{e['num']} {e['text']}"[:60]) or find(e['text'][:40])
    pages[e['id']] = i
for f in m['figures'] + m['tables']:
    pages[f['label']] = find(f['label'] + ':')
missing = [k for k, v in pages.items() if v is None]
if missing: print('not found:', missing)
json.dump(pages, open('out/pages.json', 'w'))
grey = (0.48, 0.52, 0.5)
for i, p in enumerate(doc):
    if i == 0: continue
    w, h = p.rect.width, p.rect.height
    mx = 57 if w < h else 51
    p.insert_text((mx, 34), 'CivicFlow – Public Service Complaint & Resolution System', fontsize=7.5, fontname='helv', color=grey)
    t = 'ICT2232 · Group 15'; p.insert_text((w - mx - pymupdf.get_text_length(t, 'helv', 7.5), 34), t, fontsize=7.5, fontname='helv', color=grey)
    p.draw_line((mx, 39), (w - mx, 39), color=(0.85, 0.87, 0.86), width=0.6)
    p.insert_text((mx, h - 26), 'Final project report', fontsize=8, fontname='helv', color=grey)
    t = f'Page {i} of {N}'; p.insert_text((w - mx - pymupdf.get_text_length(t, 'helv', 8), h - 26), t, fontsize=8, fontname='helv', color=grey)
outline = [[1, 'Cover', 1], [1, 'Declaration', 2], [1, 'Executive summary', 3], [1, 'Table of contents', 4]]
for e in m['toc']:
    if pages.get(e['id']) is not None: outline.append([e['level'], f"{e['num']} {e['text']}", pages[e['id']] + 1])
doc.set_toc(outline)
doc.set_metadata({'title': 'CivicFlow – Public Service Complaint & Resolution System: Final Project Report', 'author': 'Group 15 – ICT2232 Software Engineering', 'subject': 'SDLC project report', 'keywords': 'CivicFlow, SDLC, Scrum, UML, Supabase'})
doc.save(m['output'], garbage=3, deflate=True)
print('merged', doc.page_count, 'pages ->', m['output'])
