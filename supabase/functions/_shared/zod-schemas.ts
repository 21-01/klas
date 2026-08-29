import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const checkInSchema = z.object({
  qr_token: z.string().min(1, "QR token is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const generateQrTokenSchema = z.object({
  sesi_id: z.string().uuid("Invalid session ID"),
  ttl_seconds: z.number().int().min(5).max(60),
  covers: z.number().int().min(1).max(5).optional().default(2),
});

export const provisionUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["mahasiswa", "dosen"]),
  identifier: z.string().min(1, "NIM/NIP is required"),
  prodi_id: z.number().int().positive("Program studi ID is required"),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
});

export const refreshSessionSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});
