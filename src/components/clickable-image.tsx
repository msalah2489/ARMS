"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Thumbnail size preset */
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

/** Thumbnail that opens a full-size lightbox on click. */
export function ClickableImage({ src, alt = "", className, size = "md" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "shrink-0 overflow-hidden rounded-lg border border-ink-900/10 bg-sand-50 p-0 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-aroma-500 dark:border-white/10 dark:bg-ink-800",
          sizeClass[size],
          className,
        )}
        title="اضغط لفتح الصورة"
        aria-label={alt ? `فتح صورة ${alt}` : "فتح الصورة"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </button>
      <ImageLightbox src={open ? src : null} alt={alt} onClose={() => setOpen(false)} />
    </>
  );
}

/** Empty placeholder when no image is available. */
export function ImagePlaceholder({
  label = "بدون صورة",
  size = "md",
  className,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-dashed border-ink-900/20 bg-sand-50 text-[10px] text-ink-700/50 dark:border-white/20 dark:bg-ink-800 dark:text-sand-100/40",
        sizeClass[size],
        className,
      )}
    >
      {label}
    </span>
  );
}
