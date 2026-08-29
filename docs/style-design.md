# Klas. - Design System & Styling Guide

This document outlines the styling and design rules used across all roles of the Klas. application (Mahasiswa, Dosen, Admin).

## Typography
The application uses **Plus Jakarta Sans** as the primary font family to ensure a clean, modern, and readable aesthetic across all devices.
- **Font-Family**: `'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif`
- **Headings**: Heavy weights (`font-bold`, `font-extrabold`), tight letter spacing (`tracking-tight`, `tracking-[-0.24px]`).
- **Subtitles/Labels**: All caps, letter-spaced (`tracking-[1.2px]`, `uppercase`), with smaller font sizes (`text-[10px]` to `text-[12px]`).
- **Body**: Regular weights, `text-[#444650]` or `text-[#5d5f5f]`.

## Color Palette

To maintain a consistent and unified design, we rely on the following synchronized color palette across all pages:

### Primary Brand
- **Very Dark Blue**: `#00113a` — Used for main navigational elements, top app bar text, and primary text colors.
- **Dark Blue**: `#002366` — Used for active states, prominent buttons (e.g., Scan QR, Verify), and key highlights (e.g., Attendance Metric).
- **Brand SVG Blue**: `#032262` — The raw fill color found in our `logo.svg`.

### Secondary & Accents
- **Green (Success)**: `#22c55e` — Used for positive actions, successful QR verifications, and active GPS indicators.
- **Red (Destructive)**: `#ba1a1a` — Used for "Absent" statuses and negative actions like "Sign Out".
- **Pill Backgrounds**: `#e4e1e6` (Upcoming), `#dcdddd` (Closed), `#002366` (In Session).

### Backgrounds & Borders
- **Main Canvas Background**: `#fbf8fc` — An off-white, slightly warm gray that reduces eye strain.
- **Card/Panel Surface**: `#f0edf1` — Light surface for cards and panels.
- **Admin/Dosen Canvas**: `#f8f9ff` — Page background for admin and dosen layouts.
- **Cards/Containers**: `white` (`bg-white`) — For elevated elements such as class cards or profile information blocks.
- **Borders**: `#c5c6d2` — A soft, neutral gray used for dividers, card borders, and the bottom nav border.

## Tailwind CSS Theme Configurations
The color palette and styling constants are registered directly in the Tailwind v4 `@theme` block within [app.css](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/app.css).

```css
@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif, ...;

  /* Custom Design System Brand Colors */
  --color-brand-primary: #00113a;
  --color-brand-secondary: #002366;
  --color-brand-logo: #032262;
  --color-brand-bg: #fbf8fc;
  --color-brand-surface: #f0edf1;
  --color-brand-canvas: #f8f9ff;
  --color-brand-border: #c5c6d2;

  /* Custom Text Colors */
  --color-brand-text: #00113a;
  --color-brand-text-muted: #444650;
  --color-brand-text-dim: #5d5f5f;

  /* Status Colors */
  --color-status-success: #22c55e;
  --color-status-error: #ba1a1a;
}
```

These configuration tokens can be dynamically referenced across the application components as:
- **Backgrounds**: `bg-brand-bg`, `bg-brand-primary`, `bg-brand-secondary`, `bg-brand-surface`, `bg-brand-canvas`
- **Borders**: `border-brand-border`
- **Text**: `text-brand-text`, `text-brand-text-muted`, `text-brand-text-dim`, `text-brand-primary`, `text-brand-secondary`
- **Status**: `text-status-success`, `text-status-error`, `bg-status-success`, `bg-status-error`

## Layout & Components

### Mobile-First Layout
The app shell (`layout.tsx`) centers a phone-width container on desktop (`sm:w-[500px]`) with a black bezel background (`bg-black`) on a `bg-slate-100` page background. On mobile it fills the full screen.

### Cards
- **Padding**: Generous inner padding (`px-[20px] py-[20px]`) for readability.
- **Border Radius**: Subtly rounded corners (`rounded-[10px]`).
- **Truncation**: Card titles and descriptions employ `truncate` and `min-w-0` to safely handle text overflow without breaking the layout flexbox.

### Navigation (Bottom Bar)
- Icons are sized at `22px`.
- Active items switch to `#00113a` background with `text-white`.
- Inactive items use `#5b5c66` text with a light hover effect.

### Top App Bar
- **Height**: Fixed `h-[64px]`.
- **Border**: Bottom border `border-[#c5c6d2]`.
- **Logo**: Replaced inline SVGs with a unified `<img src="/logo.svg" />` sizing to `h-[32px] w-auto`.

---
*By adhering to this design system, any new screens or components will automatically feel cohesive with the rest of the Klas application.*
