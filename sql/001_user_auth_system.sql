-- ============================================================
-- 001: User Authentication & Profiles System
-- ============================================================
-- Run this FIRST in Supabase SQL Editor

-- UP Migration
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SuperAdmin', 'Admin', 'Staff')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id) NULL,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY "users_read_own_profile" ON user_profiles
FOR SELECT USING (id = auth.uid());

-- SuperAdmin reads all profiles
CREATE POLICY "superadmin_reads_all" ON user_profiles
FOR SELECT USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'SuperAdmin'
);

-- Admin reads Staff profiles only
CREATE POLICY "admin_reads_staff" ON user_profiles
FOR SELECT USING (
  role = 'Staff'
  AND (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

-- Only SuperAdmin can INSERT/UPDATE/DELETE Admin or SuperAdmin profiles
CREATE POLICY "superadmin_manages_admins" ON user_profiles
FOR ALL USING (
  CASE 
    WHEN role IN ('Admin', 'SuperAdmin')
    THEN (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'SuperAdmin'
    ELSE false
  END
);

-- Admin or SuperAdmin can INSERT/UPDATE/DELETE Staff profiles
CREATE POLICY "admin_manages_staff" ON user_profiles
FOR ALL USING (
  CASE
    WHEN role = 'Staff'
    THEN (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
    ELSE false
  END
);

-- ============================================================
-- RPC Function: Create User Account (called from frontend)
-- Uses SECURITY DEFINER to access auth schema
-- ============================================================
CREATE OR REPLACE FUNCTION create_user_account(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_role TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_user_id UUID;
  caller_role TEXT;
BEGIN
  -- Get caller's role
  SELECT role INTO caller_role FROM user_profiles WHERE id = auth.uid();
  
  -- Permission checks
  IF p_role IN ('Admin', 'SuperAdmin') AND caller_role != 'SuperAdmin' THEN
    RETURN jsonb_build_object('error', 'Only SuperAdmin can create Admin accounts');
  END IF;
  
  IF p_role = 'Staff' AND caller_role NOT IN ('Admin', 'SuperAdmin') THEN
    RETURN jsonb_build_object('error', 'Only Admin or SuperAdmin can create Staff accounts');
  END IF;
  
  IF p_role NOT IN ('Admin', 'Staff') THEN
    RETURN jsonb_build_object('error', 'Invalid role. Must be Admin or Staff');
  END IF;

  -- Generate new UUID
  new_user_id := gen_random_uuid();

  -- Create auth user
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name),
    false, ''
  );

  -- Create auth identity
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email, 'email_verified', true),
    'email',
    new_user_id::text,
    now(), now(), now()
  );

  -- Create user profile
  INSERT INTO user_profiles (id, name, role, is_active, created_by)
  VALUES (new_user_id, p_name, p_role, true, auth.uid());

  RETURN jsonb_build_object('success', true, 'user_id', new_user_id);
END;
$$;

-- ============================================================
-- RPC Function: Toggle User Active Status
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_user_active(p_user_id UUID, p_active BOOLEAN)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM user_profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM user_profiles WHERE id = p_user_id;
  
  IF target_role IN ('Admin', 'SuperAdmin') AND caller_role != 'SuperAdmin' THEN
    RETURN jsonb_build_object('error', 'Only SuperAdmin can modify Admin accounts');
  END IF;
  
  IF target_role = 'Staff' AND caller_role NOT IN ('Admin', 'SuperAdmin') THEN
    RETURN jsonb_build_object('error', 'Insufficient permissions');
  END IF;

  UPDATE user_profiles SET is_active = p_active WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- RPC Function: Delete User Account
-- ============================================================
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role TEXT;
  target_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM user_profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM user_profiles WHERE id = p_user_id;
  
  IF target_role = 'SuperAdmin' THEN
    RETURN jsonb_build_object('error', 'Cannot delete SuperAdmin');
  END IF;
  
  IF target_role = 'Admin' AND caller_role != 'SuperAdmin' THEN
    RETURN jsonb_build_object('error', 'Only SuperAdmin can delete Admin accounts');
  END IF;
  
  IF target_role = 'Staff' AND caller_role NOT IN ('Admin', 'SuperAdmin') THEN
    RETURN jsonb_build_object('error', 'Insufficient permissions');
  END IF;

  -- Delete profile first (FK constraint)
  DELETE FROM user_profiles WHERE id = p_user_id;
  -- Delete auth user
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- ROLLBACK (run to undo everything above)
-- ============================================================
-- DROP FUNCTION IF EXISTS delete_user_account(UUID);
-- DROP FUNCTION IF EXISTS toggle_user_active(UUID, BOOLEAN);
-- DROP FUNCTION IF EXISTS create_user_account(TEXT, TEXT, TEXT, TEXT);
-- DROP POLICY IF EXISTS "admin_manages_staff" ON user_profiles;
-- DROP POLICY IF EXISTS "superadmin_manages_admins" ON user_profiles;
-- DROP POLICY IF EXISTS "admin_reads_staff" ON user_profiles;
-- DROP POLICY IF EXISTS "superadmin_reads_all" ON user_profiles;
-- DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
-- DROP TABLE IF EXISTS user_profiles;
