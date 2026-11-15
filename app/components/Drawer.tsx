import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";
import ClickAwayListener from "~/components/ClickAwayListener";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const LG_QUERY = "(min-width: 1024px)";

export default function Drawer({
  open,
  onClose,
  side = "left",
  title,
  width = "w-[280px]",
  children,
  footer,
}: DrawerProps) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Lock body scroll while open; always release on unmount.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Release the scroll lock and close when the viewport reaches lg,
  // so a stale `open` cannot leave the page locked on desktop.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(LG_QUERY);
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose();
    };
    if (mq.matches) {
      onClose();
      return;
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-brand-primary/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — ClickAwayListener closes the drawer on outside mousedown */}
      <ClickAwayListener
        onClickAway={onClose}
        className={cn(
          "absolute inset-y-0 bg-brand-primary text-white flex flex-col shadow-2xl",
          side === "left" ? "left-0 border-r border-brand-primary/40" : "right-0 border-l border-brand-primary/40",
          width
        )}
      >
        {title ? (
          <div className="h-[72px] px-[24px] flex items-center justify-between gap-[12px] border-b border-white/10 shrink-0">
            <span className="font-extrabold text-[16px] tracking-tight leading-tight truncate">{title}</span>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer shrink-0"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          <div className="h-[56px] px-[16px] flex items-center justify-end shrink-0">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer shrink-0"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="border-t border-white/10 p-[16px] shrink-0">{footer}</div>
        ) : null}
      </ClickAwayListener>
    </div>
  );
}
