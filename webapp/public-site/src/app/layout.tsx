import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Jernkorset Breve -- En brevsamling fra 1911-1918",
  description:
    "666 breve fra Peter Maersk, en dansker der kaempede paa tysk side under Forste Verdenskrig. Brevsamlingen daekker perioden 1911 til 1918.",
  openGraph: {
    title: "Jernkorset Breve",
    description: "En brevsamling fra 1911-1918",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="antialiased min-h-screen flex flex-col bg-parchment text-ink font-body">
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
