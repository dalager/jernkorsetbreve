import pandas as pd
import dacy
import re


def initialize_dacy():
    """Initialize DaCy"""
    nlp = dacy.load("large")
    return nlp


def extract_sentences(text, nlp):
    """Extract sentences from text"""
    doc = nlp(text)
    return list(doc.sents)


def extract_from_letters(
    nlp, letterpath="data/letters.csv", savepath="data/sentences.csv", limit=None
):
    """Extract sentences from letters and save to file"""

    df = pd.read_csv(letterpath)
    sentences = []
    for index, row in df.iterrows():
        if limit and index > limit:
            break
        letter_id = row["id"]
        text = row["text"]
        # remove <PARA> markers
        text = re.sub(
            r"(\w+)<PARA>", r"\1. ", text
        )  # add period after word to separate sentences
        text = re.sub(r"<PARA>\s*<PARA>", r" ", text)
        text = re.sub(r"<PARA>", r" ", text)
        text = re.sub(r"\s+", r" ", text)

        sents = extract_sentences(text, nlp)
        # remove leading non-word characters
        sents = [re.sub(r"^\W+", r"", s.text) for s in sents]

        # remove empty sentences
        sents = [s for s in sents if s.strip() != ""]

        for i, sent in enumerate(sents):
            sentences.append(
                {
                    "letter_id": letter_id,
                    "sentence": sent.strip(),
                    "letter_sentence_index": i,
                }
            )

    df_sentences = pd.DataFrame(sentences)
    df_sentences["id"] = df_sentences.index
    df_sentences.set_index("id", inplace=True)
    df_sentences.to_csv(savepath)


if __name__ == "__main__":
    nlp = initialize_dacy()
    # ca 35 minutter på laptop
    extract_from_letters(nlp, "data/letters.csv", "data/sentences.csv", limit=None)
