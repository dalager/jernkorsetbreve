"""Extract embedded images from the presentation PDF and generate a manifest.

Usage:
    python scripts/extract-pdf-images.py

Extracts all embedded images from docs/background/Powerpoint_presentation_about_letters.pdf,
filters out small decorative elements, and saves to data/images/pdf-presentation/uncategorized/.
Generates a manifest.json catalog of all extracted images.
"""

import fitz  # PyMuPDF
import json
from pathlib import Path

PDF_PATH = Path("docs/background/Powerpoint_presentation_about_letters.pdf")
OUTPUT_DIR = Path("data/images/pdf-presentation/uncategorized")
MANIFEST_PATH = Path("data/images/pdf-presentation/manifest.json")

MIN_WIDTH = 100
MIN_HEIGHT = 100
MIN_BYTES = 5000


def extract_images():
    doc = fitz.open(str(PDF_PATH))
    manifest = []
    skipped = []
    seen_xrefs = set()

    print(f"Opened PDF: {len(doc)} pages")

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text().strip()
        images = page.get_images(full=True)

        for img_idx, img_info in enumerate(images):
            xref = img_info[0]

            # Skip duplicate images (same xref = same embedded object)
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            try:
                pix = fitz.Pixmap(doc, xref)
            except Exception as e:
                print(f"  Page {page_num+1}: Failed to extract xref {xref}: {e}")
                continue

            # Convert CMYK to RGB if needed
            if pix.n - pix.alpha > 3:
                pix = fitz.Pixmap(fitz.csRGB, pix)

            # Filter small/decorative images
            if pix.width < MIN_WIDTH or pix.height < MIN_HEIGHT:
                skipped.append({
                    "page": page_num + 1,
                    "xref": xref,
                    "width": pix.width,
                    "height": pix.height,
                    "reason": "too_small"
                })
                continue

            raw_bytes = pix.tobytes("png")
            if len(raw_bytes) < MIN_BYTES:
                skipped.append({
                    "page": page_num + 1,
                    "xref": xref,
                    "width": pix.width,
                    "height": pix.height,
                    "reason": "too_few_bytes"
                })
                continue

            filename = f"page{page_num+1:03d}_{img_idx+1:02d}.png"
            output_path = OUTPUT_DIR / filename
            pix.save(str(output_path))

            manifest.append({
                "filename": filename,
                "page": page_num + 1,
                "xref": xref,
                "page_text": page_text[:500] if page_text else "",
                "width": pix.width,
                "height": pix.height,
                "size_bytes": len(raw_bytes),
                "category": "uncategorized",
                "persons": [],
                "places": [],
                "description": "",
                "date_estimate": "",
                "source_note": "Else Gad Mærsk presentation"
            })

            print(f"  Page {page_num+1}: {filename} ({pix.width}x{pix.height}, {len(raw_bytes)//1024}KB)")

    doc.close()

    # Save manifest
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # Save skipped log
    skipped_path = Path("data/images/pdf-presentation/skipped.json")
    with open(skipped_path, "w", encoding="utf-8") as f:
        json.dump(skipped, f, indent=2, ensure_ascii=False)

    print(f"\nDone: {len(manifest)} images extracted, {len(skipped)} skipped")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Skipped log: {skipped_path}")


if __name__ == "__main__":
    extract_images()
