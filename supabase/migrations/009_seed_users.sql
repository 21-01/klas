-- 009_seed_users.sql
-- Auth users CANNOT be created via SQL (GoTrue bcrypt incompatibility).
-- Create via: supabase/scripts/create-auth-users.ps1 -Local
-- IMPORTANT: Never commit plaintext passwords. Use environment variables.
select 1; -- no-op
