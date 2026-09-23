-- Synthetic demo seed. No production people, clients, or Asana ids.
--
-- Login (password is public.users.special, matched exactly, then Supabase Auth):
--   demo@example.com
--   5550100199
--
-- Re-run safe: inserts use ON CONFLICT (id) DO NOTHING.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Auth ────────────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000010',
  'authenticated',
  'authenticated',
  'demo@example.com',
  extensions.crypt('5550100199', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Alex Demo"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000010',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000010',
    'email', 'demo@example.com',
    'email_verified', true
  ),
  'email',
  '00000000-0000-4000-8000-000000000010',
  now(),
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- ── Lookups the app addresses by id ─────────────────────────────────────────
INSERT INTO public.roles (id, role_key, display_name, level) VALUES
  ('00000000-0000-4000-8000-000000000101', 'super_admin', 'Super Admin', 40),
  ('00000000-0000-4000-8000-000000000102', 'admin', 'Admin', 30),
  ('00000000-0000-4000-8000-000000000103', 'senior_user', 'Senior User', 20),
  ('00000000-0000-4000-8000-000000000104', 'user', 'User', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cost_centres (id, bu_code, display, chinese_display, project_code_initial, status, expense_control_enabled, created_date) VALUES
  ('00000000-0000-4000-8000-000000000201', 'BWA', 'Acme Design Limited', 'Acme 設計有限公司', 'AD', 'Active', false, now()),
  ('4e85f232-7308-463b-8b7b-933110cbd301', 'BWF', 'Acme Furniture', 'Acme 傢俬', 'AF', 'Active', false, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_types (id, display, is_bwf, is_active, created_date) VALUES
  ('c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01', 'Project', false, true, now()),
  ('c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a02', 'Design', false, true, now()),
  ('de9950cd-bef4-4c94-8945-eb5af9351945', '3D Render', false, true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.financial_years (id, display, yy_code, date_range, created_date) VALUES
  ('00000000-0000-4000-8000-000000000301', 'FY2026', '26', '2026-01-01 to 2026-12-31', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nos_regions (id, display, chn_display, created_date) VALUES
  ('00000000-0000-4000-8000-000000000311', 'Central', '中區', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.districts (id, name, chinese_display, region, region_id, created_date) VALUES
  ('00000000-0000-4000-8000-000000000312', 'Central', '中環', 'Central', '00000000-0000-4000-8000-000000000311', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_types (id, display, chin_display, created_date) VALUES
  ('00000000-0000-4000-8000-000000000321', 'Office', '辦公室', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_types (id, display, chin_display, created_date) VALUES
  ('00000000-0000-4000-8000-000000000322', 'Fit-out', '裝修', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nos_contracts (id, display, chinese_display, rank, created_date) VALUES
  ('a5de2560-987d-4b25-ba1d-0278ab037143', 'Design and build', '設計及建造', 1, now()),
  ('7c663cb6-aaf4-4378-9e69-211f16f545ac', 'Refundable deposit', '可退按金', 2, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nos_payment_methods (id, display, created_date) VALUES
  ('c78ef0a1-46d9-41b6-a61e-f0eda646be3b', 'Cheque', now()),
  ('00000000-0000-4000-8000-000000000331', 'Bank transfer', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nos_bv_values (id, value, created_date) VALUES
  ('00000000-0000-4000-8000-000000000341', '40000', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_file_types (id, type, created_date) VALUES
  ('37b3e05b-dd02-4a8b-b143-712eb8a02eb5', 'Business registration', now()),
  ('ff6045cc-a51c-46ef-bde0-b37e6c02ad65', 'Insurance', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.supplier_types (id, display, chinese_display, is_bwf, "order", is_active, created_date) VALUES
  ('00000000-0000-4000-8000-000000000351', 'Fit-out', '裝修', false, 1, true, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nos_customer_tags_collection (id, display, "order", created_date) VALUES
  ('4f5de598-2dcb-45a6-a106-9d933e9a8007', 'Industry', 1, now()),
  ('3ec5145d-19dd-45d0-b0cf-8ffed5114e81', 'Brand group', 2, now()),
  ('eb5a7764-9ebf-4829-9991-db09538aab76', 'Decision maker', 3, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.nos_customer_tags (id, display, collection_id, created_date) VALUES
  ('63175251-2c31-46e6-b107-cbe0140983d8', 'Sample brand', '3ec5145d-19dd-45d0-b0cf-8ffed5114e81', now()),
  ('00000000-0000-4000-8000-000000000361', 'Retail', '4f5de598-2dcb-45a6-a106-9d933e9a8007', now())
ON CONFLICT (id) DO NOTHING;

-- ── Staff (company handler id is the one the app code uses) ────────────────
INSERT INTO public.staff (
  id, name, full_name, email, role, status, "position",
  bu_id, n_team_type_id, work_phone, quote_initial, created_date
) VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Acme', 'Acme', NULL, 'Company', 'Active', 'Company',
    '00000000-0000-4000-8000-000000000201',
    NULL, NULL, 'AC', now()
  ),
  (
    '00000000-0000-4000-8000-000000000010',
    'Alex Demo', 'Alex Demo', 'demo@example.com', 'Super Admin', 'Active', 'Project Manager',
    '00000000-0000-4000-8000-000000000201',
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01', '55501001', 'AD', now()
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    'Blair Demo', 'Blair Demo', 'blair@example.com', 'User', 'Active', 'Designer',
    '00000000-0000-4000-8000-000000000201',
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a02', '55501002', 'BD', now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Casey Finance', 'Casey Finance', 'finance@example.com', 'Admin', 'Active', 'Finance',
    '00000000-0000-4000-8000-000000000201',
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01', '55501003', 'CF', now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Drew Example', 'Drew Example', 'drew@example.com', 'User', 'Active', 'Coordinator',
    '00000000-0000-4000-8000-000000000201',
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01', '55501004', 'DE', now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id, email, user_type, special, member_id, auth_user_id,
  approval_status, is_developer, view_system, created_date, modified_date
) VALUES (
  '00000000-0000-4000-8000-000000000020',
  'demo@example.com',
  'Staff',
  '5550100199',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000010',
  'approved',
  true,
  'Both',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.permissions (id, module, action, display_name) VALUES
  ('00000000-0000-4000-8000-000000000401', '*', '*', 'Demo allow all')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.permission_assignments (
  id, permission_id, dimension, dimension_value, effect, priority
) VALUES (
  '00000000-0000-4000-8000-000000000402',
  '00000000-0000-4000-8000-000000000401',
  'role',
  'super_admin',
  'allow',
  100
) ON CONFLICT (id) DO NOTHING;

-- ── Parties ─────────────────────────────────────────────────────────────────
INSERT INTO public.customers (
  id, customer_name, display_name, company_name, brand_name_en,
  email, phone_display, status, status_filter_value, view_system, created_date
) VALUES
  (
    '00000000-0000-4000-8000-000000000501',
    'Northwind Cafe', 'Northwind Cafe', 'Northwind Cafe Ltd', 'Northwind',
    'hello@northwind.example', '55502001', 'Active', 'Client', 'Both', now()
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    'Contoso Market', 'Contoso Market', 'Contoso Market Ltd', 'Contoso',
    'hello@contoso.example', '55502002', 'Active', 'Enquiry', 'BWA', now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (
  id, display_name, chinese_name, email, contact1_phone, account_status, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000511',
  'Harbor Fit-out', '海港裝修', 'sales@harbor.example', '55503001', 'Active', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.factories (
  id, factory_name, factory_eng_name, display_name, email, phone, location, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000521',
  'Acme Plant', 'Acme Plant', 'Acme Plant', 'plant@acme.example', '55504001', 'Shenzhen', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.buildings (
  id, building_name, building_name_eng, address, district, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000531',
  'Demo Tower', 'Demo Tower', '1 Example Road', 'Central', now()
) ON CONFLICT (id) DO NOTHING;

-- ── BWA pitching and projects ───────────────────────────────────────────────
INSERT INTO public.bwa_pitchings (
  id, pitching_code, pitching_stages, description, site_address,
  enquiry_date, estimated_income, estimated_expense,
  customer_id, main_pm_id, main_designer_id, n_team_type_id,
  n_financial_year_id, n_service_type_id, district_id, r_building_id,
  real_customer_display_name, real_building_name, created_date
) VALUES
  (
    '00000000-0000-4000-8000-000000000601',
    'P-2601', 'Pitching', 'Lobby refresh for a sample cafe', '1 Example Road',
    '2026-08-01', 180000, 110000,
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000012',
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000322',
    '00000000-0000-4000-8000-000000000312',
    '00000000-0000-4000-8000-000000000531',
    'Contoso Market', 'Demo Tower', now()
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    'P-2602', 'Confirmed Project', 'Cafe counter and seating', '1 Example Road',
    '2026-02-01', 500000, 320000,
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000012',
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000322',
    '00000000-0000-4000-8000-000000000312',
    '00000000-0000-4000-8000-000000000531',
    'Northwind Cafe', 'Demo Tower', now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bwa_projects (
  id, project_code, project_name, status, site_address,
  enquiry_date, signed_date, start_date, handover_date,
  estimated_income, estimated_expense, estimated_profit,
  customer_id, pitching_id, cost_centre_id, main_pm_id, main_designer_id,
  n_team_type_id, n_financial_year_id, n_service_type_id,
  r_nos_district_id, r_building_id, supplier_id,
  real_customer_display_name, real_building_name, real_cost_centre,
  created_date
) VALUES (
  '00000000-0000-4000-8000-000000000611',
  'AD26001', 'Northwind Cafe counter', 'Work In Progress', '1 Example Road',
  '2026-02-01', '2026-03-15', '2026-04-01', '2026-11-30',
  500000, 320000, 180000,
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000602',
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000012',
  'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000322',
  '00000000-0000-4000-8000-000000000312',
  '00000000-0000-4000-8000-000000000531',
  '00000000-0000-4000-8000-000000000511',
  'Northwind Cafe', 'Demo Tower', 'Acme Design Limited',
  now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.incomes (
  id, project_id, income_amount, payment_amount, outstanding,
  payment_status, due_date, n_contract_type_id, type_display,
  remark, created_date
) VALUES
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000611',
    200000, 80000, 120000,
    'Pending Check', '2026-08-01',
    'a5de2560-987d-4b25-ba1d-0278ab037143', 'Design and build',
    'First installment, still open', now()
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000611',
    150000, 150000, 0,
    'Received', '2026-05-01',
    'a5de2560-987d-4b25-ba1d-0278ab037143', 'Design and build',
    'Deposit received', now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.expenses (
  id, project_id, supplier_id, installment_amount, paid_amount, outstanding,
  payment_status, n_contract_type_id, n_supplier_type_id, payment_method_id,
  type_display, remark_t, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000711',
  '00000000-0000-4000-8000-000000000611',
  '00000000-0000-4000-8000-000000000511',
  100000, 40000, 60000,
  'Pending Check',
  'a5de2560-987d-4b25-ba1d-0278ab037143',
  '00000000-0000-4000-8000-000000000351',
  '00000000-0000-4000-8000-000000000331',
  'Fit-out', 'Sample site works', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_bv (
  id, project_id, handler_id, handler, ratio,
  n_team_type_id, n_financial_year_id, signed_date, created_date
) VALUES
  (
    '00000000-0000-4000-8000-000000000721',
    '00000000-0000-4000-8000-000000000611',
    '00000000-0000-4000-8000-000000000001',
    'Acme', 30,
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
    '00000000-0000-4000-8000-000000000301',
    '2026-03-15', now()
  ),
  (
    '00000000-0000-4000-8000-000000000722',
    '00000000-0000-4000-8000-000000000611',
    '00000000-0000-4000-8000-000000000010',
    'Alex Demo', 70,
    'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
    '00000000-0000-4000-8000-000000000301',
    '2026-03-15', now()
  )
ON CONFLICT (id) DO NOTHING;

-- ── BWF pitching and project ────────────────────────────────────────────────
INSERT INTO public.bwf_pitchings (
  id, pitching_code, pitching_name, pitching_stages,
  enquiry_date, estimated_income, estimated_expense,
  customer_id, main_pm_id, main_designer_id, n_team_type_id, n_financial_year_id,
  real_customer_display_name, site_address, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000801',
  'F-2601', 'Northwind seating', 'Pitching',
  '2026-07-01', 90000, 54000,
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000012',
  'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
  '00000000-0000-4000-8000-000000000301',
  'Northwind Cafe', '1 Example Road', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bwf_projects (
  id, project_code, project_name, status, site_address,
  enquiry_date, signed_date, estimated_income, estimated_expense, estimated_profit,
  customer_id, bwf_pitching_id, cost_center_id, main_pm_id,
  n_team_type_id, n_financial_year_id, factories_id,
  real_customer_display_name, real_cost_centre, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000811',
  'AF26001', 'Northwind seating', 'Work In Progress', '1 Example Road',
  '2026-07-01', '2026-07-20', 90000, 54000, 36000,
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000801',
  '4e85f232-7308-463b-8b7b-933110cbd301',
  '00000000-0000-4000-8000-000000000010',
  'c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000521',
  'Northwind Cafe', 'Acme Furniture', now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.news (
  id, title, body_text, is_active, creator_member_id, created_date
) VALUES (
  '00000000-0000-4000-8000-000000000901',
  'Welcome to the Acme demo',
  'Sample workspace. Live Asana, email, and WhatsApp are turned off.',
  true,
  '00000000-0000-4000-8000-000000000010',
  now()
) ON CONFLICT (id) DO NOTHING;
