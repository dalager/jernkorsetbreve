"""Extract text content from each page of the presentation PDF.

Usage:
    python scripts/extract-pdf-text.py

Extracts all text from docs/background/Powerpoint_presentation_about_letters.pdf
and saves per-page text to data/images/pdf-presentation/page-texts.json.
"""

import fitz  # PyMuPDF
import json
from pathlib import Path

PDF_PATH = Path("docs/background/Powerpoint_presentation_about_letters.pdf")
OUTPUT_PATH = Path("data/images/pdf-presentation/page-texts.json")


def extract_text():
    doc = fitz.open(str(PDF_PATH))
    pages = []

    print(f"Opened PDF: {len(doc)} pages")

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()

        pages.append({
            "page": page_num + 1,
            "text": text,
            "char_count": len(text),
            "has_content": len(text) > 10
        })

        # Show preview (ascii-safe for Windows console)
        preview = text[:80].replace("\n", " ").encode("ascii", "replace").decode() if text else "(empty)"
        print(f"  Page {page_num+1:3d}: {len(text):5d} chars | {preview}")

    doc.close()

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(pages, f, indent=2, ensure_ascii=False)

    content_pages = sum(1 for p in pages if p["has_content"])
    print(f"\nDone: {len(pages)} pages, {content_pages} with text content")
    print(f"Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    extract_text()
