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


def load_places():
    places = pd.read_csv("../data/places_cleanup.csv", encoding="utf-8")
    placedict = {}
    for i, place in places.iterrows():
        placeobj = {
            "id": place["place_id"],
            "name": place["name"],
            "geometry": place["geometry"],
            # "country": place["country"],
        }
        placedict[place["place_id"]] = placeobj
    print(placedict)
    return placedict


# create function to load letters from csv file
def load_csv():

    letters = pd.read_csv("../data/placed_letters.csv", encoding="utf-8")

    places = load_places()
    letters["date"] = pd.to_datetime(letters["date"])
    letters["date_str"] = letters["date"].apply(
        lambda d: d.strftime("%A %d. %b %Y").capitalize()
    )
    # datestr as string
    letters["date_str"] = letters["date_str"].astype(str)

    # letters["place"] = places[letters["place_id"]].apply(
    #     lambda x: x["name"] if x is not None else None
    # )
    letters["sender"] = letters["sender"].astype(str)
    letters["recipient"] = letters["recipient"].astype(str)
    letters["text"] = letters["text"].astype(str)

    # replace <PARA> with newline
    letters["text"] = letters["text"].str.replace("<PARA>", "\n\n")

    letterobjs = []
    for i, letter in letters.iterrows():
        place_name = None
        if pd.notna(letter["place_id"]) and letter["place_id"] in places:
            place_name = places[letter["place_id"]]["name"]
        letterobj = {
            "id": letter["id"],
            "date": letter["date"],
            "place": place_name,
            "sender": letter["sender"],
            "recipient": letter["recipient"],
            "text": letter["text"],
        }
        letterobjs.append(letterobj)

    return letterobjs, places


letters, places = load_csv()


def get_letter(letter_id: int):
    return letters[letter_id - 1]


@app.get("/")
async def root():
    return letters


@app.get("/places")
async def read_places():
    # Count occurrences of each place
    return places


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
