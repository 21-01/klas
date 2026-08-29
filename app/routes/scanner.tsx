import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Compass, Info, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import TopAppBar from "~/components/TopAppBar";
import { api } from "~/lib/api";
import { Scanner } from "@yudiel/react-qr-scanner";

export function meta() {
  return [
    { title: "QR Scanner - Klas." },
  ];
}

export default function QRScanner() {
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleScan = useCallback(async (result: any) => {
    if (!result || result.length === 0) return;
    const token = result[0].rawValue;
    
    if (scanning || success) return;
    
    setScanning(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      await api.checkIn(token, pos.coords.latitude, pos.coords.longitude);
      setScanning(false);
      setSuccess(true);
      setTimeout(() => navigate("/mahasiswa"), 2000);
    } catch (err: any) {
      setScanning(false);
      setError(err?.message || "Failed to verify attendance");
    }
  }, [scanning, success, navigate]);

  return (
    <div className="bg-brand-bg min-h-full flex flex-col items-start relative w-full text-brand-text">
      <TopAppBar />

      <div className="flex flex-col items-center justify-center px-[24px] py-[32px] w-full gap-[32px]">

        <div className="flex flex-col gap-[24px] items-center w-full">

          <div className="bg-black border-2 border-slate-700/50 flex flex-col items-start justify-center overflow-hidden p-[2px] relative rounded-[12px] w-full max-w-[320px] aspect-square shadow-lg">
            {success ? (
              <div className="bg-[#171717] flex-1 w-full h-full flex flex-col items-center justify-center relative">
                <CheckCircle size={64} className="text-status-success animate-bounce" />
              </div>
            ) : scanning ? (
              <div className="bg-[#171717] flex-1 w-full h-full flex flex-col items-center justify-center relative">
                <Loader2 size={48} className="text-status-success animate-spin" />
              </div>
            ) : (
              <div className="w-full h-full relative">
                <Scanner
                  onScan={handleScan}
                  paused={scanning || success}
                  onError={(err: any) => setError(err?.message || "Camera access denied. Ensure you are using HTTPS or localhost.")}
                />
              </div>
            )}
          </div>

          <div className="text-center px-[20px]">
            <p className="font-semibold text-brand-text-muted text-[12px] tracking-[0.6px] leading-[18px]">
              {success ? (
                <span className="text-status-success font-bold text-[14px]">Attendance verified! Redirecting...</span>
              ) : error ? (
                <span className="text-status-error font-bold text-[14px]">{error}</span>
              ) : (
                <>Point your camera at the QR code displayed on the lecturer's screen.</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start w-full gap-[24px]">

          <div className="bg-white border border-brand-border flex flex-col gap-[16px] p-[25px] rounded-[10px] shadow-sm w-full">

            <div className="bg-brand-surface border border-transparent rounded-[6px] w-full">
              <div className="flex items-center justify-between px-[16px] py-[14px] w-full">
                <div className="flex gap-[8px] items-center">
                  <Compass size={16} className="text-brand-text-muted" />
                  <span className="font-semibold text-brand-text-muted text-[12px] tracking-[0.6px]">
                    GPS Status
                  </span>
                </div>
                <div className="flex gap-[4px] items-center">
                  <div className="bg-status-success rounded-full size-[8px] animate-pulse" />
                  <span className="font-semibold text-brand-text text-[12px] tracking-[0.6px]">
                    Active
                  </span>
                </div>
              </div>
            </div>

            <div className="border-brand-border border-t opacity-70 w-full pt-[9px] flex items-center justify-between text-brand-text-muted text-[11px] font-medium">
              <span>Location-based check-in</span>
              <span>{new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>

          </div>

          <div className="bg-brand-bg border border-brand-border/30 flex gap-[16px] p-[17px] rounded-[10px] w-full items-start">
            <Info size={20} className="text-brand-primary shrink-0 mt-0.5" />
            <div className="text-brand-text-muted text-[13px] leading-[18px]">
              Ensure your device's location services and camera are active to verify your attendance.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
