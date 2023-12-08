import datetime
import ebooklib
from ebooklib import epub
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from bs4 import BeautifulSoup
import pandas as pd
import create_epub
from reportlab.lib.units import cm

PAGE_HEIGHT = A4[1]
PAGE_WIDTH = A4[0]

# Path to your EPUB file and output PDF file
pdf_path = "exports/jernkorset.pdf"

Title = "Jernkorset - Breve fra 1911-1918"
pageinfo = "Jernkorset - Breve fra 1911-1918"


def firstPageLayout(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawCentredString(PAGE_WIDTH / 2.0, PAGE_HEIGHT - 108, Title)
    canvas.setFont("Helvetica", 9)
    # Timestamp

    now = datetime.datetime.now()
    canvas.drawCentredString(
        PAGE_WIDTH / 2.0, PAGE_HEIGHT - 120, "Genereret " + str(now)
    )
    # canvas.drawString(cm, 0.75 * cm, "First Page / %s" % pageinfo)
    canvas.restoreState()


def normalPageLayout(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(
        PAGE_WIDTH / 2, 0.75 * cm, "Side %d / %s" % (doc.page, pageinfo)
    )
    canvas.restoreState()


def create_pdf(pdf_path, paragraph_spacing=12):
    # Load the EPUB file
    letters = create_epub.load_csv()

    # Create a PDF document using SimpleDocTemplate
    pdf_doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    story = []  # List to hold the flowables

    # Get the default style sheet
    styles = getSampleStyleSheet()
    style = styles["Normal"]  # Basic paragraph style

    story.append(PageBreak())

    # Process each item in the EPUB
    for i, letter in letters.iterrows():
        text = letter["text"]
        story.append(
            Paragraph(f"{letter['date_str']} ({letter.id})", styles["Heading1"])
        )
        story.append(Paragraph(letter["place"], styles["Heading2"]))
        fromto = f"{letter['sender']} → {letter['recipient']}"
        story.append(Paragraph(fromto, styles["Heading3"]))

        for paragraph in text.split("<PARA>"):
            if paragraph.strip():  # Add non-empty paragraphs
                story.append(Paragraph(paragraph, style))
                story.append(Spacer(1, paragraph_spacing))

        story.append(PageBreak())

    # Build the PDF
    pdf_doc.build(story, onFirstPage=firstPageLayout, onLaterPages=normalPageLayout)


if __name__ == "__main__":
    create_pdf(pdf_path)
