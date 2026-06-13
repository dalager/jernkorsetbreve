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
      { label: "Ordrum", href: "/ordrum/" },
      { label: "Netværk", href: "/network/" },
    ],
  },
  { label: "Om", href: "/about/" },
];

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function isActive(pathname: string | null, itemHref: string): boolean {
  if (itemHref === "/") return pathname === "/" || pathname === "";
  return pathname?.startsWith(itemHref.replace(/\/$/, "")) ?? false;
}

function isParentActive(pathname: string | null, children: NavItem[]): boolean {
  return children.some((child) => isActive(pathname, child.href));
}

/* --- Desktop nav item (handles dropdown) --- */
function DesktopNavItem({
  item,
  pathname,
  dropdownRef,
  dropdownOpen,
  setDropdownOpen,
}: {
  item: NavItem;
  pathname: string | null;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
}) {
  if (item.children) {
    const active = isParentActive(pathname, item.children);
    return (
      <div key={item.label} className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          className={cn(
            "px-3 py-2 rounded-md text-sm font-ui transition-colors inline-flex items-center gap-1",
            active
              ? "bg-parchment text-ink font-medium"
              : "text-faded hover:text-ink hover:bg-parchment/50",
          )}
        >
          {item.label}
          <svg
            className={cn("w-3.5 h-3.5 transition-transform", dropdownOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 py-1 rounded-md shadow-lg border border-faded/20 min-w-[160px] bg-parchment-light">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setDropdownOpen(false)}
                className={cn(
                  "block px-4 py-2 text-sm font-ui transition-colors",
                  isActive(pathname, child.href)
                    ? "bg-parchment text-ink font-medium"
                    : "text-faded hover:text-ink hover:bg-parchment/50",
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      key={item.href}
      href={item.disabled ? "#" : item.href}
      onClick={item.disabled ? ((e: React.MouseEvent) => e.preventDefault()) : undefined}
      className={cn(
        "px-3 py-2 rounded-md text-sm font-ui transition-colors",
        isActive(pathname, item.href)
          ? "bg-parchment text-ink font-medium"
          : item.disabled
            ? "text-faded/50 cursor-not-allowed"
            : "text-faded hover:text-ink hover:bg-parchment/50",
      )}
      aria-disabled={item.disabled}
      title={item.disabled ? "Kommer snart" : undefined}
    >
      {item.label}
      {item.disabled && <span className="ml-1 text-xs text-faded/50">(snart)</span>}
    </Link>
  );
}

/* --- Mobile nav item --- */
function MobileNavItem({
  item,
  pathname,
  setMobileOpen,
}: {
  item: NavItem;
  pathname: string | null;
  setMobileOpen: (open: boolean) => void;
}) {
  if (item.children) {
    return (
      <div key={item.label}>
        <span className="px-3 py-2 text-sm font-ui text-faded/70 font-medium block">
          {item.label}
        </span>
        {item.children.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "pl-6 pr-3 py-2 rounded-md text-sm font-ui transition-colors block",
              isActive(pathname, child.href)
                ? "bg-parchment text-ink font-medium"
                : "text-faded hover:text-ink hover:bg-parchment/50",
            )}
          >
            {child.label}
          </Link>
        ))}
      </div>
    );
  }

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
        isActive(pathname, item.href)
          ? "bg-parchment text-ink font-medium"
          : item.disabled
            ? "text-faded/50"
            : "text-faded hover:text-ink hover:bg-parchment/50",
      )}
    >
      {item.label}
      {item.disabled && <span className="ml-1 text-xs text-faded/50">(snart)</span>}
    </Link>
  );
}

/* --- Hamburger icon --- */
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Close dropdown and mobile menu on Escape */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* Close mobile menu when resizing past md breakpoint */
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* Close mobile menu on navigation */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className="border-b border-faded/30 sticky top-0 z-50 shadow-sm bg-parchment-light"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Site Title */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl" role="img" aria-label="Jernkors">
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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Hovednavigation">
            {navItems.map((item) => (
              <DesktopNavItem
                key={item.label}
                item={item}
                pathname={pathname}
                dropdownRef={dropdownRef}
                dropdownOpen={dropdownOpen}
                setDropdownOpen={setDropdownOpen}
              />
            ))}
          </nav>

          {/* Search Box */}
          <div className="hidden sm:flex items-center">
            <SearchBox />
          </div>

          {/* Mobile hamburger button */}
          <button
            className="md:hidden p-2 text-ink"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Skift menu"
            aria-expanded={mobileOpen}
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-faded/20 pt-2" aria-label="Mobilnavigation">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <MobileNavItem
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  setMobileOpen={setMobileOpen}
                />
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
