import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "~/lib/utils";
import { api, clearProfileCache } from "~/lib/api";
import { supabase } from "~/lib/supabase";
import { useToast } from "~/components/Toast";

export function meta() {
  return [{ title: "Account Settings - Klas." }];
}

export default function AccountSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [nama, setNama] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [nip, setNip] = useState("");
  const [nidn, setNidn] = useState("");
  const [email, setEmail] = useState("");
  const [prodi, setProdi] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    api.getDosenProfile()
      .then((data) => {
        setNama(data.nama);
        setJenisKelamin(data.jenis_kelamin || "L");
        setNip(data.nip);
        setNidn(data.nidn || "");
        setEmail(data.email);
        setProdi(`${data.prodi.kode_prodi} - ${data.prodi.nama_prodi}`);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateDosenProfile({ nama, jenis_kelamin: jenisKelamin });
      clearProfileCache();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.warning("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.warning("Password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-secondary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[32px] w-full">
      <div className="flex items-center gap-[16px]">
        <Link
          to="/dosen"
          className="p-2 border border-brand-border hover:bg-slate-100 rounded-[10px] text-brand-primary transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex flex-col items-start">
          <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1px] uppercase">
            Account
          </span>
          <h1 className="font-bold text-brand-primary text-[28px] tracking-[-0.5px]">
            Account Settings
          </h1>
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden">
        <div className="p-[24px] border-b border-brand-border">
          <h2 className="font-bold text-brand-primary text-[16px]">Profile Information</h2>
          <p className="text-brand-text-dim text-[13px] mt-[4px]">Manage your personal information</p>
        </div>
        <div className="p-[24px] flex flex-col gap-[20px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                NIP
              </label>
              <input
                value={nip}
                disabled
                className="bg-slate-50 border border-brand-border text-brand-text-dim rounded-[8px] px-[14px] py-[10px] text-[13px] cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                NIDN
              </label>
              <input
                value={nidn}
                disabled
                className="bg-slate-50 border border-brand-border text-brand-text-dim rounded-[8px] px-[14px] py-[10px] text-[13px] cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                Email
              </label>
              <input
                value={email}
                disabled
                className="bg-slate-50 border border-brand-border text-brand-text-dim rounded-[8px] px-[14px] py-[10px] text-[13px] cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                Program Studi
              </label>
              <input
                value={prodi}
                disabled
                className="bg-slate-50 border border-brand-border text-brand-text-dim rounded-[8px] px-[14px] py-[10px] text-[13px] cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                Full Name
              </label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="bg-white border border-brand-border text-brand-text rounded-[8px] px-[14px] py-[10px] text-[13px] focus:outline-none focus:border-brand-secondary"
              />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                Gender
              </label>
              <select
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value as "L" | "P")}
                className="bg-white border border-brand-border text-brand-text rounded-[8px] px-[14px] py-[10px] text-[13px] appearance-none focus:outline-none focus:border-brand-secondary cursor-pointer"
              >
                <option value="L">Male (Laki-laki)</option>
                <option value="P">Female (Perempuan)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className={cn(
                "font-bold text-[12px] uppercase tracking-[0.5px] px-[20px] py-[10px] rounded-[8px] transition-all flex items-center gap-[8px] shadow-sm",
                !savingProfile
                  ? "bg-brand-secondary hover:bg-brand-primary text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{savingProfile ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden">
        <div className="p-[24px] border-b border-brand-border">
          <h2 className="font-bold text-brand-primary text-[16px]">Change Password</h2>
          <p className="text-brand-text-dim text-[13px] mt-[4px]">Update your account password</p>
        </div>
        <div className="p-[24px] flex flex-col gap-[20px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[14px] py-[10px] text-[13px] focus:outline-none focus:border-brand-secondary pr-[40px]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 text-brand-text-dim hover:text-brand-text cursor-pointer"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[14px] py-[10px] text-[13px] focus:outline-none focus:border-brand-secondary pr-[40px]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-[10px] top-1/2 -translate-y-1/2 text-brand-text-dim hover:text-brand-text cursor-pointer"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[14px] py-[10px] text-[13px] focus:outline-none focus:border-brand-secondary"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              className={cn(
                "font-bold text-[12px] uppercase tracking-[0.5px] px-[20px] py-[10px] rounded-[8px] transition-all flex items-center gap-[8px] shadow-sm",
                !savingPassword && currentPassword && newPassword && confirmPassword
                  ? "bg-brand-secondary hover:bg-brand-primary text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{savingPassword ? "Changing..." : "Change Password"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden">
        <div className="p-[24px] flex flex-col gap-[12px]">
          <div>
            <h2 className="font-bold text-brand-primary text-[16px]">Sign Out</h2>
            <p className="text-brand-text-dim text-[13px] mt-[4px]">Sign out of your account on this device</p>
          </div>
          <div>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-[12px] uppercase tracking-[0.5px] px-[20px] py-[10px] rounded-[8px] transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
