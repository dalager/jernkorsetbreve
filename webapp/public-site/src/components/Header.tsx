import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-gray-800 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold">
            Jernkorset
          </Link>
          <nav>
            <ul className="flex space-x-6">
              <li>
                <Link
                  href="/"
                  className="hover:text-gray-300 transition-colors"
                >
                  Hjem
                </Link>
              </li>
              <li>
                <Link
                  href="/about/"
                  className="hover:text-gray-300 transition-colors"
                >
                  Om
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
