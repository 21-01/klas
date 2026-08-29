import { useState } from "react";
import { useNavigate } from "react-router";
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { supabase } from "~/lib/supabase";

export function meta() {
  return [
    { title: "Klas. - Sign In" },
    { name: "description", content: "Sign in to your Klas account." },
  ];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!campusId.trim()) {
      setError("Campus ID / Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);

    try {
      let resolvedEmail = campusId.trim();

      // Check if it's a numeric NIM (Student ID) or NIP (Lecturer ID)
      const isNumeric = /^\d+$/.test(resolvedEmail);
      if (isNumeric) {
        // Query to find if it matches a Student NIM
        const { data: studentData } = await supabase
          .from("mahasiswa")
          .select("users(email)")
          .eq("nim", resolvedEmail)
          .maybeSingle();

        if (studentData?.users && typeof studentData.users === "object" && "email" in studentData.users) {
          resolvedEmail = (studentData.users as any).email;
        } else {
          // If not a student, check if it matches a Lecturer NIP
          const { data: lecturerData } = await supabase
            .from("dosen")
            .select("users(email)")
            .eq("nip", resolvedEmail)
            .maybeSingle();

          if (lecturerData?.users && typeof lecturerData.users === "object" && "email" in lecturerData.users) {
            resolvedEmail = (lecturerData.users as any).email;
          } else {
            setIsLoading(false);
            setError("No student (NIM) or lecturer (NIP) matches this ID.");
            return;
          }
        }
      }

      // Perform real Supabase authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (authError) {
        setIsLoading(false);
        setError(authError.message);
        return;
      }

      if (authData.user) {
        // Fetch the user's role and profile via RPC (bypasses RLS)
        const { data: userProfile, error: profileError } = await supabase
          .rpc("get_current_user_profile")
          .maybeSingle();

        if (profileError || !userProfile) {
          setIsLoading(false);
          setError(`Failed to fetch user profile data. ${profileError?.message || "User not found"}`);
          return;
        }

        const profile = userProfile as any;

        setIsLoading(false);

        // Redirect based on role
        if (profile.role === "mahasiswa") {
          navigate("/mahasiswa");
        } else if (profile.role === "dosen") {
          navigate("/dosen");
        } else if (profile.role === "admin" || profile.role === "super_admin" || profile.role === "admin_prodi") {
          navigate("/admin");
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || "An unexpected error occurred during sign in.");
    }
  };


  return (
    <div className="min-h-screen w-full flex bg-brand-bg text-brand-text font-sans antialiased overflow-hidden">
      {/* Left Panel - Brand Identity (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-primary relative items-center justify-center overflow-hidden">
        {/* Subtle decorative mesh and glowing background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(3,34,98,0.4),transparent_60%)] z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(0,35,102,0.3),transparent_70%)] z-0" />
        
        {/* Grid Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] z-0" 
          style={{
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: "24px 24px"
          }}
        />

        {/* Large Logo */}
        <div className="flex gap-[32px] items-center justify-center z-10 animate-fade-in">
          {/* Logo SVG */}
          <div className="h-[224px] w-[128px] transition-transform duration-700 hover:scale-105">
            <svg width="128" height="224" viewBox="0 0 128 224" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
              <path d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="#ffffff" />
            </svg>
          </div>
          {/* Brand Name */}
          <h1 className="font-extrabold text-[110px] tracking-[-0.04em] text-white leading-none drop-shadow-md select-none">
            KLAS
          </h1>
        </div>

        {/* Dynamic decorative light beam */}
        <div className="absolute bottom-10 left-10 text-white/40 text-xs font-medium tracking-[2px] uppercase select-none z-10">
          Your Location, Your Attendance.
        </div>
      </div>

      {/* Right Panel - Login Card Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 relative">
        {/* Subtle decorative circles for mobile screens */}
        <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-brand-logo/5 blur-3xl lg:hidden" />
        <div className="absolute bottom-10 right-10 w-52 h-52 rounded-full bg-[#22c55e]/5 blur-3xl lg:hidden" />

        <div className="w-full max-w-[460px] bg-white border border-brand-border/60 shadow-[0_20px_50px_rgba(0,17,58,0.06)] rounded-[30px] p-8 md:p-10 flex flex-col gap-6 relative transition-all duration-300 hover:shadow-[0_24px_60px_rgba(0,17,58,0.1)]">
          
          {/* Small Logo for visual branding */}
          <div className="flex flex-col gap-2 items-center w-full">
            <div className="select-none hover:scale-105 transition-transform duration-300">
              <svg width="48" viewBox="0 0 128 224" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M64 224L0 115.294H52.4609C53.8928 120.319 58.5152 124 64 124C69.4848 124 74.1072 120.319 75.5391 115.294H128L64 224ZM128 108.706H75.5391C74.1072 103.681 69.4848 100 64 100C58.5152 100 53.8928 103.681 52.4609 108.706H0L64 0L128 108.706Z" fill="#032262" />
              </svg>
            </div>
            <p className="font-semibold text-brand-text-muted text-[15px] tracking-wide text-center mt-2">
              Your Location, Your Attendance.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border-l-4 border-status-error p-4 rounded-r-lg flex items-start gap-3">
              <AlertCircle className="text-status-error shrink-0 mt-0.5" size={18} />
              <span className="text-[13px] font-semibold text-status-error">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            
            {/* Input - Campus ID */}
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="email"
                className="font-bold text-brand-secondary text-[12px] tracking-[1px] uppercase"
              >
                Campus Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-brand-text-dim group-focus-within:text-brand-secondary transition-colors">
                  <User size={18} />
                </div>
                <input
                  id="email"
                  type="text"
                  value={campusId}
                  onChange={(e) => setCampusId(e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g. nama@mhs.unj.ac.id"
                  className="w-full bg-brand-bg border border-brand-border/60 hover:border-brand-border/90 focus:border-brand-secondary focus:bg-white text-brand-text font-medium text-[15px] pl-11 pr-4 py-4 rounded-[12px] shadow-inner focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Input - Password */}
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="password"
                className="font-bold text-brand-secondary text-[12px] tracking-[1px] uppercase"
              >
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-brand-text-dim group-focus-within:text-brand-secondary transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full bg-brand-bg border border-brand-border/60 hover:border-brand-border/90 focus:border-brand-secondary focus:bg-white text-brand-text font-medium text-[15px] pl-11 pr-12 py-4 rounded-[12px] shadow-inner focus:outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-brand-text-dim hover:text-brand-secondary transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full bg-brand-logo text-white font-semibold text-[15px] tracking-[1px] uppercase py-4 rounded-[12px] shadow-md hover:bg-brand-primary active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2",
                isLoading && "opacity-80 pointer-events-none"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
