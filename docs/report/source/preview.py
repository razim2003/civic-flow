import sys, pymupdf
from PIL import Image
doc = pymupdf.open(sys.argv[1]); out = sys.argv[2]; start = int(sys.argv[3]); end = min(int(sys.argv[4]), doc.page_count)
ims = []
for i in range(start - 1, end):
    pix = doc[i].get_pixmap(dpi=int(sys.argv[5]) if len(sys.argv) > 5 else 45)
    ims.append(Image.frombytes('RGB', (pix.width, pix.height), pix.samples))
cols = 4 if len(ims) > 1 else 1
w = max(i.width for i in ims); h = max(i.height for i in ims); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8), rows * (h + 8)), '#777')
for k, im in enumerate(ims): sheet.paste(im, ((k % cols) * (w + 8), (k // cols) * (h + 8)))
sheet.save(out); print(doc.page_count, 'pages')
