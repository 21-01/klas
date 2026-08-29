import { Link } from "react-router";
import { ArrowRight, Shield, MapPin, QrCode, Zap } from "lucide-react";

export function meta() {
  return [
    { title: "Klas. - Geospatial Presence Verification" },
    { name: "description", content: "Modern attendance verification system for academic institutions." },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-primary text-white font-sans antialiased overflow-hidden">
      {/* Decorative Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(3,34,98,0.6),transparent_60%)] z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(0,35,102,0.4),transparent_70%)] z-0" />
      <div
        className="fixed inset-0 opacity-[0.04] z-0"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <header className="flex items-center justify-between px-6 sm:px-12 py-6">
          <div className="flex items-center gap-3">
            <svg width="32" height="56" viewBox="0 0 128 224" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="white" />
            </svg>
            <span className="font-extrabold text-2xl tracking-tight">KLAS</span>
          </div>
          <Link
            to="/login"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            Sign In
          </Link>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-32">
          <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
            {/* Logo animation */}
            <div className="mb-4">
              <svg width="80" height="140" viewBox="0 0 128 224" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
                <path d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="white" />
              </svg>
            </div>

            <h1 className="font-extrabold text-5xl sm:text-7xl tracking-tight leading-tight">
              Your Location,<br />
              <span className="text-white/70">Your Attendance.</span>
            </h1>

            <p className="text-white/60 text-lg sm:text-xl max-w-xl leading-relaxed">
              Multi-layered presence verification combining dynamic QR codes,
              GPS geofencing, and campus network security.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link
                to="/login"
                className="bg-white text-brand-primary font-bold text-sm tracking-wide px-8 py-4 rounded-xl hover:bg-white/90 active:scale-95 transition-all flex items-center gap-2 shadow-xl"
              >
                Get Started
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </main>

        {/* Features + Footer Section */}
        <div className="bg-brand-logo/20">
          {/* Features */}
          <section className="py-32 px-6">
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
              <FeatureCard icon={QrCode} title="Dynamic QR" description="Time-limited QR codes that auto-regenerate every 15 seconds for secure check-in." />
              <FeatureCard icon={MapPin} title="GPS Geofencing" description="Spatial verification using PostGIS to ensure students are within classroom boundaries." />
              <FeatureCard icon={Shield} title="IP Filtering" description="Campus network whitelist matching with VPN spoofing mitigation for layered security." />
            </div>
          </section>

          {/* Footer */}
          <footer className="py-12 px-6 text-center text-white/30 text-sm">
            KLAS — Geospatial Presence Verification System
          </footer>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ComponentType<{ size: number; className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
        <Icon size={20} className="text-white/80" />
      </div>
      <div>
        <h3 className="font-bold text-lg text-white">{title}</h3>
        <p className="text-white/50 text-sm leading-relaxed mt-1">{description}</p>
      </div>
    </div>
  );
}
