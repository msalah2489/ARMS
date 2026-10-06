type ArmsLogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

/** Metallic silver wordmark with a calm CSS shimmer sweep. */
export function ArmsLogo({ size = "md", className = "" }: ArmsLogoProps) {
  return (
    <span
      className={`arms-logo font-display tracking-tight ${SIZE_CLASS[size]} ${className}`.trim()}
      aria-label="ARMS"
    >
      ARMS
    </span>
  );
}
