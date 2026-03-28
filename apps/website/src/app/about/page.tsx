import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Om projektet -- Jernkorset Breve",
  description: "Bag brevsamlingen fra Peter Maersk, 1911-1918.",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-4xl text-ink mb-6">Om Jernkorset.dk</h1>

      <div className="bg-cream rounded-lg border border-faded/20 shadow-letter p-6 sm:p-8">
        <div className="font-body text-ink text-lg leading-relaxed space-y-4">
          <p>
            Denne brevsamling består af ca. 665 breve fra perioden 1911
            til 1918, primært fra men også til Peter Mærsk,
            der under første verdenskrig kæmpede på tysk
            side som en del af det danske mindretal i Sønderjylland.
          </p>

          <p>
            Brevene giver et sjældent indblik i hverdagen for en dansk
            soldat i den tyske hær. De spænder fra kærlige
            breve til Trine Mærsk før krigen, over frontbreve
            fra Østfronten og Vestfronten, til de sidste breve kort
            før våbenstilstanden i november 1918.
          </p>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Historisk kontekst
          </h2>

          <p>
            Sønderjylland var under tysk styre fra 1864 til 1920.
            Under første verdenskrig blev ca. 30.000 dansksindede
            sønderjyder indkaldt til den tyske hær. Omkring 5.000
            faldt i krigen. Peter Mærsk overlevede og vendte hjem til
            et Sønderjylland der efter folkeafstemningen i 1920 blev
            genforenet med Danmark. Titlen "Jernkorset" refererer til
            den tyske militære udmærkelse.
          </p>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Bag jernkorset.dk
          </h2>

          <p>
            Jernkorset.dk er bare det foreløbige seneste stop på
            et længere familieprojekt.
          </p>

          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Peter Mærsk skrev brevene.</li>
            <li>
              Else Mærsk, Peters datter, skrev dem ind på maskine
              i 1990'erne.
            </li>
            <li>
              Jørgen Dalager, gift med Aase Mærsk Berthelsen,
              Peters barnebarn, har scannet og indsamlet materiale rundt om
              brevsamlingen.
            </li>
            <li>
              Christian Dalager, søn af Jørgen og Aase, har
              skruet nærværende website sammen. Kan kontaktes
              på{" "}
              <a
                href="mailto:christian@dalager.com"
                className="text-wax-red hover:underline"
              >
                christian@dalager.com
              </a>
            </li>
          </ul>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Sprogteknologi og data
          </h2>

          <p>
            Brevene er skrevet på dansk anno 1911-1918 med en
            retskrivning der kan være svær at læse i dag.
            Websitet bruger AI-baseret sprogteknologi til at
            gøre samlingen mere tilgængelig:
          </p>

          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>Semantisk søgning</strong> &mdash; Alle 665 breve
              er indekseret med en multilingual embedding model
              (multilingual-e5-small, 384 dimensioner), så man kan søge
              på semantisk nærhed fremfor blot nøgleord.
            </li>
            <li>
              <strong>Stemningsanalyse</strong> &mdash; Hvert brev er
              analyseret med en sentiment analysis teknik, der er beskrevet i et paper om  {" "}
              <a
                href="https://arxiv.org/abs/2508.14620"
                target="_blank"
                rel="noopener noreferrer"
                className="text-wax-red hover:underline"
              >
                Concept Vector Projection
              </a>{" "}
              (CVP), fra Aarhus Universitet, der giver kontinuerlige
              sentiment scores baseret på semantiske embeddings.
              Metoden er udviklet specifikt til historiske og
              litterære tekster og klarer sig bedre end
              traditionelle dictionary-baserede værktøjer på ældre
              dansk.
            </li>
            <li>
              <strong>Emne-grupper og relaterede breve</strong> &mdash;
              Brevene er grupperet i klynger i emner og forbundet via
              lighed, så man kan udforske tematiske
              sammenhænge på tværs af samlingen.
            </li>
            <li>
              <strong>Data om krigens slag</strong> &mdash; Historiske slag er
              korreleret med brevenes datering og afsendelsessted,
              så man kan undersøge om der er korrelationer mellem krigsbegivenheder og brevenes indhold.
            </li>
          </ul>

          <p>
            Hele datasættet &mdash; breve, indlejringer,
            stemninger, emner og steddata &mdash; genereres fra
            kildefilerne via en automatiseret datapipeline og
            eksporteres som statiske JSON-filer, der indlæses
            direkte i browseren uden behov for en server.
          </p>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Udforsk samlingen
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <Link
              href="/timeline/"
              className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
            >
              <p className="font-display text-lg text-ink">Tidslinje</p>
              <p className="text-faded text-sm font-ui">
                Brevene plottet kronologisk med historiske begivenheder
              </p>
            </Link>
            <Link
              href="/map/"
              className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
            >
              <p className="font-display text-lg text-ink">Kort</p>
              <p className="text-faded text-sm font-ui">
                Se hvor brevene blev skrevet fra
              </p>
            </Link>
            <Link
              href="/statistics/"
              className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
            >
              <p className="font-display text-lg text-ink">Statistik</p>
              <p className="text-faded text-sm font-ui">
                Tal og analyser af brevsamlingen
              </p>
            </Link>
            <Link
              href="/search/"
              className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
            >
              <p className="font-display text-lg text-ink">Søg</p>
              <p className="text-faded text-sm font-ui">
                Søg på tværs af alle breve
              </p>
            </Link>
          </div>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Kildekode
          </h2>

          <p>
            Koden til dette projekt er open source og tilgængelig på{" "}
            <a
              href="https://github.com/dalager/jernkorsetbreve"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wax-red hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
