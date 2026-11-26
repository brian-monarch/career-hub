import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-sage-400 text-navy-950 hover:bg-sage-300 shadow-soft",
  secondary: "bg-navy-800 text-stone-200 border border-stone-700 hover:border-stone-500",
  ghost: "text-stone-400 hover:text-stone-200 hover:bg-navy-800",
  danger: "bg-transparent text-terracotta-300 border border-terracotta-600 hover:bg-terracotta-600/20",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
    />
  );
}
