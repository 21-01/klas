import { MapPin, User, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { cn } from "../lib/utils";
import StatusPill from "./StatusPill";

interface ClassCardProps {
  variant: "in-session" | "closed" | "upcoming";
  time: string;
  title: string;
  location: string;
  lecturer?: string;
  action?: {
    label: string;
    to: string;
  };
  className?: string;
}

const cardStyles = {
  "in-session": "bg-white border-brand-border shadow-sm",
  closed: "bg-white border-brand-border opacity-60",
  upcoming: "bg-brand-border border-brand-border hover:opacity-95 transition-opacity",
};

export default function ClassCard({ variant, time, title, location, lecturer, action, className }: ClassCardProps) {
  return (
    <div className={cn(
      "border flex items-center justify-between px-[20px] py-[20px] rounded-[10px] w-full",
      cardStyles[variant],
      className
    )}>
      <div className="flex flex-col gap-[12px] items-start flex-1 min-w-0 mr-4">
        <div className="flex gap-[8px] items-center">
          <StatusPill variant={variant} />
          <span className="font-semibold text-brand-text-muted text-[12px] tracking-[0.6px]">
            {time}
          </span>
        </div>

        <h2 className={cn(
          "font-bold text-[18px] leading-snug truncate w-full",
          variant === "closed" ? "text-brand-text-muted" : "text-brand-text"
        )}>
          {title}
        </h2>

        <div className="flex flex-col gap-[4px] text-brand-text-muted text-[12px]">
          <div className="flex items-center gap-[6px] font-semibold tracking-[0.4px]">
            <MapPin size={14} className="text-brand-text-dim" />
            <span>{location}</span>
          </div>
          {lecturer && (
            <div className="flex items-center gap-[6px] font-semibold tracking-[0.4px]">
              <User size={14} className="text-brand-text-dim" />
              <span>{lecturer}</span>
            </div>
          )}
        </div>
      </div>

      {action ? (
        <Link
          to={action.to}
          className="bg-brand-primary hover:bg-brand-secondary active:scale-95 transition-all text-white font-semibold text-[11px] tracking-[1.2px] uppercase px-[16px] py-[10px] rounded text-center shadow-md shrink-0"
        >
          {action.label}
        </Link>
      ) : variant === "upcoming" ? (
        <ChevronRight size={20} className="text-brand-text shrink-0" />
      ) : null}
    </div>
  );
}
