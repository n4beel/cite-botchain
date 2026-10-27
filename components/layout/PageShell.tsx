"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

const DEFAULT_NAV: NavItem[] = [
  { href: "/", label: "Bibliography" },
  { href: "/publish", label: "Publish & Cite" },
  { href: "/me", label: "Earnings & Balance" },
];

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

export default function PageShell({
  children,
  nav = DEFAULT_NAV,
  title,
  description,
}: PageShellProps) {
  const links = footerLinks();
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF7FF] text-[#1E1233]">
      {/* Running Head Header */}
      <header className="sticky top-0 z-30 flex-shrink-0 bg-white/95 backdrop-blur-sm border-b border-[#D9CCF0]">
        <div className="mx-auto w-full max-w-[1120px] px-4 md:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 no-underline group">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[#B5179E] group-hover:scale-110 transition-transform" />
                <span className="font-serif font-bold text-[18px] tracking-tight text-[#1E1233]">
                  CITE
                </span>
                <span className="text-[12px] font-mono text-[#5B4A78] uppercase tracking-wider pl-1 border-l border-[#D9CCF0]">
                  Vol. 1
                </span>
              </Link>

              <nav className="hidden sm:flex items-center gap-1">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`px-3 py-1.5 rounded-[4px] text-[13px] font-medium no-underline transition-colors ${
                        active
                          ? "bg-[#F3EAFF] text-[#B5179E] font-semibold"
                          : "text-[#5B4A78] hover:text-[#1E1233] hover:bg-[#FAF7FF]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <NetworkBadge />
              <div className="w-[145px] sm:w-[170px] flex-shrink-0">
                <ConnectButton />
              </div>
            </div>
          </div>

          {/* Mobile Navigation bar */}
          <nav className="sm:hidden flex items-center gap-1 pb-2.5 overflow-x-auto border-t border-[#ECE3FA] pt-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium no-underline whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#F3EAFF] text-[#B5179E] font-semibold"
                      : "text-[#5B4A78] hover:text-[#1E1233]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 md:py-8">
        {(title || description) && (
          <div className="mb-6 pb-4 border-b border-[#ECE3FA]">
            {title && (
              <h1 className="font-serif text-[24px] md:text-[30px] font-bold tracking-tight text-[#1E1233]">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-[14px] text-[#5B4A78] leading-relaxed max-w-[720px]">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      {/* Footer with Limits Copy and Shared UI Contract Links */}
      <footer className="flex-shrink-0 border-t border-[#D9CCF0] bg-white mt-12">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-8 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-[#ECE3FA]">
            {/* Column 1: Scholarly Mission */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-[1px] bg-[#B5179E]" />
                <span className="font-serif font-bold text-[15px] text-[#1E1233]">Cite</span>
              </div>
              <p className="text-[13px] text-[#5B4A78] leading-relaxed">
                {app.tagline}
              </p>
            </div>

            {/* Column 2: What a Citation Proves (Limits Heading & Copy) */}
            <div className="md:col-span-2 p-4 rounded-[6px] bg-[#FAF7FF] border border-[#D9CCF0]">
              <span className="font-serif font-bold text-[13px] text-[#1E1233] block mb-1.5">
                What a citation proves
              </span>
              <ul className="text-[12px] text-[#5B4A78] space-y-1 list-disc list-inside">
                <li>
                  That this wallet published this hash at this time. Not that it is original.
                </li>
                <li>
                  Wallets are free. Read who cites a work, not how many.
                </li>
                <li>
                  Fees are fixed when a work is published.
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: 3 Required Links */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[12px] text-[#5B4A78]">
            <BuiltOnBotChain />

            <div className="flex items-center gap-4">
              <a
                href={links.site}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#B5179E] hover:underline"
              >
                botchain.ai
              </a>
              <span className="text-[#D9CCF0]">·</span>
              <a
                href={links.explorer}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#B5179E] hover:underline"
              >
                scan.botchain.ai
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
