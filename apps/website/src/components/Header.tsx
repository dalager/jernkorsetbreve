"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchBox from "@/components/SearchBox";

interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Breve", href: "/breve/" },
  { label: "Søg", href: "/search/" },
  { label: "Tidslinje", href: "/timeline/" },
  { label: "Kort", href: "/map/" },
  { label: "Steder", href: "/steder/" },
  { label: "Personer", href: "/personer/" },
  { label: "Billeder", href: "/billeder/" },
  {
    label: "Analyser",
    href: "#",
    children: [
      { label: "Statistik", href: "/statistics/" },
      { label: "Stemning", href: "/sentiment/" },
      { label: "Sprog", href: "/sproganalyse/" },
      { label: "Udforsk", href: "/explorer/" },
      { label: "Netværk", href: "/network/" },
    ],
  },
  { label: "Om", href: "/about/" },
];

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isChildActive = (item: NavItem) =>
    item.children?.some((child) =>
      pathname?.startsWith(child.href.replace(/\/$/, ""))
    );

  return (
    <header
      className="border-b border-faded/30 sticky top-0 z-50 shadow-sm"
      style={{ backgroundColor: "#FFFEF8" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Site Title */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl" role="img" aria-label="Iron Cross">
               ✠
            </span>
            <div className="flex flex-col">
              <span className="font-display text-xl text-ink group-hover:text-wax-red transition-colors">
                Jernkorset
              </span>
              <span className="text-xs text-faded font-ui -mt-1 hidden sm:block">
                Breve fra Første Verdenskrig
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              if (item.children) {
                const active = isChildActive(item);
                return (
                  <div key={item.label} className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm font-ui transition-colors inline-flex items-center gap-1",
                        active
                          ? "bg-parchment text-ink font-medium"
                          : "text-faded hover:text-ink hover:bg-parchment/50"
                      )}
                    >
                      {item.label}
                      <svg className={cn("w-3.5 h-3.5 transition-transform", dropdownOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {dropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 py-1 rounded-md shadow-lg border border-faded/20 min-w-[160px]" style={{ backgroundColor: "#FFFEF8" }}>
                        {item.children.map((child) => {
                          const childActive = pathname?.startsWith(child.href.replace(/\/$/, ""));
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setDropdownOpen(false)}
                              className={cn(
                                "block px-4 py-2 text-sm font-ui transition-colors",
                                childActive
                                  ? "bg-parchment text-ink font-medium"
                                  : "text-faded hover:text-ink hover:bg-parchment/50"
                              )}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive =
                item.href === "/"
                  ? pathname === "/" || pathname === ""
                  : pathname?.startsWith(item.href.replace(/\/$/, ""));
              return (
                <Link
                  key={item.href}
                  href={item.disabled ? "#" : item.href}
                  onClick={
                    item.disabled ? (e) => e.preventDefault() : undefined
                  }
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-ui transition-colors",
                    isActive
                      ? "bg-parchment text-ink font-medium"
                      : item.disabled
                        ? "text-faded/50 cursor-not-allowed"
                        : "text-faded hover:text-ink hover:bg-parchment/50"
                  )}
                  aria-disabled={item.disabled}
                  title={item.disabled ? "Kommer snart" : undefined}
                >
                  {item.label}
                  {item.disabled && (
                    <span className="ml-1 text-xs text-faded/50">(snart)</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Search Box */}
          <div className="hidden sm:flex items-center">
            <SearchBox />
          </div>

          {/* Mobile hamburger button */}
          <button
            className="md:hidden p-2 text-ink"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-faded/20 pt-2">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                if (item.children) {
                  return (
                    <div key={item.label}>
                      <span className="px-3 py-2 text-sm font-ui text-faded/70 font-medium block">
                        {item.label}
                      </span>
                      {item.children.map((child) => {
                        const childActive = pathname?.startsWith(child.href.replace(/\/$/, ""));
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "pl-6 pr-3 py-2 rounded-md text-sm font-ui transition-colors block",
                              childActive
                                ? "bg-parchment text-ink font-medium"
                                : "text-faded hover:text-ink hover:bg-parchment/50"
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname === ""
                    : pathname?.startsWith(item.href.replace(/\/$/, ""));
                return (
                  <Link
                    key={item.href}
                    href={item.disabled ? "#" : item.href}
                    onClick={(e) => {
                      if (item.disabled) {
                        e.preventDefault();
                      } else {
                        setMobileOpen(false);
                      }
                    }}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-ui transition-colors",
                      isActive
                        ? "bg-parchment text-ink font-medium"
                        : item.disabled
                          ? "text-faded/50"
                          : "text-faded hover:text-ink hover:bg-parchment/50"
                    )}
                  >
                    {item.label}
                    {item.disabled && (
                      <span className="ml-1 text-xs text-faded/50">
                        (snart)
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
