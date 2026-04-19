import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om projektet -- Jernkorset Breve",
  description: "Bag brevsamlingen fra Peter Mærsk, 1911-1918.",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-4xl text-ink mb-6">Om Jernkorset.dk</h1>

      <div className="bg-cream rounded-lg border border-faded/20 shadow-letter p-6 sm:p-8">
        <div className="font-body text-ink text-lg leading-relaxed space-y-4">
          <p>
            Jernkorset.dk er bare det foreløbige seneste stop på
            et længere familieprojekt.
          </p>

          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Peter Mærsk skrev brevene.</li>
            <li>
              Else Mærsk, Peters datter, skrev dem ind på maskine
              i 1990&rsquo;erne.
            </li>
            <li>
              Jørgen Dalager, gift med Aase Mærsk Berthelsen,
              Peters barnebarn, har scannet og indsamlet materiale rundt om
              brevsamlingen.
            </li>
            <li>
              Jeg, Christian Dalager, søn af Jørgen og Aase, har
              bygget jernkorset.dk. <br />
              Hvis du har feedback eller bruger jernkorset til et eller andet vil jeg meget gerne høre fra dig. Fang mig på 
              på{" "}
              <a
                href="mailto:christian@dalager.com"
                className="text-wax-red hover:underline"
              >
                christian@dalager.com
              </a> eller på LinkedIn: <a
                href="https://www.linkedin.com/in/dalager/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-wax-red hover:underline"
              >
                linkedin.com/in/dalager
              </a>
            </li>
          </ul>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Sprogteknologi og data
          </h2>

          <p>
            Brevene er skrevet på dansk anno 1911–1918 med en
            retskrivning der kan være svær at læse i dag.
            Websitet bruger AI-baseret sprogteknologi til at
            gøre samlingen mere tilgængelig:
          </p>

          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>Semantisk søgning</strong> — Alle 665 breve
              er indekseret med en multilingual embedding model
              (multilingual-e5-small, 384 dimensioner), så man kan søge
              på semantisk nærhed fremfor blot nøgleord.
            </li>
            <li>
              <strong>Stemningsanalyse</strong> — Hvert brev er
              analyseret med en sentimentanalyseteknik beskrevet i et paper om{" "}
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
              <strong>Emne-grupper og relaterede breve</strong> —
              Brevene er grupperet i emneklynger og forbundet via
              lighed, så man kan udforske tematiske
              sammenhænge på tværs af samlingen.
            </li>
            <li>
              <strong>Sproganalyse</strong> — Psykolingvistiske
              mål som ordlængde, sætningskompleksitet og
              pronomenfordeling afdækker hvordan krigens pres
              forandrede Peters skriftsprog over tid.
            </li>
            <li>
              <strong>Data om krigens slag</strong> — Historiske slag er
              korreleret med brevenes datering og afsendelsessted,
              så man kan undersøge om der er korrelationer mellem
              krigsbegivenheder og brevenes indhold.
            </li>
          </ul>

          <p>
            Hele datasættet — breve, indlejringer,
            stemninger, emner og steddata — genereres fra
            kildefilerne via en automatiseret datapipeline og
            eksporteres som statiske JSON-filer, der indlæses
            direkte i browseren uden behov for en server.
          </p>

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
