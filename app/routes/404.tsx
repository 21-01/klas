import { Link } from "react-router";
import { ArrowLeft, Compass, Home } from "lucide-react";

export function meta() {
  return [{ title: "Page Not Found - Klas." }];
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-primary text-white font-sans antialiased overflow-hidden">
      {/* Decorative Background — matches the landing page */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(3,34,98,0.6),transparent_60%)] z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(0,35,102,0.4),transparent_70%)] z-0" />
      <div
        className="fixed inset-0 opacity-[0.04] z-0"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen items-center justify-center px-6 py-16 text-center">
        {/* Oversized ghost numeral */}
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 -top-[70px] sm:-top-[100px] font-extrabold text-white/[0.06] text-[160px] sm:text-[240px] leading-none tracking-tighter select-none pointer-events-none"
          >
            404
          </span>
          <div className="relative flex items-center justify-center gap-[12px] text-white/90">
            <Compass size={28} className="text-white/60 shrink-0" />
            <span className="font-bold text-[64px] sm:text-[88px] tracking-[-2px] leading-none">
              404
            </span>
          </div>
        </div>

        <h1 className="mt-[24px] font-extrabold text-[22px] sm:text-[28px] tracking-[-0.5px] leading-tight">
          This page wandered off campus
        </h1>
        <p className="mt-[10px] max-w-[420px] text-white/60 text-[14px] sm:text-[15px] leading-relaxed">
          The page you are looking for does not exist or may have been moved.
          Check the address, or head back to where the attendance happens.
        </p>

        <div className="mt-[32px] flex flex-col sm:flex-row items-stretch sm:items-center gap-[12px] w-full sm:w-auto">
          <Link
            to="/"
            className="bg-white text-brand-primary font-bold text-[13px] px-[24px] py-[12px] rounded-[10px] transition-all shadow-md flex items-center justify-center gap-2 hover:bg-slate-100 cursor-pointer"
          >
            <Home size={16} />
            <span>Back to Home</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="bg-white/10 border border-white/25 hover:bg-white/20 text-white font-bold text-[13px] px-[24px] py-[12px] rounded-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>

        {/* Brand mark */}
        <div className="mt-[56px] flex items-center gap-[10px] text-white/40">
          <svg width="18" height="32" viewBox="0 0 128 224" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="currentColor" />
          </svg>
          <span className="font-extrabold text-[16px] tracking-tight">KLAS</span>
        </div>
      </div>
    </div>
  );
}
