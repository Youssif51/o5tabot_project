-- ============================================================
-- 002: Seed SuperAdmin Account
-- ============================================================
-- Run this ONCE after 001_user_auth_system.sql
-- 
-- OPTION A (Recommended): Create user via Supabase Dashboard first
-- 1. Go to Supabase Dashboard → Authentication → Users → "Add User"
-- 2. Email: yousif.m.d.2002@gmail.com
-- 3. Password: A5-SFSF  
-- 4. Check "Auto-confirm email"
-- 5. Click "Create User"
-- 6. Copy the User UUID from the table
-- 7. Replace 'REPLACE_WITH_UUID' below with the actual UUID
-- 8. Run the INSERT below

INSERT INTO user_profiles (id, name, role, is_active, created_by)
VALUES (
  'REPLACE_WITH_UUID', -- ← Replace with UUID from Supabase Dashboard
  'Yousif',
  'SuperAdmin',
  true,
  NULL
);

-- ============================================================
-- OPTION B (Alternative): Create user directly via SQL
-- WARNING: This directly writes to auth schema. Use Option A if possible.
-- ============================================================
-- DO $$
-- DECLARE
--   new_id UUID := gen_random_uuid();
-- BEGIN
--   INSERT INTO auth.users (
--     instance_id, id, aud, role, email,
--     encrypted_password, email_confirmed_at,
--     created_at, updated_at,
--     raw_app_meta_data, raw_user_meta_data,
--     is_super_admin, confirmation_token
--   ) VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     new_id, 'authenticated', 'authenticated',
--     'yousif.m.d.2002@gmail.com',
--     crypt('A5-SFSF', gen_salt('bf')),
--     now(), now(), now(),
--     '{"provider":"email","providers":["email"]}'::jsonb,
--     '{"name":"Yousif"}'::jsonb,
--     false, ''
--   );
--   
--   INSERT INTO auth.identities (
--     id, user_id, identity_data, provider, provider_id,
--     last_sign_in_at, created_at, updated_at
--   ) VALUES (
--     gen_random_uuid(), new_id,
--     jsonb_build_object('sub', new_id::text, 'email', 'yousif.m.d.2002@gmail.com', 'email_verified', true),
--     'email', new_id::text, now(), now(), now()
--   );
--   
--   INSERT INTO user_profiles (id, name, role, is_active, created_by)
--   VALUES (new_id, 'Yousif', 'SuperAdmin', true, NULL);
-- END $$;
