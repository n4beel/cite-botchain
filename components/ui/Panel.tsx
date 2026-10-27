import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "elevated" | "scholarly";
  elevated?: boolean;
  noPadding?: boolean;
}

export default function Panel({
  variant = "surface",
  elevated,
  noPadding,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  const isElevated = elevated || variant === "elevated";
  const isScholarly = variant === "scholarly";

  return (
    <div
      className={[
        "rounded-[4px] transition-all",
        noPadding ? "" : "p-5",
        isScholarly ? "border border-[#D9CCF0] bg-white shadow-xs" : "",
        className,
      ].join(" ")}
      style={{
        background: isElevated ? "var(--bg-elevated)" : isScholarly ? "#FFFFFF" : "var(--bg-surface)",
        border: isScholarly ? "1px solid var(--border-default)" : "1px solid var(--border-subtle)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
