import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-faded/30 bg-parchment-dark mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-display text-lg text-ink">Jernkorset.dk</p>
            <p className="text-faded text-sm font-ui">
              En brevsamling fra 1911&ndash;1918
            </p>
          </div>
          <nav className="flex gap-4 text-sm font-ui">
            <Link
              href="/about/"
              className="text-faded hover:text-ink transition-colors"
            >
              Om projektet
            </Link>
            <a
              href="mailto:christian@dalager.com"
              className="text-faded hover:text-ink transition-colors"
            >
              Kontakt
            </a>
          </nav>
        </div>
        <div className="mt-6 pt-4 border-t border-faded/20 text-center">
          <p className="text-faded text-xs font-ui">
            Breve af Peter Maersk &middot; Indskrevet af Else Maersk &middot;
            Digitaliseret af Jorgen Dalager &middot; Website af Christian Dalager
          </p>
        </div>
      </div>
    </footer>
  );
}
