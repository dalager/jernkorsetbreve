from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

app = FastAPI()

# Allow CORS from all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# create function to load letters from csv file
def load_csv():

    letters = pd.read_csv("../../data/letters.csv", encoding="utf-8")
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

    # replace <PARA> with newline
    letters["text"] = letters["text"].str.replace("<PARA>", "\n\n")

    letterobjs = []
    for i, letter in letters.iterrows():
        letterobj = {
            "id": letter["id"],
            "date": letter["date"].strftime("%A %d. %b %Y").capitalize(),
            "place": letter["place"],
            "sender": letter["sender"],
            "recipient": letter["recipient"],
            "text": letter["text"],
        }
        letterobjs.append(letterobj)

    return letterobjs


letters = load_csv()


def get_letter(letter_id: int):
    return letters[letter_id - 1]


@app.get("/")
async def root():
    return letters


@app.get("/letters")
async def read_letters():
    # map to date, place and sender
    list = [
        {
            "id": letter["id"],
            "date": letter["date"],
            "place": letter["place"],
            "sender": letter["sender"],
            "recipient": letter["recipient"],
        }
        for letter in letters
    ]
    return list


@app.post("/proofread/{letter_id}")
async def proofread_letter(letter_id: int):
    from modernizer import modernize

    print("proofreading letter", letter_id)
    letter = get_letter(letter_id)
    modernized_text, tps = modernize(letter["text"])
    result = {"text": modernized_text, "tps": tps}
    return result


@app.get("/letters/{letter_id}")
async def read_letter(letter_id: int):
    return letters[letter_id - 1]
