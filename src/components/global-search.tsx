"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePreferences } from "@/components/preferences-provider";
import {
  globalSearchKindLabel,
  runGlobalSearch,
  type GlobalSearchResult,
} from "@/lib/global-search";
import type { Profile } from "@/types/domain";

const DEBOUNCE_MS = 220;

export function GlobalSearch({ user }: { user: Profile }) {
  const router = useRouter();
  const { t, locale } = usePreferences();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const results: GlobalSearchResult[] =
    open && debounced.length >= 2 ? runGlobalSearch(debounced, user) : [];

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goTo(result: GlobalSearchResult) {
    setOpen(false);
    setQuery("");
    setDebounced("");
    router.push(result.href);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) goTo(hit);
    }
  }

  const showPanel = open && debounced.length >= 2;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 md:max-w-md md:flex-none lg:max-w-lg">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t("search.label")}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/45 dark:text-sand-100/45"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && results[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          placeholder={t("search.placeholder")}
          className="w-full min-h-11 rounded-xl border border-ink-900/10 bg-white/90 pe-3 ps-9 text-sm text-ink-900 placeholder:text-ink-700/45 outline-none transition focus:border-aroma-400 focus:ring-2 focus:ring-aroma-400/20 dark:border-white/15 dark:bg-ink-950/60 dark:text-sand-50 dark:placeholder:text-sand-100/40 dark:focus:border-aroma-400"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(22rem,70vh)] overflow-y-auto rounded-2xl border border-ink-900/10 bg-white shadow-panel dark:border-white/10 dark:bg-ink-900"
        >
          {results.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-ink-700/60 dark:text-sand-100/60">
              {t("search.empty")}
            </p>
          ) : (
            <ul>
              {results.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <li key={item.id} role="option" aria-selected={active} id={`${listId}-opt-${index}`}>
                    <button
                      type="button"
                      className={[
                        "flex w-full items-start gap-2 px-3 py-2.5 text-start transition",
                        active
                          ? "bg-aroma-50/70 dark:bg-aroma-900/20"
                          : "hover:bg-sand-50 dark:hover:bg-ink-950/50",
                      ].join(" ")}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(item)}
                    >
                      <span className="mt-0.5 shrink-0 rounded-md bg-ink-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700/70 dark:bg-white/10 dark:text-sand-100/70">
                        {globalSearchKindLabel(item.kind, locale)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900 dark:text-sand-50">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="mt-0.5 block truncate text-xs text-ink-700/65 dark:text-sand-100/60">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
