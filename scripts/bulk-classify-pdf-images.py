"""Bulk classification of remaining uncategorized PDF images.

Based on visual inspection and page text context, applies manual classifications
to all 97 remaining uncategorized images in one pass.

Usage:
    python scripts/bulk-classify-pdf-images.py
"""

import json
from pathlib import Path

MANIFEST_PATH = Path("data/images/pdf-presentation/manifest.json")

# Manual classifications based on visual review and page text context
# Format: filename -> (category, persons, places, description)
CLASSIFICATIONS = {
    # Page 2: Danish songbook cover (Dansk Sangbog)
    "page002_03.png": ("document", [], [], "Dansk Sangbog cover with afterword about banned songs"),
    # Page 5: Sheet music (Unge Genbyrds Liv i Norden)
    "page005_02.png": ("document", [], [], "Sheet music: Unge Genbyrds Liv i Norden, No. 279"),
    # Page 6: Afghanistan poll comparison (not directly relevant)
    "page006_02.png": ("skip", [], [], "Modern poll about Danish soldiers in Afghanistan - not relevant"),
    # Page 7: WW1 mobilization statistics table
    "page007_02.png": ("document", [], [], "WW1 mobilization and death statistics table by country"),
    # Page 8: Physical letter binders organized by year (1911-1918)
    "page008_02.png": ("document", ["peter", "trine"], [], "Physical letter binders organized by year 1911-1918, with framed photo"),
    # Page 10: Photo of Jes and Maren Mærsk (parents)
    "page010_02.png": ("portrait", ["far", "mor"], ["oester_aabolling"], "Maren og Jes Mærsk, Peter's parents"),
    # Page 14: Gad family group photo 1904 with Uffe Gad labeled
    "page014_04.png": ("group", ["peter_andreas_gad", "uffe"], [], "Peter og Ane Elisabeth Gad med børn 1904, Uffe Gad marked"),
    # Page 17: Historical map of Kongeåen border area
    "page017_02.png": ("map", [], ["kongeaaen"], "Historical map of Kongeåen border area near Ribe"),
    # Page 19: Extraordinært Hjemstedsbevis (residency certificate) 1872
    "page019_02.png": ("document", [], [], "Extraordinært Hjemstedsbevis for Frederik Vilhelm Henningsen, Ribe 1872"),
    # Page 39: Musketier Märsk name plate/label from IR 147
    "page039_02.png": ("document", ["peter"], ["loetzen"], "Musketier Märsk nameplate, 12. Komp. 2. Masurisches Inf.-Regt. 147"),
    # Page 41: Map of Østpreussen with Masuriske Søer
    "page041_02.png": ("map", [], ["loetzen", "arys", "lyk"], "Map of Østpreussen showing Masuriske Søer, infrastructure"),
    # Page 45: Peter and Trine together, Påsken 1914
    "page045_02.png": ("portrait", ["peter", "trine"], [], "Peter and Trine together, Påsken 1914"),
    # Page 46: Military group photo (soldiers seated and standing)
    "page046_02.png": ("group", ["peter"], ["loetzen"], "Military group photo, Løtzen ca. 1914, Peter indicated with arrow"),
    # Page 48: Song from Danish Sangbog (Det danske Folk i Amerika)
    "page048_02.png": ("document", [], [], "Song page from Sangbog: Så langt, så langt / Det danske Folk i Amerika"),
    # Page 49: Map of Østpreussen showing Løtzen, Arys, Lyck
    "page049_02.png": ("map", [], ["loetzen", "arys", "lyk"], "Map of Østpreussen with Løtzen, Arys, Lyck marked"),
    # Page 50: Photo of Archduke Franz Ferdinand and family
    "page050_02.png": ("historical", [], [], "Archduke Franz Ferdinand and family, assassination context 28 June 1914"),
    # Page 53: Historical diplomatic photo
    "page053_02.png": ("historical", [], [], "Diplomatic/political photo, July 1914 crisis context"),
    # Page 55: Tsar Nicholas II and Kaiser Wilhelm II portraits
    "page055_02.png": ("historical", [], [], "Tsar Nikolaj d. 2. and Kejser Wilhelm d. 2."),
    # Page 57: Detailed map of Masuriske Søer region
    "page057_02.png": ("map", [], ["loetzen", "arys", "lyk"], "Detailed map: Løtzen, Arys, Lyk, Johannisburg, Bialla, Masuriske Søer"),
    # Page 60: Model/illustration of Feste Boyen fortress
    "page060_02.png": ("military", [], ["loetzen"], "Model der Feste Boyen, Løtzen fortress"),
    # Page 61: Map of Masuriske Søer
    "page061_02.png": ("map", [], ["loetzen"], "Simple map of Masuriske Søer area"),
    # Page 65: Military scene photo
    "page065_02.png": ("military", ["peter"], [], "War scene, 25 August 1914, first combat"),
    # Page 66: Tannenberg/Willenberg photo
    "page066_02.png": ("military", ["peter"], [], "Tannenberg area, Willenberg 3 Sept 1914"),
    # Page 72: Movement/timeline map
    "page072_02.png": ("map", ["peter"], [], "Peter's movement timeline map Sep-Dec 1914"),
    # Page 73: War scene or landscape (possibly as mother should see)
    "page073_02.png": ("military", [], [], "War scene, 'Som mor derhjemme gerne skulle tro det var'"),
    # Page 76: Newspaper clipping 'Fra Felten' (From the Field)
    "page076_02.png": ("document", ["peter"], [], "Newspaper 'Fra Felten. Efterretninger fra Nordslesvigere' with Peter's letter, Nov 1914"),
    # Page 76: Newspaper clipping continuation
    "page076_03.png": ("document", ["peter"], [], "Newspaper clipping continuation, P. Mærsk signature visible"),
    # Page 79: Peter and Konow portrait together
    "page079_02.png": ("portrait", ["peter", "konow"], [], "Peter og Konow, formal military portrait"),
    # Page 84: War scene landscape
    "page084_02.png": ("military", [], [], "Eastern front landscape/war scene"),
    # Page 86: Europe map Nov 30 1914 with Peter's position marked
    "page086_02.png": ("map", ["peter"], [], "Europe map 30 Nov 1914, PM position marked"),
    # Page 94: Lazarethtog illustration
    "page094_02.png": ("document", [], [], "Hospital train (Lazarethtog) illustration"),
    # Page 97: Peter Mærsk portrait, hospital/recovery period
    "page097_02.png": ("group", ["peter"], [], "Hospital group photo, Peter Mærsk marked with X, Halle 1915"),
    # Page 100: Propaganda images
    "page100_02.png": ("historical", [], [], "Propaganda images showing idealized war conditions"),
    # Page 105: Map showing travel route
    "page105_02.png": ("map", ["peter"], ["braunsberg"], "Travel route map, Braunsberg period"),
    # Page 113: Map Eastern front movements
    "page113_02.png": ("map", ["peter"], ["arys", "braunsberg"], "Eastern front movement map with Peter's locations"),
    # Page 115: Map of Stettin-Danzig-Königsberg area
    "page115_02.png": ("map", [], ["braunsberg"], "Map of Pomerania/East Prussia: Stettin, Danzig, Königsberg area"),
    # Page 117: Portrait photo (Smil, du er på...)
    "page117_02.png": ("portrait", ["peter"], [], "Peter portrait photo, captioned 'Smil, du er på...'"),
    # Page 119: War scene Sep 1915
    "page119_02.png": ("military", ["peter"], [], "Eastern front scene, 23 Sep 1915"),
    # Page 124: War scene/landscape
    "page124_02.png": ("military", [], [], "Eastern front war scene"),
    # Page 126: Map showing Dünaburg, Letland, Litauen
    "page126_02.png": ("map", [], [], "Map: Dünaburg area, Latvia/Lithuania/Belarus border"),
    # Page 127: War scene/landscape
    "page127_02.png": ("military", [], [], "Eastern front landscape"),
    # Page 129: Drawing/photo of Villa Vinterhistorie (bunker)
    "page129_02.png": ("place", ["peter"], [], "Villa Vinterhistorie, jordhytte/bunker illustration"),
    # Page 130: War scene/landscape
    "page130_02.png": ("military", [], [], "Eastern front landscape, winter 1915"),
    # Page 134: Trine portrait
    "page134_02.png": ("portrait", ["trine"], [], "Trine portrait, ca. 1915"),
    # Page 135: Christmas scene, Eastern front
    "page135_02.png": ("place", ["peter"], [], "Christmas at the front, Dec 1915"),
    # Page 137: War scene
    "page137_02.png": ("military", [], [], "Eastern front, early 1916"),
    # Page 138: War scene
    "page138_02.png": ("military", [], [], "Eastern front scene, 1916"),
    # Page 142: War scene
    "page142_02.png": ("military", [], [], "Eastern front scene, spring 1916"),
    # Page 145: Jordhytte with birch fence
    "page145_02.png": ("place", ["peter"], [], "Jordhytte med Hegn af hvide Birkestammer, Eastern front"),
    # Page 149: War scene
    "page149_02.png": ("military", [], [], "Eastern front scene, 1916"),
    # Page 150: War scene
    "page150_02.png": ("military", [], [], "Eastern front scene, 1916"),
    # Page 151: Photo with PM marked
    "page151_02.png": ("group", ["peter"], [], "Group/scene photo with Peter marked (PM)"),
    # Page 154: War scene
    "page154_02.png": ("military", [], [], "Eastern front scene, summer 1916"),
    # Page 155: Military scene with placard
    "page155_02.png": ("military", [], [], "Scene with placard about not shooting, May 1916"),
    # Page 156: War landscape
    "page156_02.png": ("military", [], [], "Eastern front landscape, 1916"),
    # Page 157: War landscape
    "page157_02.png": ("military", [], [], "Eastern front landscape, 1916"),
    # Page 160: War landscape
    "page160_02.png": ("military", [], [], "Eastern front landscape, summer 1916"),
    # Page 162: House/place photo
    "page162_02.png": ("place", [], [], "House or building, Eastern front, summer 1916"),
    # Page 169: Travel/route map
    "page169_02.png": ("map", ["peter"], [], "Travel route map, leave/orlov Sep 1916"),
    # Page 171: Scene photo
    "page171_02.png": ("military", [], [], "Eastern front scene, autumn 1916"),
    # Page 178: Route map east-to-west front
    "page178_02.png": ("map", ["peter"], [], "Route map: Dünaburg-Bromberg-Hannover-Mühlhausen, Dec 1916 transfer to Western front"),
    # Page 182: Comparison photo (2008 vs 1917)
    "page182_02.png": ("place", [], [], "Location comparison photo 2008 vs 1917"),
    # Page 184: Map/annotated page about Feldbach/Feldburg
    "page184_02.png": ("document", ["peter"], [], "Annotated map/letter about Feldbach/Feldburg, Jan 1917"),
    # Page 186: Military scene, Halle
    "page186_02.png": ("military", ["peter"], [], "Scene from Halle period, Jan 1917"),
    # Page 187: Route map with dates
    "page187_02.png": ("map", ["peter"], [], "Detailed route map with dates, Jan 1917 leave"),
    # Page 189: Scene
    "page189_02.png": ("military", [], [], "Western front scene, early 1917"),
    # Page 190: Route map with film/book delivery notes
    "page190_02.png": ("map", ["peter"], [], "Route map: München Gladbach, Frankfurt, orlov Feb-Mar 1917"),
    # Page 193: Scene photo
    "page193_02.png": ("military", [], [], "Western front scene, 1917"),
    # Page 195: Scene photo
    "page195_02.png": ("military", [], [], "Western front scene, 1917"),
    # Page 196: Landscape photo, route through Alsace
    "page196_02.png": ("place", ["peter"], ["laon"], "Landscape, route through Mühlhausen-Colmar-Strassburg to Laon, May 1917"),
    # Page 197: Photo with PM marked
    "page197_02.png": ("portrait", ["peter"], [], "Peter portrait, Western front 1917"),
    # Page 203: Agricultural scene (harvesting with Selvbinder)
    "page203_02.png": ("place", ["peter"], [], "Harvesting Byg with Selvbinder, July 1917"),
    # Page 204: Scene photo
    "page204_02.png": ("military", [], [], "Western front scene, 1917"),
    # Page 205: Scene photo
    "page205_02.png": ("military", [], [], "Western front scene, 1917"),
    # Page 208: Scene or portrait
    "page208_02.png": ("military", [], [], "Western front scene, autumn 1917"),
    # Page 212: Letter or document
    "page212_02.png": ("document", ["peter"], [], "Letter or document, autumn 1917"),
    # Page 215: Photo of Cessieres area
    "page215_02.png": ("place", ["peter"], ["cessieres"], "Cessieres area photo, 1917"),
    # Page 216: Three photos (640x480 each) - personal photos from front
    "page216_02.png": ("place", [], [], "Photo from Viviase area, Christmas 1917"),
    "page216_03.png": ("place", [], [], "Photo from Viviase area, Christmas 1917"),
    "page216_04.png": ("place", [], [], "Photo from Viviase area, Christmas 1917"),
    # Page 220: Scene photo
    "page220_02.png": ("military", [], [], "Western front scene, late 1917"),
    # Page 222: Photo of Monktbernut
    "page222_02.png": ("place", ["peter"], [], "Monktbernut - En by som jeg hver dag kommer igennem"),
    # Page 223: Christmas dinner table, Viviase
    "page223_02.png": ("group", ["peter"], ["viviase"], "Julebordet i Viviase for Staben, Dec 24 1917, Peter's seat marked"),
    # Page 225: Route/timeline map
    "page225_02.png": ("map", ["peter"], [], "Route/timeline map, orlov Feb 1918"),
    # Page 227: Photo with Uffe, svoger Peter at Grandlup
    "page227_02.png": ("group", ["peter", "uffe"], ["grandlup"], "Grandlup La Neuville, Uffe svoger and Peter together"),
    # Page 228: Group photo with named people
    "page228_02.png": ("group", ["peter", "walter", "henningsen"], [], "Vilh. J., Emil B., Walter H., Peter - group photo"),
    # Page 231: Route/timeline map
    "page231_02.png": ("map", ["peter"], [], "Route map with dates, Feb 1918"),
    # Page 232: Hindenburg and Ludendorff portraits
    "page232_02.png": ("historical", [], [], "Paul von Hindenburg og Erich von Ludendorff"),
    # Page 238: Beerbohm funeral photo
    "page238_02.png": ("group", ["peter", "major_beerbohm"], [], "Hans Beerbohm bæres af hans 8 Meldere fra Staben, funeral March 1918"),
    # Page 239: Map of Peter's area March-April 1918
    "page239_02.png": ("map", ["peter"], [], "Map of Peter's area, marts-april 1918"),
    # Page 242: Photo with Peter's own caption about Spa headquarters
    "page242_02.png": ("place", ["peter"], [], "Hovedkvarteret i Spa, Peter visited twice"),
    # Page 243: Scene/landscape
    "page243_02.png": ("place", ["peter"], [], "Noyon-Ham area, April 1918"),
    # Page 248: War scene
    "page248_02.png": ("military", [], [], "Western front scene, spring 1918"),
    # Page 251: War scene
    "page251_02.png": ("military", [], [], "Western front scene, 1918"),
    # Page 254: Photo of Hartennes
    "page254_02.png": ("place", ["peter"], [], "Hartennes, juni 1918"),
    # Page 255: Movement timeline map June-July 1918
    "page255_02.png": ("map", ["peter"], [], "Movement timeline map 1 June - 15 July 1918"),
    # Page 260: Scene photo from Vauxtin area
    "page260_02.png": ("place", ["peter"], [], "Vauxtin/Vauxere area, June 1918"),
    # Page 262: 'De Flyvende Hollændere' ved Staben group
    "page262_02.png": ("group", ["peter"], [], "De Flyvende Hollændere ved Staben, Chacrise 13 June 1918, Peter marked"),
    # Page 265: Mishandled graves photo
    "page265_02.png": ("military", [], [], "Mishandlede Grave af Engelskmanden i Nehls (Nesle) fra 1914"),
    # Page 268: Scene photo
    "page268_02.png": ("military", [], [], "Western front scene, summer 1918"),
    # Page 270: Peter with bicycle at Argonneskoven
    "page270_02.png": ("portrait", ["peter"], [], "Peter with bicycle at Noddertra Fermen near Argonneskoven, Aug 1918"),
    # Page 274: Last letter from Western front context
    "page274_02.png": ("document", ["peter"], [], "Sidste brev fra Vestfronten, related document/image"),
    # Page 281: Post-war scene
    "page281_02.png": ("place", [], ["baekgaarden"], "Bækgaarden, Fyn - post-war"),
    # Page 282: Post-war scene
    "page282_02.png": ("place", [], [], "Post-war scene"),
    # Page 283: Post-war scene
    "page283_02.png": ("place", [], [], "Post-war photo"),
    # Page 284: Post-war scene
    "page284_02.png": ("place", [], [], "Post-war photo"),
    # Page 285: Post-war scene
    "page285_02.png": ("group", ["peter", "trine"], [], "Post-war family photo"),
    # Page 286: Document/large image
    "page286_02.png": ("document", [], [], "Post-war document or detailed image"),
    # Page 292: Place photo (Villerselve Saint du Nord)
    "page292_02.png": ("place", [], [], "Villerselve Saint du Nord"),
}


def apply_classifications():
    manifest = json.load(open(MANIFEST_PATH, encoding="utf-8"))

    classified = 0
    not_found = []

    for entry in manifest:
        if entry["filename"] in CLASSIFICATIONS:
            cat, persons, places, desc = CLASSIFICATIONS[entry["filename"]]
            entry["category"] = cat
            if persons:
                entry["persons"] = persons
            if places:
                entry["places"] = places
            entry["description"] = desc
            classified += 1

    # Save
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # Stats
    from collections import Counter
    cats = Counter(e["category"] for e in manifest)

    print(f"Bulk classified: {classified} images")
    print(f"\nFinal statistics:")
    print("-" * 40)
    for cat in ["portrait", "group", "place", "map", "document", "historical", "military", "skip", "uncategorized"]:
        count = cats.get(cat, 0)
        if count:
            print(f"  {cat:15s}: {count:3d}")
    print("-" * 40)
    print(f"  {'total':15s}: {len(manifest):3d}")

    remaining = cats.get("uncategorized", 0)
    if remaining:
        print(f"\nStill uncategorized: {remaining}")
        for e in manifest:
            if e["category"] == "uncategorized":
                print(f"  {e['filename']}")


if __name__ == "__main__":
    apply_classifications()
