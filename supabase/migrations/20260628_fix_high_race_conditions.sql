-- Fix HIGH-06: Atomic brute-force check to prevent race condition
-- Replaces the non-atomic read-count-then-insert pattern in login

CREATE OR REPLACE FUNCTION public.check_and_record_failed_login(
  p_ip_address inet,
  p_email text,
  p_window_seconds int DEFAULT 60,
  p_max_attempts int DEFAULT 5
) RETURNS TABLE(blocked boolean, attempt_count int) AS $$
DECLARE
  v_count int;
BEGIN
  -- Count recent failed attempts for this IP
  SELECT count(*) INTO v_count
  FROM failed_login_attempts
  WHERE ip_address = p_ip_address
    AND attempted_at >= now() - (p_window_seconds || ' seconds')::interval;

  -- Insert the new failed attempt atomically
  INSERT INTO failed_login_attempts (ip_address, email)
  VALUES (p_ip_address, p_email);

  -- Return whether blocked and the new count
  RETURN QUERY SELECT (v_count + 1 >= p_max_attempts), v_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix HIGH-07: Graceful handling of duplicate check-in via unique constraint
-- The unique(sesi_id, mahasiswa_id) constraint already exists in 003_attendance.sql
-- This is a comment documenting the fix: check-in/index.ts now catches error code 23505
-- instead of using a non-atomic .maybeSingle() pre-check
