"use client";

import { useState } from "react";
import Link from "next/link";
import { formatFee, refLabel, truncateHash, type WorkData } from "@/lib/cite";

interface BibliographyListProps {
  works: WorkData[];
  selectedId: bigint | null;
  onSelect: (id: bigint) => void;
}

export default function BibliographyList({
  works,
  selectedId,
  onSelect,
}: BibliographyListProps) {
  const [search, setSearch] = useState("");

  const filtered = works.filter((w) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      w.title.toLowerCase().includes(q) ||
      w.contentHash.toLowerCase().includes(q) ||
      w.author.toLowerCase().includes(q) ||
      w.id.toString() === q
    );
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Search Header */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title, hash prefix, or author…"
          className="w-full px-3.5 py-2.5 rounded-[4px] border border-[#D9CCF0] bg-white text-[13px] text-[#1E1233] placeholder-[#8472A3] focus:outline-none focus:border-[#B5179E] transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-2.5 text-[12px] text-[#8472A3] hover:text-[#1E1233]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Bibliography Entries */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-[4px] border border-[#D9CCF0] text-[13px] text-[#5B4A78]">
          {works.length === 0
            ? "Nothing has been published yet. Be the first author!"
            : "No works matching your filter."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((work) => {
            const isSelected = selectedId === work.id;

            return (
              <div
                key={work.id.toString()}
                data-bib-id={work.id.toString()}
                onClick={() => onSelect(work.id)}
                className={`p-3.5 rounded-[4px] border transition-all cursor-pointer text-left ${
                  isSelected
                    ? "bg-[#F3EAFF] border-[#B5179E] shadow-xs"
                    : "bg-white border-[#D9CCF0] hover:border-[#B5179E] hover:bg-[#FAF7FF]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] ${
                        isSelected
                          ? "bg-[#B5179E] text-white"
                          : "bg-[#FAF7FF] text-[#B5179E] border border-[#D9CCF0]"
                      }`}
                    >
                      {refLabel(work.id)}
                    </span>
                    <h3 className="font-serif font-bold text-[14px] text-[#1E1233] leading-snug line-clamp-2">
                      {work.title}
                    </h3>
                  </div>

                  <span className="font-mono text-[11px] font-semibold text-[#1E1233] whitespace-nowrap">
                    {formatFee(work.fee)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#5B4A78] font-mono mt-2 pt-2 border-t border-[#ECE3FA]">
                  <span>{truncateHash(work.contentHash, 6, 4)}</span>
                  <div className="flex items-center gap-3">
                    <span>by {truncateHash(work.author, 4, 3)}</span>
                    <span className="text-[#B5179E] font-semibold">
                      cited by {work.citedBy}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
