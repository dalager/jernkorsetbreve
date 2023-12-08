import json
from MLStripper import strip_tags
from datetime import datetime
import csv
from ebooklib import epub
import pandas as pd
import locale

locale.setlocale(locale.LC_TIME, "da_DK")


def load_csv():
    letters = pd.read_csv("data/letters.csv", encoding="utf-8")
    letters["date"] = pd.to_datetime(letters["date"])
    letters["date_str"] = letters["date"].apply(
        lambda d: d.strftime("%A %d. %b %Y").capitalize()
    )
    # datestr as string
    letters["date_str"] = letters["date_str"].astype(str)
    letters["place"] = letters["place"].astype(str)
    letters["sender"] = letters["sender"].astype(str)
    letters["recipient"] = letters["recipient"].astype(str)
    letters["text"] = letters["text"].astype(str)

    # sort by date
    letters = letters.sort_values(by=["date"])

    return letters


def create_epub(letters, filename="jernkorset.epub"):
    book = epub.EpubBook()
    # set metadata
    # book.set_identifier("Jernkorset2023-11-19")
    book.set_identifier(filename)
    book.set_title(filename)
    book.set_language("da")
    book.add_author("Jørgen Dalager")
    book.add_author("Christian Dalager")
    chaps = []

    c1 = epub.EpubHtml(title="Introduktion", file_name="intro.xhtml", lang="da")
    c1.content = "<html><head></head><body><h1>Jernkorset</h1><p>Denne brevsamling består af 666 breve fra perioden 1911 til 1918, primært fra men også til Peter Mærsk, der under første verdenskrig kæmpede på tysk side som en del af det danske mindretal i sønderjylland.</p></body></html>"
    book.add_item(c1)

    for i, letter in letters.iterrows():
        heading = str(letter["date_str"] + " - " + letter["place"])
        c = epub.EpubHtml(title=heading, file_name=f"chap_{i+1}.xhtml")

        html = f"<h1>{letter['date_str']} ({letter['id']})</h1>"
        html = html + f"<h2>{letter['place']}</h2>"
        html = html + f'<p>{letter["sender"]} &rarr; {letter["recipient"]}</p>'
        html = html + "".join([f"<p>{p}</p>" for p in letter["text"].split("<PARA>")])

        c.content = html
        book.add_item(c)
        chaps.append(c)

    book.toc = (
        epub.Link("intro.xhtml", "Introduktion", "intro"),
        (epub.Section("Brevene"), (tuple(chaps))),
    )

    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    style = "BODY {color: white;}"
    nav_css = epub.EpubItem(
        uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style
    )

    # add CSS file
    book.add_item(nav_css)

    # basic spine
    book.spine = ["nav", c1] + chaps

    epub.write_epub(f"exports/{filename}", book, {})


if __name__ == "__main__":
    letters = load_csv()

    create_epub(letters)
