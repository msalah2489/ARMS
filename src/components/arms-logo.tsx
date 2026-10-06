type ArmsLogoProps = {
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  /** Metallic shimmer only — use on login / unauthenticated only (no bob/scale). */
  animate?: boolean;
  className?: string;
};

const SIZE_CLASS = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-5xl",
  hero: "text-6xl sm:text-7xl",
} as const;

/** Metallic silver wordmark; optional shimmer lighting for unauthenticated screens. */
export function ArmsLogo({ size = "md", animate = false, className = "" }: ArmsLogoProps) {
  return (
    <span
      className={[
        "arms-logo font-display tracking-tight",
        SIZE_CLASS[size],
        animate ? "arms-logo--alive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="ARMS"
    >
      ARMS
    </span>
  );
}
