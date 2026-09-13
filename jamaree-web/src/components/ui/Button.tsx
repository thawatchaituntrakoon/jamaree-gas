import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ok";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent/90",
  secondary: "border border-line bg-card text-ink hover:bg-paper",
  ghost: "text-accent hover:bg-accent-soft",
  danger: "border border-danger/30 bg-card text-danger hover:bg-danger-soft",
  ok: "bg-ok text-on-accent hover:bg-ok/90",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const pad = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-btn font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        pad,
        VARIANTS[variant],
        className,
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}
