import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "dark" | "subtle" | "outline";

const styles: Record<Variant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700 shadow-soft",
  dark: "bg-ink text-white hover:bg-slate-800",
  subtle: "bg-slate-100 text-ink hover:bg-slate-200",
  outline: "border border-line bg-white text-ink hover:border-teal-500 hover:text-teal-700"
};

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn("pill disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)} {...props} />;
}