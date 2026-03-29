import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchPreloader from "@/components/SearchPreloader";

export const metadata: Metadata = {
  title: "Jernkorset Breve -- En brevsamling fra 1911-1918",
  description:
    "666 breve fra Peter Mærsk, en dansker, der kæmpede på tysk side under Første Verdenskrig. Brevsamlingen dækker perioden 1911 til 1918.",
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
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://huggingface.co"
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://huggingface.co" />
        <meta name="build-version" content={process.env.NEXT_PUBLIC_GIT_SHA || "dev"} />
        <meta name="build-date" content={process.env.NEXT_PUBLIC_BUILD_DATE || "dev"} />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-parchment text-ink font-body">
        <Header />
        <SearchPreloader />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
