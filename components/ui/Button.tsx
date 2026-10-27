"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

export type ButtonVariant = "primary" | "scholarly" | "footnote" | "subtle" | "ghost" | "secondary" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  citationNumber?: number | bigint;
  icon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#B5179E] text-white hover:bg-[#971283] active:bg-[#7D0E6C] border border-[#B5179E] shadow-xs",
  scholarly:
    "bg-white text-[#1E1233] border border-[#D9CCF0] hover:border-[#B5179E] hover:bg-[#F3EAFF] font-serif",
  footnote:
    "bg-[#FAF7FF] text-[#5B4A78] border border-[#D9CCF0] hover:border-[#B5179E] hover:text-[#B5179E] font-mono text-[11px]",
  subtle:
    "bg-transparent text-[#5B4A78] hover:text-[#1E1233] hover:bg-[#F3EAFF] border border-transparent",
  ghost:
    "bg-transparent text-[#5B4A78] hover:text-[#1E1233] hover:bg-[#F3EAFF] border border-transparent",
  secondary:
    "bg-[#F3EAFF] text-[#1E1233] border border-[#D9CCF0] hover:border-[#B5179E]",
  danger:
    "bg-transparent text-[#B3261E] border border-[#B3261E] hover:bg-[#FCE8E6]",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-0.5 text-[11px] rounded-[3px]",
  sm: "px-3 py-1.5 text-[12px] rounded-[4px]",
  md: "px-4 py-2.5 text-[13px] rounded-[4px]",
  lg: "px-6 py-3 text-[15px] font-semibold rounded-[4px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      citationNumber,
      icon,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2 transition-all cursor-pointer font-sans select-none",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {citationNumber !== undefined && (
              <span className="font-mono text-[10px] px-1 py-0.2 bg-[#F3EAFF] text-[#B5179E] rounded-[2px] font-bold border border-[#D9CCF0]">
                [{citationNumber.toString()}]
              </span>
            )}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{children}</span>
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
