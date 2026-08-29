export default function TopAppBar() {
  return (
    <header className="bg-brand-bg border-brand-border border-b border-solid flex h-[64px] items-center justify-between px-[24px] relative shrink-0 w-full z-10">
      <div className="flex items-center gap-[16px]">
        <img src="/logo.svg" alt="KLAS Logo" className="h-[32px] w-auto" />
        <span className="font-bold text-[24px] tracking-tight text-brand-text">KLAS</span>
      </div>
    </header>
  );
}
