"use client";

import { useEffect } from "react";

type Props = {
  src: string | null;
  alt?: string;
  onClose: () => void;
};

/** Full-size image overlay. Click backdrop or press Escape to close. */
export function ImageLightbox({ src, alt = "", onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "معاينة الصورة"}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 rounded-full bg-white/90 px-4 py-2 text-sm text-ink-900 shadow end-4 dark:bg-ink-800 dark:text-sand-50"
        onClick={onClose}
      >
        إغلاق
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-panel"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
