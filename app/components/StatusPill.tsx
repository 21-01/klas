import { cn } from "../lib/utils";

type PillVariant = "in-session" | "closed" | "upcoming";

interface StatusPillProps {
  variant: PillVariant;
  className?: string;
}

const pillStyles: Record<PillVariant, { label: string; bg: string; text: string }> = {
  "in-session": {
    label: "IN SESSION",
    bg: "bg-brand-secondary",
    text: "text-[#758dd5]",
  },
  closed: {
    label: "CLOSED",
    bg: "bg-[#dcdddd]",
    text: "text-brand-text-dim",
  },
  upcoming: {
    label: "UPCOMING",
    bg: "bg-[#e4e1e6]",
    text: "text-brand-text-muted",
  },
};

export default function StatusPill({ variant, className }: StatusPillProps) {
  const { label, bg, text } = pillStyles[variant];

  return (
    <div className={cn(bg, text, "font-bold text-[10px] tracking-[0.5px] uppercase px-[8px] py-[2px] rounded-sm", className)}>
      {label}
    </div>
  );
}
