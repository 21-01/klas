import { useEffect, useRef } from "react";

interface ClickAwayListenerProps {
  children: React.ReactNode;
  onClickAway: () => void;
  className?: string;
}

export default function ClickAwayListener({ children, onClickAway, className }: ClickAwayListenerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickAway();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClickAway]);

  return <div ref={ref} className={className}>{children}</div>;
}
