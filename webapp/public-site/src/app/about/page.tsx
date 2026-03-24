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
            Denne brevsamling best&aring;r af ca. 665 breve fra perioden 1911
            til 1918, prim&aelig;rt fra men ogs&aring; til Peter M&aelig;rsk,
            der under f&oslash;rste verdenskrig k&aelig;mpede p&aring; tysk
            side som en del af det danske mindretal i S&oslash;nderjylland.
          </p>

          <p>
            Brevene giver et sj&aelig;ldent indblik i hverdagen for en dansk
            soldat i den tyske h&aelig;r. De sp&aelig;nder fra k&aelig;rlige
            breve til Trine M&aelig;rsk f&oslash;r krigen, over frontbreve
            fra &Oslash;stfronten og Vestfronten, til de sidste breve kort
            f&oslash;r v&aring;benstilstanden i november 1918.
          </p>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Historisk kontekst
          </h2>

          <p>
            S&oslash;nderjylland var under tysk styre fra 1864 til 1920.
            Under f&oslash;rste verdenskrig blev ca. 30.000 dansksindede
            s&oslash;nderjyder indkaldt til den tyske h&aelig;r. Omkring 5.000
            faldt i krigen. Peter M&aelig;rsk overlevede og vendte hjem til
            et S&oslash;nderjylland der efter folkeafstemningen i 1920 blev
            genforenet med Danmark. Titlen &quot;Jernkorset&quot; refererer til
            den tyske milit&aelig;re udm&aelig;rkelse.
          </p>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Bag jernkorset.dk
          </h2>

          <p>
            Jernkorset.dk er bare det forel&oslash;bige seneste stop p&aring;
            et l&aelig;ngere familieprojekt.
          </p>

          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>Peter M&aelig;rsk skrev brevene.</li>
            <li>
              Else M&aelig;rsk, Peters datter, skrev dem ind p&aring; maskine
              i 1990&apos;erne.
            </li>
            <li>
              J&oslash;rgen Dalager, gift med Aase M&aelig;rsk Berthelsen,
              Peters barnebarn, har scannet og indsamlet materiale rundt om
              brevsamlingen.
            </li>
            <li>
              Christian Dalager, s&oslash;n af J&oslash;rgen og Aase, har
              skruet n&aelig;rv&aelig;rende website sammen. Kan kontaktes
              p&aring;{" "}
              <a
                href="mailto:christian@dalager.com"
                className="text-wax-red hover:underline"
              >
                christian@dalager.com
              </a>
            </li>
          </ul>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            Teknologi
          </h2>

          <p>
            Denne side k&oslash;rer udelukkende i din browser &mdash; ingen
            server er n&oslash;dvendig. Alle 665 breve er inkluderet som
            statiske data, og s&oslash;gning og analyser sker lokalt p&aring;
            din enhed.
          </p>

          <p>
            Sitet er bygget med{" "}
            <a
              href="https://nextjs.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-wax-red hover:underline"
            >
              Next.js
            </a>{" "}
            og eksporteret som en statisk side. Sentimentanalyse af brevene er
            foretaget med b&aring;de AFINN- og Sentida-ordb&oslash;ger, og
            stednavne er fundet via Named Entity Recognition.
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
              <p className="font-display text-lg text-ink">S&oslash;g</p>
              <p className="text-faded text-sm font-ui">
                S&oslash;g p&aring; tv&aelig;rs af alle breve
              </p>
            </Link>
          </div>

          <h2 className="font-display text-2xl text-ink mt-8 mb-4">
            K&aelig;ldekode
          </h2>

          <p>
            Koden til dette projekt er open source og tilg&aelig;ngelig p&aring;{" "}
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
