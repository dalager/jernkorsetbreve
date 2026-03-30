import Link from "next/link";
import { getLetterCount } from "@/lib/data";

export default function Home() {
  const letterCount = getLetterCount();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl sm:text-5xl text-ink mb-4">
          Jernkorset
        </h1>
        <p className="font-body text-xl text-faded leading-relaxed">
          En samling af {letterCount > 0 ? letterCount : "ca. 665"} breve fra
          perioden 1911–1918, primært fra Peter Mærsk, der under
          første verdenskrig kæmpede på tysk side som en del af det
          danske mindretal i Sønderjylland.
        </p>
      </div>

      {/* Featured entry point */}
      <Link
        href="/breve/"
        className="block p-6 mb-8 bg-cream rounded-lg border border-faded/20 shadow-letter hover:shadow-md transition-shadow text-center"
      >
        <p className="font-display text-2xl text-ink mb-1">Læs brevene</p>
        <p className="text-faded font-ui">
          Udforsk hele samlingen — filtrér på afsender, sted og dato
        </p>
      </Link>

      {/* Context */}
      <div className="bg-cream rounded-lg border border-faded/20 shadow-letter p-6 sm:p-8 mb-8">
        <div className="font-body text-ink text-lg leading-relaxed space-y-4">
          <p>
            Brevene giver et sjældent indblik i hverdagen for en dansk
            soldat i den tyske hær. De spænder fra kærlige breve
            til Trine Mærsk før krigen, over frontbreve
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
            et Sønderjylland, der efter folkeafstemningen i 1920 blev
            genforenet med Danmark. Titlen &ldquo;Jernkorset&rdquo; refererer til
            den tyske militære udmærkelse.
          </p>

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
              <strong>Semantisk søgning</strong> — Alle breve
              er indekseret med en multilingual embedding model, så man
              kan søge på semantisk nærhed fremfor blot nøgleord.
            </li>
            <li>
              <strong>Stemningsanalyse</strong> — Hvert brev er
              analyseret med{" "}
              <a
                href="https://arxiv.org/abs/2508.14620"
                target="_blank"
                rel="noopener noreferrer"
                className="text-wax-red hover:underline"
              >
                Concept Vector Projection
              </a>{" "}
              (CVP), en metode udviklet specifikt til historiske og
              litterære tekster.
            </li>
            <li>
              <strong>Emne-grupper og relaterede breve</strong> —
              Brevene er grupperet i emneklynger og forbundet via
              semantisk lighed.
            </li>
            <li>
              <strong>Sproganalyse</strong> — Psykolingvistiske
              mål afdækker hvordan krigens pres forandrede Peters
              skriftsprog over tid.
            </li>
          </ul>
        </div>
      </div>

      {/* Section links */}
      <h2 className="font-display text-2xl text-ink mb-4">
        Udforsk samlingen
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/breve/"
          className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
        >
          <p className="font-display text-lg text-ink">Alle breve</p>
          <p className="text-faded text-sm font-ui">
            Den komplette brevsamling med filtrering
          </p>
        </Link>
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
          href="/search/"
          className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
        >
          <p className="font-display text-lg text-ink">Søg</p>
          <p className="text-faded text-sm font-ui">
            Søg på tværs af alle breve
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
          href="/sentiment/"
          className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
        >
          <p className="font-display text-lg text-ink">Stemning</p>
          <p className="text-faded text-sm font-ui">
            Udforsk brevenes følelsesmæssige indhold
          </p>
        </Link>
        <Link
          href="/sproganalyse/"
          className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
        >
          <p className="font-display text-lg text-ink">Sproganalyse</p>
          <p className="text-faded text-sm font-ui">
            Hvordan krigen forandrede Peters skriftsprog
          </p>
        </Link>
        <Link
          href="/explorer/"
          className="block p-4 bg-parchment border border-faded/20 rounded-lg hover:bg-parchment-dark transition-colors"
        >
          <p className="font-display text-lg text-ink">Udforsk</p>
          <p className="text-faded text-sm font-ui">
            Brevene visualiseret i et vektorrum efter tematisk lighed
          </p>
        </Link>
      </div>
    </div>
  );
}
