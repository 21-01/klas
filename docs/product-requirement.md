# PRODUCT REQUIREMENTS DOCUMENT
**Project Name:** KLAS - Geospatial Presence Verification[cite: 1]

## 1. Product Overview
KLAS is a standalone web-based presence verification system designed to modernize academic administration[cite: 1]. The system guarantees the integrity of student attendance data through a multi-layered verification mechanism combining dynamic QR codes, geographic coordinates (geofencing), and campus network IP address filtering[cite: 1]. It utilizes a Client-BaaS architecture utilizing React for the frontend and Supabase for the backend[cite: 1].

## 2. User Roles & Permissions (RBAC)
The system strictly isolates data access using PostgreSQL Row Level Security (RLS) based on three primary actors[cite: 1]:

*   **Mahasiswa (Student):**
    *   **Access Level:** Low-Level Access[cite: 1].
    *   **Permissions:** Insert-only rights on the attendance table via Edge Functions[cite: 1]. Read-only rights restricted to their own historical records matched via JWT token sub claims[cite: 1].
    *   **Interface:** Mobile-first, portrait orientation optimized[cite: 1].
*   **Dosen (Lecturer):**
    *   **Access Level:** Mid-Level Access[cite: 1].
    *   **Permissions:** Read rights for attendance logs and student entities exclusively for their assigned classes[cite: 1]. Update rights to execute manual overrides (e.g., Sick, Leave, Absent)[cite: 1].
    *   **Interface:** Tablet and class projector layouts[cite: 1].
*   **Admin Prodi (Program Administrator):**
    *   **Access Level:** High-Level Access[cite: 1].
    *   **Permissions:** Full CRUD authority on all master tables (users, courses, schedules, security parameters) bypassing individual RLS restrictions[cite: 1].
    *   **Interface:** Desktop-focused for managing complex master data tables[cite: 1].

## 3. Core System Features

### 3.1. Dynamic QR Code Engine
*   The system generates encrypted QR codes containing the Schedule ID, Server Timestamp, and a random cryptographic salt token[cite: 1].
*   QR codes have a strict Time-to-Live (TTL) of maximum 15 seconds to prevent illegal sharing[cite: 1].
*   The code automatically regenerates in the background upon TTL expiration without disrupting real-time monitoring[cite: 1].

### 3.2. Geospatial & Network Verification (Multi-layered)
*   **Geofencing:** Extracts Latitude and Longitude using the Browser Geolocation API and calculates the spatial distance to the absolute center of the classroom using the Haversine formula (implemented in `_shared/geofence.ts`) on the server.
*   **IP Filtering:** Automatically extracts client IP parameters via HTTP request headers (e.g., `x-forwarded-for`) and matches the public IP address against a whitelist of campus subnet masks stored in the `ip_whitelist` table.
*   If either spatial or network verification fails, attendance requests are rejected with a descriptive error message.

### 3.3. Real-Time Data Synchronization & Class Management
*   Lecturer dashboards automatically update attendance lists with ultra-low latency (max 500ms) using WebSocket protocols (Supabase Realtime) without requiring page refreshes[cite: 1].
*   Lecturers have the authority to initiate, monitor, and close class sessions[cite: 1].
*   Lecturers can manually override attendance states to bypass machine verification in case of technical anomalies[cite: 1].

### 3.4. Master Data Management (MDM) & Reporting
*   Admins manage student, lecturer, and course entities, map class schedules, and set absolute classroom coordinates and IP whitelists[cite: 1].
*   The system provides visual dashboards for attendance trends and an Early Warning System highlighting students with attendance below 75%[cite: 1].
*   Supports exporting official reports (BAP) to Microsoft Excel (.xlsx) and printable PDF summary cards with QR validation[cite: 1].

### 3.5. Notifications & Audit Logs
*   Delivers In-App Notifications via Supabase Realtime (WebSocket subscriptions) for key events (e.g., geofence violations, session closures, check-in confirmations).
*   Maintains strict read-only / append-only Audit Logs for crucial activities (logins, session changes, manual overrides, admin changes) to prevent non-repudiation.

## 4. Non-Functional Requirements
*   **Performance:** Must handle at least 500 concurrent check-in requests within a 10-second window without degrading service[cite: 1]. Standard API responses must be under 300ms, and spatial edge functions under 1.5 seconds[cite: 1].
*   **Security:** All data payloads must be transmitted via HTTPS (TLS 1.2/1.3) to prevent Man-in-the-Middle attacks[cite: 1]. The system must validate realistic coordinates to mitigate GPS spoofing[cite: 1].
*   **Usability:** Mahasiswa must be able to complete the attendance check-in workflow within a maximum of "Three Clicks" (3-Click Rule)[cite: 1].
*   **Availability:** Targeted Service Level Agreement (SLA) uptime is 99.9% during active academic workdays[cite: 1].

## 5. Technology Stack & Architecture

### 5.1 Frontend
*   **Core Library:** React 19 with component-based architecture (strict separation of UI render from data fetching/state management).
*   **Framework:** React Router v8 (SSR enabled) for routing and data loading.
*   **Styling:** Tailwind CSS v4 (utility-first, using `@tailwindcss/vite` plugin).
*   **Target Environments:** Mobile-first portrait (Mahasiswa), Tablet/Projector (Dosen), Desktop (Admin Prodi).

### 5.2 Backend & Infrastructure
*   **Platform:** Supabase (BaaS). **Custom servers are strictly forbidden** (no Node.js/Express).
*   **Serverless Logic:** Supabase Edge Functions (Deno runtime) for all server-side logic — QR validation, IP extraction, spatial computation. Each function in `supabase/functions/<name>/index.ts` with TypeScript + Zod schema validation.
*   **Database:** PostgreSQL 17 with PostGIS extension. Geofencing uses Haversine formula (not `ST_Distance`) for distance calculation.
*   **Auth:** Supabase Auth (email/password). JWT tokens contain `auth.uid()` and role claim.

### 5.3 Real-Time & Notifications
*   **Data Sync:** WebSockets via Supabase Realtime (Postgres CDC on `presensi`, `sesi_kehadiran`, `notifikasi` tables). HTTP polling is explicitly forbidden.
*   **Notifications:** In-app only via Supabase Realtime subscriptions (no push notifications).

### 5.4 Browser APIs
*   **Camera:** `MediaDevices.getUserMedia()` for QR code scanning.
*   **Location:** HTML5 Geolocation API for high-accuracy coordinate extraction.

### 5.5 Transport Security
*   All payloads over HTTPS/WSS (TLS 1.2 or 1.3).