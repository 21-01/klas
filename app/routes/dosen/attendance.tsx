import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, RefreshCw, Search, ChevronDown, CheckCircle, Loader2, XCircle, FileText, History } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useToast } from "~/components/Toast";
import QRCode from "react-qr-code";

export function meta() {
  return [
    { title: "Attendance - Klas." },
  ];
}

export default function DosenAttendance() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [radius, setRadius] = useState(50);
  const [qrRotatesEvery, setQrRotatesEvery] = useState(15);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const tokenQueueRef = useRef<Array<{ qr_token: string; expired_at: string }>>([]);
  const tokenIndexRef = useRef(0);
  const isFetchingBatchRef = useRef(false);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { jadwal_id } = useParams();
  const [courseData, setCourseData] = useState<any>(null);
  const [opening, setOpening] = useState(false);

  const handleOpenSession = async () => {
    if (!jadwal_id) return;
    setOpening(true);
    try {
      const data = await api.openSession({ jadwal_id, geofence_radius_m: 50, qr_rotates_every: 15 });
      toast.success("Session opened");
      const sessionDataResult = await api.getLiveSession(data.sesi_id);
      setSessionData(sessionDataResult);
      if (sessionDataResult.geofence_radius_m) setRadius(sessionDataResult.geofence_radius_m);
      if (sessionDataResult.qr_rotates_every) setQrRotatesEvery(sessionDataResult.qr_rotates_every);
      const startMs = new Date(sessionDataResult.waktu_mulai).getTime();
      setSessionTime(Math.floor((Date.now() - startMs) / 1000));
      const batch = await api.generateQrTokens(sessionDataResult.sesi_id, sessionDataResult.qr_rotates_every || 15, 2);
      if (batch?.tokens?.length > 0) {
        tokenQueueRef.current = batch.tokens;
        tokenIndexRef.current = 0;
        setQrToken(batch.tokens[0].qr_token);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to open session");
    } finally {
      setOpening(false);
    }
  };

  const handleCloseSession = async () => {
    if (!sessionData?.sesi_id) return;
    setClosing(true);
    try {
      await api.closeSession(sessionData.sesi_id);
      toast.success("Session closed");
      navigate("/dosen");
    } catch (err: any) {
      toast.error(err.message || "Failed to close session");
      setClosing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!sessionData?.sesi_id) return;
    setSavingSettings(true);
    try {
      await api.updateSessionSettings(sessionData.sesi_id, { 
        geofence_radius_m: radius,
        qr_rotates_every: qrRotatesEvery
      });
      setSessionData((prev: any) => ({ ...prev, qr_rotates_every: qrRotatesEvery }));
      // Invalidate old token queue and fetch fresh batch with new TTL
      const batch = await api.generateQrTokens(sessionData.sesi_id, qrRotatesEvery, 2);
      if (batch?.tokens?.length > 0) {
        tokenQueueRef.current = batch.tokens;
        tokenIndexRef.current = 0;
        setQrToken(batch.tokens[0].qr_token);
      }
      toast.success("Settings updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update settings");
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const courses = await api.getDosenDashboard();
        const course = courses.courses.find((c) => c.jadwal_id === jadwal_id);
        if (!course) {
          setError("Class not found.");
          setLoading(false);
          return;
        }
        setCourseData(course);
        if (!course.latest_session) {
          setLoading(false);
          return;
        }
        const data = await api.getLiveSession(course.latest_session.sesi_id);
        setSessionData(data);
        if (data.geofence_radius_m) setRadius(data.geofence_radius_m);
        if (data.qr_rotates_every) setQrRotatesEvery(data.qr_rotates_every);

        if (data.status === "live") {
          const startMs = new Date(data.waktu_mulai).getTime();
          setSessionTime(Math.floor((Date.now() - startMs) / 1000));

          const batch = await api.generateQrTokens(data.sesi_id, data.qr_rotates_every || 15, 2);
          if (batch?.tokens?.length > 0) {
            tokenQueueRef.current = batch.tokens;
            tokenIndexRef.current = 0;
            setQrToken(batch.tokens[0].qr_token);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [jadwal_id]);

  useEffect(() => {
    if (!sessionData?.sesi_id || sessionData.status !== "live") return;
    
    // Only set up the session timer once when sessionData first becomes available
    const timer = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    // Drift-compensating QR rotation using setTimeout recursive pattern
    const rotatesEvery = sessionData.qr_rotates_every || 15;
    let lastRotationAt = Date.now();

    const rotate = async () => {
      const queue = tokenQueueRef.current;
      const idx = tokenIndexRef.current;

      if (!queue || queue.length === 0) return;

      if (idx < queue.length - 1) {
        const nextIdx = idx + 1;
        tokenIndexRef.current = nextIdx;
        setQrToken(queue[nextIdx]?.qr_token ?? "");
      } else if (!isFetchingBatchRef.current) {
        isFetchingBatchRef.current = true;
        try {
          const res = await api.generateQrTokens(sessionData.sesi_id, rotatesEvery, 2);
          if (res?.tokens?.length > 0) {
            tokenQueueRef.current = res.tokens;
            tokenIndexRef.current = 0;
            setQrToken(res.tokens[0].qr_token);
          }
        } catch (err) {
          console.error("Failed to fetch next QR batch", err);
        } finally {
          isFetchingBatchRef.current = false;
        }
      }

      // Drift compensation: calculate delay to next ideal fire time
      lastRotationAt += rotatesEvery * 1000;
      const drift = Date.now() - lastRotationAt;
      const nextDelay = Math.max(0, rotatesEvery * 1000 - drift);
      qrTimeoutRef.current = setTimeout(rotate, nextDelay);
    };

    lastRotationAt = Date.now();
    qrTimeoutRef.current = setTimeout(rotate, rotatesEvery * 1000);

    const dataTimer = setInterval(async () => {
      try {
        const data = await api.getLiveSession(sessionData.sesi_id);
        setSessionData((prev: any) => ({ ...prev, counts: data.counts, recent_checkins: data.recent_checkins }));
      } catch (err) {
        console.error("Failed to fetch live session data", err);
      }
    }, 3000);

    return () => {
      clearInterval(timer);
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
      clearInterval(dataTimer);
    };
  }, [sessionData?.sesi_id, sessionData?.qr_rotates_every]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-secondary" size={32} /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <XCircle size={48} className="text-status-error" />
        <p className="text-status-error font-semibold">{error}</p>
        <Link to="/dosen" className="text-brand-secondary underline">Back to Dashboard</Link>
      </div>
    );
  }

  const present = sessionData?.counts?.present ?? 0;
  const absent = sessionData?.counts?.absent ?? 0;
  const total = present + absent;
  const checkins = sessionData?.recent_checkins ?? [];

  return (
    <div className="flex flex-col gap-[32px] w-full">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-[16px]">
          <Link to="/dosen" className="p-2 border border-brand-border hover:bg-slate-100 rounded-[10px] text-brand-primary transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex flex-col items-start">
            <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1px] uppercase">
              LIVE MONITORING SESSION
            </span>
            <h1 className="font-bold text-brand-primary text-[24px] tracking-[-0.5px]">
              Session Overview
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-[12px]">
          <Link 
            to={`/dosen/attendance/correction/${jadwal_id}`}
            className="bg-white border border-brand-border hover:bg-slate-50 text-brand-primary px-[16px] py-[10px] rounded-[10px] font-bold text-[13px] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FileText size={16} />
            <span className="hidden sm:inline">Manual Correction</span>
          </Link>
          <Link 
            to={`/dosen/attendance/${jadwal_id}/sessions`}
            className="bg-white border border-brand-border hover:bg-slate-50 text-brand-primary px-[16px] py-[10px] rounded-[10px] font-bold text-[13px] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <History size={16} />
            <span className="hidden sm:inline">Sessions</span>
          </Link>
          {sessionData?.status === "live" ? (
            <button 
              onClick={handleCloseSession}
              disabled={closing}
              className="bg-red-600 hover:bg-red-700 text-white px-[20px] py-[10px] rounded-[10px] font-bold text-[13px] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {closing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              <span>End Session</span>
            </button>
          ) : (
            <button
              onClick={handleOpenSession}
              disabled={opening}
              className="bg-brand-secondary hover:bg-brand-primary text-white px-[20px] py-[10px] rounded-[10px] font-bold text-[13px] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {opening ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span>Open Session</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[32px] w-full items-start">

        <div className="lg:col-span-5 flex flex-col gap-[24px] w-full">
          <div className="bg-white border border-brand-border rounded-[16px] p-[28px] flex flex-col items-center gap-[24px] shadow-sm relative overflow-hidden">
            <div className="relative border-2 border-brand-secondary p-[20px] rounded-[16px] bg-slate-50 size-[320px] flex items-center justify-center shadow-inner">
              <div className="absolute left-[24px] right-[24px] h-[3px] bg-brand-primary shadow-[0_0_12px_rgba(0,17,58,0.6)] animate-[bounce_3s_infinite] opacity-80" />
              <div className="absolute border-t-4 border-l-4 border-brand-primary top-[-3px] left-[-3px] size-[24px] rounded-tl-[8px]" />
              <div className="absolute border-t-4 border-r-4 border-brand-primary top-[-3px] right-[-3px] size-[24px] rounded-tr-[8px]" />
              <div className="absolute border-b-4 border-l-4 border-brand-primary bottom-[-3px] left-[-3px] size-[24px] rounded-bl-[8px]" />
              <div className="absolute border-b-4 border-r-4 border-brand-primary bottom-[-3px] right-[-3px] size-[24px] rounded-br-[8px]" />

              <div className="size-[240px] opacity-90 transition-all duration-300 flex items-center justify-center bg-white rounded-lg p-4">
                {!sessionData || sessionData.status !== "live" ? (
                  <div className="text-center">
                    <button
                      onClick={handleOpenSession}
                      disabled={opening}
                      className="bg-brand-secondary hover:bg-brand-primary text-white font-bold text-[14px] py-[12px] px-[24px] rounded-[10px] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {opening ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      <span>Open Session</span>
                    </button>
                  </div>
                ) : qrToken ? (
                  <div className="text-center w-full h-full flex flex-col items-center justify-center">
                    <QRCode value={qrToken} size={180} className="w-full h-auto" />
                    <p className="text-[11px] text-brand-text-dim font-semibold mt-3">
                      QR rotates every {sessionData?.qr_rotates_every || "15"}s
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <RefreshCw size={48} className="text-brand-secondary animate-spin mx-auto mb-4" />
                    <p className="text-[11px] text-brand-text-dim font-semibold">
                      Generating QR...
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-[4px] text-center w-full">
              <div className="flex items-center gap-[8px] justify-center">
                <div className="size-[8px] bg-emerald-500 rounded-full animate-ping" />
                <span className="font-bold text-brand-primary text-[12px] tracking-[0.5px] uppercase">
                  DYNAMIC SECURITY KEY ACTIVE
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[16px] w-full">
            <div className="bg-brand-surface border border-brand-border rounded-[12px] p-[16px] flex flex-col gap-[4px]">
              <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px]">SESSION TIME</span>
              <div className="flex items-baseline gap-[4px]">
                <span className="font-extrabold text-brand-primary text-[20px]">{formatTime(sessionTime)}</span>
              </div>
            </div>
            <div className="bg-brand-surface border border-brand-border rounded-[12px] p-[16px] flex flex-col gap-[4px]">
              <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px]">TOTAL CHECKED-IN</span>
              <span className="font-extrabold text-brand-primary text-[20px]">{present}</span>
            </div>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-[12px] flex flex-col w-full mt-2 overflow-hidden">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="flex items-center justify-between p-[16px] w-full text-left focus:outline-none hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <h3 className="font-bold text-[14px] text-brand-primary">Session Settings</h3>
              <ChevronDown size={18} className={cn("text-brand-text-dim transition-transform duration-200", isSettingsOpen && "rotate-180")} />
            </button>
            
            <div className={cn(
              "grid transition-all duration-300 ease-in-out",
              isSettingsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
              <div className="overflow-hidden">
                <div className="flex flex-col gap-[16px] p-[16px] pt-0 border-t border-brand-border/40 mt-2">
                  <div className="flex flex-col gap-[8px]">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-brand-text-dim font-bold tracking-[0.5px] uppercase text-[11px]">Geofencing Radius</span>
                      <div className="flex items-center gap-[4px]">
                        <input
                          type="number"
                          min="10" max="500"
                          value={radius}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") { setRadius(10); }
                            else { const num = Number(val); if (!isNaN(num)) setRadius(num); }
                          }}
                          onBlur={() => {
                            const num = Number(radius);
                            if (isNaN(num) || num < 10) setRadius(10);
                            else if (num > 500) setRadius(500);
                            else setRadius(Math.round(num));
                          }}
                          className="w-[52px] px-2 py-1 border border-brand-border rounded-[6px] font-bold text-brand-primary text-right focus:outline-none focus:ring-1 focus:ring-brand-secondary text-[13px] bg-white no-spinner shadow-sm"
                        />
                        <span className="font-bold text-brand-primary text-[13px]">m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="range" min="10" max="500"
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
                      />
                      <div className="flex items-center justify-between text-[10px] text-brand-text-dim font-bold">
                        <span>10m</span>
                        <span>500m</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-[8px]">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-brand-text-dim font-bold tracking-[0.5px] uppercase text-[11px]">QR Rotates Every</span>
                      <div className="flex items-center gap-[4px]">
                        <input
                          type="number"
                          min="5" max="60"
                          value={qrRotatesEvery}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") { setQrRotatesEvery(5); }
                            else { const num = Number(val); if (!isNaN(num)) setQrRotatesEvery(num); }
                          }}
                          onBlur={() => {
                            const num = Number(qrRotatesEvery);
                            if (isNaN(num) || num < 5) setQrRotatesEvery(5);
                            else if (num > 60) setQrRotatesEvery(60);
                            else setQrRotatesEvery(Math.round(num));
                          }}
                          className="w-[52px] px-2 py-1 border border-brand-border rounded-[6px] font-bold text-brand-primary text-right focus:outline-none focus:ring-1 focus:ring-brand-secondary text-[13px] bg-white no-spinner shadow-sm"
                        />
                        <span className="font-bold text-brand-primary text-[13px]">s</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="range" min="5" max="60" step="1"
                        value={qrRotatesEvery}
                        onChange={(e) => setQrRotatesEvery(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
                      />
                      <div className="flex items-center justify-between text-[10px] text-brand-text-dim font-bold">
                        <span>5s</span>
                        <span>60s</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="mt-1 w-full bg-brand-secondary hover:bg-brand-primary text-white text-[12px] font-bold py-[8px] rounded-[8px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    <span>Save Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col gap-[24px] w-full">

          <div className="bg-brand-secondary border border-brand-primary rounded-[16px] p-[28px] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="flex flex-col gap-[4px]">
              <span className="font-bold text-[#758dd5] text-[12px] tracking-[0.8px] uppercase">
                ATTENDANCE QUOTA
              </span>
              <h2 className="font-extrabold text-[32px] tracking-[-0.5px] leading-tight">
                {present} / {total || "?"} Students
              </h2>
            </div>

            <div className="flex items-center gap-[24px]">
              <div className="flex flex-col items-end">
                <span className="font-bold text-[24px] leading-tight">
                  {total > 0 ? Math.round((present / total) * 100) : 0}%
                </span>
                <span className="text-[#758dd5] font-bold text-[10px] tracking-[0.5px] uppercase">PRESENT</span>
              </div>
              <div className="w-[px] h-[40px] bg-white/20" />
              <div className="flex flex-col items-end">
                <span className="font-bold text-[24px] leading-tight text-[#ffdad6]">
                  {(total - present).toString().padStart(2, "0")}
                </span>
                <span className="text-[#ffdad6]/80 font-bold text-[10px] tracking-[0.5px] uppercase">PENDING</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[16px] w-full">
            <div className="flex items-center justify-between border-b border-brand-border/40 pb-[12px]">
              <h3 className="font-bold text-brand-primary text-[18px]">
                Live Activity Log
              </h3>
            </div>

            <div className="flex flex-col gap-[10px] max-h-[380px] overflow-y-auto pr-1">
              {checkins.length === 0 && (
                <p className="text-brand-text-dim text-[13px] text-center py-8">No check-ins yet.</p>
              )}
              {checkins.map((student: any, index: number) => (
                <div key={student.presensi_id} className={cn(
                  "bg-brand-surface border border-brand-border/60 rounded-[12px] p-[16px] flex items-center justify-between transition-all hover:border-brand-border",
                  index === 0 && "border-brand-secondary bg-white"
                )}>
                  <div className="flex items-center gap-[16px] min-w-0">
                    <div className="size-[40px] rounded-[10px] bg-white border border-brand-border flex items-center justify-center font-bold text-brand-primary text-[14px] shrink-0">
                      {student.mahasiswa.nama.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[14px] text-brand-primary truncate">{student.mahasiswa.nama}</span>
                      <span className="text-[11px] text-brand-text-dim">NIM: {student.mahasiswa.nim}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[12px] shrink-0">
                    <div className="bg-brand-primary text-white text-[11px] font-semibold px-[8px] py-[3px] rounded">
                      {new Date(student.waktu_check_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <CheckCircle className="text-emerald-500" size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
