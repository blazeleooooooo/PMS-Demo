-- Demo public schema, squashed from a schema-only dump.
-- No table rows. No cron jobs were in public.
-- Removed public.exec_sql (security definer arbitrary SQL, granted to anon).
-- bwf_product_master.id default uses gen_random_uuid() instead of extensions.uuid_generate_v4().
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


-- ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: auto_close_stale_pitchings(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  today_hk date := (NOW() AT TIME ZONE 'Asia/Hong_Kong')::date;
  cutoff date;
  bwa_affected integer := 0;
  bwf_affected integer := 0;
BEGIN
  IF p_deadline_days IS NULL OR p_deadline_days < 1 THEN
    RAISE EXCEPTION 'p_deadline_days must be >= 1';
  END IF;

  cutoff := today_hk - p_deadline_days;

  UPDATE bwa_pitchings p
  SET
    pitching_stages = 'Case Closed',
    modified_date = NOW()
  WHERE lower(trim(COALESCE(p.pitching_stages, ''))) NOT IN (
      'confirmed project',
      'case closed'
    )
    AND COALESCE(p.enquiry_date::date, p.created_date::date) IS NOT NULL
    AND COALESCE(p.enquiry_date::date, p.created_date::date) <= cutoff
    AND NOT EXISTS (
      SELECT 1
      FROM bwa_projects proj
      WHERE proj.pitching_id = p.id
    );

  GET DIAGNOSTICS bwa_affected = ROW_COUNT;

  UPDATE bwf_pitchings p
  SET
    pitching_stages = 'Case Closed',
    modified_date = NOW()
  WHERE lower(trim(COALESCE(p.pitching_stages, ''))) NOT IN (
      'confirmed project',
      'case closed'
    )
    AND COALESCE(p.enquiry_date::date, p.created_date::date) IS NOT NULL
    AND COALESCE(p.enquiry_date::date, p.created_date::date) <= cutoff
    AND NOT EXISTS (
      SELECT 1
      FROM bwf_projects proj
      WHERE proj.bwf_pitching_id = p.id
    );

  GET DIAGNOSTICS bwf_affected = ROW_COUNT;

  RETURN bwa_affected + bwf_affected;
END;
$$;


ALTER FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer) OWNER TO postgres;

--
-- Name: FUNCTION auto_close_stale_pitchings(p_deadline_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer) IS 'Sets pitching_stages to Case Closed for BWA/BWF pitchings whose enquiry_date (fallback created_date) is older than p_deadline_days. Skips Confirmed Project, Case Closed, and pitchings linked to bwa_projects/bwf_projects.';


--
-- Name: check_permission(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_permission(p_user_id uuid, p_module text, p_action text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_role_key TEXT;
    v_bu_id TEXT;
    v_team_id TEXT;
    v_position TEXT;
    v_staff_id TEXT;
    v_result TEXT;
    v_parent_module TEXT;
BEGIN
    SELECT
        COALESCE(
            CASE lower(COALESCE(s.role, 'user'))
                WHEN 'super admin' THEN 'super_admin'
                WHEN 'admin' THEN 'admin'
                WHEN 'senior user' THEN 'senior_user'
                WHEN 'user' THEN 'user'
                ELSE lower(replace(COALESCE(s.role, 'user'), ' ', '_'))
            END,
            'user'
        ),
        s.bu_id::TEXT,
        s.n_team_type_id::TEXT,
        s.position,
        s.id::TEXT
    INTO v_role_key, v_bu_id, v_team_id, v_position, v_staff_id
    FROM staff s
    WHERE s.id = p_user_id
      AND s.status = 'Active'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
        RETURN TRUE;
    END IF;

    IF position('.' in p_module) > 0 THEN
        v_parent_module := split_part(p_module, '.', 1);
    ELSE
        v_parent_module := NULL;
    END IF;

    SELECT pa.effect INTO v_result
    FROM permission_assignments pa
    JOIN permissions p ON p.id = pa.permission_id
    WHERE (
        (pa.dimension = 'role' AND pa.dimension_value = v_role_key)
        OR (pa.dimension = 'bu' AND v_bu_id IS NOT NULL AND pa.dimension_value = v_bu_id)
        OR (pa.dimension = 'team' AND v_team_id IS NOT NULL AND pa.dimension_value = v_team_id)
        OR (pa.dimension = 'position' AND v_position IS NOT NULL AND pa.dimension_value = v_position)
        OR (pa.dimension = 'user' AND pa.dimension_value = v_staff_id)
        OR (pa.dimension = 'special' AND pa.dimension_value = v_staff_id)
    )
    AND (
        (p.module = p_module AND p.action = p_action)
        OR (p.module = p_module AND p.action = '*')
        OR (v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = p_action)
        OR (v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = '*')
        OR (p.module = '*' AND p.action = p_action)
        OR (p.module = '*' AND p.action = '*')
    )
    ORDER BY
        CASE
            WHEN p.module = p_module AND p.action = p_action THEN 6
            WHEN p.module = p_module AND p.action = '*' THEN 5
            WHEN v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = p_action THEN 4
            WHEN v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = '*' THEN 3
            WHEN p.module = '*' AND p.action = p_action THEN 2
            ELSE 1
        END DESC,
        CASE pa.dimension
            WHEN 'special' THEN 60
            WHEN 'user' THEN 50
            WHEN 'position' THEN 40
            WHEN 'team' THEN 30
            WHEN 'bu' THEN 20
            WHEN 'role' THEN 10
            ELSE COALESCE(pa.priority, 0)
        END DESC,
        pa.priority DESC,
        pa.effect DESC
    LIMIT 1;

    IF v_result IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN v_result = 'allow';
END;
$$;


ALTER FUNCTION public.check_permission(p_user_id uuid, p_module text, p_action text) OWNER TO postgres;

--
-- Name: check_specific_rule(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_specific_rule(p_user_id uuid, p_module text, p_rule_key text, p_context jsonb DEFAULT '{}'::jsonb) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_role_key TEXT;
    v_bu_id TEXT;
    v_team_id TEXT;
    v_position TEXT;
    v_staff_id TEXT;
    v_rule RECORD;
    v_condition JSONB;
    v_field TEXT;
    v_operator TEXT;
    v_expected JSONB;
    v_actual JSONB;
    v_match BOOLEAN;
BEGIN
    -- Resolve user dimensions from staff table
    SELECT
        CASE lower(s.role)
            WHEN 'super admin' THEN 'super_admin'
            WHEN 'admin' THEN 'admin'
            WHEN 'senior user' THEN 'senior_user'
            WHEN 'user' THEN 'user'
            ELSE lower(replace(s.role, ' ', '_'))
        END,
        s.bu_id::TEXT,
        s.n_team_type_id::TEXT,
        s.position,
        s.id::TEXT
    INTO v_role_key, v_bu_id, v_team_id, v_position, v_staff_id
    FROM staff s
    WHERE s.id = p_user_id
      AND s.status = 'Active'
    LIMIT 1;

    -- If no staff found, return null (no rule applies)
    IF v_staff_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find matching specific_rules ordered by priority
    FOR v_rule IN
        SELECT sr.*
        FROM specific_rules sr
        WHERE sr.module = p_module
          AND sr.rule_key = p_rule_key
          AND sr.is_active = TRUE
          AND (
              (sr.dimension = 'role' AND sr.dimension_value = v_role_key)
              OR (sr.dimension = 'bu' AND v_bu_id IS NOT NULL AND sr.dimension_value = v_bu_id)
              OR (sr.dimension = 'team' AND v_team_id IS NOT NULL AND sr.dimension_value = v_team_id)
              OR (sr.dimension = 'position' AND v_position IS NOT NULL AND sr.dimension_value = v_position)
              OR (sr.dimension = 'user' AND sr.dimension_value = v_staff_id)
          )
        ORDER BY sr.priority DESC, sr.effect ASC
    LOOP
        -- Evaluate condition_json against p_context
        v_condition := v_rule.condition_json;
        v_field := v_condition->>'field';
        v_operator := v_condition->>'operator';
        v_expected := v_condition->'value';

        -- Get actual value from context
        v_actual := p_context->v_field;

        -- If the field doesn't exist in context, skip this rule
        IF v_actual IS NULL AND NOT p_context ? v_field THEN
            CONTINUE;
        END IF;

        -- Evaluate condition based on operator
        v_match := FALSE;
        CASE v_operator
            WHEN '=' THEN
                v_match := (v_actual = v_expected);
            WHEN '!=' THEN
                v_match := (v_actual != v_expected);
            WHEN 'in' THEN
                v_match := (v_actual <@ v_expected);
            WHEN 'not_in' THEN
                v_match := NOT (v_actual <@ v_expected);
            WHEN '>' THEN
                v_match := ((v_actual->>0)::NUMERIC > (v_expected->>0)::NUMERIC);
            WHEN '<' THEN
                v_match := ((v_actual->>0)::NUMERIC < (v_expected->>0)::NUMERIC);
            WHEN '>=' THEN
                v_match := ((v_actual->>0)::NUMERIC >= (v_expected->>0)::NUMERIC);
            WHEN '<=' THEN
                v_match := ((v_actual->>0)::NUMERIC <= (v_expected->>0)::NUMERIC);
            ELSE
                v_match := FALSE;
        END CASE;

        -- If condition matches, return this rule's effect (first matching highest priority wins)
        IF v_match THEN
            RETURN v_rule.effect;
        END IF;
    END LOOP;

    -- No matching rule found
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.check_specific_rule(p_user_id uuid, p_module text, p_rule_key text, p_context jsonb) OWNER TO postgres;

--
-- Name: compute_bwa_os_schedule_group(uuid, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.compute_bwa_os_schedule_group(p_service_type_id uuid, p_estimated_income numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  v_result TEXT := NULL;
BEGIN
  IF p_service_type_id = '00231877-eae1-4ade-9217-77a773be6a62'::uuid THEN
    v_result := 'Design & Build';
  ELSIF p_service_type_id = '7db39dd1-24d6-43fd-bb48-438795c39e16'::uuid THEN
    v_result := 'Design Only';
  ELSIF p_service_type_id = '6a5b42cc-872d-436f-9bdd-a5159f0629ce'::uuid THEN
    v_result := 'Build Only';
  END IF;

  IF p_estimated_income IS NOT NULL THEN
    IF p_estimated_income >= 40000 AND p_estimated_income <= 150000 THEN
      v_result := 'Small Build (<$40-150K)';
    END IF;
    IF p_estimated_income < 30000 THEN
      v_result := 'Mini Build (<$30K)';
    END IF;
  END IF;

  RETURN v_result;
END;
$_$;


ALTER FUNCTION public.compute_bwa_os_schedule_group(p_service_type_id uuid, p_estimated_income numeric) OWNER TO postgres;


--
-- Name: expense_control_waivers_no_overlap(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expense_control_waivers_no_overlap() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  conflict_key text;
BEGIN
  NEW.updated_at := now();
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;
  SELECT k INTO conflict_key
  FROM unnest(NEW.item_keys) AS k
  WHERE EXISTS (
    SELECT 1
    FROM public.expense_control_waivers w
    WHERE w.bwa_project_id = NEW.bwa_project_id
      AND w.status IN ('pending', 'approved')
      AND (TG_OP = 'INSERT' OR w.id IS DISTINCT FROM NEW.id)
      AND k = ANY (w.item_keys)
  )
  LIMIT 1;
  IF conflict_key IS NOT NULL THEN
    RAISE EXCEPTION 'Item key % already has a pending or approved waiver for this project', conflict_key
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.expense_control_waivers_no_overlap() OWNER TO postgres;

--
-- Name: explain_permission_resolution(uuid, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.explain_permission_resolution(p_user_id uuid, p_module text, p_action text DEFAULT 'view'::text) RETURNS TABLE(layer_order integer, dimension text, dimension_label text, dimension_rank integer, staff_value text, staff_value_label text, assignment_effect text, assignment_priority integer, is_winner boolean, resolved_effect text, resolved_allowed boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_role_key TEXT;
    v_role_label TEXT;
    v_bu_id TEXT;
    v_bu_label TEXT;
    v_team_id TEXT;
    v_team_label TEXT;
    v_position TEXT;
    v_staff_id TEXT;
    v_staff_name TEXT;
    v_parent_module TEXT;
BEGIN
    SELECT
        CASE lower(s.role)
            WHEN 'super admin' THEN 'super_admin'
            WHEN 'admin' THEN 'admin'
            WHEN 'senior user' THEN 'senior_user'
            WHEN 'user' THEN 'user'
            ELSE lower(replace(COALESCE(s.role, ''), ' ', '_'))
        END,
        COALESCE(s.role, '—'),
        s.bu_id::TEXT,
        s.n_team_type_id::TEXT,
        s.position,
        s.id::TEXT,
        COALESCE(NULLIF(s.name, ''), NULLIF(s.full_name, ''), s.id::TEXT)
    INTO v_role_key, v_role_label, v_bu_id, v_team_id, v_position, v_staff_id, v_staff_name
    FROM staff s
    WHERE s.id = p_user_id
      AND s.status = 'Active'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
        RETURN;
    END IF;

    IF position('.' in p_module) > 0 THEN
        v_parent_module := split_part(p_module, '.', 1);
    ELSE
        v_parent_module := NULL;
    END IF;

    IF v_bu_id IS NOT NULL THEN
        SELECT COALESCE(cc.display, cc.bu_code, v_bu_id)
        INTO v_bu_label
        FROM cost_centres cc
        WHERE cc.id::TEXT = v_bu_id
        LIMIT 1;
    END IF;

    IF v_team_id IS NOT NULL THEN
        SELECT COALESCE(tt.display, v_team_id)
        INTO v_team_label
        FROM team_types tt
        WHERE tt.id::TEXT = v_team_id
        LIMIT 1;
    END IF;

    RETURN QUERY
    WITH layers AS (
        SELECT * FROM (VALUES
            (1, 'special'::text, '特殊規則 Special'::text, 60),
            (2, 'user', '按用戶 User', 50),
            (3, 'position', '按職位 Position', 40),
            (4, 'team', '按團隊 Team', 30),
            (5, 'bu', '按公司 BU', 20),
            (6, 'role', '按角色 Role', 10)
        ) AS t(layer_order, dimension, dimension_label, dimension_rank)
    ),
    staff_dims AS (
        SELECT
            l.layer_order,
            l.dimension,
            l.dimension_label,
            l.dimension_rank,
            CASE l.dimension
                WHEN 'special' THEN v_staff_id
                WHEN 'user' THEN v_staff_id
                WHEN 'position' THEN v_position
                WHEN 'team' THEN v_team_id
                WHEN 'bu' THEN v_bu_id
                WHEN 'role' THEN v_role_key
            END AS staff_value,
            CASE l.dimension
                WHEN 'special' THEN v_staff_name
                WHEN 'user' THEN v_staff_name
                WHEN 'position' THEN COALESCE(v_position, '—')
                WHEN 'team' THEN COALESCE(v_team_label, v_team_id, '—')
                WHEN 'bu' THEN COALESCE(v_bu_label, v_bu_id, '—')
                WHEN 'role' THEN COALESCE(v_role_label, v_role_key, '—')
            END AS staff_value_label
        FROM layers l
    ),
    matched AS (
        SELECT
            sd.layer_order,
            sd.dimension,
            sd.dimension_label,
            sd.dimension_rank,
            sd.staff_value,
            sd.staff_value_label,
            pa.effect AS assignment_effect,
            pa.priority AS assignment_priority,
            p.module AS matched_module,
            CASE
                WHEN p.module = p_module AND p.action = p_action THEN 4
                WHEN p.module = p_module AND p.action = '*' THEN 3
                WHEN v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = p_action THEN 2
                WHEN v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = '*' THEN 1
                ELSE 0
            END AS module_specificity
        FROM staff_dims sd
        LEFT JOIN permissions p
          ON (
                (p.module = p_module AND (p.action = p_action OR p.action = '*'))
                OR (
                  v_parent_module IS NOT NULL
                  AND p.module = v_parent_module
                  AND (p.action = p_action OR p.action = '*')
                )
             )
        LEFT JOIN permission_assignments pa
          ON pa.permission_id = p.id
         AND pa.dimension = sd.dimension
         AND sd.staff_value IS NOT NULL
         AND pa.dimension_value = sd.staff_value
    ),
    ranked_match AS (
        SELECT DISTINCT ON (m.dimension)
            m.layer_order,
            m.dimension,
            CASE
                WHEN m.assignment_effect IS NOT NULL
                     AND m.matched_module IS NOT NULL
                     AND m.matched_module <> p_module
                THEN m.dimension_label || '（繼承 ' || m.matched_module || '）'
                ELSE m.dimension_label
            END AS dimension_label,
            m.dimension_rank,
            m.staff_value,
            m.staff_value_label,
            m.assignment_effect,
            m.assignment_priority
        FROM matched m
        ORDER BY
            m.dimension,
            CASE WHEN m.assignment_effect IS NULL THEN 1 ELSE 0 END,
            m.module_specificity DESC,
            m.assignment_priority DESC NULLS LAST,
            m.assignment_effect DESC NULLS LAST
    ),
    winner AS (
        SELECT rm.dimension_rank
        FROM ranked_match rm
        WHERE rm.assignment_effect IS NOT NULL
        ORDER BY rm.dimension_rank DESC, rm.assignment_priority DESC NULLS LAST, rm.assignment_effect DESC
        LIMIT 1
    )
    SELECT
        rm.layer_order,
        rm.dimension,
        rm.dimension_label,
        rm.dimension_rank,
        rm.staff_value,
        rm.staff_value_label,
        rm.assignment_effect,
        rm.assignment_priority,
        (w.dimension_rank IS NOT NULL AND rm.dimension_rank = w.dimension_rank AND rm.assignment_effect IS NOT NULL) AS is_winner,
        COALESCE(
            (SELECT rm2.assignment_effect
             FROM ranked_match rm2
             WHERE rm2.assignment_effect IS NOT NULL
             ORDER BY rm2.dimension_rank DESC, rm2.assignment_priority DESC NULLS LAST, rm2.assignment_effect DESC
             LIMIT 1),
            'allow'
        ) AS resolved_effect,
        COALESCE(
            (
                SELECT rm2.assignment_effect = 'allow'
                FROM ranked_match rm2
                WHERE rm2.assignment_effect IS NOT NULL
                ORDER BY rm2.dimension_rank DESC, rm2.assignment_priority DESC NULLS LAST, rm2.assignment_effect DESC
                LIMIT 1
            ),
            TRUE
        ) AS resolved_allowed
    FROM ranked_match rm
    LEFT JOIN winner w ON TRUE
    ORDER BY rm.layer_order;
END;
$$;


ALTER FUNCTION public.explain_permission_resolution(p_user_id uuid, p_module text, p_action text) OWNER TO postgres;

--
-- Name: get_bwa_project_financials(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_bwa_project_financials(p_project_ids uuid[]) RETURNS TABLE(project_id uuid, total_sales numeric, paid_sales numeric, total_expense numeric, paid_expense numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH ids AS (
    SELECT DISTINCT u.id
    FROM unnest(p_project_ids) AS u(id)
    WHERE u.id IS NOT NULL
  ),
  inc AS (
    SELECT
      i.project_id,
      COALESCE(SUM(i.income_amount), 0)::numeric AS total_sales,
      COALESCE(SUM(i.payment_amount), 0)::numeric AS paid_sales
    FROM public.incomes i
    WHERE i.project_id = ANY (p_project_ids)
    GROUP BY i.project_id
  ),
  exp AS (
    SELECT
      e.project_id,
      COALESCE(SUM(e.installment_amount), 0)::numeric AS total_expense,
      COALESCE(SUM(e.paid_amount), 0)::numeric AS paid_expense
    FROM public.expenses e
    WHERE e.project_id = ANY (p_project_ids)
    GROUP BY e.project_id
  )
  SELECT
    ids.id AS project_id,
    COALESCE(inc.total_sales, 0),
    COALESCE(inc.paid_sales, 0),
    COALESCE(exp.total_expense, 0),
    COALESCE(exp.paid_expense, 0)
  FROM ids
  LEFT JOIN inc ON inc.project_id = ids.id
  LEFT JOIN exp ON exp.project_id = ids.id;
$$;


ALTER FUNCTION public.get_bwa_project_financials(p_project_ids uuid[]) OWNER TO postgres;

--
-- Name: get_bwf_project_financials(uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_bwf_project_financials(p_project_ids uuid[]) RETURNS TABLE(project_id uuid, total_sales numeric, paid_sales numeric, total_expense numeric, paid_expense numeric, income_payment_status text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH ids AS (
    SELECT DISTINCT u.id
    FROM unnest(p_project_ids) AS u(id)
    WHERE u.id IS NOT NULL
  ),
  inc AS (
    SELECT
      i.bwf_project_id AS project_id,
      COALESCE(SUM(i.income_amount), 0)::numeric AS total_sales,
      COALESCE(SUM(i.payment_amount), 0)::numeric AS paid_sales
    FROM public.incomes i
    WHERE i.bwf_project_id = ANY (p_project_ids)
    GROUP BY i.bwf_project_id
  ),
  exp AS (
    SELECT
      e.bwf_project_id AS project_id,
      COALESCE(SUM(e.installment_amount), 0)::numeric AS total_expense,
      COALESCE(SUM(e.paid_amount), 0)::numeric AS paid_expense
    FROM public.expenses e
    WHERE e.bwf_project_id = ANY (p_project_ids)
    GROUP BY e.bwf_project_id
  ),
  unpaid AS (
    SELECT DISTINCT ON (i.bwf_project_id)
      i.bwf_project_id AS project_id,
      i.payment_status
    FROM public.incomes i
    WHERE i.bwf_project_id = ANY (p_project_ids)
      AND i.payment_status IS NOT NULL
      AND lower(i.payment_status) NOT IN ('received', 'zoho completed')
      AND NOT (
        COALESCE(i.income_amount, 0) > 0
        AND COALESCE(i.payment_amount, 0) >= COALESCE(i.income_amount, 0)
      )
    ORDER BY
      i.bwf_project_id,
      CASE lower(i.payment_status)
        WHEN 'not received' THEN 0
        WHEN 'bounced payment' THEN 1
        WHEN 'pending check' THEN 2
        ELSE 3
      END
  )
  SELECT
    ids.id AS project_id,
    COALESCE(inc.total_sales, 0),
    COALESCE(inc.paid_sales, 0),
    COALESCE(exp.total_expense, 0),
    COALESCE(exp.paid_expense, 0),
    CASE
      WHEN COALESCE(inc.total_sales, 0) > 0
        AND COALESCE(inc.paid_sales, 0) >= COALESCE(inc.total_sales, 0)
        THEN 'Payment Done'
      WHEN unpaid.payment_status IS NOT NULL THEN unpaid.payment_status
      WHEN COALESCE(inc.total_sales, 0) > 0 THEN 'Pending Check'
      ELSE NULL
    END AS income_payment_status
  FROM ids
  LEFT JOIN inc ON inc.project_id = ids.id
  LEFT JOIN exp ON exp.project_id = ids.id
  LEFT JOIN unpaid ON unpaid.project_id = ids.id;
$$;


ALTER FUNCTION public.get_bwf_project_financials(p_project_ids uuid[]) OWNER TO postgres;

--
-- Name: get_complete_user_context(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_complete_user_context(input_email text) RETURNS TABLE(profile_data jsonb, staff_data jsonb, display_name text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH found_user AS (
        SELECT u.* FROM users u
        WHERE u.email = lower(trim(input_email))
           OR lower(u.email) = lower(trim(input_email))
        LIMIT 1
    ),
    found_staff AS (
        SELECT s.*, 
          CASE
            -- Highest priority: UUID FK match (member_id)
            WHEN s.id = (SELECT fu.member_id FROM found_user fu LIMIT 1) THEN 1
            -- Second priority: direct email match
            WHEN lower(s.email) = lower(trim(input_email)) THEN 2
            -- Lowest priority: legacy bubble_id match
            WHEN s.bubble_id = (SELECT fu.member FROM found_user fu LIMIT 1) THEN 3
          END AS match_priority
        FROM staff s
        WHERE (
            s.id = (SELECT fu.member_id FROM found_user fu LIMIT 1)
            OR lower(s.email) = lower(trim(input_email))
            OR s.bubble_id = (SELECT fu.member FROM found_user fu LIMIT 1)
        )
        AND s.status = 'Active'
        ORDER BY match_priority ASC
        LIMIT 1
    )
    SELECT 
        COALESCE(to_jsonb(fu.*), '{}'::jsonb) AS profile_data,
        COALESCE(to_jsonb(fs.*) - 'match_priority', '{}'::jsonb) AS staff_data,
        COALESCE(
            fs.name, 
            fs.full_name, 
            split_part(input_email, '@', 1)
        ) AS display_name
    FROM found_user fu
    FULL OUTER JOIN found_staff fs ON true
    LIMIT 1;
END;
$$;


ALTER FUNCTION public.get_complete_user_context(input_email text) OWNER TO postgres;

--
-- Name: get_module_view_roster(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_module_view_roster(p_module text, p_action text DEFAULT 'view'::text) RETURNS TABLE(staff_id uuid, staff_name text, role text, bu_id uuid, n_team_type_id uuid, "position" text, can_view boolean, decided_by text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_parent_module text;
BEGIN
  IF p_module IS NULL OR btrim(p_module) = '' THEN
    RETURN;
  END IF;

  IF position('.' in p_module) > 0 THEN
    v_parent_module := split_part(p_module, '.', 1);
  ELSE
    v_parent_module := NULL;
  END IF;

  RETURN QUERY
  WITH active_staff AS (
    SELECT
      s.id,
      COALESCE(NULLIF(btrim(s.name), ''), NULLIF(btrim(s.full_name), ''), s.id::text) AS display_name,
      s.role,
      s.bu_id,
      s.n_team_type_id,
      s.position,
      COALESCE(
        CASE lower(COALESCE(s.role, 'user'))
          WHEN 'super admin' THEN 'super_admin'
          WHEN 'admin' THEN 'admin'
          WHEN 'senior user' THEN 'senior_user'
          WHEN 'user' THEN 'user'
          ELSE lower(replace(COALESCE(s.role, 'user'), ' ', '_'))
        END,
        'user'
      ) AS role_key,
      s.bu_id::text AS bu_id_text,
      s.n_team_type_id::text AS team_id_text,
      s.id::text AS staff_id_text
    FROM staff s
    WHERE s.status = 'Active'
  ),
  candidates AS (
    SELECT
      st.id AS sid,
      pa.effect,
      pa.dimension,
      pa.dimension_value,
      pa.priority,
      p.module AS perm_module,
      p.action AS perm_action,
      CASE
        WHEN p.module = p_module AND p.action = p_action THEN 6
        WHEN p.module = p_module AND p.action = '*' THEN 5
        WHEN v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = p_action THEN 4
        WHEN v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = '*' THEN 3
        WHEN p.module = '*' AND p.action = p_action THEN 2
        ELSE 1
      END AS match_rank,
      CASE pa.dimension
        WHEN 'special' THEN 60
        WHEN 'user' THEN 50
        WHEN 'position' THEN 40
        WHEN 'team' THEN 30
        WHEN 'bu' THEN 20
        WHEN 'role' THEN 10
        ELSE COALESCE(pa.priority, 0)
      END AS dimension_rank
    FROM active_staff st
    JOIN permission_assignments pa ON (
      (pa.dimension = 'role' AND pa.dimension_value = st.role_key)
      OR (pa.dimension = 'bu' AND st.bu_id_text IS NOT NULL AND pa.dimension_value = st.bu_id_text)
      OR (pa.dimension = 'team' AND st.team_id_text IS NOT NULL AND pa.dimension_value = st.team_id_text)
      OR (pa.dimension = 'position' AND st.position IS NOT NULL AND pa.dimension_value = st.position)
      OR (pa.dimension = 'user' AND pa.dimension_value = st.staff_id_text)
      OR (pa.dimension = 'special' AND pa.dimension_value = st.staff_id_text)
    )
    JOIN permissions p ON p.id = pa.permission_id
    WHERE
      (p.module = p_module AND p.action = p_action)
      OR (p.module = p_module AND p.action = '*')
      OR (v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = p_action)
      OR (v_parent_module IS NOT NULL AND p.module = v_parent_module AND p.action = '*')
      OR (p.module = '*' AND p.action = p_action)
      OR (p.module = '*' AND p.action = '*')
  ),
  ranked AS (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.sid
        ORDER BY
          c.match_rank DESC,
          c.dimension_rank DESC,
          c.priority DESC,
          c.effect DESC
      ) AS rn
    FROM candidates c
  ),
  winners AS (
    SELECT * FROM ranked WHERE rn = 1
  )
  SELECT
    st.id,
    st.display_name,
    st.role,
    st.bu_id,
    st.n_team_type_id,
    st.position,
    CASE WHEN w.effect IS NULL THEN true ELSE w.effect = 'allow' END AS can_view,
    CASE
      WHEN w.effect IS NULL THEN 'default open (no rule)'
      ELSE format(
        '%s:%s → %s/%s=%s',
        w.dimension,
        w.dimension_value,
        w.perm_module,
        w.perm_action,
        w.effect
      )
    END AS decided_by
  FROM active_staff st
  LEFT JOIN winners w ON w.sid = st.id
  ORDER BY
    CASE WHEN w.effect IS NULL THEN true ELSE w.effect = 'allow' END DESC,
    st.display_name;
END;
$$;


ALTER FUNCTION public.get_module_view_roster(p_module text, p_action text) OWNER TO postgres;

--
-- Name: FUNCTION get_module_view_roster(p_module text, p_action text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_module_view_roster(p_module text, p_action text) IS 'Returns Active staff effective can_view for one module/action; used by /admin/permissions Access sheet.';


--
-- Name: get_modules_view_summary(text[], text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_modules_view_summary(p_modules text[], p_action text DEFAULT 'view'::text) RETURNS TABLE(module text, can_view_count bigint, cannot_view_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_modules IS NULL OR cardinality(p_modules) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH modules AS (
    SELECT DISTINCT m AS module_key
    FROM unnest(p_modules) AS m
    WHERE m IS NOT NULL AND btrim(m) <> ''
  ),
  active_staff AS (
    SELECT
      s.id,
      COALESCE(
        CASE lower(COALESCE(s.role, 'user'))
          WHEN 'super admin' THEN 'super_admin'
          WHEN 'admin' THEN 'admin'
          WHEN 'senior user' THEN 'senior_user'
          WHEN 'user' THEN 'user'
          ELSE lower(replace(COALESCE(s.role, 'user'), ' ', '_'))
        END,
        'user'
      ) AS role_key,
      s.bu_id::text AS bu_id_text,
      s.n_team_type_id::text AS team_id_text,
      s.position,
      s.id::text AS staff_id_text
    FROM staff s
    WHERE s.status = 'Active'
  ),
  candidates AS (
    SELECT
      st.id AS sid,
      mod.module_key,
      pa.effect,
      pa.priority,
      CASE
        WHEN p.module = mod.module_key AND p.action = p_action THEN 6
        WHEN p.module = mod.module_key AND p.action = '*' THEN 5
        WHEN position('.' in mod.module_key) > 0
          AND p.module = split_part(mod.module_key, '.', 1)
          AND p.action = p_action THEN 4
        WHEN position('.' in mod.module_key) > 0
          AND p.module = split_part(mod.module_key, '.', 1)
          AND p.action = '*' THEN 3
        WHEN p.module = '*' AND p.action = p_action THEN 2
        ELSE 1
      END AS match_rank,
      CASE pa.dimension
        WHEN 'special' THEN 60
        WHEN 'user' THEN 50
        WHEN 'position' THEN 40
        WHEN 'team' THEN 30
        WHEN 'bu' THEN 20
        WHEN 'role' THEN 10
        ELSE COALESCE(pa.priority, 0)
      END AS dimension_rank
    FROM active_staff st
    CROSS JOIN modules mod
    JOIN permission_assignments pa ON (
      (pa.dimension = 'role' AND pa.dimension_value = st.role_key)
      OR (pa.dimension = 'bu' AND st.bu_id_text IS NOT NULL AND pa.dimension_value = st.bu_id_text)
      OR (pa.dimension = 'team' AND st.team_id_text IS NOT NULL AND pa.dimension_value = st.team_id_text)
      OR (pa.dimension = 'position' AND st.position IS NOT NULL AND pa.dimension_value = st.position)
      OR (pa.dimension = 'user' AND pa.dimension_value = st.staff_id_text)
      OR (pa.dimension = 'special' AND pa.dimension_value = st.staff_id_text)
    )
    JOIN permissions p ON p.id = pa.permission_id
    WHERE
      (p.module = mod.module_key AND p.action = p_action)
      OR (p.module = mod.module_key AND p.action = '*')
      OR (
        position('.' in mod.module_key) > 0
        AND p.module = split_part(mod.module_key, '.', 1)
        AND p.action = p_action
      )
      OR (
        position('.' in mod.module_key) > 0
        AND p.module = split_part(mod.module_key, '.', 1)
        AND p.action = '*'
      )
      OR (p.module = '*' AND p.action = p_action)
      OR (p.module = '*' AND p.action = '*')
  ),
  ranked AS (
    SELECT
      c.*,
      ROW_NUMBER() OVER (
        PARTITION BY c.sid, c.module_key
        ORDER BY
          c.match_rank DESC,
          c.dimension_rank DESC,
          c.priority DESC,
          c.effect DESC
      ) AS rn
    FROM candidates c
  ),
  winners AS (
    SELECT sid, module_key, effect
    FROM ranked
    WHERE rn = 1
  ),
  staff_modules AS (
    SELECT st.id AS sid, mod.module_key
    FROM active_staff st
    CROSS JOIN modules mod
  ),
  resolved AS (
    SELECT
      sm.module_key,
      CASE WHEN w.effect IS NULL THEN true ELSE w.effect = 'allow' END AS can_view
    FROM staff_modules sm
    LEFT JOIN winners w
      ON w.sid = sm.sid AND w.module_key = sm.module_key
  )
  SELECT
    r.module_key AS module,
    count(*) FILTER (WHERE r.can_view)::bigint AS can_view_count,
    count(*) FILTER (WHERE NOT r.can_view)::bigint AS cannot_view_count
  FROM resolved r
  GROUP BY r.module_key
  ORDER BY r.module_key;
END;
$$;


ALTER FUNCTION public.get_modules_view_summary(p_modules text[], p_action text) OWNER TO postgres;

--
-- Name: FUNCTION get_modules_view_summary(p_modules text[], p_action text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_modules_view_summary(p_modules text[], p_action text) IS 'Returns can/cannot view counts per module for /admin/permissions Access column badges.';


--
-- Name: get_pms_auth_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_pms_auth_sessions() RETURNS TABLE(session_id uuid, auth_user_id uuid, login_at timestamp with time zone, last_active_at timestamp with time zone, ip text, user_agent text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'auth'
    AS $$
  SELECT
    s.id,
    s.user_id,
    s.created_at,
    (
      SELECT MAX(ts)
      FROM unnest(ARRAY[s.created_at, s.updated_at, s.refreshed_at]) AS ts
    ),
    host(s.ip),
    s.user_agent
  FROM auth.sessions s
  ORDER BY s.created_at DESC;
$$;


ALTER FUNCTION public.get_pms_auth_sessions() OWNER TO postgres;

--
-- Name: FUNCTION get_pms_auth_sessions(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_pms_auth_sessions() IS 'PMS Login Report: auth.sessions rows with login_at (created) and last_active_at (max of created/updated/refreshed).';


--
-- Name: get_table_columns_audit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_table_columns_audit() RETURNS TABLE(table_name text, column_name text, data_type text, is_nullable text, column_default text, has_unique_constraint boolean, has_fk_constraint boolean, fk_target_table text, fk_target_column text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH
  cols AS (
    SELECT
      c.relname::TEXT AS tbl,
      a.attname::TEXT AS col,
      pg_catalog.format_type(a.atttypid, a.atttypmod)::TEXT AS dtype,
      CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END::TEXT AS nullable,
      pg_get_expr(d.adbin, d.adrelid)::TEXT AS col_default,
      a.attnum
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relname NOT LIKE 'pg_%'
  ),
  unique_cols AS (
    SELECT
      c.relname::TEXT AS tbl,
      a.attname::TEXT AS col
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey) AS k(attnum)
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public'
      AND con.contype IN ('u', 'p')
  ),
  fk_cols AS (
    SELECT
      c.relname::TEXT AS tbl,
      a.attname::TEXT AS col,
      fc.relname::TEXT AS ftbl,
      fa.attname::TEXT AS fcol
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_class fc ON fc.oid = con.confrelid
    CROSS JOIN LATERAL unnest(con.conkey, con.confkey) AS k(attnum, fattnum)
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    JOIN pg_catalog.pg_attribute fa ON fa.attrelid = fc.oid AND fa.attnum = k.fattnum
    WHERE n.nspname = 'public'
      AND con.contype = 'f'
  )
  SELECT
    cols.tbl AS table_name,
    cols.col AS column_name,
    cols.dtype AS data_type,
    cols.nullable AS is_nullable,
    cols.col_default AS column_default,
    (uc.col IS NOT NULL) AS has_unique_constraint,
    (fk.col IS NOT NULL) AS has_fk_constraint,
    fk.ftbl AS fk_target_table,
    fk.fcol AS fk_target_column
  FROM cols
  LEFT JOIN unique_cols uc ON uc.tbl = cols.tbl AND uc.col = cols.col
  LEFT JOIN fk_cols fk ON fk.tbl = cols.tbl AND fk.col = cols.col
  ORDER BY cols.tbl, cols.attnum;
END;
$$;


ALTER FUNCTION public.get_table_columns_audit() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: man_hour_dates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.man_hour_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    staff_id uuid,
    staff_bubble_id text,
    report_date timestamp with time zone NOT NULL,
    total_work_hour numeric(5,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text
);


ALTER TABLE public.man_hour_dates OWNER TO postgres;

--
-- Name: get_unfinished_man_hour_dates(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) RETURNS SETOF public.man_hour_dates
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT d.*
  FROM public.man_hour_dates d
  WHERE d.staff_id = p_staff_id
    AND d.total_work_hour > 0
    AND COALESCE((
      SELECT SUM(t.work_hour)
      FROM public.man_hour_tasks t
      WHERE t.man_hour_date_id = d.id
    ), 0) < d.total_work_hour
  ORDER BY d.report_date DESC;
$$;


ALTER FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_unfinished_man_hour_dates(p_staff_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) IS 'Man-hour dates for a staff member where total_work_hour > 0 but SUM(man_hour_tasks.work_hour) is still below that total.';


--
-- Name: get_user_effective_permissions(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_effective_permissions(p_user_id uuid) RETURNS TABLE(module text, action text, effect text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_role_key TEXT;
    v_bu_id TEXT;
    v_team_id TEXT;
    v_position TEXT;
    v_staff_id TEXT;
BEGIN
    SELECT
        CASE lower(s.role)
            WHEN 'super admin' THEN 'super_admin'
            WHEN 'admin' THEN 'admin'
            WHEN 'senior user' THEN 'senior_user'
            WHEN 'user' THEN 'user'
            ELSE lower(replace(s.role, ' ', '_'))
        END,
        s.bu_id::TEXT,
        s.n_team_type_id::TEXT,
        s.position,
        s.id::TEXT
    INTO v_role_key, v_bu_id, v_team_id, v_position, v_staff_id
    FROM staff s
    WHERE s.id = p_user_id
      AND s.status = 'Active'
    LIMIT 1;

    IF v_staff_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH user_assignments AS (
        SELECT
            pa.permission_id,
            pa.effect AS pa_effect,
            pa.priority,
            CASE pa.dimension
                WHEN 'special' THEN 60
                WHEN 'user' THEN 50
                WHEN 'position' THEN 40
                WHEN 'team' THEN 30
                WHEN 'bu' THEN 20
                WHEN 'role' THEN 10
                ELSE COALESCE(pa.priority, 0)
            END AS dimension_rank
        FROM permission_assignments pa
        WHERE
            (pa.dimension = 'role' AND pa.dimension_value = v_role_key)
            OR (pa.dimension = 'bu' AND v_bu_id IS NOT NULL AND pa.dimension_value = v_bu_id)
            OR (pa.dimension = 'team' AND v_team_id IS NOT NULL AND pa.dimension_value = v_team_id)
            OR (pa.dimension = 'position' AND v_position IS NOT NULL AND pa.dimension_value = v_position)
            OR (pa.dimension = 'user' AND pa.dimension_value = v_staff_id)
            OR (pa.dimension = 'special' AND pa.dimension_value = v_staff_id)
    ),
    ranked AS (
        SELECT
            ua.permission_id,
            ua.pa_effect,
            ROW_NUMBER() OVER (
                PARTITION BY ua.permission_id
                ORDER BY
                    ua.dimension_rank DESC,
                    ua.priority DESC,
                    ua.pa_effect DESC
            ) AS rn
        FROM user_assignments ua
    ),
    resolved AS (
        SELECT
            r.permission_id,
            r.pa_effect
        FROM ranked r
        WHERE r.rn = 1
    )
    SELECT
        p.module,
        p.action,
        res.pa_effect
    FROM resolved res
    JOIN permissions p ON p.id = res.permission_id;
END;
$$;


ALTER FUNCTION public.get_user_effective_permissions(p_user_id uuid) OWNER TO postgres;

--
-- Name: merge_customers(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_a customers%ROWTYPE;
  v_b customers%ROWTYPE;
  v_new_id uuid;
  v_now timestamptz := NOW();
  v_a_bubble text;
  v_b_bubble text;
  v_refs text[];
  v_status text;
BEGIN
  IF p_customer_a IS NULL OR p_customer_b IS NULL THEN
    RAISE EXCEPTION 'Both customer ids are required';
  END IF;

  IF p_customer_a = p_customer_b THEN
    RAISE EXCEPTION 'Cannot merge a customer with itself';
  END IF;

  IF p_merged IS NULL OR jsonb_typeof(p_merged) <> 'object' THEN
    RAISE EXCEPTION 'Merged customer payload is required';
  END IF;

  SELECT * INTO v_a FROM customers WHERE id = p_customer_a FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer A not found';
  END IF;

  SELECT * INTO v_b FROM customers WHERE id = p_customer_b FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer B not found';
  END IF;

  v_status := NULLIF(TRIM(COALESCE(p_merged->>'status', '')), '');
  IF v_status IS NULL OR v_status NOT IN ('Active', 'Inactive', 'Blacklist') THEN
    v_status := 'Active';
  END IF;

  v_a_bubble := NULLIF(TRIM(COALESCE(v_a.bubble_id, '')), '');
  v_b_bubble := NULLIF(TRIM(COALESCE(v_b.bubble_id, '')), '');
  v_refs := ARRAY[p_customer_a::text, p_customer_b::text];
  IF v_a_bubble IS NOT NULL THEN
    v_refs := array_append(v_refs, v_a_bubble);
  END IF;
  IF v_b_bubble IS NOT NULL THEN
    v_refs := array_append(v_refs, v_b_bubble);
  END IF;

  INSERT INTO customers (
    customer_name, display_name, company_name, brand_name_cn, brand_name_en,
    branding_icon, email, phone_display, phone_number_a, phone_number_b,
    address, view_system, status_filter_value, remark, asana, enquiry_create_date,
    bubble_id, status, created_by_id, member_created_by_id, real_created_by_name,
    created_date, modified_date, bwa_income, bwa_profit, bwa_receivable,
    bwa_project_number, bwa_pitching_number, bwf_income, bwf_profit,
    bwf_receivable, bwf_project_number, bwf_pitching_no
  ) VALUES (
    NULLIF(TRIM(COALESCE(p_merged->>'customer_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'display_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'company_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'brand_name_cn', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'brand_name_en', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'branding_icon', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'email', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'phone_display', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'phone_number_a', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'phone_number_b', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'address', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'view_system', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'status_filter_value', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'remark', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'asana', '')), ''),
    CASE
      WHEN NULLIF(TRIM(COALESCE(p_merged->>'enquiry_create_date', '')), '') IS NOT NULL
        THEN (p_merged->>'enquiry_create_date')::timestamptz
      ELSE COALESCE(v_a.enquiry_create_date, v_b.enquiry_create_date)
    END,
    NULL,
    v_status,
    COALESCE(v_a.created_by_id, v_b.created_by_id),
    COALESCE(v_a.member_created_by_id, v_b.member_created_by_id),
    COALESCE(v_a.real_created_by_name, v_b.real_created_by_name),
    v_now,
    v_now,
    COALESCE(v_a.bwa_income, 0) + COALESCE(v_b.bwa_income, 0),
    COALESCE(v_a.bwa_profit, 0) + COALESCE(v_b.bwa_profit, 0),
    COALESCE(v_a.bwa_receivable, 0) + COALESCE(v_b.bwa_receivable, 0),
    COALESCE(v_a.bwa_project_number, 0) + COALESCE(v_b.bwa_project_number, 0),
    COALESCE(v_a.bwa_pitching_number, 0) + COALESCE(v_b.bwa_pitching_number, 0),
    COALESCE(v_a.bwf_income, 0) + COALESCE(v_b.bwf_income, 0),
    COALESCE(v_a.bwf_profit, 0) + COALESCE(v_b.bwf_profit, 0),
    COALESCE(v_a.bwf_receivable, 0) + COALESCE(v_b.bwf_receivable, 0),
    COALESCE(v_a.bwf_project_number, 0) + COALESCE(v_b.bwf_project_number, 0),
    COALESCE(v_a.bwf_pitching_no, 0) + COALESCE(v_b.bwf_pitching_no, 0)
  )
  RETURNING id INTO v_new_id;

  INSERT INTO customer_tags (customer_uuid, customer_id, tag_uuid, tag_id, collection_uuid)
  SELECT DISTINCT
    v_new_id, v_new_id::text, tag_uuid,
    COALESCE(NULLIF(TRIM(tag_id), ''), tag_uuid::text), collection_uuid
  FROM customer_tags
  WHERE customer_uuid IN (p_customer_a, p_customer_b) AND tag_uuid IS NOT NULL
  ON CONFLICT (customer_uuid, tag_uuid) DO NOTHING;

  DELETE FROM customer_tags WHERE customer_uuid IN (p_customer_a, p_customer_b);

  UPDATE bwa_projects SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE bwf_projects SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE bwa_pitchings SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE bwf_pitchings SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE cr_event_details SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE customer_comments SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE customer_documents SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE quotations SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE users SET customer_id = v_new_id WHERE customer_id IN (p_customer_a, p_customer_b);
  UPDATE customer_cr_events SET customer_id = v_new_id::text WHERE customer_id = ANY (v_refs);

  UPDATE customers
  SET status = 'Inactive', modified_date = v_now,
    remark = CASE
      WHEN remark IS NULL OR TRIM(remark) = '' THEN
        'Merged into ' || v_new_id::text || ' on ' || to_char(v_now AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')
      ELSE
        remark || E'\nMerged into ' || v_new_id::text || ' on ' || to_char(v_now AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')
    END
  WHERE id IN (p_customer_a, p_customer_b);

  RETURN v_new_id;
END;
$$;


ALTER FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) OWNER TO postgres;

--
-- Name: FUNCTION merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) IS 'Merge customers A+B into a new customer C; reassign all related rows; set A/B Inactive.';


--
-- Name: merge_suppliers(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_a suppliers%ROWTYPE;
  v_b suppliers%ROWTYPE;
  v_new_id uuid;
  v_now timestamptz := NOW();
  v_a_bubble text;
  v_b_bubble text;
  v_refs text[];
  v_n_type_id uuid;
  v_text text;
BEGIN
  IF p_supplier_a IS NULL OR p_supplier_b IS NULL THEN
    RAISE EXCEPTION 'Both supplier ids are required';
  END IF;

  IF p_supplier_a = p_supplier_b THEN
    RAISE EXCEPTION 'Cannot merge a supplier with itself';
  END IF;

  IF p_merged IS NULL OR jsonb_typeof(p_merged) <> 'object' THEN
    RAISE EXCEPTION 'Merged supplier payload is required';
  END IF;

  SELECT * INTO v_a FROM suppliers WHERE id = p_supplier_a FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier A not found';
  END IF;

  SELECT * INTO v_b FROM suppliers WHERE id = p_supplier_b FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier B not found';
  END IF;

  v_a_bubble := NULLIF(TRIM(COALESCE(v_a.bubble_id, '')), '');
  v_b_bubble := NULLIF(TRIM(COALESCE(v_b.bubble_id, '')), '');
  v_refs := ARRAY[p_supplier_a::text, p_supplier_b::text];
  IF v_a_bubble IS NOT NULL THEN
    v_refs := array_append(v_refs, v_a_bubble);
  END IF;
  IF v_b_bubble IS NOT NULL THEN
    v_refs := array_append(v_refs, v_b_bubble);
  END IF;

  v_text := NULLIF(TRIM(COALESCE(p_merged->>'n_type_id', '')), '');
  IF v_text IS NOT NULL THEN
    v_n_type_id := v_text::uuid;
  ELSE
    SELECT supplier_type_id INTO v_n_type_id
    FROM supplier_supplier_types
    WHERE supplier_id IN (p_supplier_a, p_supplier_b)
    ORDER BY created_at NULLS LAST
    LIMIT 1;
    IF v_n_type_id IS NULL THEN
      v_n_type_id := COALESCE(v_a.n_type_id, v_b.n_type_id);
    END IF;
  END IF;

  INSERT INTO suppliers (
    display_name, name, chinese_name, account_description, email, phone, fax_no,
    address, website, contact_persons, district_id, n_type_id, real_level,
    auto_level, admin_level, status, account_status, join_date, establish_year,
    director_hkid, asana_link, referer_name, referer_set, professional_skill,
    remark, moq, order_days, company_office_photo,
    contact1_chn_surname, contact1_chn_given_name, contact1_chn_nickname,
    contact1_eng_surname, contact1_eng_givenname, contact1_eng_nickname,
    contact1_gender, contact1_phone, contact1_job_title, contact1_name_card,
    contact2_chn_surname, contact2_chn_given_name, contact2_chn_nickname,
    contact2_eng_surname, contact2_eng_givenname, contact2_eng_nickname,
    contact2_gender, contact2_phone, contact2_job_title, contact2_name_card,
    disable_comments, bubble_id, created_date, modified_date, created_by_id
  ) VALUES (
    NULLIF(TRIM(COALESCE(p_merged->>'display_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'chinese_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'account_description', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'email', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'phone', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'fax_no', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'address', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'website', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact_persons', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'district_id', '')), '')::uuid,
    v_n_type_id,
    NULLIF(TRIM(COALESCE(p_merged->>'real_level', '')), ''),
    COALESCE(v_a.auto_level, v_b.auto_level),
    COALESCE(v_a.admin_level, v_b.admin_level),
    COALESCE(NULLIF(TRIM(COALESCE(p_merged->>'status', '')), ''), 'Active'),
    NULLIF(TRIM(COALESCE(p_merged->>'account_status', '')), ''),
    CASE
      WHEN NULLIF(TRIM(COALESCE(p_merged->>'join_date', '')), '') IS NOT NULL
        THEN (p_merged->>'join_date')::timestamptz
      ELSE COALESCE(v_a.join_date, v_b.join_date)
    END,
    NULLIF(TRIM(COALESCE(p_merged->>'establish_year', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'director_hkid', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'asana_link', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'referer_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'referer_set', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'professional_skill', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'remark', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'moq', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'order_days', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'company_office_photo', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_chn_surname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_chn_given_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_chn_nickname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_eng_surname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_eng_givenname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_eng_nickname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_gender', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_phone', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_job_title', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact1_name_card', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_chn_surname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_chn_given_name', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_chn_nickname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_eng_surname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_eng_givenname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_eng_nickname', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_gender', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_phone', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_job_title', '')), ''),
    NULLIF(TRIM(COALESCE(p_merged->>'contact2_name_card', '')), ''),
    COALESCE(v_a.disable_comments, v_b.disable_comments),
    NULL,
    v_now,
    v_now,
    COALESCE(v_a.created_by_id, v_b.created_by_id)
  )
  RETURNING id INTO v_new_id;

  INSERT INTO supplier_supplier_types (supplier_id, supplier_type_id)
  SELECT DISTINCT v_new_id, supplier_type_id
  FROM supplier_supplier_types
  WHERE supplier_id IN (p_supplier_a, p_supplier_b)
  ON CONFLICT DO NOTHING;

  DELETE FROM supplier_supplier_types
  WHERE supplier_id IN (p_supplier_a, p_supplier_b);

  INSERT INTO supplier_supplier_tags (supplier_id, supplier_tag_id)
  SELECT DISTINCT v_new_id, supplier_tag_id
  FROM supplier_supplier_tags
  WHERE supplier_id IN (p_supplier_a, p_supplier_b)
  ON CONFLICT DO NOTHING;

  DELETE FROM supplier_supplier_tags
  WHERE supplier_id IN (p_supplier_a, p_supplier_b);

  UPDATE expenses SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE staff_supplier_comments SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE supplier_files SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE supplier_pricings SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE supplier_recent_statuses SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE supplier_register_forms SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE users SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE ap_report_remarks SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);

  UPDATE bwa_projects SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE bwa_projects SET main_contractor_id = v_new_id WHERE main_contractor_id IN (p_supplier_a, p_supplier_b);
  UPDATE bwa_projects SET main_air_supplier_id = v_new_id WHERE main_air_supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE bwa_projects SET main_network_supplier_id = v_new_id WHERE main_network_supplier_id IN (p_supplier_a, p_supplier_b);

  UPDATE bwf_projects SET supplier_id = v_new_id WHERE supplier_id IN (p_supplier_a, p_supplier_b);
  UPDATE bwf_projects SET main_contractor_id = v_new_id WHERE main_contractor_id IN (p_supplier_a, p_supplier_b);

  UPDATE bwf_orders SET warehouse_id = v_new_id WHERE warehouse_id IN (p_supplier_a, p_supplier_b);
  UPDATE bwf_orders SET installation_team_id = v_new_id WHERE installation_team_id IN (p_supplier_a, p_supplier_b);
  UPDATE bwf_orders SET defect_supplier_id = v_new_id WHERE defect_supplier_id IN (p_supplier_a, p_supplier_b);

  INSERT INTO bwf_project_suppliers (project_id, supplier_id)
  SELECT DISTINCT project_id, v_new_id
  FROM bwf_project_suppliers
  WHERE supplier_id IN (p_supplier_a, p_supplier_b)
  ON CONFLICT DO NOTHING;

  DELETE FROM bwf_project_suppliers
  WHERE supplier_id IN (p_supplier_a, p_supplier_b);

  INSERT INTO tender_selective_suppliers (tender_id, supplier_id)
  SELECT DISTINCT tender_id, v_new_id
  FROM tender_selective_suppliers
  WHERE supplier_id IN (p_supplier_a, p_supplier_b)
  ON CONFLICT DO NOTHING;

  DELETE FROM tender_selective_suppliers
  WHERE supplier_id IN (p_supplier_a, p_supplier_b);

  INSERT INTO tender_rejected_suppliers (tender_id, supplier_id)
  SELECT DISTINCT tender_id, v_new_id
  FROM tender_rejected_suppliers
  WHERE supplier_id IN (p_supplier_a, p_supplier_b)
  ON CONFLICT DO NOTHING;

  DELETE FROM tender_rejected_suppliers
  WHERE supplier_id IN (p_supplier_a, p_supplier_b);

  UPDATE supplier_login_codes SET supplier = v_new_id::text WHERE supplier = ANY (v_refs);
  UPDATE supplier_feedback SET supplier = v_new_id::text WHERE supplier = ANY (v_refs);
  UPDATE tender_bids SET supplier = v_new_id::text WHERE supplier = ANY (v_refs);
  UPDATE tender_responds SET supplier = v_new_id::text WHERE supplier = ANY (v_refs);

  UPDATE suppliers s SET
    amount = agg.amount,
    paid = agg.paid,
    outstanding = agg.outstanding,
    project_number = agg.project_number,
    modified_date = v_now
  FROM (
    SELECT
      COALESCE(SUM(e.installment_amount), 0) AS amount,
      COALESCE(SUM(e.paid_amount), 0) AS paid,
      COALESCE(SUM(e.outstanding), 0) AS outstanding,
      COUNT(DISTINCT COALESCE(e.project_id::text, e.bwf_project_id::text))
        FILTER (WHERE e.project_id IS NOT NULL OR e.bwf_project_id IS NOT NULL) AS project_number
    FROM expenses e
    WHERE e.supplier_id = v_new_id
  ) agg
  WHERE s.id = v_new_id;

  UPDATE suppliers
  SET
    status = 'Inactive',
    modified_date = v_now,
    remark = CASE
      WHEN remark IS NULL OR TRIM(remark) = '' THEN
        'Merged into ' || v_new_id::text || ' on ' || to_char(v_now AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')
      ELSE
        remark || E'\nMerged into ' || v_new_id::text || ' on ' || to_char(v_now AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD')
    END
  WHERE id IN (p_supplier_a, p_supplier_b);

  RETURN v_new_id;
END;
$$;


ALTER FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) OWNER TO postgres;

--
-- Name: FUNCTION merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) IS 'Merge suppliers A+B into a new supplier C; reassign all related rows; set A/B Inactive.';


--
-- Name: purge_stale_pms_auth_sessions(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer DEFAULT 7) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'auth', 'public'
    AS $$
DECLARE
  cutoff timestamptz;
  deleted_sessions integer;
BEGIN
  IF p_max_age_days IS NULL OR p_max_age_days < 1 THEN
    RAISE EXCEPTION 'p_max_age_days must be >= 1';
  END IF;

  cutoff := NOW() - (p_max_age_days || ' days')::interval;

  DELETE FROM auth.refresh_tokens rt
  USING auth.sessions s
  WHERE rt.session_id = s.id
    AND s.created_at < cutoff;

  DELETE FROM auth.sessions
  WHERE created_at < cutoff;

  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;
  RETURN deleted_sessions;
END;
$$;


ALTER FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer) OWNER TO postgres;

--
-- Name: FUNCTION purge_stale_pms_auth_sessions(p_max_age_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer) IS 'Deletes auth.sessions (and linked refresh_tokens) older than p_max_age_days. Matches PMS 7-day session cookie policy.';


--
-- Name: qms_apply_cost_source(uuid, integer, integer, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_quote_version integer;
  v_previous public.qms_quote_cost_versions;
  v_version public.qms_quote_cost_versions;
  v_new_line_id uuid;
  v_row record;
  v_source_type text;
  v_cost_layer text;
  v_quantity numeric;
  v_unit_id uuid;
  v_loss_rule numeric;
  v_low numeric;
  v_base numeric;
  v_high numeric;
  v_free_reason text;
  v_included_by uuid;
  v_line_id uuid;
  v_coverage_id uuid;
  v_supplier_item public.qms_supplier_quote_items;
  v_supplier_revision public.qms_supplier_quote_revisions;
  v_supplier_revision_id uuid;
  v_supplier_item_id uuid;
  v_estimate_run_id uuid;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_requirement_scope_key is null or length(trim(p_requirement_scope_key)) = 0 then
    raise exception 'invalid_requirement_scope' using errcode = '22023';
  end if;
  if p_component_type is null or p_component_type not in ('MATERIAL', 'INSTALLATION', 'BUNDLE', 'OTHER') then
    raise exception 'invalid_component_type' using errcode = '22023';
  end if;

  select version_number into v_quote_version
    from public.quotations where id = p_quotation_id for update;
  if v_quote_version is null then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;
  if p_expected_customer_version is null or v_quote_version <> p_expected_customer_version then
    raise exception 'quote_revision_conflict' using errcode = '40001';
  end if;

  -- Latest cost version (locked with the quotation row above, so concurrent
  -- draft edits serialize here and the mutation token stays authoritative).
  select * into v_previous
    from public.qms_quote_cost_versions
    where quotation_id = p_quotation_id
    order by revision desc
    limit 1
    for update;

  if v_previous.id is null then
    if coalesce(p_expected_cost_revision, 0) <> 0 then
      raise exception 'quote_cost_revision_conflict' using errcode = '40001';
    end if;
    insert into public.qms_quote_cost_versions (
      quotation_id, customer_quote_version_number, revision, mutation_revision, status, version_token, created_by
    ) values (
      p_quotation_id, v_quote_version, 1, 0, 'draft', 'draft', auth.uid()
    ) returning * into v_version;
  elsif v_previous.status = 'draft' then
    if coalesce(p_expected_cost_revision, 0) <> coalesce(v_previous.mutation_revision, 0) then
      raise exception 'quote_cost_revision_conflict' using errcode = '40001';
    end if;
    v_version := v_previous;
  else
    -- Latest version is locked/published: fork a new draft and inherit every
    -- currently effective line, coverage and source snapshot so editing one
    -- scope never drops the rest of the costed works.
    if coalesce(p_expected_cost_revision, 0) <> coalesce(v_previous.mutation_revision, 0) then
      raise exception 'quote_cost_revision_conflict' using errcode = '40001';
    end if;
    insert into public.qms_quote_cost_versions (
      quotation_id, customer_quote_version_number, revision, mutation_revision, status, version_token, created_by
    ) values (
      p_quotation_id, v_quote_version, v_previous.revision + 1, coalesce(v_previous.mutation_revision, 0), 'draft', 'draft', auth.uid()
    ) returning * into v_version;

    for v_row in
      select c.requirement_scope_key,
             c.component_type as coverage_component_type,
             l.id as line_id,
             l.cost_layer, l.component_type, l.cost_source_type,
             l.quantity, l.unit_id, l.loss_rule,
             l.low_amount, l.base_amount, l.high_amount,
             l.is_chargeable, l.free_reason, l.manual_description, l.manual_note
        from public.qms_cost_coverages c
        join public.qms_quote_cost_lines l on l.id = c.cost_line_id
       where c.cost_version_id = v_previous.id
         and c.is_active
    loop
      insert into public.qms_quote_cost_lines (
        cost_version_id, cost_layer, component_type, cost_source_type,
        quantity, unit_id, loss_rule, low_amount, base_amount, high_amount,
        is_chargeable, free_reason, included_by_line_id, manual_description, manual_note, created_by
      ) values (
        v_version.id, v_row.cost_layer, v_row.component_type, v_row.cost_source_type,
        v_row.quantity, v_row.unit_id, v_row.loss_rule, v_row.low_amount, v_row.base_amount, v_row.high_amount,
        v_row.is_chargeable, v_row.free_reason, null, v_row.manual_description, v_row.manual_note, auth.uid()
      ) returning id into v_new_line_id;

      insert into public.qms_cost_coverages (
        cost_version_id, cost_line_id, requirement_scope_key, component_type, is_active, created_by
      ) values (
        v_version.id, v_new_line_id, v_row.requirement_scope_key, v_row.coverage_component_type, true, auth.uid()
      );

      insert into public.qms_cost_source_snapshots (
        cost_line_id, source_type, supplier_quote_revision_id, supplier_quote_item_id, estimate_run_id,
        original_unit_id, original_unit_price, original_unit_text, normalized_unit_id, normalized_unit_price,
        currency_code, scope_signature, override_reason, selected_by
      )
      select v_new_line_id, source_type, supplier_quote_revision_id, supplier_quote_item_id, estimate_run_id,
             original_unit_id, original_unit_price, original_unit_text, normalized_unit_id, normalized_unit_price,
             currency_code, scope_signature, override_reason, selected_by
        from public.qms_cost_source_snapshots
       where cost_line_id = v_row.line_id;
    end loop;
  end if;

  v_source_type := p_input->>'sourceType';
  if v_source_type is null or v_source_type not in ('SUPPLIER_SELECTED', 'HISTORICAL_ESTIMATE', 'MANUAL', 'UNPRICED') then
    raise exception 'invalid_source_type' using errcode = '22023';
  end if;
  v_cost_layer := p_input->>'costLayer';
  if v_cost_layer is null or v_cost_layer not in ('MAIN', 'MATERIAL_SPECIALIST', 'EXTRA_MANUAL') then
    raise exception 'invalid_cost_layer' using errcode = '22023';
  end if;

  v_quantity := case when p_input ? 'quantity' and p_input->>'quantity' <> '' then (p_input->>'quantity')::numeric else null end;
  if v_quantity is not null and v_quantity < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  v_unit_id := case when p_input ? 'unitId' and p_input->>'unitId' <> '' then (p_input->>'unitId')::uuid else null end;
  v_loss_rule := case when p_input ? 'lossRule' and p_input->>'lossRule' <> '' then (p_input->>'lossRule')::numeric else null end;
  v_free_reason := nullif(trim(coalesce(p_input->>'freeReason', '')), '');
  v_included_by := case when p_input ? 'includedByLineId' and p_input->>'includedByLineId' <> '' then (p_input->>'includedByLineId')::uuid else null end;

  if v_source_type = 'UNPRICED' then
    v_low := null; v_base := null; v_high := null;
  elsif v_source_type = 'SUPPLIER_SELECTED' then
    v_supplier_item_id := case when p_input ? 'supplierQuoteItemId' and p_input->>'supplierQuoteItemId' <> '' then (p_input->>'supplierQuoteItemId')::uuid else null end;
    if v_supplier_item_id is null then
      raise exception 'supplier_quote_item_required' using errcode = '22023';
    end if;
    select * into v_supplier_item from public.qms_supplier_quote_items where id = v_supplier_item_id;
    if v_supplier_item.id is null then
      raise exception 'supplier_quote_item_not_found' using errcode = 'P0002';
    end if;
    if v_supplier_item.pricing_status not in ('priced', 'free') then
      raise exception 'supplier_item_not_priceable' using errcode = '22023';
    end if;
    select * into v_supplier_revision
      from public.qms_supplier_quote_revisions
      where id = v_supplier_item.supplier_quote_revision_id for update;
    if v_supplier_revision.status <> 'approved' then
      raise exception 'supplier_revision_not_approved' using errcode = '42501';
    end if;
    v_supplier_revision_id := v_supplier_revision.id;
    if v_supplier_revision.currency_code <> 'HKD' then
      raise exception 'non_hkd_source' using errcode = '22023';
    end if;
    -- The server is authoritative: when the selected quantity and a normalised
    -- unit cost exist the amount is recomputed here, so a client-supplied
    -- `baseAmount` can never override a changed quantity. A lump-sum line with
    -- no unit cost falls back to the reviewed total.
    v_base := case
      when v_supplier_item.pricing_status = 'free' then 0
      when v_supplier_item.normalized_unit_cost is not null and v_quantity is not null then round(v_supplier_item.normalized_unit_cost * v_quantity, 2)
      when p_input ? 'baseAmount' and p_input->>'baseAmount' <> '' then round((p_input->>'baseAmount')::numeric, 2)
      else null
    end;
    if v_base is null then
      raise exception 'base_amount_required' using errcode = '22023';
    end if;
    v_low := coalesce(nullif(p_input->>'lowAmount', '')::numeric, v_base);
    v_high := coalesce(nullif(p_input->>'highAmount', '')::numeric, v_base);
  else
    v_low := nullif(p_input->>'lowAmount', '')::numeric;
    v_base := nullif(p_input->>'baseAmount', '')::numeric;
    v_high := nullif(p_input->>'highAmount', '')::numeric;
    if v_source_type = 'HISTORICAL_ESTIMATE' then
      v_estimate_run_id := case when p_input ? 'estimateRunId' and p_input->>'estimateRunId' <> '' then (p_input->>'estimateRunId')::uuid else null end;
      if v_low is null or v_base is null or v_high is null then
        raise exception 'estimate_amounts_required' using errcode = '22023';
      end if;
    elsif v_base is null then
      raise exception 'base_amount_required' using errcode = '22023';
    end if;
    v_low := coalesce(v_low, v_base);
    v_high := coalesce(v_high, v_base);
  end if;

  -- Supersede the previous active source for this scope + component only.
  update public.qms_cost_coverages
     set is_active = false
   where cost_version_id = v_version.id
     and requirement_scope_key = p_requirement_scope_key
     and component_type = p_component_type
     and is_active;

  insert into public.qms_quote_cost_lines (
    cost_version_id, cost_layer, component_type, cost_source_type,
    quantity, unit_id, loss_rule, low_amount, base_amount, high_amount,
    is_chargeable, free_reason, included_by_line_id, manual_description, manual_note, created_by
  ) values (
    v_version.id, v_cost_layer, p_component_type, v_source_type,
    v_quantity, v_unit_id, v_loss_rule, v_low, v_base, v_high,
    v_included_by is null, v_free_reason, v_included_by,
    nullif(trim(coalesce(p_input->>'manualDescription', '')), ''),
    nullif(trim(coalesce(p_input->>'manualNote', '')), ''),
    auth.uid()
  ) returning id into v_line_id;

  insert into public.qms_cost_coverages (
    cost_version_id, cost_line_id, requirement_scope_key, component_type, is_active, created_by
  ) values (
    v_version.id, v_line_id, p_requirement_scope_key, p_component_type,
    v_included_by is null, auth.uid()
  ) returning id into v_coverage_id;

  insert into public.qms_cost_source_snapshots (
    cost_line_id, source_type, supplier_quote_revision_id, supplier_quote_item_id, estimate_run_id,
    original_unit_id, original_unit_price, original_unit_text, normalized_unit_id, normalized_unit_price,
    currency_code, scope_signature, override_reason, selected_by
  ) values (
    v_line_id, v_source_type, v_supplier_revision_id, v_supplier_item_id, v_estimate_run_id,
    v_unit_id,
    case when p_input ? 'originalUnitPrice' and p_input->>'originalUnitPrice' <> '' then (p_input->>'originalUnitPrice')::numeric else null end,
    nullif(trim(coalesce(p_input->>'originalUnitText', '')), ''),
    v_unit_id,
    case when p_input ? 'normalizedUnitPrice' and p_input->>'normalizedUnitPrice' <> '' then (p_input->>'normalizedUnitPrice')::numeric else null end,
    coalesce(nullif(trim(coalesce(p_input->>'currencyCode', '')), ''), 'HKD'),
    nullif(trim(coalesce(p_input->>'scopeSignature', '')), ''),
    nullif(trim(coalesce(p_input->>'overrideReason', '')), ''),
    auth.uid()
  );

  update public.qms_quote_cost_versions
     set updated_at = timezone('utc', now()),
         mutation_revision = coalesce(mutation_revision, 0) + 1
   where id = v_version.id
   returning mutation_revision into v_version.mutation_revision;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'costVersionId', v_version.id,
    'costRevision', v_version.mutation_revision,
    'costLineId', v_line_id,
    'coverageId', v_coverage_id,
    'sourceType', v_source_type
  );
end;
$$;


ALTER FUNCTION public.qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb) IS 'Atomically sets the single active cost source for one requirement scope + component on the current draft cost version, advancing the draft mutation revision used for optimistic concurrency. When the latest version is published, a new draft is forked and inherits every currently effective line/coverage/snapshot before the one scope is replaced. Switching or cancelling only deactivates the previous coverage for that scope; history is preserved. Only approved HKD supplier revisions may be selected, and the server recomputes the supplier amount from the selected quantity. Unpriced lines store null amounts, never 0.';


--
-- Name: qms_attach_quote_cost_packet_file(uuid, uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid DEFAULT NULL::uuid, p_component_type text DEFAULT 'BUNDLE'::text, p_source_folder_path text DEFAULT NULL::text, p_signature_suggestion jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_packet_id uuid;
  v_packet_file_id uuid;
  v_scope_id uuid;
  v_item_key uuid;
  v_component text;
  v_import_status text;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  -- P0: all cost-scope writes are Super Admin only.
  if v_role <> 'super_admin' then
    raise exception 'super_admin_required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.quotations q where q.id = p_quotation_id) then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  select status into v_import_status
    from public.qms_supplier_quote_imports
   where id = p_import_id and owner_auth_user_id = auth.uid();
  if v_import_status is null then
    raise exception 'supplier_import_not_found' using errcode = 'P0002';
  end if;
  if v_import_status = 'archived' then
    raise exception 'supplier_import_archived' using errcode = '22023';
  end if;

  v_component := coalesce(nullif(trim(p_component_type), ''), 'BUNDLE');
  if v_component not in ('MATERIAL', 'INSTALLATION', 'BUNDLE', 'OTHER') then
    raise exception 'invalid_component_type' using errcode = '22023';
  end if;

  -- Target item is optional; when given it must belong to this quotation.
  if p_quote_item_key is not null then
    if not exists (
      select 1 from public.qms_quotation_item_identities qi
       where qi.id = p_quote_item_key and qi.quotation_id = p_quotation_id
    ) then
      raise exception 'quote_item_identity_not_found' using errcode = 'P0002';
    end if;
    v_item_key := p_quote_item_key;
  end if;

  insert into public.qms_quote_cost_packets (quotation_id, status, created_by)
  values (p_quotation_id, 'open', auth.uid())
  on conflict (quotation_id) do nothing;
  select id into v_packet_id from public.qms_quote_cost_packets where quotation_id = p_quotation_id;

  -- Reuse a live scope for this (item, component); NULL item means target undecided.
  select id into v_scope_id
    from public.qms_quote_cost_scopes
   where packet_id = v_packet_id
     and component_type = v_component
     and status <> 'orphaned'
     and quote_item_key is not distinct from v_item_key
   order by created_at desc
   limit 1;

  if v_scope_id is null then
    insert into public.qms_quote_cost_scopes
      (packet_id, quote_item_key, component_type, target_source, source_folder_path, suggestion, status, created_at, updated_at)
    values (
      v_packet_id, v_item_key, v_component, 'manual', p_source_folder_path, p_signature_suggestion,
      case when v_item_key is null then 'unset' else 'pending_review' end, now(), now()
    )
    returning id into v_scope_id;
  end if;

  insert into public.qms_quote_cost_packet_files (packet_id, import_id, signature_suggestion, status)
  values (
    v_packet_id, p_import_id, p_signature_suggestion,
    case when v_import_status = 'approved' then 'approved'
         when v_import_status = 'needs_review' then 'needs_review'
         else 'processing' end
  )
  on conflict (packet_id, import_id) do nothing;
  select id into v_packet_file_id
    from public.qms_quote_cost_packet_files
   where packet_id = v_packet_id and import_id = p_import_id;

  insert into public.qms_quote_cost_scope_files (scope_id, packet_file_id)
  values (v_scope_id, v_packet_file_id)
  on conflict (scope_id, packet_file_id) do nothing;

  insert into public.qms_quote_cost_audits
    (packet_id, entity_type, entity_id, action, after, created_by, created_at)
  values (
    v_packet_id, 'file', v_packet_file_id, 'file_attached',
    jsonb_build_object('scopeId', v_scope_id, 'importId', p_import_id, 'componentType', v_component),
    auth.uid(), now()
  );

  return jsonb_build_object(
    'packetId', v_packet_id,
    'scopeId', v_scope_id,
    'packetFileId', v_packet_file_id,
    'componentType', v_component,
    'targetItemKey', v_item_key
  );
end;
$$;


ALTER FUNCTION public.qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb) IS 'Attaches the caller''s own supplier import to their quotation''s cost-scope packet, creating the packet and an unset/pending competition group as needed. Super Admin only; additive; writes only QMS-owned tables and appends one audit row.';


--
-- Name: qms_commit_quote_cost_binding(uuid, integer, integer, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_quote_version integer;
  v_supplier_revision public.qms_supplier_quote_revisions;
  v_current_cost_revision integer;
  v_link_id uuid;
  v_next_cost_revision integer;
  v_mapping_count integer;
  v_snapshot jsonb;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select version_number into v_quote_version
    from public.quotations where id = p_quotation_id for update;
  if v_quote_version is null then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;
  if p_expected_quote_version is null or v_quote_version <> p_expected_quote_version then
    raise exception 'quote_revision_conflict' using errcode = '40001';
  end if;

  select coalesce(max(cost_revision_no), 0) into v_current_cost_revision
    from public.qms_quotation_cost_revisions
    where quotation_id = p_quotation_id;
  if p_expected_cost_revision is null or v_current_cost_revision <> coalesce(p_expected_cost_revision, 0) then
    raise exception 'quote_cost_revision_conflict' using errcode = '40001';
  end if;

  select * into v_supplier_revision
    from public.qms_supplier_quote_revisions
    where id = p_supplier_revision_id for update;
  if v_supplier_revision.id is null then
    raise exception 'supplier_revision_not_found' using errcode = 'P0002';
  end if;
  if v_supplier_revision.status <> 'approved' then
    raise exception 'supplier_revision_not_approved' using errcode = '42501';
  end if;

  if p_source_role is null or p_source_role not in ('awarded_cost', 'reference_cost', 'alternate_cost') then
    raise exception 'invalid_source_role' using errcode = '22023';
  end if;

  if p_source_role = 'awarded_cost'
     and (v_supplier_revision.source_project_name is null
          or v_supplier_revision.source_site_address is null
          or v_supplier_revision.source_area_sq_ft is null) then
    if p_override_reason is null or length(trim(p_override_reason)) = 0 then
      raise exception 'override_reason_required' using errcode = '22023';
    end if;
  end if;

  if p_mappings is not null and jsonb_typeof(p_mappings) <> 'array' then
    raise exception 'invalid_mappings' using errcode = '22023';
  end if;

  -- Ensure a stable identity exists for every live item so a quotation that has
  -- never been revised can still bind. Idempotent: only missing identities are added.
  insert into public.qms_quotation_item_identities (
    quotation_id, current_quotation_section_item_id, catalog_item_id
  )
  select p_quotation_id, qsi.id, qsi.item_id
    from public.quotation_section_items qsi
   where qsi.quote_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false
     and not exists (
       select 1 from public.qms_quotation_item_identities qi
        where qi.current_quotation_section_item_id = qsi.id
     )
  on conflict (current_quotation_section_item_id) do nothing;

  -- Upsert the active document link (supersede existing confirmed links first).
  update public.qms_quotation_supplier_links
     set status = 'superseded'
   where quotation_id = p_quotation_id
     and status in ('proposed', 'confirmed');

  insert into public.qms_quotation_supplier_links (
    quotation_id, supplier_quote_revision_id, supplier_id, source_role, status,
    context_mismatch_flags, override_reason, created_by, created_at, confirmed_by, confirmed_at
  ) values (
    p_quotation_id, v_supplier_revision.id, v_supplier_revision.supplier_id, p_source_role, 'confirmed',
    '{}'::jsonb, p_override_reason, auth.uid(), now(), auth.uid(), now()
  ) returning id into v_link_id;

  if p_mappings is not null and jsonb_array_length(p_mappings) > 0 then
    -- Stage every mapping once, then validate and insert set-based (no per-row loop).
    create temp table pg_temp.tmp_cost_mappings (
      quote_item_key uuid,
      supplier_item_id uuid,
      allocated numeric,
      mapping_kind text,
      applied_quantity numeric,
      applied_unit_id uuid,
      conversion_factor numeric
    ) on commit drop;

    insert into pg_temp.tmp_cost_mappings (
      quote_item_key, supplier_item_id, allocated, mapping_kind,
      applied_quantity, applied_unit_id, conversion_factor
    )
    select
      (m->>'quoteItemKey')::uuid,
      (m->>'supplierQuoteItemId')::uuid,
      coalesce((m->>'allocatedCostAmount')::numeric, 0),
      coalesce(m->>'mappingKind', 'manual'),
      case when m ? 'appliedQuantity' then (m->>'appliedQuantity')::numeric else null end,
      case when m ? 'appliedUnitId' then (m->>'appliedUnitId')::uuid else null end,
      case when m ? 'conversionFactor' then (m->>'conversionFactor')::numeric else null end
    from jsonb_array_elements(p_mappings) as m
    where m ? 'quoteItemKey' and m ? 'supplierQuoteItemId';

    v_mapping_count := jsonb_array_length(p_mappings);
    -- Every mapping must carry both keys.
    if (select count(*) from pg_temp.tmp_cost_mappings) <> v_mapping_count then
      raise exception 'invalid_mapping' using errcode = '22023';
    end if;
    -- Supplier lines must exist and be priceable.
    if exists (
      select 1 from pg_temp.tmp_cost_mappings t
        left join public.qms_supplier_quote_items si on si.id = t.supplier_item_id
       where si.id is null
    ) then
      raise exception 'supplier_quote_item_not_found' using errcode = 'P0002';
    end if;
    if exists (
      select 1 from pg_temp.tmp_cost_mappings t
        join public.qms_supplier_quote_items si on si.id = t.supplier_item_id
       where si.pricing_status not in ('priced', 'free')
    ) then
      raise exception 'supplier_item_not_priceable' using errcode = '22023';
    end if;
    if exists (select 1 from pg_temp.tmp_cost_mappings where allocated < 0) then
      raise exception 'negative_allocation' using errcode = '22023';
    end if;
    if exists (
      select 1
        from (
          select supplier_item_id, sum(allocated) as allocated_total
            from pg_temp.tmp_cost_mappings
           group by supplier_item_id
        ) tot
        join public.qms_supplier_quote_items si on si.id = tot.supplier_item_id
       where si.pricing_status = 'priced'
         and si.source_line_total is not null
         and tot.allocated_total > si.source_line_total
    ) then
      raise exception 'allocation_exceeds_source_line' using errcode = '22023';
    end if;
    -- Each quote key must resolve to a stable identity (by live item id or identity id).
    if exists (
      select 1 from pg_temp.tmp_cost_mappings t
       where not exists (
         select 1
           from public.qms_quotation_item_identities qi
           join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
          where qi.quotation_id = p_quotation_id and qsi.id = t.quote_item_key
       )
       and not exists (
         select 1 from public.qms_quotation_item_identities qi2
          where qi2.quotation_id = p_quotation_id and qi2.id = t.quote_item_key
       )
    ) then
      raise exception 'quote_item_identity_not_found' using errcode = 'P0002';
    end if;

    insert into public.qms_quotation_item_cost_bindings (
      quote_item_identity_id, quotation_supplier_link_id, supplier_quote_item_id,
      mapping_kind, applied_quantity, applied_unit_id, conversion_factor,
      allocated_cost_amount, status, confirmed_by, confirmed_at, created_at
    )
    select
      coalesce(
        (select qi.id
           from public.qms_quotation_item_identities qi
           join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
          where qi.quotation_id = p_quotation_id and qsi.id = t.quote_item_key
          limit 1),
        (select qi2.id
           from public.qms_quotation_item_identities qi2
          where qi2.quotation_id = p_quotation_id and qi2.id = t.quote_item_key
          limit 1)
      ),
      v_link_id, t.supplier_item_id, t.mapping_kind, t.applied_quantity,
      t.applied_unit_id, t.conversion_factor, t.allocated,
      'confirmed', auth.uid(), now(), now()
    from pg_temp.tmp_cost_mappings t;
  end if;

  -- Persist the adopted cost snapshot on the live PMS items (single statement).
  -- Deliberately does not touch modified_date: binding is a QMS cost concern and
  -- must not mark the original quotation items as edited. unit_price /
  -- sub_total_price are untouched.
  update public.quotation_section_items qsi
     set cost = agg.applied_unit_cost,
         sub_total_cost = agg.total_allocated
    from (
      select qi.current_quotation_section_item_id as item_id,
             sum(b.allocated_cost_amount) as total_allocated,
             case when max(qsi.quantity) > 0
                  then sum(b.allocated_cost_amount) / max(qsi.quantity)
                  else null end as applied_unit_cost
        from public.qms_quotation_item_cost_bindings b
        join public.qms_quotation_item_identities qi on qi.id = b.quote_item_identity_id
        join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
       where b.quotation_supplier_link_id = v_link_id
         and b.status = 'confirmed'
       group by qi.current_quotation_section_item_id
    ) agg
    where qsi.id = agg.item_id;

  select coalesce(max(cost_revision_no), 0) + 1 into v_next_cost_revision
    from public.qms_quotation_cost_revisions
    where quotation_id = p_quotation_id;

  v_snapshot := jsonb_build_object(
    'quotationId', p_quotation_id,
    'quotationVersionNumber', v_quote_version,
    'supplierRevisionId', v_supplier_revision.id,
    'sourceRole', p_source_role,
    'overrideReason', p_override_reason,
    'mappings', p_mappings,
    'committedBy', auth.uid(),
    'committedAt', now()
  );

  insert into public.qms_quotation_cost_revisions (
    quotation_id, cost_revision_no, quotation_version_number, snapshot, created_by, created_at
  ) values (
    p_quotation_id, v_next_cost_revision, v_quote_version, v_snapshot, auth.uid(), now()
  );

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'quotationVersionNumber', v_quote_version,
    'costRevisionNumber', v_next_cost_revision,
    'supplierLinkId', v_link_id,
    'sourceRole', p_source_role
  );
end;
$$;


ALTER FUNCTION public.qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb) IS 'Atomically confirms a supplier cost binding in one call: ensures stable item identities, writes the document link, allocations (single set-based insert), the live cost snapshot on quotation_section_items.cost, and an append-only cost revision. Only approved supplier revisions may bind; awarding a mismatched document as formal cost requires a human reason. Binding never changes sell prices or item modified_date.';


--
-- Name: qms_commit_quote_cost_bindings(uuid, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_quote_version integer;
  v_current_cost_revision integer;
  v_next_cost_revision integer;
  v_group jsonb;
  v_revision_id uuid;
  v_supplier_revision public.qms_supplier_quote_revisions;
  v_source_role text;
  v_override_reason text;
  v_mappings jsonb;
  v_link_id uuid;
  v_mapping_count integer;
  v_group_count integer := 0;
  v_snapshot jsonb;
  v_sync jsonb;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select version_number into v_quote_version
    from public.quotations where id = p_quotation_id for update;
  if v_quote_version is null then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;
  if p_expected_quote_version is null or v_quote_version <> p_expected_quote_version then
    raise exception 'quote_revision_conflict' using errcode = '40001';
  end if;

  select coalesce(max(cost_revision_no), 0) into v_current_cost_revision
    from public.qms_quotation_cost_revisions
    where quotation_id = p_quotation_id;
  if p_expected_cost_revision is null or v_current_cost_revision <> coalesce(p_expected_cost_revision, 0) then
    raise exception 'quote_cost_revision_conflict' using errcode = '40001';
  end if;

  if p_suppliers is null or jsonb_typeof(p_suppliers) <> 'array' then
    raise exception 'invalid_suppliers' using errcode = '22023';
  end if;

  insert into public.qms_quotation_item_identities (
    quotation_id, current_quotation_section_item_id, catalog_item_id
  )
  select p_quotation_id, qsi.id, qsi.item_id
    from public.quotation_section_items qsi
   where qsi.quote_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false
     and not exists (
       select 1 from public.qms_quotation_item_identities qi
        where qi.current_quotation_section_item_id = qsi.id
     )
  on conflict (current_quotation_section_item_id) do nothing;

  update public.qms_quotation_supplier_links
     set status = 'superseded'
   where quotation_id = p_quotation_id
     and status in ('proposed', 'confirmed');

  create temp table if not exists pg_temp.tmp_cost_mappings (
    quote_item_key uuid,
    supplier_item_id uuid,
    allocated numeric,
    mapping_kind text,
    applied_quantity numeric,
    applied_unit_id uuid,
    conversion_factor numeric,
    cost_scope_id uuid,
    component_type text,
    include_optional boolean,
    adopted_pricing_status text
  ) on commit drop;

  for v_group in select value from jsonb_array_elements(p_suppliers) loop
    v_revision_id := nullif(v_group->>'supplierRevisionId', '')::uuid;
    if v_revision_id is null then
      raise exception 'invalid_supplier_group' using errcode = '22023';
    end if;

    select * into v_supplier_revision
      from public.qms_supplier_quote_revisions
      where id = v_revision_id for update;
    if v_supplier_revision.id is null then
      raise exception 'supplier_revision_not_found' using errcode = 'P0002';
    end if;
    if v_supplier_revision.status <> 'approved' then
      raise exception 'supplier_revision_not_approved' using errcode = '42501';
    end if;

    v_source_role := coalesce(nullif(v_group->>'sourceRole', ''), 'reference_cost');
    if v_source_role not in ('awarded_cost', 'reference_cost', 'alternate_cost') then
      raise exception 'invalid_source_role' using errcode = '22023';
    end if;
    -- Awarded cost ALWAYS needs a human reason (PRD 7.2.4).
    v_override_reason := nullif(trim(coalesce(v_group->>'overrideReason', '')), '');
    if v_source_role = 'awarded_cost' and v_override_reason is null then
      raise exception 'override_reason_required' using errcode = '22023';
    end if;

    insert into public.qms_quotation_supplier_links (
      quotation_id, supplier_quote_revision_id, supplier_id, source_role, status,
      context_mismatch_flags, override_reason, created_by, created_at, confirmed_by, confirmed_at
    ) values (
      p_quotation_id, v_supplier_revision.id, v_supplier_revision.supplier_id, v_source_role, 'confirmed',
      '{}'::jsonb, v_override_reason, auth.uid(), now(), auth.uid(), now()
    ) returning id into v_link_id;

    v_mappings := coalesce(v_group->'mappings', '[]'::jsonb);
    if jsonb_typeof(v_mappings) <> 'array' then
      raise exception 'invalid_mappings' using errcode = '22023';
    end if;

    if jsonb_array_length(v_mappings) > 0 then
      truncate pg_temp.tmp_cost_mappings;
      insert into pg_temp.tmp_cost_mappings (
        quote_item_key, supplier_item_id, allocated, mapping_kind,
        applied_quantity, applied_unit_id, conversion_factor,
        cost_scope_id, component_type, include_optional, adopted_pricing_status
      )
      select
        (m->>'quoteItemKey')::uuid,
        (m->>'supplierQuoteItemId')::uuid,
        coalesce((m->>'allocatedCostAmount')::numeric, 0),
        coalesce(m->>'mappingKind', 'manual'),
        case when m ? 'appliedQuantity' then (m->>'appliedQuantity')::numeric else null end,
        case when m ? 'appliedUnitId' then (m->>'appliedUnitId')::uuid else null end,
        case when m ? 'conversionFactor' then (m->>'conversionFactor')::numeric else null end,
        case when coalesce(m->>'costScopeId', '') <> '' then (m->>'costScopeId')::uuid else null end,
        case when coalesce(m->>'componentType', '') <> '' then m->>'componentType' else null end,
        coalesce((m->>'includeOptional')::boolean, false),
        null
      from jsonb_array_elements(v_mappings) as m
      where m ? 'quoteItemKey' and m ? 'supplierQuoteItemId';

      v_mapping_count := jsonb_array_length(v_mappings);
      if (select count(*) from pg_temp.tmp_cost_mappings) <> v_mapping_count then
        raise exception 'invalid_mapping' using errcode = '22023';
      end if;
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
          left join public.qms_supplier_quote_items si on si.id = t.supplier_item_id
         where si.id is null
      ) then
        raise exception 'supplier_quote_item_not_found' using errcode = 'P0002';
      end if;
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
         where t.component_type is not null
           and t.component_type not in ('MATERIAL', 'INSTALLATION', 'BUNDLE', 'OTHER')
      ) then
        raise exception 'invalid_component_type' using errcode = '22023';
      end if;
      -- A component must lie in the item's expected set (D6).
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
          join public.qms_quotation_item_identities qi
            on qi.id = t.quote_item_key
         where t.component_type is not null
           and not (t.component_type = any (coalesce(qi.expected_components, array['BUNDLE'])))
      ) then
        raise exception 'component_not_expected' using errcode = '22023';
      end if;
      -- Scope target and component must agree with the binding.
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
          join public.qms_quote_cost_scopes sc on sc.id = t.cost_scope_id
         where t.cost_scope_id is not null
           and (sc.quote_item_key is null
                or sc.quote_item_key <> t.quote_item_key
                or sc.component_type <> coalesce(t.component_type, sc.component_type))
      ) then
        raise exception 'scope_target_mismatch' using errcode = '22023';
      end if;
      -- An unset target cannot be awarded.
      if v_source_role = 'awarded_cost' and exists (
        select 1 from pg_temp.tmp_cost_mappings t
          join public.qms_quote_cost_scopes sc on sc.id = t.cost_scope_id
         where t.cost_scope_id is not null and sc.quote_item_key is null
      ) then
        raise exception 'scope_target_unset' using errcode = '22023';
      end if;
      -- Source file must be a member of the scope (or a member alias master).
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
         where t.cost_scope_id is not null
           and not exists (
             select 1
               from public.qms_quote_cost_scope_files sf
               join public.qms_quote_cost_packet_files pf on pf.id = sf.packet_file_id
              where sf.scope_id = t.cost_scope_id
                and pf.import_id = v_supplier_revision.import_id
           )
           and not exists (
             select 1
               from public.qms_quote_cost_scope_files sf
               join public.qms_quote_cost_packet_files pf on pf.id = sf.packet_file_id
               join public.qms_supplier_quote_imports i on i.id = pf.import_id
              where sf.scope_id = t.cost_scope_id
                and i.duplicate_of_import_id = v_supplier_revision.import_id
           )
      ) then
        raise exception 'source_file_not_in_scope' using errcode = '22023';
      end if;

      -- Server derives the adopted pricing status from source status + adoption.
      update pg_temp.tmp_cost_mappings t
         set adopted_pricing_status = case
               when si.pricing_status = 'optional' and t.include_optional then 'optional_adopted'
               when si.pricing_status = 'optional' then 'optional'
               else si.pricing_status
             end
        from public.qms_supplier_quote_items si
       where si.id = t.supplier_item_id;

      -- Only priced/free, adopted optional, or included may be a confirmed cost
      -- line; an un-adopted optional line is rejected (it must not carry cost).
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
         where t.adopted_pricing_status not in ('priced', 'free', 'included', 'optional_adopted')
      ) then
        raise exception 'supplier_item_not_priceable' using errcode = '22023';
      end if;
      if exists (select 1 from pg_temp.tmp_cost_mappings where allocated < 0) then
        raise exception 'negative_allocation' using errcode = '22023';
      end if;
      if exists (
        select 1
          from (
            select supplier_item_id, sum(allocated) as allocated_total
              from pg_temp.tmp_cost_mappings
             group by supplier_item_id
          ) tot
          join public.qms_supplier_quote_items si on si.id = tot.supplier_item_id
         where si.pricing_status = 'priced'
           and si.source_line_total is not null
           and tot.allocated_total > si.source_line_total
      ) then
        raise exception 'allocation_exceeds_source_line' using errcode = '22023';
      end if;
      if exists (
        select 1 from pg_temp.tmp_cost_mappings t
         where not exists (
           select 1
             from public.qms_quotation_item_identities qi
             join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
            where qi.quotation_id = p_quotation_id and qsi.id = t.quote_item_key
         )
         and not exists (
           select 1 from public.qms_quotation_item_identities qi2
            where qi2.quotation_id = p_quotation_id and qi2.id = t.quote_item_key
         )
      ) then
        raise exception 'quote_item_identity_not_found' using errcode = 'P0002';
      end if;

      -- Award conflict matrix (D3): one awarded supplier per (item, component);
      -- BUNDLE excludes every split component for the same item.
      if v_source_role = 'awarded_cost' and exists (
        select 1
          from (
            select distinct t.quote_item_key,
                   coalesce(t.component_type, sc.component_type) as comp
              from pg_temp.tmp_cost_mappings t
              left join public.qms_quote_cost_scopes sc on sc.id = t.cost_scope_id
             where t.cost_scope_id is not null
          ) neww
          join public.qms_quote_cost_scope_sources s
            on s.status = 'confirmed' and s.source_role = 'awarded_cost'
           and s.supplier_quote_revision_id <> v_supplier_revision.id
          join public.qms_quote_cost_scopes sc2 on sc2.id = s.scope_id
         where sc2.quote_item_key = neww.quote_item_key
           and (sc2.component_type = neww.comp
                or sc2.component_type = 'BUNDLE'
                or neww.comp = 'BUNDLE')
      ) then
        raise exception 'award_conflict' using errcode = '22023';
      end if;

      -- Role authority on the competition group (Revision x scope). Supersede any
      -- previous confirmed role for this revision/scope, then confirm the new one.
      update public.qms_quote_cost_scope_sources
         set status = 'superseded'
       where status = 'confirmed'
         and supplier_quote_revision_id = v_supplier_revision.id
         and (source_role <> v_source_role
              or scope_id not in (
                select distinct cost_scope_id from pg_temp.tmp_cost_mappings where cost_scope_id is not null
              ));

      insert into public.qms_quote_cost_scope_sources (
        scope_id, supplier_quote_revision_id, source_role, override_reason, status, legacy,
        confirmed_by, confirmed_at, created_at
      )
      select distinct t.cost_scope_id, v_supplier_revision.id, v_source_role, v_override_reason,
             'confirmed', false, auth.uid(), now(), now()
        from pg_temp.tmp_cost_mappings t
       where t.cost_scope_id is not null
      on conflict do nothing;

      insert into public.qms_quotation_item_cost_bindings (
        quote_item_identity_id, quotation_supplier_link_id, supplier_quote_item_id,
        mapping_kind, applied_quantity, applied_unit_id, conversion_factor,
        allocated_cost_amount, status, confirmed_by, confirmed_at, created_at,
        cost_scope_id, component_type, include_optional, adopted_pricing_status
      )
      select
        coalesce(
          (select qi.id
             from public.qms_quotation_item_identities qi
             join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
            where qi.quotation_id = p_quotation_id and qsi.id = t.quote_item_key
            limit 1),
          (select qi2.id
             from public.qms_quotation_item_identities qi2
            where qi2.quotation_id = p_quotation_id and qi2.id = t.quote_item_key
            limit 1)
        ),
        v_link_id, t.supplier_item_id, t.mapping_kind, t.applied_quantity,
        t.applied_unit_id, t.conversion_factor, t.allocated,
        'confirmed', auth.uid(), now(), now(),
        t.cost_scope_id,
        coalesce(t.component_type, (select sc3.component_type from public.qms_quote_cost_scopes sc3 where sc3.id = t.cost_scope_id)),
        t.include_optional, t.adopted_pricing_status
      from pg_temp.tmp_cost_mappings t;
    end if;

    v_group_count := v_group_count + 1;
  end loop;

  if v_group_count = 0 then
    raise exception 'no_supplier_binding' using errcode = '22023';
  end if;

  -- Legacy PMS cost snapshot: only confirmed AWARDED allocations, with the scope
  -- role taking precedence over the document link role.
  update public.quotation_section_items qsi
     set cost = agg.applied_unit_cost,
         sub_total_cost = agg.total_allocated
    from (
      select qi.current_quotation_section_item_id as item_id,
             sum(b.allocated_cost_amount) as total_allocated,
             case when max(la.quantity) > 0
                  then sum(b.allocated_cost_amount) / max(la.quantity)
                  else null end as applied_unit_cost
        from public.qms_quotation_item_cost_bindings b
        join public.qms_quotation_item_identities qi on qi.id = b.quote_item_identity_id
        join public.qms_quotation_supplier_links l on l.id = b.quotation_supplier_link_id
        join public.qms_supplier_quote_items si on si.id = b.supplier_quote_item_id
        left join public.qms_quote_cost_scope_sources ss
          on ss.scope_id = b.cost_scope_id
         and ss.supplier_quote_revision_id = si.supplier_quote_revision_id
         and ss.status = 'confirmed'
        join public.quotation_section_items la on la.id = qi.current_quotation_section_item_id
       where l.quotation_id = p_quotation_id
         and l.status = 'confirmed'
         and b.status = 'confirmed'
         and coalesce(ss.source_role, l.source_role) = 'awarded_cost'
       group by qi.current_quotation_section_item_id
    ) agg
    where qsi.id = agg.item_id;

  select coalesce(max(cost_revision_no), 0) + 1 into v_next_cost_revision
    from public.qms_quotation_cost_revisions
    where quotation_id = p_quotation_id;

  v_snapshot := jsonb_build_object(
    'quotationId', p_quotation_id,
    'quotationVersionNumber', v_quote_version,
    'suppliers', p_suppliers,
    'committedBy', auth.uid(),
    'committedAt', now()
  );

  insert into public.qms_quotation_cost_revisions (
    quotation_id, cost_revision_no, quotation_version_number, snapshot, created_by, created_at
  ) values (
    p_quotation_id, v_next_cost_revision, v_quote_version, v_snapshot, auth.uid(), now()
  );

  v_sync := public.qms_sync_quote_cost_from_bindings(p_quotation_id, null);

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'quotationVersionNumber', v_quote_version,
    'costRevisionNumber', v_next_cost_revision,
    'supplierCount', v_group_count,
    'costSync', v_sync
  );
end;
$$;


ALTER FUNCTION public.qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb) IS 'Atomically confirms the full multi-supplier cost binding for one quotation in a single locked transaction: ensures stable identities, writes one confirmed link per revision plus set-based allocations, confirms the per-scope role (Revision x competition group), validates target/component/source membership, rejects unexpected components and award conflicts, derives the adopted pricing status server-side, aggregates only AWARDED allocations onto the legacy quotation_section_items.cost, appends one cost revision and projects into the internal cost version. Awarded cost always requires a human reason. Never changes sell prices or item modified_date; writes no PMS column beyond the legacy cost snapshot.';


--
-- Name: qms_cost_reference_summary(uuid, text, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text DEFAULT NULL::text, p_normalized_unit_id uuid DEFAULT NULL::uuid, p_scope_signature text DEFAULT NULL::text, p_window_months integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_result jsonb;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_standard_variant_id is null then
    raise exception 'variant_required' using errcode = '22023';
  end if;

  with base as (
    select s.*
    from public.qms_cost_reference_samples s
    where s.standard_variant_id = p_standard_variant_id
      and s.currency_code = 'HKD'
      and s.source_date >= (current_date - make_interval(months => greatest(coalesce(p_window_months, 24), 1)))
      and (p_component_type is null or s.component_type = p_component_type)
      and (p_normalized_unit_id is null or s.normalized_unit_id = p_normalized_unit_id)
      and (p_scope_signature is null or s.scope_signature = p_scope_signature)
  ),
  latest_per_supplier as (
    select distinct on (supplier_id) *
    from base
    order by supplier_id, source_date desc, supplier_quote_revision_id desc
  ),
  agg as (
    select count(*)::int                                                    as sample_count,
           count(distinct supplier_id)::int                                 as supplier_count,
           min(normalized_unit_cost)                                        as minimum,
           percentile_cont(0.5) within group (order by normalized_unit_cost) as median,
           max(normalized_unit_cost)                                        as maximum,
           avg(normalized_unit_cost)                                        as average,
           min(source_date)                                                 as period_start,
           max(source_date)                                                 as period_end,
           coalesce(jsonb_agg(supplier_quote_item_id order by source_date), '[]'::jsonb) as sample_ids
    from latest_per_supplier
  )
  select jsonb_build_object(
    'standardVariantId', p_standard_variant_id,
    'sampleCount', a.sample_count,
    'supplierCount', a.supplier_count,
    'minimum', a.minimum,
    'median', a.median,
    'maximum', a.maximum,
    'average', case when a.average is null then null else round(a.average, 2) end,
    'sampleLevel', case
      when a.sample_count = 0 then 'none'
      when a.sample_count = 1 then 'single'
      when a.sample_count = 2 then 'few'
      else 'full'
    end,
    'currency', 'HKD',
    'periodStart', a.period_start,
    'periodEnd', a.period_end,
    'sampleIds', a.sample_ids,
    'currencyRestricted', exists (
      select 1 from public.qms_cost_reference_samples x
      where x.standard_variant_id = p_standard_variant_id
        and x.currency_code <> 'HKD'
    )
  )
  into v_result
  from agg a;

  return v_result;
end;
$$;


ALTER FUNCTION public.qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer) OWNER TO postgres;

--
-- Name: FUNCTION qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer) IS 'De-duplicated historical supplier cost statistics for one comparable group: per-supplier latest eligible line within the window, then min/median/max/average. n=0 none, n=1 single, n=2 few, n>=3 full. HKD only; non-HKD lines are excluded and flagged. Statistics are a planning reference, never a guaranteed market price.';


--
-- Name: qms_dashboard_summary(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_dashboard_summary() RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_result json;
begin
  select json_build_object(
    'quote_count', (select count(*) from public.quotations),
    'customer_count', (select count(*) from public.customers),
    'tender_count', (select count(*) from public.tenders),
    'won_quote_count', (
      select count(*) from public.quotations q
       where lower(btrim(coalesce(q.status, ''))) in ('won', 'accepted', 'approved')
    ),
    'lost_quote_count', (
      select count(*) from public.quotations q
       where lower(btrim(coalesce(q.status, ''))) in ('lost', 'rejected')
    ),
    'recent_quotes', coalesce((
      select json_agg(
               json_build_object(
                 'id', r.id,
                 'status', r.status,
                 'created_at', r.created_at
               )
               order by r.created_at desc nulls last
             )
        from (
          select q.id,
                 q.status,
                 coalesce(q.created_date, q.date, q.modified_date) as created_at
            from public.quotations q
           order by coalesce(q.created_date, q.date, q.modified_date) desc nulls last
           limit 6
        ) r
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION public.qms_dashboard_summary() OWNER TO postgres;

--
-- Name: qms_ensure_item_identities(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_ensure_item_identities(p_quotation_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_item record;
  v_created integer := 0;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  for v_item in
    select qsi.id as item_id, qsi.item_id as catalog_item_id
      from public.quotation_section_items qsi
     where qsi.quote_id = p_quotation_id
       and coalesce(qsi.abandon, false) = false
  loop
    if not exists (
      select 1 from public.qms_quotation_item_identities
      where current_quotation_section_item_id = v_item.item_id
    ) then
      insert into public.qms_quotation_item_identities (quotation_id, current_quotation_section_item_id, catalog_item_id)
      values (p_quotation_id, v_item.item_id, v_item.catalog_item_id);
      v_created := v_created + 1;
    end if;
  end loop;
  return v_created;
end;
$$;


ALTER FUNCTION public.qms_ensure_item_identities(p_quotation_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION qms_ensure_item_identities(p_quotation_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_ensure_item_identities(p_quotation_id uuid) IS 'Idempotently creates stable item identities for all live items of a quotation. Identities are keyed by the current PMS item id and remapped after the revise rebuild.';


--
-- Name: qms_expected_components_valid(text[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_expected_components_valid(p text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select p is null or (
    cardinality(p) between 1 and 3
    and array_position(p, null) is null
    and p <@ array['MATERIAL', 'INSTALLATION', 'BUNDLE', 'OTHER']::text[]
    and not ('BUNDLE' = any (p) and cardinality(p) > 1)
    and cardinality(p) = (select count(distinct e) from unnest(p) as e)
  );
$$;


ALTER FUNCTION public.qms_expected_components_valid(p text[]) OWNER TO postgres;

--
-- Name: FUNCTION qms_expected_components_valid(p text[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_expected_components_valid(p text[]) IS 'True when a text[] is one of the eight legal expected_components sets: a non-empty, duplicate-free subset of MATERIAL/INSTALLATION/OTHER, or the single value BUNDLE.';


--
-- Name: qms_large_tender_quotes(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_large_tender_quotes(p_search text DEFAULT ''::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 15) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_search text := lower(coalesce(nullif(btrim(p_search), ''), ''));
  v_offset integer := greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_page_size, 15), 1);
  v_limit integer := greatest(coalesce(p_page_size, 15), 1);
  v_result json;
begin
  with totals as (
    select quote_id,
           sum(
             case when coalesce(abandon, false) then 0
                  else coalesce(sub_total_price, coalesce(unit_price, 0) * coalesce(quantity, 0))
             end
           )::numeric as total_amount
      from public.quotation_section_items
     where quote_id is not null
     group by quote_id
  ),
  base as (
    select q.*, coalesce(t.total_amount, 0) as total_amount
      from public.quotations q
      join totals t on t.quote_id = q.id
     where coalesce(t.total_amount, 0) > 10000000
  ),
  filtered as (
    select * from base
     where v_search = ''
        or lower(concat_ws(' ', quotation_no, reference_number, name, company_name, project, project_manager))
           like '%' || v_search || '%'
  )
  select json_build_object(
    'count', (select count(*) from filtered),
    'project_types', coalesce((
      select json_agg(json_build_object('id', t.id, 'name', t.name))
        from public.nos_quote_project_types t
    ), '[]'::json),
    'rows', coalesce((
      select json_agg(to_jsonb(f))
        from (
          select * from filtered
           order by total_amount desc, id
           limit v_limit offset v_offset
        ) f
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION public.qms_large_tender_quotes(p_search text, p_page integer, p_page_size integer) OWNER TO postgres;

--
-- Name: qms_permission_actor_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_permission_actor_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case when count(*) = 1 then min(
    case lower(trim(s.role))
      when 'super admin' then 'super_admin'
      when 'admin' then 'admin'
      when 'senior user' then 'senior_user'
      when 'user' then 'user'
      else null end) else null end
  from public.users u join public.staff s on s.id = u.member_id
  where u.auth_user_id = auth.uid()
    and lower(trim(u.approval_status)) = 'approved'
    and lower(trim(s.status)) = 'active';
$$;


ALTER FUNCTION public.qms_permission_actor_role() OWNER TO postgres;

--
-- Name: qms_pitching_list(text, text, text, text, text, text, text, text, boolean, text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_pitching_list(p_search text DEFAULT ''::text, p_stage text DEFAULT 'all'::text, p_project_manager text DEFAULT 'all'::text, p_team text DEFAULT 'all'::text, p_service_type text DEFAULT 'all'::text, p_district text DEFAULT 'all'::text, p_financial_year text DEFAULT 'all'::text, p_project_scale text DEFAULT 'all'::text, p_key_only boolean DEFAULT false, p_sort_key text DEFAULT 'date'::text, p_sort_dir text DEFAULT 'desc'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 15) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_staff jsonb := '{}'::jsonb;
  v_pt jsonb := '{}'::jsonb;
  v_npt jsonb := '{}'::jsonb;
  v_st_bubble jsonb := '{}'::jsonb;
  v_st_id jsonb := '{}'::jsonb;
  v_tt jsonb := '{}'::jsonb;
  v_fy_bubble jsonb := '{}'::jsonb;
  v_fy_id jsonb := '{}'::jsonb;
  v_dist jsonb := '{}'::jsonb;
  v_mh jsonb := '{}'::jsonb;
  v_search text := lower(coalesce(nullif(btrim(p_search), ''), ''));
  v_stage text := coalesce(nullif(btrim(p_stage), ''), 'all');
  v_pm text := coalesce(nullif(btrim(p_project_manager), ''), 'all');
  v_team text := coalesce(nullif(btrim(p_team), ''), 'all');
  v_service text := coalesce(nullif(btrim(p_service_type), ''), 'all');
  v_district text := coalesce(nullif(btrim(p_district), ''), 'all');
  v_fy text := coalesce(nullif(btrim(p_financial_year), ''), 'all');
  v_scale text := coalesce(nullif(btrim(p_project_scale), ''), 'all');
  v_sort text := lower(coalesce(nullif(btrim(p_sort_key), ''), 'date'));
  v_dir text := case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_offset integer := greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_page_size, 15), 1);
  v_limit integer := greatest(coalesce(p_page_size, 15), 1);
  v_result json;
begin
  -- Staff display names keyed by row id and bubble id.
  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_staff
    from (
      select k, max(label) as label
        from (
          select id::text as k,
                 coalesce(nullif(btrim(name), ''), nullif(btrim(full_name), '')) as label
            from public.staff where id is not null
          union all
          select bubble_id::text as k,
                 coalesce(nullif(btrim(name), ''), nullif(btrim(full_name), '')) as label
            from public.staff where bubble_id is not null
        ) s
       group by k
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_pt
    from (
      select bubble_id::text as k,
             coalesce(nullif(btrim(chin_display), ''), nullif(btrim(display), '')) as label
        from public.project_types where bubble_id is not null
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_npt
    from (
      select id::text as k, nullif(btrim(name), '') as label
        from public.nos_quote_project_types
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_st_bubble
    from (
      select bubble_id::text as k,
             coalesce(nullif(btrim(display), ''), nullif(btrim(chin_display), '')) as label
        from public.service_types where bubble_id is not null
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_st_id
    from (
      select id::text as k,
             coalesce(nullif(btrim(display), ''), nullif(btrim(chin_display), '')) as label
        from public.service_types
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_tt
    from (
      select bubble_id::text as k, nullif(btrim(display), '') as label
        from public.team_types where bubble_id is not null
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_fy_bubble
    from (
      select bubble_id::text as k, nullif(btrim(display), '') as label
        from public.financial_years where bubble_id is not null
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_fy_id
    from (
      select id::text as k, nullif(btrim(display), '') as label
        from public.financial_years
    ) t;

  select coalesce(jsonb_object_agg(k, label), '{}'::jsonb) into v_dist
    from (
      select bubble_id::text as k,
             coalesce(nullif(btrim(chinese_display), ''), nullif(btrim(name), '')) as label
        from public.districts where bubble_id is not null
    ) t;

  select coalesce(jsonb_object_agg(project_id::text, hours), '{}'::jsonb) into v_mh
    from (
      select project_id, sum(coalesce(work_hour, 0))::numeric as hours
        from public.man_hour_tasks
       where job_type = 'bwa_pitching' and project_id is not null
       group by project_id
    ) t;

  with resolved as (
    select
      b.id,
      b.customer_id::text as customer_id,
      nullif(btrim(b.pitching_code), '') as pitching_code,
      nullif(btrim(b.real_customer_display_name), '') as customer_name,
      nullif(btrim(b.real_customer_co_name), '') as company_name,
      nullif(btrim(b.real_building_name), '') as building_name,
      nullif(btrim(b.site_address), '') as site_address,
      coalesce(nullif(btrim(b.real_district_name), ''), v_dist ->> b.district::text) as district,
      coalesce(v_staff ->> b.main_pm_id::text, v_staff ->> b.main_pm::text) as project_manager,
      coalesce(v_staff ->> b.main_designer_id::text, v_staff ->> b.main_designer::text) as designer_name,
      coalesce(
        (
          select array_agg(s.lbl order by s.ord)
            from (
              select v_pt ->> btrim(x.val) as lbl, x.ord
                from unnest(regexp_split_to_array(coalesce(b.n_project_types, ''), ','))
                     with ordinality as x(val, ord)
               where nullif(btrim(x.val), '') is not null
            ) s
           where s.lbl is not null
        ),
        case when b.quote_project_type_id is not null
             then array(select v_npt ->> b.quote_project_type_id::text where (v_npt ->> b.quote_project_type_id::text) is not null)
             else null end,
        array[]::text[]
      ) as project_types,
      coalesce(
        (
          select array_agg(s.lbl order by s.ord)
            from (
              select v_st_bubble ->> btrim(x.val) as lbl, x.ord
                from unnest(regexp_split_to_array(coalesce(b.n_service_type, ''), ','))
                     with ordinality as x(val, ord)
               where nullif(btrim(x.val), '') is not null
            ) s
           where s.lbl is not null
        ),
        case when b.n_service_type_id is not null
             then array(select v_st_id ->> b.n_service_type_id::text where (v_st_id ->> b.n_service_type_id::text) is not null)
             else null end,
        array[]::text[]
      ) as service_types,
      (
        select s.lbl
          from (
            select v_tt ->> btrim(x.val) as lbl, x.ord
              from unnest(regexp_split_to_array(coalesce(b.n_team_type, ''), ','))
                   with ordinality as x(val, ord)
             where nullif(btrim(x.val), '') is not null
          ) s
         where s.lbl is not null
         order by s.ord
         limit 1
      ) as team_type,
      coalesce(v_fy_bubble ->> b.n_financial_year::text, v_fy_id ->> b.n_financial_year_id::text) as financial_year,
      nullif(btrim(b.os_money_size), '') as project_scale,
      coalesce(nullif(btrim(b.size), ''), nullif(btrim(b.actual_size), '')) as size,
      b.estimated_income,
      b.estimated_expense,
      case when b.estimated_income is null then null
           else b.estimated_income - coalesce(b.estimated_expense, 0) end as estimated_profit,
      nullif(btrim(b.pitching_stages), '') as stage,
      b.enquiry_date,
      b.modified_date,
      round(coalesce((v_mh ->> b.id::text)::numeric, 0), 1) as man_hour_total,
      case when b.enquiry_date is null then null
           else 90 - ((now() at time zone 'Asia/Hong_Kong')::date
                      - (b.enquiry_date at time zone 'Asia/Hong_Kong')::date)
      end as remaining_days,
      q.quotation_id,
      q.quote_number,
      q.quote_status,
      q.quote_date
    from public.bwa_pitchings b
    left join lateral (
      select qq.id as quotation_id,
             coalesce(nullif(btrim(qq.quotation_no), ''), nullif(btrim(qq.reference_number), '')) as quote_number,
             nullif(btrim(qq.status), '') as quote_status,
             coalesce(qq.date, qq.modified_date) as quote_date
        from public.quotations qq
       where qq.pitching_id = b.id
       order by qq.modified_date desc nulls last
       limit 1
    ) q on true
  ),
  scoped as (
    select * from resolved
     where (not coalesce(p_key_only, false)) or man_hour_total > 10
  ),
  filtered as (
    select * from scoped
     where (v_stage = 'all' or stage = v_stage)
       and (v_pm = 'all' or project_manager = v_pm)
       and (v_team = 'all' or team_type = v_team)
       and (v_service = 'all' or v_service = any(service_types))
       and (v_district = 'all' or district = v_district)
       and (v_fy = 'all' or financial_year = v_fy)
       and (v_scale = 'all' or project_scale = v_scale)
       and (
         v_search = ''
         or lower(concat_ws(' ',
              pitching_code, customer_name, company_name, building_name, site_address,
              district, project_manager, designer_name, team_type, financial_year, project_scale,
              array_to_string(project_types, ' '), array_to_string(service_types, ' ')
            )) like '%' || v_search || '%'
       )
  ),
  paged as (
    select * from filtered
     order by
       (case v_sort
          when 'date' then enquiry_date is null
          when 'remaining' then remaining_days is null
          when 'manHour' then man_hour_total is null
          when 'income' then estimated_income is null
          when 'profit' then estimated_profit is null
          when 'size' then nullif(regexp_replace(size, '[^0-9.]', '', 'g'), '') is null
          when 'service' then (service_types)[1] is null
          when 'project' then (project_types)[1] is null
          when 'district' then district is null
          when 'name' then customer_name is null
          else false
        end),
       case when v_dir = 'asc' then
         case v_sort
           when 'date' then extract(epoch from enquiry_date)::double precision
           when 'remaining' then remaining_days::double precision
           when 'manHour' then man_hour_total::double precision
           when 'income' then estimated_income::double precision
           when 'profit' then estimated_profit::double precision
           when 'size' then nullif(regexp_replace(size, '[^0-9.]', '', 'g'), '')::double precision
           else null
         end
       end asc nulls last,
       case when v_dir = 'desc' then
         case v_sort
           when 'date' then extract(epoch from enquiry_date)::double precision
           when 'remaining' then remaining_days::double precision
           when 'manHour' then man_hour_total::double precision
           when 'income' then estimated_income::double precision
           when 'profit' then estimated_profit::double precision
           when 'size' then nullif(regexp_replace(size, '[^0-9.]', '', 'g'), '')::double precision
           else null
         end
       end desc nulls last,
       case when v_dir = 'asc' then
         case v_sort
           when 'service' then (service_types)[1]
           when 'project' then (project_types)[1]
           when 'district' then district
           when 'name' then customer_name
           else null
         end
       end asc nulls last,
       case when v_dir = 'desc' then
         case v_sort
           when 'service' then (service_types)[1]
           when 'project' then (project_types)[1]
           when 'district' then district
           when 'name' then customer_name
           else null
         end
       end desc nulls last,
       id asc
     limit v_limit offset v_offset
  )
  select json_build_object(
    'count', (select count(*) from filtered),
    'kpi', json_build_object(
      'total', (select count(*) from filtered),
      'active', (select count(*) from filtered
                  where stage is distinct from 'Confirmed Project'
                    and stage is distinct from 'Case Closed'),
      'success', (select count(*) from filtered where stage = 'Confirmed Project'),
      'income', (select coalesce(sum(estimated_income), 0) from filtered),
      'profit', (select coalesce(sum(estimated_profit), 0) from filtered)
    ),
    'options', json_build_object(
      'serviceTypes', coalesce((select json_agg(v order by v) from (select distinct unnest(service_types) as v from scoped) t), '[]'::json),
      'districts', coalesce((select json_agg(v order by v) from (select distinct district as v from scoped where district is not null) t), '[]'::json),
      'stages', coalesce((select json_agg(v order by v) from (select distinct stage as v from scoped where stage is not null) t), '[]'::json),
      'projectManagers', coalesce((select json_agg(v order by v) from (select distinct project_manager as v from scoped where project_manager is not null) t), '[]'::json),
      'teams', coalesce((select json_agg(v order by v) from (select distinct team_type as v from scoped where team_type is not null) t), '[]'::json),
      'financialYears', coalesce((select json_agg(v order by v) from (select distinct financial_year as v from scoped where financial_year is not null) t), '[]'::json),
      'projectScales', coalesce((select json_agg(v order by v) from (select distinct project_scale as v from scoped where project_scale is not null) t), '[]'::json)
    ),
    'rows', coalesce((
      select json_agg(p.obj)
        from (
          select json_build_object(
            'id', p.id,
            'customer_id', p.customer_id,
            'pitching_code', p.pitching_code,
            'customer_name', p.customer_name,
            'company_name', p.company_name,
            'building_name', p.building_name,
            'site_address', p.site_address,
            'district_label', p.district,
            'project_manager', p.project_manager,
            'designer_name', p.designer_name,
            'project_types', p.project_types,
            'service_types', p.service_types,
            'team_type', p.team_type,
            'financial_year', p.financial_year,
            'project_scale', p.project_scale,
            'size', p.size,
            'estimated_income', p.estimated_income,
            'estimated_expense', p.estimated_expense,
            'estimated_profit', p.estimated_profit,
            'stage', p.stage,
            'enquiry_date', p.enquiry_date,
            'modified_at', p.modified_date,
            'man_hour_total', p.man_hour_total,
            'remaining_days', p.remaining_days,
            'quotation_id', p.quotation_id,
            'quote_number', p.quote_number,
            'quote_status', p.quote_status,
            'quote_date', p.quote_date
          ) as obj
          from paged p
        ) p
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION public.qms_pitching_list(p_search text, p_stage text, p_project_manager text, p_team text, p_service_type text, p_district text, p_financial_year text, p_project_scale text, p_key_only boolean, p_sort_key text, p_sort_dir text, p_page integer, p_page_size integer) OWNER TO postgres;

--
-- Name: qms_preview_cost_estimate(uuid, uuid, text, uuid, text, numeric, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_quote_exists boolean;
  v_stats jsonb;
  v_qty numeric;
  v_low numeric;
  v_base numeric;
  v_high numeric;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select exists (select 1 from public.quotations q where q.id = p_quotation_id) into v_quote_exists;
  if not v_quote_exists then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  v_stats := public.qms_cost_reference_summary(
    p_standard_variant_id, p_component_type, p_normalized_unit_id, p_scope_signature, p_window_months
  );

  v_qty := greatest(coalesce(p_quantity, 0), 0);
  v_low := round((v_stats->>'minimum')::numeric * v_qty, 2);
  v_base := round((v_stats->>'median')::numeric * v_qty, 2);
  v_high := round((v_stats->>'maximum')::numeric * v_qty, 2);

  return v_stats || jsonb_build_object(
    'quantity', v_qty,
    'lowAmount', case when (v_stats->>'minimum') is null then null else v_low end,
    'baseAmount', case when (v_stats->>'median') is null then null else v_base end,
    'highAmount', case when (v_stats->>'maximum') is null then null else v_high end
  );
end;
$$;


ALTER FUNCTION public.qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer) OWNER TO postgres;

--
-- Name: FUNCTION qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer) IS 'Read-only historical estimate preview for one variant/component/unit/scope group, scaled by quantity. Returns the sample statistics plus low/base/high totals. Nothing is written.';


--
-- Name: qms_publish_quote_cost_version(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_version public.qms_quote_cost_versions;
  v_required integer;
  v_covered integer;
  v_unpriced integer;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null or v_role <> 'super_admin' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_version
    from public.qms_quote_cost_versions
    where id = p_cost_version_id and quotation_id = p_quotation_id
    for update;
  if v_version.id is null then
    raise exception 'cost_version_not_found' using errcode = 'P0002';
  end if;
  if p_expected_cost_revision is null or coalesce(v_version.mutation_revision, 0) <> p_expected_cost_revision then
    raise exception 'quote_cost_revision_conflict' using errcode = '40001';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'cost_version_locked' using errcode = '22023';
  end if;

  select count(*)::int into v_required
    from public.qms_quotation_item_identities qi
    join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
   where qi.quotation_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false;

  select count(distinct c.requirement_scope_key)::int into v_covered
    from public.qms_cost_coverages c
   where c.cost_version_id = v_version.id
     and c.is_active
     and c.requirement_scope_key in (
       select qi.id::text
         from public.qms_quotation_item_identities qi
         join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
        where qi.quotation_id = p_quotation_id
          and coalesce(qsi.abandon, false) = false
     );

  -- An effective coverage that is still unpriced is not a complete cost: a
  -- published version must never present unknown as zero.
  select count(distinct c.requirement_scope_key)::int into v_unpriced
    from public.qms_cost_coverages c
    join public.qms_quote_cost_lines l on l.id = c.cost_line_id
   where c.cost_version_id = v_version.id
     and c.is_active
     and l.is_chargeable
     and l.base_amount is null
     and c.requirement_scope_key in (
       select qi.id::text
         from public.qms_quotation_item_identities qi
         join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
        where qi.quotation_id = p_quotation_id
          and coalesce(qsi.abandon, false) = false
     );

  if v_required = 0 then
    raise exception 'no_required_scope' using errcode = '22023';
  end if;
  if v_covered < v_required then
    raise exception 'cost_incomplete' using errcode = '22023';
  end if;
  if v_unpriced > 0 then
    raise exception 'cost_unpriced' using errcode = '22023';
  end if;

  update public.qms_quote_cost_versions
     set status = 'published',
         version_token = 'c' || v_version.revision::text,
         mutation_revision = coalesce(mutation_revision, 0) + 1,
         published_at = timezone('utc', now()),
         published_by = auth.uid(),
         updated_at = timezone('utc', now())
   where id = v_version.id;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'costVersionId', v_version.id,
    'costRevision', v_version.mutation_revision,
    'status', 'published',
    'requiredScopes', v_required,
    'coveredScopes', v_covered,
    'unpricedScopes', v_unpriced
  );
end;
$$;


ALTER FUNCTION public.qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer) OWNER TO postgres;

--
-- Name: FUNCTION qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer) IS 'Validates that every live quotation item has a priced active cost coverage, then locks the draft cost version as published. First phase publish is Super Admin only. A published cost version is never edited in place; further changes fork a new revision. Incomplete or still-unpriced coverage is rejected so unknown is never published as zero.';


--
-- Name: qms_quote_cost_audits_block_mutation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_quote_cost_audits_block_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  raise exception 'qms_quote_cost_audits_append_only' using errcode = 'check_violation';
end
$$;


ALTER FUNCTION public.qms_quote_cost_audits_block_mutation() OWNER TO postgres;

--
-- Name: qms_quote_cost_orphan_scopes_on_retire(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_quote_cost_orphan_scopes_on_retire() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.retired_at is not null and old.retired_at is distinct from new.retired_at then
    update public.qms_quote_cost_scopes
       set status = 'orphaned', updated_at = now()
     where quote_item_key = new.id and status <> 'orphaned';

    update public.qms_quote_cost_scope_sources s
       set status = 'superseded'
      from public.qms_quote_cost_scopes sc
     where s.scope_id = sc.id
       and sc.quote_item_key = new.id
       and s.status = 'confirmed';
  end if;
  return new;
end
$$;


ALTER FUNCTION public.qms_quote_cost_orphan_scopes_on_retire() OWNER TO postgres;

--
-- Name: qms_quote_cost_overview(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_quote_cost_overview(p_quotation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_version public.qms_quote_cost_versions;
  v_layers jsonb;
  v_total_low numeric;
  v_total_base numeric;
  v_total_high numeric;
  v_required integer;
  v_covered integer;
  v_priced integer;
  v_source_counts jsonb;
  v_unpriced integer;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  -- Component-level required scope count: each live item contributes one scope per
  -- expected component (NULL expected_components = one BUNDLE scope).
  select coalesce(sum(coalesce(array_length(qi.expected_components, 1), 1)), 0)::int into v_required
    from public.qms_quotation_item_identities qi
    join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
   where qi.quotation_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false;

  select * into v_version
    from public.qms_quote_cost_versions
    where quotation_id = p_quotation_id
    order by (case when status = 'draft' then 0 else 1 end), revision desc
    limit 1;

  if v_version.id is null then
    return jsonb_build_object(
      'quotationId', p_quotation_id,
      'costVersionId', null,
      'costRevision', 0,
      'versionRevision', 0,
      'status', null,
      'layers', '[]'::jsonb,
      'totalLow', null,
      'totalBase', null,
      'totalHigh', null,
      'requiredScopes', v_required,
      'coveredScopes', 0,
      'coverage', null,
      'completeness', null,
      'pricedScopes', 0,
      'unpricedScopes', 0,
      'sourceCounts', '{}'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_layers
  from (
    select l.cost_layer,
           coalesce(sum(l.low_amount), 0)  as low,
           coalesce(sum(l.base_amount), 0) as base,
           coalesce(sum(l.high_amount), 0) as high,
           count(*) filter (where l.base_amount is null) as unpriced_lines
      from public.qms_quote_cost_lines l
      join public.qms_cost_coverages c on c.cost_line_id = l.id
     where l.cost_version_id = v_version.id
       and c.is_active
       and l.is_chargeable
       and c.requirement_scope_key in (
         select qi.id::text
           from public.qms_quotation_item_identities qi
           join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
          where qi.quotation_id = p_quotation_id
            and coalesce(qsi.abandon, false) = false
       )
     group by l.cost_layer
  ) t;

  select coalesce(sum(l.low_amount), 0), coalesce(sum(l.base_amount), 0), coalesce(sum(l.high_amount), 0)
    into v_total_low, v_total_base, v_total_high
    from public.qms_quote_cost_lines l
    join public.qms_cost_coverages c on c.cost_line_id = l.id
   where l.cost_version_id = v_version.id
     and c.is_active
     and l.is_chargeable
     and c.requirement_scope_key in (
       select qi.id::text
         from public.qms_quotation_item_identities qi
         join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
        where qi.quotation_id = p_quotation_id
          and coalesce(qsi.abandon, false) = false
     );

  -- Covered: active coverage pairs (scope_key, component) that sit inside the
  -- item's expected component set.
  select count(*)::int into v_covered
  from (
    select distinct c.requirement_scope_key, c.component_type
      from public.qms_cost_coverages c
      join public.qms_quotation_item_identities qi on qi.id::text = c.requirement_scope_key
      join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
     where c.cost_version_id = v_version.id
       and c.is_active
       and qi.quotation_id = p_quotation_id
       and coalesce(qsi.abandon, false) = false
       and c.component_type = any (coalesce(qi.expected_components, array['BUNDLE']))
  ) cov;

  -- Priced: (scope_key, component) pairs whose every chargeable line has a value.
  select count(*)::int into v_priced
  from (
    select c.requirement_scope_key, c.component_type
      from public.qms_cost_coverages c
      join public.qms_quote_cost_lines l on l.id = c.cost_line_id
      join public.qms_quotation_item_identities qi on qi.id::text = c.requirement_scope_key
      join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
     where c.cost_version_id = v_version.id
       and c.is_active
       and l.is_chargeable
       and qi.quotation_id = p_quotation_id
       and coalesce(qsi.abandon, false) = false
     group by c.requirement_scope_key, c.component_type
    having count(*) filter (where l.base_amount is null) = 0
  ) p;

  select count(distinct (c.requirement_scope_key, c.component_type))::int into v_unpriced
    from public.qms_cost_coverages c
    join public.qms_quote_cost_lines l on l.id = c.cost_line_id
    join public.qms_quotation_item_identities qi on qi.id::text = c.requirement_scope_key
    join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
   where c.cost_version_id = v_version.id
     and c.is_active
     and l.is_chargeable
     and l.base_amount is null
     and qi.quotation_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false;

  select coalesce(jsonb_object_agg(cost_source_type, cnt), '{}'::jsonb) into v_source_counts
  from (
    select l.cost_source_type, count(*)::int as cnt
      from public.qms_quote_cost_lines l
      join public.qms_cost_coverages c on c.cost_line_id = l.id
     where l.cost_version_id = v_version.id
       and c.is_active
       and c.requirement_scope_key in (
         select qi.id::text
           from public.qms_quotation_item_identities qi
           join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
          where qi.quotation_id = p_quotation_id
            and coalesce(qsi.abandon, false) = false
       )
     group by l.cost_source_type
  ) s;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'costVersionId', v_version.id,
    'costRevision', coalesce(v_version.mutation_revision, 0),
    'versionRevision', v_version.revision,
    'status', v_version.status,
    'layers', v_layers,
    'totalLow', case when v_required = 0 or v_priced < v_required then null else v_total_low end,
    'totalBase', case when v_required = 0 or v_priced < v_required then null else v_total_base end,
    'totalHigh', case when v_required = 0 or v_priced < v_required then null else v_total_high end,
    'requiredScopes', v_required,
    'coveredScopes', v_covered,
    'coverage', case when v_required = 0 then null else round(v_covered::numeric / v_required, 4) end,
    'completeness', case when v_required = 0 then null else round(v_priced::numeric / v_required, 4) end,
    'pricedScopes', v_priced,
    'unpricedScopes', v_unpriced,
    'sourceCounts', v_source_counts
  );
end;
$$;


ALTER FUNCTION public.qms_quote_cost_overview(p_quotation_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION qms_quote_cost_overview(p_quotation_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_quote_cost_overview(p_quotation_id uuid) IS 'Read-only internal cost overview: latest (draft-preferred) cost version, per-layer and total low/base/high, component-level required/covered scopes, new `coverage` (covered/required) for health and cost reliability, `completeness` kept as the priced ratio that gates GP ranges, and pricedScopes/unpricedScopes. Amounts are withheld (null) whenever pricedScopes < requiredScopes. Abandoned items and retired identities never count.';


--
-- Name: qms_quote_detail(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_quote_detail(p_quotation_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_quote jsonb;
  v_result json;
begin
  select to_jsonb(q)
    into v_quote
    from public.quotations q
   where q.id = p_quotation_id;

  if v_quote is null then
    return null;
  end if;

  select json_build_object(
    'quote', v_quote,
    'project_types', coalesce((
      select json_agg(json_build_object('id', t.id, 'name', t.name))
        from public.nos_quote_project_types t
    ), '[]'::json),
    'contract_types', coalesce((
      select json_agg(json_build_object(
               'id', c.id,
               'bubble_id', c.bubble_id,
               'chinese_display', c.chinese_display,
               'display', c.display))
        from public.nos_contracts c
    ), '[]'::json),
    'issuing_company', (
      select json_build_object('bank_notes', cc.bank_notes)
        from public.cost_centres cc
       where cc.id = (v_quote ->> 'cost_centre_id')::uuid
    ),
    'sections', coalesce((
      select json_agg(s.obj order by s.ord nulls last)
        from (
          select json_build_object(
                   'id', x.id,
                   'quotation_id', x.quotation_id,
                   'r_section_id', x.r_section_id,
                   'name', x.name,
                   'order', x."order") as obj,
                 x."order" as ord
            from public.quotation_sections x
           where x.quotation_id = p_quotation_id
        ) s
    ), '[]'::json),
    'items', coalesce((
      select json_agg(i.obj order by i.ord nulls last)
        from (
          select json_build_object(
                   'id', x.id,
                   'quote_id', x.quote_id,
                   'section_id', x.section_id,
                   'item_id', x.item_id,
                   'item', x.item,
                   'description', x.description,
                   'quantity', x.quantity,
                   'unit', x.unit,
                   'cost', x.cost,
                   'unit_price', x.unit_price,
                   'opt', x.opt,
                   'order_number', x.order_number,
                   'abandon', x.abandon,
                   'sub_total_price', x.sub_total_price) as obj,
                 x.order_number as ord
            from public.quotation_section_items x
           where x.quote_id = p_quotation_id
        ) i
    ), '[]'::json),
    'term_sections', coalesce((
      select json_agg(t.obj order by t.ord nulls last)
        from (
          select json_build_object(
                   'id', x.id,
                   'quote_id', x.quote_id,
                   'head_name', x.head_name,
                   'order', x."order") as obj,
                 x."order" as ord
            from public.q_term_sections x
           where x.quote_id = p_quotation_id
        ) t
    ), '[]'::json),
    'term_details', coalesce((
      select json_agg(t.obj order by t.ord nulls last)
        from (
          select json_build_object(
                   'id', x.id,
                   'quote_id', x.quote_id,
                   'term_section', x.term_section,
                   'term_head_id', x.term_head_id,
                   'number', x.number,
                   'description', x.description,
                   'total', x.total,
                   'order', x."order",
                   'star', x.star) as obj,
                 x."order" as ord
            from public.q_term_section_details x
           where x.quote_id = p_quotation_id
        ) t
    ), '[]'::json),
    'section_prices', coalesce((
      select json_agg(json_build_object(
               'section_id', x.section_id,
               'special_price', x.special_price))
        from public.qms_quotation_section_prices x
       where x.quotation_id = p_quotation_id
    ), '[]'::json),
    'section_ordinals', coalesce((
      select json_agg(json_build_object(
               'section_id', x.section_id,
               'ordinal', x.ordinal))
        from public.qms_quotation_section_ordinals x
       where x.quotation_id = p_quotation_id
    ), '[]'::json),
    'catalog_sections', coalesce((
      select json_agg(json_build_object(
               'id', x.id,
               'chinese_name', x.chinese_name,
               'english_name', x.english_name))
        from public.nos_sections x
    ), '[]'::json),
    'catalog_items', coalesce((
      select json_agg(json_build_object(
               'id', x.id,
               'chinese_name', x.chinese_name,
               'english_name', x.english_name,
               'remark', x.remark))
        from public.nos_items x
       where x.id in (
         select distinct si.item_id
           from public.quotation_section_items si
          where si.quote_id = p_quotation_id
            and si.item_id is not null
       )
    ), '[]'::json),
    'industry', (
      select json_build_object(
               'industry_id', x.industry_id,
               'industry_name', x.industry_name)
        from public.qms_quotation_industries x
       where x.quotation_id = p_quotation_id
       limit 1
    ),
    'remarks', (
      select json_build_object('remarks', x.remarks)
        from public.qms_quotation_remarks x
       where x.quotation_id = p_quotation_id
       limit 1
    ),
    'site_conditions', (
      select json_build_object('data', x.data)
        from public.qms_quotation_site_conditions x
       where x.quotation_id = p_quotation_id
       limit 1
    ),
    'linked_imports', coalesce((
      select json_agg(l.obj order by l.updated_at desc nulls last, l.created_at desc nulls last)
        from (
          select json_build_object(
                   'id', x.id,
                   'reviewed_result', x.reviewed_result,
                   'extracted_result', x.extracted_result) as obj,
                 x.updated_at,
                 x.created_at
            from public.qms_historical_quote_imports x
           where x.linked_quotation_id = p_quotation_id
           order by x.updated_at desc nulls last, x.created_at desc nulls last
           limit 8
        ) l
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION public.qms_quote_detail(p_quotation_id uuid) OWNER TO postgres;

--
-- Name: qms_quote_evaluations_immutable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_quote_evaluations_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  raise exception 'quote_evaluations_are_append_only' using errcode = '27000';
end;
$$;


ALTER FUNCTION public.qms_quote_evaluations_immutable() OWNER TO postgres;

--
-- Name: qms_reject_box_access_log_mutation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_reject_box_access_log_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  raise exception 'qms_box_access_log is append-only';
end;
$$;


ALTER FUNCTION public.qms_reject_box_access_log_mutation() OWNER TO postgres;

--
-- Name: qms_save_page_permissions(integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_save_page_permissions(p_revision integer, p_entries jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  current_row public.qms_page_permission_settings;
  entry jsonb;
begin
  if public.qms_permission_actor_role() is distinct from 'super_admin' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 170 then
    raise exception 'invalid_entries' using errcode = '22023';
  end if;
  for entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(entry) <> 'object'
      or not (entry ?& array['page','role','view','manage'])
      or (entry - array['page','role','view','manage']) <> '{}'::jsonb
      or jsonb_typeof(entry->'view') <> 'boolean'
      or jsonb_typeof(entry->'manage') <> 'boolean'
      or jsonb_typeof(entry->'page') <> 'string'
      or jsonb_typeof(entry->'role') <> 'string'
      or entry->>'role' not in ('user','senior_user','admin','super_admin')
      or entry->>'page' not in ('/dashboard','/dashboard/tasks','/customers','/office/quotes','/office/quotes/import','/office','/office/create','/office/scenarios','/office/ai-analysis','/office/scenario-centre','/engineering/quote-types','/engineering/templates','/engineering/sections','/engineering/items','/engineering/units','/engineering/item-descriptions','/engineering/term-templates','/engineering/site-conditions','/engineering/exclusions','/engineering/section-descriptions','/tenders/create','/tenders/active','/tenders/confirmed','/tenders/history','/suppliers','/suppliers/quote-import','/suppliers/cost-review','/reports/hit-rate','/reports/project-managers','/settings/users','/settings/page-permissions','/settings/project-types','/settings/companies','/settings/brand-documents','/settings/notifications','/settings/audit','/office/quotes/:quoteId','/office/quotes/:quoteId/revisions/:revisionId','/office/quotes/:quoteId/edit','/office/quotes/import/:importId')
      or ((entry->>'manage')::boolean and not (entry->>'view')::boolean)
      or (entry->>'page' = '/settings/page-permissions' and entry->>'role' <> 'super_admin' and (entry->>'manage')::boolean)
    then raise exception 'invalid_entries' using errcode = '22023'; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_entries) e group by e->>'page', e->>'role' having count(*) > 1) then
    raise exception 'duplicate_entries' using errcode = '22023';
  end if;
  select * into current_row from public.qms_page_permission_settings where id = 1 for update;
  if p_revision is null or current_row.revision <> p_revision then
    raise exception 'permissions_conflict' using errcode = '40001';
  end if;
  insert into public.qms_page_permission_audit(revision,actor,previous_entries,entries)
    values(current_row.revision + 1, auth.uid(), current_row.entries, p_entries);
  update public.qms_page_permission_settings set entries=p_entries,
    revision=revision+1, updated_at=now(), updated_by=auth.uid() where id=1
    returning * into current_row;
  return jsonb_build_object('revision',current_row.revision,'entries',current_row.entries,'updated_at',current_row.updated_at);
end;
$$;


ALTER FUNCTION public.qms_save_page_permissions(p_revision integer, p_entries jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_save_page_permissions(p_revision integer, p_entries jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_save_page_permissions(p_revision integer, p_entries jsonb) IS 'Super Admin only. Validates page catalog including engineering exclusion options.';


--
-- Name: qms_save_quotation(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_version integer;
  v_next integer;
  v_identity_map jsonb;
  v_industry_name text;
  v_remarks text;
  v_site jsonb;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'invalid_snapshot' using errcode = '22023';
  end if;

  select version_number into v_version
    from public.quotations where id = p_quotation_id for update;
  if v_version is null then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;
  if p_expected_version is null or v_version <> p_expected_version then
    raise exception 'quote_revision_conflict' using errcode = '40001';
  end if;
  v_next := v_version + 1;

  -- Capture the old-item -> identity assignment BEFORE the delete-rebuild cycle,
  -- because the identity FK is ON DELETE SET NULL.
  select coalesce(jsonb_object_agg(qi.current_quotation_section_item_id::text, qi.id::text), '{}'::jsonb)
    into v_identity_map
    from public.qms_quotation_item_identities qi
   where qi.quotation_id = p_quotation_id
     and qi.current_quotation_section_item_id is not null;

  insert into public.qms_quotation_revisions (
    quotation_id, archived_version_number, snapshot, created_by, created_at
  ) values (
    p_quotation_id, v_version, p_snapshot, auth.uid(), now()
  );

  update public.quotations set
    project = p_header->>'project',
    name = p_header->>'name',
    quo_head = p_header->>'quo_head',
    work_address = p_header->>'work_address',
    size = p_header->>'size',
    contact_person = p_header->>'contact_person',
    contact_tel = p_header->>'contact_tel',
    email = p_header->>'email',
    company_address = p_header->>'company_address',
    project_manager = p_header->>'project_manager',
    pm_tel = p_header->>'pm_tel',
    date = nullif(p_header->>'date', '')::timestamptz,
    remark_under_section = p_header->>'remark_under_section',
    project_type_id = nullif(p_header->>'project_type_id', '')::uuid,
    project_type = p_header->>'project_type',
    discount_percent = nullif(p_header->>'discount_percent', '')::numeric,
    fixed_discount = nullif(p_header->>'fixed_discount', '')::numeric,
    discount_method = p_header->>'discount_method',
    version_number = v_next,
    modified_date = now()
  where id = p_quotation_id;

  -- Rebuild children in one transaction (set-based). Deleting the sections cascades to
  -- qms_quotation_section_prices / qms_quotation_section_ordinals, re-inserted below.
  delete from public.quotation_section_items where quote_id = p_quotation_id;
  delete from public.quotation_sections where quotation_id = p_quotation_id;
  delete from public.q_term_section_details where quote_id = p_quotation_id;
  delete from public.q_term_sections where quote_id = p_quotation_id;

  create temp table pg_temp.tmp_sections (sec_order integer, name text) on commit drop;
  create temp table pg_temp.tmp_section_ids (sec_order integer primary key, section_id uuid) on commit drop;
  create temp table pg_temp.tmp_section_prices (sec_order integer primary key, special_price numeric) on commit drop;
  create temp table pg_temp.tmp_section_ordinals (sec_order integer primary key, ordinal text) on commit drop;
  create temp table pg_temp.tmp_item_keys (sec_order integer, item_order integer, client_key text) on commit drop;
  create temp table pg_temp.tmp_new_items (section_id uuid, order_number integer, new_item_id uuid) on commit drop;
  create temp table pg_temp.tmp_terms (
    term_order integer, kind text, title text, content text, number text, rows jsonb
  ) on commit drop;
  create temp table pg_temp.tmp_term_ids (term_order integer primary key, term_id uuid) on commit drop;

  insert into pg_temp.tmp_sections (sec_order, name)
  select s.ord::integer,
         coalesce(nullif(trim(s.sec->>'name'), ''), 'Section ' || s.ord::text)
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as s(sec, ord);

  insert into pg_temp.tmp_section_prices (sec_order, special_price)
  select s.ord::integer, nullif(s.sec->>'specialPrice', '')::numeric
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as s(sec, ord)
   where nullif(s.sec->>'specialPrice', '') is not null;

  insert into pg_temp.tmp_section_ordinals (sec_order, ordinal)
  select s.ord::integer, nullif(trim(s.sec->>'ordinal'), '')
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as s(sec, ord)
   where nullif(trim(s.sec->>'ordinal'), '') is not null;

  insert into pg_temp.tmp_item_keys (sec_order, item_order, client_key)
  select s.ord::integer, i.ord::integer, nullif(i.item->>'clientKey', '')
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as s(sec, ord)
    cross join lateral jsonb_array_elements(coalesce(s.sec->'items', '[]'::jsonb)) with ordinality as i(item, ord);

  insert into pg_temp.tmp_terms (term_order, kind, title, content, number, rows)
  select t.ord::integer,
         coalesce(nullif(t.term->>'kind', ''), 'term'),
         coalesce(nullif(trim(t.term->>'title'), ''), '條款 ' || t.ord::text),
         nullif(t.term->>'content', ''),
         coalesce(t.term->>'number', ''),
         coalesce(t.term->'rows', '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_terms, '[]'::jsonb)) with ordinality as t(term, ord);

  with ins as (
    insert into public.quotation_sections (quotation_id, name, "order", created_date, modified_date)
    select p_quotation_id, s.name, s.sec_order, now(), now()
      from pg_temp.tmp_sections s
    returning id, "order"
  )
  insert into pg_temp.tmp_section_ids (sec_order, section_id)
  select "order", id from ins;

  insert into public.qms_quotation_section_prices (
    section_id, quotation_id, special_price, updated_by, updated_at
  )
  select si.section_id, p_quotation_id, sp.special_price, auth.uid(), now()
    from pg_temp.tmp_section_prices sp
    join pg_temp.tmp_section_ids si on si.sec_order = sp.sec_order;

  insert into public.qms_quotation_section_ordinals (
    section_id, quotation_id, ordinal, updated_by, updated_at
  )
  select si.section_id, p_quotation_id, so.ordinal, auth.uid(), now()
    from pg_temp.tmp_section_ordinals so
    join pg_temp.tmp_section_ids si on si.sec_order = so.sec_order;

  with ins as (
    insert into public.quotation_section_items (
      quote_id, section_id, item, description, quantity, unit,
      cost, sub_total_cost, unit_price, sub_total_price,
      opt, abandon, order_number, item_id, c_unit_id, created_date, modified_date
    )
    select
      p_quotation_id,
      si.section_id,
      nullif(trim(i.item->>'name'), ''),
      nullif(trim(i.item->>'description'), ''),
      coalesce((i.item->>'quantity')::numeric, 0),
      coalesce(nullif(trim(i.item->>'unit'), ''), '項'),
      nullif(i.item->>'cost', '')::numeric,
      case
        when nullif(i.item->>'cost', '') is null
          or coalesce((i.item->>'quantity')::numeric, 0) = 0
        then null
        else nullif(i.item->>'cost', '')::numeric * (i.item->>'quantity')::numeric
      end,
      nullif(i.item->>'unitPrice', '')::numeric,
      case
        when nullif(i.item->>'unitPrice', '') is null then null
        else nullif(i.item->>'unitPrice', '')::numeric * coalesce((i.item->>'quantity')::numeric, 0)
      end,
      coalesce((i.item->>'optional')::boolean, false),
      false,
      i.ord::integer,
      nullif(i.item->>'catalogItemId', '')::uuid,
      nullif(i.item->>'unitId', '')::uuid,
      now(), now()
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as s(sec, ord)
    cross join lateral jsonb_array_elements(coalesce(s.sec->'items', '[]'::jsonb)) with ordinality as i(item, ord)
    join pg_temp.tmp_section_ids si on si.sec_order = s.ord::integer
    returning id, section_id, order_number
  )
  insert into pg_temp.tmp_new_items (section_id, order_number, new_item_id)
  select section_id, order_number, id from ins;

  -- Remap stable identities to the rebuilt item rows; create identities for items
  -- that predate identity tracking so their bindings are not orphaned.
  update public.qms_quotation_item_identities qi
     set current_quotation_section_item_id = m.new_item_id
    from (
      select k.client_key, n.new_item_id
        from pg_temp.tmp_item_keys k
        join pg_temp.tmp_section_ids si on si.sec_order = k.sec_order
        join pg_temp.tmp_new_items n on n.section_id = si.section_id and n.order_number = k.item_order
       where k.client_key is not null
    ) m
   where qi.quotation_id = p_quotation_id
     and v_identity_map ? m.client_key
     and qi.id = (v_identity_map->>m.client_key)::uuid;

  insert into public.qms_quotation_item_identities (
    quotation_id, current_quotation_section_item_id, created_at
  )
  select p_quotation_id, m.new_item_id, now()
    from (
      select k.client_key, n.new_item_id
        from pg_temp.tmp_item_keys k
        join pg_temp.tmp_section_ids si on si.sec_order = k.sec_order
        join pg_temp.tmp_new_items n on n.section_id = si.section_id and n.order_number = k.item_order
       where k.client_key is not null
    ) m
   where not (v_identity_map ? m.client_key)
  on conflict (current_quotation_section_item_id) do nothing;

  with ins as (
    insert into public.q_term_sections (quote_id, head_name, "order", created_date, modified_date)
    select p_quotation_id, t.title, t.term_order, now(), now()
      from pg_temp.tmp_terms t
    returning id, "order"
  )
  insert into pg_temp.tmp_term_ids (term_order, term_id)
  select "order", id from ins;

  insert into public.q_term_section_details (
    quote_id, term_head_id, description, number, "order", created_date, modified_date
  )
  select p_quotation_id, ti.term_id, t.content, t.number, 1, now(), now()
    from pg_temp.tmp_terms t
    join pg_temp.tmp_term_ids ti on ti.term_order = t.term_order
   where t.kind <> 'payment'
     and t.content is not null;

  insert into public.q_term_section_details (
    quote_id, term_head_id, description, total, number, "order", created_date, modified_date
  )
  select p_quotation_id, ti.term_id,
         nullif(trim(r.row->>'description'), ''),
         nullif(r.row->>'total', ''),
         '', r.ord::integer, now(), now()
    from pg_temp.tmp_terms t
    join pg_temp.tmp_term_ids ti on ti.term_order = t.term_order
    cross join lateral jsonb_array_elements(coalesce(t.rows, '[]'::jsonb)) with ordinality as r(row, ord)
   where t.kind = 'payment'
     and (nullif(trim(r.row->>'description'), '') is not null or nullif(r.row->>'total', '') is not null);

  v_industry_name := nullif(trim(p_industry->>'name'), '');
  if v_industry_name is not null then
    insert into public.qms_quotation_industries (
      quotation_id, industry_id, industry_name, updated_by, updated_at
    ) values (
      p_quotation_id, nullif(p_industry->>'id', ''), v_industry_name, auth.uid(), now()
    )
    on conflict (quotation_id) do update set
      industry_id = excluded.industry_id,
      industry_name = excluded.industry_name,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;

  v_remarks := nullif(trim(p_header->>'works_remarks'), '');
  if v_remarks is not null then
    insert into public.qms_quotation_remarks (
      quotation_id, remarks, updated_by, updated_at
    ) values (
      p_quotation_id, v_remarks, auth.uid(), now()
    )
    on conflict (quotation_id) do update set
      remarks = excluded.remarks,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  else
    delete from public.qms_quotation_remarks where quotation_id = p_quotation_id;
  end if;

  v_site := p_header->'site_conditions';
  if v_site is not null and jsonb_typeof(v_site) = 'object' then
    insert into public.qms_quotation_site_conditions (
      quotation_id, data, updated_by, updated_at
    ) values (
      p_quotation_id, v_site, auth.uid(), now()
    )
    on conflict (quotation_id) do update set
      data = excluded.data,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  else
    delete from public.qms_quotation_site_conditions where quotation_id = p_quotation_id;
  end if;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionNumber', v_next,
    'archivedVersionNumber', v_version
  );
end;
$$;


ALTER FUNCTION public.qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb) IS 'Atomically saves a formal quotation revision: append-only snapshot, mutable header update, set-based rebuild of sections/items/terms, QMS-owned section 優惠價, ordinal, works remarks and 工地情況 snapshot, stable item identity remap and version bump in one transaction. Called with the user JWT; verifies the actor via qms_permission_actor_role().';


--
-- Name: qms_save_quote_evaluation(uuid, integer, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  -- Deliberately no quote lookup, data write or privileged execution. Forged
  -- approved flags, rule versions and sources cannot enable this entry point.
  raise exception 'quote_evaluation_not_enabled' using errcode = '55000';
end;
$$;


ALTER FUNCTION public.qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb) OWNER TO postgres;

--
-- Name: FUNCTION qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb) IS 'Disabled legacy client-result API. Re-enable only through a reviewed server evaluator with caller quote authorization, approved rules, immutable input/source revisions and conflict checks. Existing rows are legacy unverified audit data.';


--
-- Name: qms_supplier_detail(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_supplier_detail(p_supplier_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_result json;
begin
  with exp as (
    select e.*
      from public.expenses e
     where e.supplier_id = p_supplier_id
  )
  select json_build_object(
    'supplier', (
      select json_build_object(
        'id', s.id,
        'name', s.name,
        'chinese_name', s.chinese_name,
        'display_name', s.display_name,
        'status', s.status,
        'account_status', s.account_status,
        'email', s.email,
        'phone', s.phone,
        'fax_no', s.fax_no,
        'address', s.address,
        'district', s.district,
        'website', s.website,
        'establish_year', s.establish_year,
        'contact_persons', s.contact_persons,
        'professional_skill', s.professional_skill,
        'remark', s.remark,
        'supplier_tags', s.supplier_tags,
        'real_level', s.real_level,
        'admin_level', s.admin_level,
        'level_pass_out_day', s.level_pass_out_day,
        'join_date', s.join_date,
        'created_date', s.created_date,
        'modified_date', s.modified_date,
        'created_by', s.created_by,
        'disable_comments', s.disable_comments,
        'n_type', s.n_type,
        'project_number', s.project_number,
        'paid', s.paid,
        'outstanding', s.outstanding,
        'past12_count', s.past12_count,
        'past_6_project', s.past_6_project,
        'contact1', json_build_object(
          'name', nullif(trim(concat_ws(' ', s.contact1_eng_givenname, s.contact1_eng_surname)), ''),
          'chn_name', nullif(trim(concat_ws('', s.contact1_chn_surname, s.contact1_chn_given_name)), ''),
          'job_title', nullif(trim(coalesce(s.contact1_job_title, '')), ''),
          'phone', nullif(trim(coalesce(s.contact1_phone, '')), '')
        ),
        'contact2', json_build_object(
          'name', nullif(trim(concat_ws(' ', s.contact2_eng_givenname, s.contact2_eng_surname)), ''),
          'chn_name', nullif(trim(concat_ws('', s.contact2_chn_surname, s.contact2_chn_given_name)), ''),
          'job_title', nullif(trim(coalesce(s.contact2_job_title, '')), ''),
          'phone', nullif(trim(coalesce(s.contact2_phone, '')), '')
        )
      )
        from public.suppliers s
       where s.id = p_supplier_id
    ),
    'types', coalesce((
      select json_agg(coalesce(nullif(trim(st.display), ''), nullif(trim(st.chinese_display), '')) order by st."order" asc)
        from public.supplier_supplier_types sst
        join public.supplier_types st on st.id = sst.supplier_type_id
       where sst.supplier_id = p_supplier_id
    ), '[]'::json),
    'tag_names', coalesce((
      select json_agg(nst.tag_name order by nst.tag_name)
        from public.supplier_supplier_tags sst
        join public.nos_supplier_tags nst on nst.id = sst.supplier_tag_id
       where sst.supplier_id = p_supplier_id
    ), '[]'::json),
    'recent_statuses', coalesce((
      select json_agg(json_build_object(
               'text', rs.text,
               'created_date', rs.created_date
             ) order by rs.created_date desc nulls last)
        from (
          select srs.text, srs.created_date
            from public.supplier_recent_statuses srs
           where srs.supplier_id = p_supplier_id
           order by srs.created_date desc nulls last
           limit 10
        ) rs
    ), '[]'::json),
    'financial', json_build_object(
      'total', (select json_build_object(
                  'amount', sum(x.installment_amount),
                  'paid', sum(x.paid_amount),
                  'outstanding', sum(x.outstanding),
                  'projects', count(distinct coalesce(x.project_id::text, x.bwf_project_id::text)),
                  'projects12m', count(distinct case when coalesce(x.modified_date, x.created_date) >= now() - interval '12 months'
                                                then coalesce(x.project_id::text, x.bwf_project_id::text) end),
                  'projects6m', count(distinct case when coalesce(x.modified_date, x.created_date) >= now() - interval '6 months'
                                               then coalesce(x.project_id::text, x.bwf_project_id::text) end)
                ) from exp x),
      'bwa', (select json_build_object(
                  'amount', sum(x.installment_amount),
                  'paid', sum(x.paid_amount),
                  'outstanding', sum(x.outstanding),
                  'projects', count(distinct coalesce(x.project_id::text, x.bwf_project_id::text)),
                  'projects12m', count(distinct case when coalesce(x.modified_date, x.created_date) >= now() - interval '12 months'
                                                then coalesce(x.project_id::text, x.bwf_project_id::text) end),
                  'projects6m', count(distinct case when coalesce(x.modified_date, x.created_date) >= now() - interval '6 months'
                                               then coalesce(x.project_id::text, x.bwf_project_id::text) end)
                ) from exp x where x.project_id is not null),
      'bwf', (select json_build_object(
                  'amount', sum(x.installment_amount),
                  'paid', sum(x.paid_amount),
                  'outstanding', sum(x.outstanding),
                  'projects', count(distinct coalesce(x.project_id::text, x.bwf_project_id::text)),
                  'projects12m', count(distinct case when coalesce(x.modified_date, x.created_date) >= now() - interval '12 months'
                                                then coalesce(x.project_id::text, x.bwf_project_id::text) end),
                  'projects6m', count(distinct case when coalesce(x.modified_date, x.created_date) >= now() - interval '6 months'
                                               then coalesce(x.project_id::text, x.bwf_project_id::text) end)
                ) from exp x where x.bwf_project_id is not null)
    )
  ) into v_result;

  -- Supplier not found (or hidden by RLS): the 'supplier' key above is NULL.
  if v_result is null or v_result -> 'supplier' is null then
    return null;
  end if;
  return v_result;
end;
$$;


ALTER FUNCTION public.qms_supplier_detail(p_supplier_id uuid) OWNER TO postgres;

--
-- Name: qms_supplier_list(text, text, text, text[], integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_supplier_list(p_search text DEFAULT ''::text, p_status text DEFAULT 'all'::text, p_level text DEFAULT 'all'::text, p_tags text[] DEFAULT '{}'::text[], p_page integer DEFAULT 1, p_page_size integer DEFAULT 15) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_offset integer := greatest(p_page - 1, 0) * greatest(p_page_size, 1);
  v_limit integer := greatest(p_page_size, 1);
  v_search text := coalesce(nullif(trim(p_search), ''), '');
  v_tags text[] := coalesce(p_tags, '{}');
  v_result json;
begin
  with base as (
    select s.*
      from public.suppliers s
     where (v_search = ''
            or s.name ilike '%' || v_search || '%'
            or s.chinese_name ilike '%' || v_search || '%'
            or s.display_name ilike '%' || v_search || '%'
            or s.email ilike '%' || v_search || '%'
            or s.phone ilike '%' || v_search || '%'
            or s.contact_persons ilike '%' || v_search || '%'
            or s.supplier_tags ilike '%' || v_search || '%'
            or s.professional_skill ilike '%' || v_search || '%')
       and (p_status = 'all' or s.status = p_status)
       and (p_level = 'all' or s.real_level = p_level)
  ),
  filtered as (
    select b.*
      from base b
     where cardinality(v_tags) = 0
        or (
          select count(distinct nst.tag_name)
            from public.supplier_supplier_tags sst
            join public.nos_supplier_tags nst on nst.id = sst.supplier_tag_id
           where sst.supplier_id = b.id
             and nst.tag_name = any(v_tags)
        ) = cardinality(v_tags)
  ),
  tag_counts as (
    select nst.tag_name as tag_name, count(*)::int as supplier_count
      from public.supplier_supplier_tags sst
      join public.nos_supplier_tags nst on nst.id = sst.supplier_tag_id
      join base b on b.id = sst.supplier_id
     group by nst.tag_name
  )
  select json_build_object(
    'all_count', (select count(*) from base),
    'count', (select count(*) from filtered),
    'rows', coalesce((
      select json_agg(row_to_json(t) order by t.qms_status_rank asc, t.display_name asc nulls last, t.id asc)
        from (
          select f.id,
                 f.name,
                 f.chinese_name,
                 f.display_name,
                 f.status,
                 f.account_status,
                 f.email,
                 f.phone,
                 f.address,
                 f.district,
                 f.website,
                 f.contact_persons,
                 f.supplier_tags,
                 f.professional_skill,
                 f.remark,
                 f.created_date,
                 f.modified_date,
                 f.real_level,
                 f.admin_level,
                 f.level_modified_date,
                 f.level_pass_out_day,
                 f.join_date,
                 f.disable_comments,
                 f.past12_count,
                 f.project_number,
                 f.paid,
                 f.expense,
                 f.outstanding,
                 f.n_type,
                 case
                   when lower(coalesce(f.status, '')) = 'blacklist' then 2
                   when lower(coalesce(f.status, '')) = 'inactive' then 1
                   else 0
                 end as qms_status_rank,
                 (
                   select coalesce(json_agg(nst2.tag_name order by nst2.tag_name), '[]'::json)
                     from public.supplier_supplier_tags sst2
                     join public.nos_supplier_tags nst2 on nst2.id = sst2.supplier_tag_id
                    where sst2.supplier_id = f.id
                 ) as tag_names
            from filtered f
           order by
             case
               when lower(coalesce(f.status, '')) = 'blacklist' then 2
               when lower(coalesce(f.status, '')) = 'inactive' then 1
               else 0
             end asc,
             f.display_name asc nulls last,
             f.id asc
           limit v_limit
           offset v_offset
        ) t
    ), '[]'::json),
    'tag_counts', coalesce((
      select json_agg(json_build_object('tag_name', tc.tag_name, 'count', tc.supplier_count) order by tc.supplier_count desc, tc.tag_name asc)
        from tag_counts tc
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;


ALTER FUNCTION public.qms_supplier_list(p_search text, p_status text, p_level text, p_tags text[], p_page integer, p_page_size integer) OWNER TO postgres;

--
-- Name: qms_supplier_quote_imports_flatten_alias(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_supplier_quote_imports_flatten_alias() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_master uuid;
begin
  if new.duplicate_of_import_id is not null then
    -- Point at the master, never at another alias (collapse A->B->C to A->C).
    select coalesce(i.duplicate_of_import_id, i.id) into v_master
      from public.qms_supplier_quote_imports i
     where i.id = new.duplicate_of_import_id;

    if v_master is null then
      raise exception 'alias_target_not_found' using errcode = 'foreign_key_violation';
    end if;
    if v_master = new.id then
      raise exception 'alias_self_reference' using errcode = 'check_violation';
    end if;

    -- An import that already owns revisions cannot become an alias.
    if exists (select 1 from public.qms_supplier_quote_revisions r where r.import_id = new.id) then
      raise exception 'alias_revision_forbidden' using errcode = 'check_violation';
    end if;

    new.duplicate_of_import_id := v_master;
  end if;
  return new;
end
$$;


ALTER FUNCTION public.qms_supplier_quote_imports_flatten_alias() OWNER TO postgres;

--
-- Name: qms_supplier_quote_revisions_forbid_alias(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_supplier_quote_revisions_forbid_alias() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if exists (
    select 1 from public.qms_supplier_quote_imports i
     where i.id = new.import_id and i.duplicate_of_import_id is not null
  ) then
    raise exception 'alias_revision_forbidden' using errcode = 'check_violation';
  end if;
  return new;
end
$$;


ALTER FUNCTION public.qms_supplier_quote_revisions_forbid_alias() OWNER TO postgres;

--
-- Name: qms_sync_quote_cost_from_bindings(uuid, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text;
  v_quote_version integer;
  v_previous public.qms_quote_cost_versions;
  v_version public.qms_quote_cost_versions;
  v_row record;
  v_existing record;
  v_new_line_id uuid;
  v_synced integer := 0;
  v_base numeric;
  v_free text;
  v_scope_count integer;
  v_required integer;
begin
  v_role := public.qms_permission_actor_role();
  if v_role is null then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select version_number into v_quote_version
    from public.quotations where id = p_quotation_id for update;
  if v_quote_version is null then
    raise exception 'quote_not_found' using errcode = 'P0002';
  end if;

  insert into public.qms_quotation_item_identities (
    quotation_id, current_quotation_section_item_id, catalog_item_id
  )
  select p_quotation_id, qsi.id, qsi.item_id
    from public.quotation_section_items qsi
   where qsi.quote_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false
     and not exists (
       select 1 from public.qms_quotation_item_identities qi
        where qi.current_quotation_section_item_id = qsi.id
     )
  on conflict (current_quotation_section_item_id) do nothing;

  create temp table if not exists pg_temp.tmp_binding_sync (
    scope_key uuid,
    component_type text,
    amount numeric,
    quantity numeric,
    unit_id uuid,
    supplier_item_id uuid,
    supplier_revision_id uuid,
    normalized_unit_price numeric,
    currency_code text,
    row_count integer,
    free_count integer,
    unpriced_count integer
  ) on commit drop;
  truncate pg_temp.tmp_binding_sync;

  -- Only awarded allocations project into cost. When the binding has no scope
  -- (legacy row) the document link role is used (fallback). A binding whose scope
  -- has a non-awarded role for this revision is excluded even if the link is awarded.
  insert into pg_temp.tmp_binding_sync
  select b.quote_item_identity_id,
         coalesce(b.component_type, sc.component_type, si.component_type, 'BUNDLE'),
         sum(b.allocated_cost_amount),
         sum(b.applied_quantity),
         (array_agg(b.applied_unit_id) filter (where b.applied_unit_id is not null))[1],
         (array_agg(si.id order by b.created_at, b.id))[1],
         (array_agg(si.supplier_quote_revision_id order by b.created_at, b.id))[1],
         (array_agg(si.normalized_unit_cost order by b.created_at, b.id))[1],
         (array_agg(sr.currency_code order by b.created_at, b.id))[1],
         count(*)::int,
         count(*) filter (where coalesce(b.adopted_pricing_status, si.pricing_status) = 'free')::int,
         count(*) filter (
           where coalesce(b.adopted_pricing_status, si.pricing_status) <> 'free'
             and coalesce(b.allocated_cost_amount, 0) = 0
         )::int
    from public.qms_quotation_item_cost_bindings b
    join public.qms_quotation_supplier_links l on l.id = b.quotation_supplier_link_id
    join public.qms_supplier_quote_items si on si.id = b.supplier_quote_item_id
    join public.qms_supplier_quote_revisions sr on sr.id = si.supplier_quote_revision_id
    left join public.qms_quote_cost_scopes sc on sc.id = b.cost_scope_id
    left join public.qms_quote_cost_scope_sources ss
      on ss.scope_id = b.cost_scope_id
     and ss.supplier_quote_revision_id = si.supplier_quote_revision_id
     and ss.status = 'confirmed'
   where l.quotation_id = p_quotation_id
     and l.status = 'confirmed'
     and b.status = 'confirmed'
     and b.quote_item_identity_id is not null
     and coalesce(ss.source_role, l.source_role) = 'awarded_cost'
     and exists (
       select 1
         from public.qms_quotation_item_identities qi
         join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
        where qi.id = b.quote_item_identity_id
          and coalesce(qsi.abandon, false) = false
     )
   group by b.quote_item_identity_id, coalesce(b.component_type, sc.component_type, si.component_type, 'BUNDLE');

  select count(*) into v_scope_count from pg_temp.tmp_binding_sync;
  if v_scope_count = 0 then
    return jsonb_build_object(
      'quotationId', p_quotation_id,
      'costVersionId', null,
      'costRevision', coalesce(p_expected_cost_revision, 0),
      'syncedScopes', 0,
      'requiredScopes', 0
    );
  end if;

  select * into v_previous
    from public.qms_quote_cost_versions
    where quotation_id = p_quotation_id
    order by revision desc
    limit 1
    for update;

  if v_previous.id is null then
    if coalesce(p_expected_cost_revision, 0) <> 0 then
      raise exception 'quote_cost_revision_conflict' using errcode = '40001';
    end if;
    insert into public.qms_quote_cost_versions (
      quotation_id, customer_quote_version_number, revision, mutation_revision, status, version_token, created_by
    ) values (
      p_quotation_id, v_quote_version, 1, 0, 'draft', 'draft', auth.uid()
    ) returning * into v_version;
  elsif v_previous.status = 'draft' then
    if p_expected_cost_revision is not null and coalesce(v_previous.mutation_revision, 0) <> p_expected_cost_revision then
      raise exception 'quote_cost_revision_conflict' using errcode = '40001';
    end if;
    v_version := v_previous;
  else
    if p_expected_cost_revision is not null and coalesce(v_previous.mutation_revision, 0) <> p_expected_cost_revision then
      raise exception 'quote_cost_revision_conflict' using errcode = '40001';
    end if;
    insert into public.qms_quote_cost_versions (
      quotation_id, customer_quote_version_number, revision, mutation_revision, status, version_token, created_by
    ) values (
      p_quotation_id, v_quote_version, v_previous.revision + 1, coalesce(v_previous.mutation_revision, 0), 'draft', 'draft', auth.uid()
    ) returning * into v_version;

    for v_existing in
      select c.requirement_scope_key,
             c.component_type as coverage_component_type,
             l.id as line_id,
             l.cost_layer, l.component_type, l.cost_source_type,
             l.quantity, l.unit_id, l.loss_rule,
             l.low_amount, l.base_amount, l.high_amount,
             l.is_chargeable, l.free_reason, l.manual_description, l.manual_note
        from public.qms_cost_coverages c
        join public.qms_quote_cost_lines l on l.id = c.cost_line_id
       where c.cost_version_id = v_previous.id
         and c.is_active
    loop
      insert into public.qms_quote_cost_lines (
        cost_version_id, cost_layer, component_type, cost_source_type,
        quantity, unit_id, loss_rule, low_amount, base_amount, high_amount,
        is_chargeable, free_reason, included_by_line_id, manual_description, manual_note, created_by
      ) values (
        v_version.id, v_existing.cost_layer, v_existing.component_type, v_existing.cost_source_type,
        v_existing.quantity, v_existing.unit_id, v_existing.loss_rule, v_existing.low_amount, v_existing.base_amount, v_existing.high_amount,
        v_existing.is_chargeable, v_existing.free_reason, null, v_existing.manual_description, v_existing.manual_note, auth.uid()
      ) returning id into v_new_line_id;

      insert into public.qms_cost_coverages (
        cost_version_id, cost_line_id, requirement_scope_key, component_type, is_active, created_by
      ) values (
        v_version.id, v_new_line_id, v_existing.requirement_scope_key, v_existing.coverage_component_type, true, auth.uid()
      );

      insert into public.qms_cost_source_snapshots (
        cost_line_id, source_type, supplier_quote_revision_id, supplier_quote_item_id, estimate_run_id,
        original_unit_id, original_unit_price, original_unit_text, normalized_unit_id, normalized_unit_price,
        currency_code, scope_signature, override_reason, selected_by
      )
      select v_new_line_id, source_type, supplier_quote_revision_id, supplier_quote_item_id, estimate_run_id,
             original_unit_id, original_unit_price, original_unit_text, normalized_unit_id, normalized_unit_price,
             currency_code, scope_signature, override_reason, selected_by
        from public.qms_cost_source_snapshots
       where cost_line_id = v_existing.line_id;
    end loop;
  end if;

  update public.qms_cost_coverages c
     set is_active = false
    from public.qms_quote_cost_lines l
   where c.cost_line_id = l.id
     and c.cost_version_id = v_version.id
     and c.is_active
     and l.manual_note = '[binding-sync]';

  for v_row in select * from pg_temp.tmp_binding_sync loop
    -- Per-row pricing: free only when every contributing line is free; a priced
    -- line mixed with a free line still sums its money.
    if v_row.row_count > 0 and v_row.free_count = v_row.row_count then
      v_base := 0;
      v_free := '已包括（供應商綁定）';
    elsif v_row.unpriced_count > 0 or v_row.amount is null then
      v_base := null;
      v_free := null;
    else
      v_base := round(v_row.amount, 2);
      v_free := null;
    end if;

    update public.qms_cost_coverages
       set is_active = false
     where cost_version_id = v_version.id
       and requirement_scope_key = v_row.scope_key::text
       and component_type = v_row.component_type
       and is_active;

    insert into public.qms_quote_cost_lines (
      cost_version_id, cost_layer, component_type, cost_source_type,
      quantity, unit_id, low_amount, base_amount, high_amount,
      is_chargeable, free_reason, manual_note, created_by
    ) values (
      v_version.id, 'MAIN', v_row.component_type,
      case when v_base is null then 'UNPRICED' else 'SUPPLIER_SELECTED' end,
      v_row.quantity, v_row.unit_id, v_base, v_base, v_base,
      true, v_free, '[binding-sync]', auth.uid()
    ) returning id into v_new_line_id;

    insert into public.qms_cost_coverages (
      cost_version_id, cost_line_id, requirement_scope_key, component_type, is_active, created_by
    ) values (
      v_version.id, v_new_line_id, v_row.scope_key::text, v_row.component_type, true, auth.uid()
    );

    insert into public.qms_cost_source_snapshots (
      cost_line_id, source_type, supplier_quote_revision_id, supplier_quote_item_id,
      normalized_unit_id, normalized_unit_price, currency_code, scope_signature, selected_by
    ) values (
      v_new_line_id,
      case when v_base is null then 'UNPRICED' else 'SUPPLIER_SELECTED' end,
      v_row.supplier_revision_id, v_row.supplier_item_id,
      v_row.unit_id, v_row.normalized_unit_price, coalesce(v_row.currency_code, 'HKD'), '[binding-sync]', auth.uid()
    );

    v_synced := v_synced + 1;
  end loop;

  update public.qms_quote_cost_versions
     set updated_at = timezone('utc', now()),
         mutation_revision = coalesce(mutation_revision, 0) + 1
   where id = v_version.id
   returning mutation_revision into v_version.mutation_revision;

  -- Component-level required count: sum of each live item's expected component set
  -- (NULL expected_components counts as one BUNDLE component).
  select coalesce(sum(coalesce(array_length(qi.expected_components, 1), 1)), 0)::int into v_required
    from public.qms_quotation_item_identities qi
    join public.quotation_section_items qsi on qsi.id = qi.current_quotation_section_item_id
   where qi.quotation_id = p_quotation_id
     and coalesce(qsi.abandon, false) = false;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'costVersionId', v_version.id,
    'costRevision', coalesce(v_version.mutation_revision, 0),
    'syncedScopes', v_synced,
    'requiredScopes', v_required,
    'status', v_version.status
  );
end;
$$;


ALTER FUNCTION public.qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer) OWNER TO postgres;

--
-- Name: FUNCTION qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer) IS 'Projects only confirmed AWARDED supplier cost bindings into the QMS internal cost version as SUPPLIER_SELECTED lines (one per item identity + component). Role is read from the competition-group source (scope_source) with a document-link fallback for legacy rows. Component comes from the binding, never the raw source line. Free only when every contributing line is free; a zero/missing allocation is UNPRICED. Currency is the real source revision currency. Forks a new draft when the latest version is published. Writes no PMS column.';


--
-- Name: recalculate_all_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_all_customer_stats() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM customers LOOP
    PERFORM recalculate_customer_stats(r.id);
  END LOOP;
END;
$$;


ALTER FUNCTION public.recalculate_all_customer_stats() OWNER TO postgres;

--
-- Name: recalculate_all_project_bv(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_all_project_bv() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT project_id AS pid
    FROM public.project_bv
    WHERE project_id IS NOT NULL
    UNION
    SELECT DISTINCT bwf_project_id AS pid
    FROM public.project_bv
    WHERE bwf_project_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_project_bv(r.pid);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;


ALTER FUNCTION public.recalculate_all_project_bv() OWNER TO postgres;

--
-- Name: recalculate_customer_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_customer_stats(p_customer_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_bwa_income NUMERIC := 0;
  v_bwa_profit NUMERIC := 0;
  v_bwa_receivable NUMERIC := 0;
  v_bwa_project_number INTEGER := 0;
  v_bwa_pitching_number INTEGER := 0;
  v_bwf_income NUMERIC := 0;
  v_bwf_profit NUMERIC := 0;
  v_bwf_receivable NUMERIC := 0;
  v_bwf_project_number INTEGER := 0;
  v_bwf_pitching_no INTEGER := 0;
  v_status_filter_value TEXT := 'Enquiry';
  v_bwa_expense_total NUMERIC := 0;
  v_bwf_expense_total NUMERIC := 0;
  v_project_count INTEGER := 0;
  v_has_active_project BOOLEAN := FALSE;
  v_has_pitching_stage BOOLEAN := FALSE;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_bwa_project_number
  FROM bwa_projects
  WHERE customer_id = p_customer_id;

  SELECT COUNT(*)
  INTO v_bwa_pitching_number
  FROM bwa_pitchings
  WHERE customer_id = p_customer_id;

  SELECT COUNT(*)
  INTO v_bwf_project_number
  FROM bwf_projects
  WHERE customer_id = p_customer_id;

  SELECT COUNT(*)
  INTO v_bwf_pitching_no
  FROM bwf_pitchings
  WHERE customer_id = p_customer_id;

  SELECT
    COALESCE(SUM(i.payment_amount), 0),
    COALESCE(SUM(i.income_amount), 0)
  INTO v_bwa_income, v_bwa_receivable
  FROM incomes i
  INNER JOIN bwa_projects bp ON bp.id = i.project_id
  WHERE bp.customer_id = p_customer_id;

  SELECT COALESCE(SUM(e.installment_amount), 0)
  INTO v_bwa_expense_total
  FROM expenses e
  INNER JOIN bwa_projects bp ON bp.id = e.project_id
  WHERE bp.customer_id = p_customer_id;

  v_bwa_profit := v_bwa_receivable - v_bwa_expense_total;

  SELECT
    COALESCE(SUM(i.payment_amount), 0),
    COALESCE(SUM(i.income_amount), 0)
  INTO v_bwf_income, v_bwf_receivable
  FROM incomes i
  INNER JOIN bwf_projects bp ON bp.id = i.bwf_project_id
  WHERE bp.customer_id = p_customer_id;

  SELECT COALESCE(SUM(e.installment_amount), 0)
  INTO v_bwf_expense_total
  FROM expenses e
  INNER JOIN bwf_projects bp ON bp.id = e.bwf_project_id
  WHERE bp.customer_id = p_customer_id;

  v_bwf_profit := v_bwf_receivable - v_bwf_expense_total;

  SELECT
    COUNT(*),
    COALESCE(BOOL_OR(COALESCE(status, '') <> 'Case Closed'), FALSE)
  INTO v_project_count, v_has_active_project
  FROM (
    SELECT status FROM bwa_projects WHERE customer_id = p_customer_id
    UNION ALL
    SELECT status FROM bwf_projects WHERE customer_id = p_customer_id
  ) AS customer_projects;

  SELECT EXISTS(
    SELECT 1 FROM bwa_pitchings
    WHERE customer_id = p_customer_id
      AND pitching_stages = 'Pitching'
  ) OR EXISTS(
    SELECT 1 FROM bwf_pitchings
    WHERE customer_id = p_customer_id
      AND pitching_stages = 'Pitching'
  )
  INTO v_has_pitching_stage;

  IF v_project_count > 0 AND NOT v_has_active_project THEN
    v_status_filter_value := 'Case Closed';
  ELSIF v_has_active_project THEN
    v_status_filter_value := 'Project';
  ELSIF v_has_pitching_stage THEN
    v_status_filter_value := 'Pitching';
  ELSE
    v_status_filter_value := 'Enquiry';
  END IF;

  UPDATE customers
  SET
    bwa_income = v_bwa_income,
    bwa_profit = v_bwa_profit,
    bwa_receivable = v_bwa_receivable,
    bwa_project_number = v_bwa_project_number,
    bwa_pitching_number = v_bwa_pitching_number,
    bwf_income = v_bwf_income,
    bwf_profit = v_bwf_profit,
    bwf_receivable = v_bwf_receivable,
    bwf_project_number = v_bwf_project_number,
    bwf_pitching_no = v_bwf_pitching_no,
    status_filter_value = v_status_filter_value,
    modified_date = NOW()
  WHERE id = p_customer_id;
END;
$$;


ALTER FUNCTION public.recalculate_customer_stats(p_customer_id uuid) OWNER TO postgres;

--
-- Name: recalculate_project_bv(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recalculate_project_bv(p_project_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_is_bwf      boolean;
  v_bv_unit     numeric;
  v_est_profit  numeric;
  v_team        uuid;
  v_fy          uuid;
  v_signed      timestamptz;
  v_handover    timestamptz;
  v_sum_income  numeric;
  v_sum_payment numeric;
  v_sum_paid    numeric;
  v_total_sales numeric;
  v_actual_gp   numeric;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  SELECT value INTO v_bv_unit
  FROM public.nos_bv_values
  ORDER BY created_date ASC
  LIMIT 1;
  IF v_bv_unit IS NULL OR v_bv_unit = 0 THEN
    v_bv_unit := 40000;
  END IF;

  SELECT
    COALESCE(
      p.estimated_profit,
      CASE
        WHEN p.estimated_income IS NOT NULL OR p.estimated_expense IS NOT NULL
        THEN COALESCE(p.estimated_income, 0) - COALESCE(p.estimated_expense, 0)
        ELSE NULL
      END
    ),
    p.n_team_type_id,
    p.n_financial_year_id,
    p.signed_date,
    p.handover_date
  INTO v_est_profit, v_team, v_fy, v_signed, v_handover
  FROM public.bwa_projects p
  WHERE p.id = p_project_id;

  IF FOUND THEN
    v_is_bwf := false;
  ELSE
    SELECT
      COALESCE(
        p.estimated_profit,
        CASE
          WHEN p.estimated_income IS NOT NULL OR p.estimated_expense IS NOT NULL
          THEN COALESCE(p.estimated_income, 0) - COALESCE(p.estimated_expense, 0)
          ELSE NULL
        END
      ),
      p.n_team_type_id,
      p.n_financial_year_id,
      p.signed_date,
      p.handover_date
    INTO v_est_profit, v_team, v_fy, v_signed, v_handover
    FROM public.bwf_projects p
    WHERE p.id = p_project_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;
    v_is_bwf := true;
  END IF;

  IF v_is_bwf THEN
    SELECT coalesce(sum(income_amount), 0), coalesce(sum(payment_amount), 0)
      INTO v_sum_income, v_sum_payment
    FROM public.incomes
    WHERE bwf_project_id = p_project_id;

    SELECT coalesce(sum(paid_amount), 0)
      INTO v_sum_paid
    FROM public.expenses
    WHERE bwf_project_id = p_project_id;
  ELSE
    SELECT coalesce(sum(income_amount), 0), coalesce(sum(payment_amount), 0)
      INTO v_sum_income, v_sum_payment
    FROM public.incomes
    WHERE project_id = p_project_id;

    SELECT coalesce(sum(paid_amount), 0)
      INTO v_sum_paid
    FROM public.expenses
    WHERE project_id = p_project_id;
  END IF;

  v_total_sales := v_sum_income;
  v_actual_gp   := v_sum_payment - v_sum_paid;

  UPDATE public.project_bv bv
  SET
    estimated_gp        = v_est_profit,
    shared_estimated_gp = round(coalesce(v_est_profit, 0) * coalesce(bv.ratio, 0) / 100.0, 2),
    total_sales         = v_total_sales,
    actual_gp           = v_actual_gp,
    shared_actual_gp    = round(v_actual_gp * coalesce(bv.ratio, 0) / 100.0, 2),
    estimated_bv        = round((coalesce(v_est_profit, 0) * coalesce(bv.ratio, 0) / 100.0) / v_bv_unit, 2),
    actual_bv           = round((v_actual_gp           * coalesce(bv.ratio, 0) / 100.0) / v_bv_unit, 2),
    n_team_type_id      = v_team,
    n_financial_year_id = v_fy,
    signed_date         = v_signed,
    handover_date       = v_handover,
    modified_date       = now()
  WHERE (v_is_bwf AND bv.bwf_project_id = p_project_id)
     OR (NOT v_is_bwf AND bv.project_id = p_project_id);
END;
$$;


ALTER FUNCTION public.recalculate_project_bv(p_project_id uuid) OWNER TO postgres;

--
-- Name: staff_id_from_auth(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.staff_id_from_auth() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    u.member_id,
    (
      SELECT s.id
      FROM staff s
      WHERE lower(s.email) = lower(u.email)
        AND s.status = 'Active'
      LIMIT 1
    )
  )
  FROM users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION public.staff_id_from_auth() OWNER TO postgres;

--
-- Name: sync_bwa_project_os_schedule_group_from_pitching(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_bwa_project_os_schedule_group_from_pitching() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.n_service_type_id IS DISTINCT FROM NEW.n_service_type_id)
     OR (OLD.estimated_income IS DISTINCT FROM NEW.estimated_income) THEN
    UPDATE public.bwa_projects
    SET os_schedule_group = public.compute_bwa_os_schedule_group(
      NEW.n_service_type_id,
      NEW.estimated_income
    )
    WHERE pitching_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_bwa_project_os_schedule_group_from_pitching() OWNER TO postgres;

--
-- Name: trg_log_expected_payment_date(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_log_expected_payment_date() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old date;
  v_new date;
  v_staff uuid;
  v_hint uuid;
  v_incoming jsonb;
  v_history jsonb;
BEGIN
  v_old := (OLD.expected_payment_date AT TIME ZONE 'Asia/Hong_Kong')::date;
  v_new := (NEW.expected_payment_date AT TIME ZONE 'Asia/Hong_Kong')::date;
  v_incoming := NEW.expected_payment_date_log;
  v_history := COALESCE(OLD.expected_payment_date_log, '[]'::jsonb);
  IF jsonb_typeof(v_history) <> 'array' THEN
    v_history := '[]'::jsonb;
  END IF;

  -- Always keep existing history (ignore client overwrite / wipe).
  NEW.expected_payment_date_log := v_history;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN NEW;
  END IF;

  v_hint := NULL;
  IF jsonb_typeof(v_incoming) = 'array' THEN
    IF jsonb_array_length(v_incoming) = 1
       AND (v_incoming->0) ? 'staff_id'
       AND NOT ((v_incoming->0) ? 'previous_date')
    THEN
      BEGIN
        v_hint := (v_incoming->0->>'staff_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_hint := NULL;
      END;
    ELSIF jsonb_array_length(v_incoming) = jsonb_array_length(v_history) + 1 THEN
      BEGIN
        v_hint := (v_incoming->-1->>'staff_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_hint := NULL;
      END;
    END IF;
  END IF;

  IF v_hint IS NOT NULL AND NOT EXISTS (SELECT 1 FROM staff WHERE id = v_hint) THEN
    v_hint := NULL;
  END IF;

  v_staff := COALESCE(v_hint, public.staff_id_from_auth());

  NEW.expected_payment_date_log := v_history || jsonb_build_array(
    jsonb_build_object(
      'previous_date',
        CASE WHEN v_old IS NULL THEN NULL ELSE to_char(v_old, 'YYYY-MM-DD') END,
      'staff_id', v_staff,
      'changed_at',
        to_char(timezone('Asia/Hong_Kong', now()), 'YYYY-MM-DD"T"HH24:MI:SS+08:00')
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_log_expected_payment_date() OWNER TO postgres;

--
-- Name: trg_recalc_project_bv_from_child(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_recalc_project_bv_from_child() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.project_id IS NOT NULL THEN PERFORM public.recalculate_project_bv(NEW.project_id); END IF;
    IF NEW.bwf_project_id IS NOT NULL THEN PERFORM public.recalculate_project_bv(NEW.bwf_project_id); END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.project_id IS NOT NULL THEN PERFORM public.recalculate_project_bv(OLD.project_id); END IF;
    IF OLD.bwf_project_id IS NOT NULL THEN PERFORM public.recalculate_project_bv(OLD.bwf_project_id); END IF;
    RETURN OLD;
  ELSE
    IF NEW.project_id IS NOT NULL THEN PERFORM public.recalculate_project_bv(NEW.project_id); END IF;
    IF NEW.bwf_project_id IS NOT NULL THEN PERFORM public.recalculate_project_bv(NEW.bwf_project_id); END IF;
    IF OLD.project_id IS NOT NULL AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.recalculate_project_bv(OLD.project_id);
    END IF;
    IF OLD.bwf_project_id IS NOT NULL AND OLD.bwf_project_id IS DISTINCT FROM NEW.bwf_project_id THEN
      PERFORM public.recalculate_project_bv(OLD.bwf_project_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION public.trg_recalc_project_bv_from_child() OWNER TO postgres;

--
-- Name: trg_recalc_project_bv_from_project(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_recalc_project_bv_from_project() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalculate_project_bv(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public.recalculate_project_bv(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_recalc_project_bv_from_project() OWNER TO postgres;

--
-- Name: trg_recalc_project_bv_on_ratio(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_recalc_project_bv_on_ratio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.project_id IS NOT NULL THEN
    PERFORM public.recalculate_project_bv(NEW.project_id);
  END IF;
  IF NEW.bwf_project_id IS NOT NULL THEN
    PERFORM public.recalculate_project_bv(NEW.bwf_project_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_recalc_project_bv_on_ratio() OWNER TO postgres;

--
-- Name: trg_recalc_project_bv_self(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_recalc_project_bv_self() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  r record;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  FOR r IN
    SELECT DISTINCT project_id AS pid
    FROM new_rows
    WHERE project_id IS NOT NULL
    UNION
    SELECT DISTINCT bwf_project_id AS pid
    FROM new_rows
    WHERE bwf_project_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_project_bv(r.pid);
  END LOOP;
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.trg_recalc_project_bv_self() OWNER TO postgres;

--
-- Name: trigger_bwa_pitching_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_bwa_pitching_customer_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: recalculate if customer changed or stage changed
  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id OR OLD.pitching_stages IS DISTINCT FROM NEW.pitching_stages THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id = OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_bwa_pitching_customer_stats() OWNER TO postgres;

--
-- Name: trigger_bwa_project_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_bwa_project_customer_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id OR OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id = OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_bwa_project_customer_stats() OWNER TO postgres;

--
-- Name: trigger_bwf_pitching_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_bwf_pitching_customer_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: recalculate if customer changed or stage changed
  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id OR OLD.pitching_stages IS DISTINCT FROM NEW.pitching_stages THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id = OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_bwf_pitching_customer_stats() OWNER TO postgres;

--
-- Name: trigger_bwf_project_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_bwf_project_customer_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id OR OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM recalculate_customer_stats(OLD.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
    IF NEW.customer_id IS NOT NULL AND NEW.customer_id = OLD.customer_id THEN
      PERFORM recalculate_customer_stats(NEW.customer_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_bwf_project_customer_stats() OWNER TO postgres;

--
-- Name: trigger_expense_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_expense_customer_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = OLD.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    IF OLD.bwf_project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = OLD.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = NEW.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    IF NEW.bwf_project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = NEW.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.project_id IS DISTINCT FROM NEW.project_id
    OR OLD.bwf_project_id IS DISTINCT FROM NEW.bwf_project_id
    OR OLD.installment_amount IS DISTINCT FROM NEW.installment_amount THEN

    IF OLD.project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = OLD.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    IF OLD.bwf_project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = OLD.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    IF NEW.project_id IS NOT NULL AND (NEW.project_id IS DISTINCT FROM OLD.project_id OR OLD.installment_amount IS DISTINCT FROM NEW.installment_amount) THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = NEW.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    IF NEW.bwf_project_id IS NOT NULL AND (NEW.bwf_project_id IS DISTINCT FROM OLD.bwf_project_id OR OLD.installment_amount IS DISTINCT FROM NEW.installment_amount) THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = NEW.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_expense_customer_stats() OWNER TO postgres;

--
-- Name: trigger_income_customer_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_income_customer_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Try BWA project
    IF OLD.project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = OLD.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    -- Try BWF project
    IF OLD.bwf_project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = OLD.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = NEW.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    IF NEW.bwf_project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = NEW.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: recalculate for both old and new project links if changed
  IF OLD.project_id IS DISTINCT FROM NEW.project_id
    OR OLD.bwf_project_id IS DISTINCT FROM NEW.bwf_project_id
    OR OLD.income_amount IS DISTINCT FROM NEW.income_amount
    OR OLD.payment_amount IS DISTINCT FROM NEW.payment_amount THEN

    -- Old BWA
    IF OLD.project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = OLD.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    -- Old BWF
    IF OLD.bwf_project_id IS NOT NULL THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = OLD.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    -- New BWA (if different from old)
    IF NEW.project_id IS NOT NULL AND (NEW.project_id IS DISTINCT FROM OLD.project_id OR OLD.income_amount IS DISTINCT FROM NEW.income_amount OR OLD.payment_amount IS DISTINCT FROM NEW.payment_amount) THEN
      SELECT customer_id INTO v_customer_id FROM bwa_projects WHERE id = NEW.project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
    -- New BWF (if different from old)
    IF NEW.bwf_project_id IS NOT NULL AND (NEW.bwf_project_id IS DISTINCT FROM OLD.bwf_project_id OR OLD.income_amount IS DISTINCT FROM NEW.income_amount OR OLD.payment_amount IS DISTINCT FROM NEW.payment_amount) THEN
      SELECT customer_id INTO v_customer_id FROM bwf_projects WHERE id = NEW.bwf_project_id;
      IF v_customer_id IS NOT NULL THEN
        PERFORM recalculate_customer_stats(v_customer_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_income_customer_stats() OWNER TO postgres;

--
-- Name: update_bwf_product_master_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_bwf_product_master_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_bwf_product_master_updated_at() OWNER TO postgres;

--
-- Name: update_notifications_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_notifications_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_notifications_updated_at() OWNER TO postgres;

--
-- Name: ai_prompt_by_project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_prompt_by_project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    project_type text,
    prompt text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.ai_prompt_by_project_types OWNER TO postgres;

--
-- Name: ai_quote_demo_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_quote_demo_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    amount numeric(12,2),
    item_description text,
    item_name text,
    price numeric(12,2),
    quantity numeric(10,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.ai_quote_demo_items OWNER TO postgres;

--
-- Name: ai_quote_sub_item_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_quote_sub_item_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    ai_quote text,
    ai_quote_sub_item text,
    amount numeric(12,2),
    description text,
    item_index text,
    quantity numeric(10,2),
    unit_price numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    ai_quote_id uuid,
    ai_quote_sub_item_id uuid
);


ALTER TABLE public.ai_quote_sub_item_details OWNER TO postgres;

--
-- Name: ai_quote_sub_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_quote_sub_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    ai_quote text,
    amount numeric(12,2),
    checked boolean,
    item_content text,
    item_description text,
    item_index text,
    item_name text,
    o_item_type text,
    price numeric(12,2),
    quantity numeric(10,2),
    quantity_text text,
    unit text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    ai_quote_id uuid
);


ALTER TABLE public.ai_quote_sub_items OWNER TO postgres;

--
-- Name: ai_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    ai_logic text,
    additional_information text,
    bank_information text,
    block_ai_until timestamp with time zone,
    c_address text,
    c_client_name text,
    c_company_name text,
    c_email text,
    c_industry text,
    c_phone text,
    c_purpose text,
    c_unique_product_service text,
    c_website_function text,
    development_schedule text,
    discount_amount_monthly numeric(12,2),
    discount_amount_one_time numeric(12,2),
    discount_description_monthly text,
    discount_description_one_time text,
    discount_type text,
    effective_date timestamp with time zone,
    enable_discount_monthly boolean,
    enable_discount_one_time boolean,
    excluded text,
    issue_date timestamp with time zone,
    item_index text,
    methodology_1 text,
    methodology_2 text,
    montly_amount numeric(12,2),
    n_cost_center text,
    negative_prompt text,
    note text,
    pm_name text,
    pm_phone text,
    project_name text,
    project_type text,
    quote_code text,
    selected_item_types text,
    service_type text,
    t_and_c text,
    total_amount numeric(12,2),
    site_location text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.ai_quotes OWNER TO postgres;

--
-- Name: ap_report_remarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ap_report_remarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_project text,
    project text,
    remark text,
    supplier text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    project_id uuid,
    bwf_project_id uuid,
    supplier_id uuid
);


ALTER TABLE public.ap_report_remarks OWNER TO postgres;

--
-- Name: asana_oauth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asana_oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    user_id uuid,
    asana_user_gid text,
    asana_user_name text,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asana_oauth_tokens OWNER TO postgres;

--
-- Name: TABLE asana_oauth_tokens; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.asana_oauth_tokens IS 'Asana OAuth tokens per PMS auth user. Read/write only via service role.';


--
-- Name: blocked_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    blocked_bu text,
    blocked_member text,
    blocked_position text,
    blocked_role text,
    blocked_team text,
    view text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    blocked_member_id uuid,
    blocked_bu_id uuid,
    blocked_team_id uuid
);


ALTER TABLE public.blocked_views OWNER TO postgres;

--
-- Name: building_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.building_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_project text,
    building text,
    comment text,
    evaluator text,
    pitching text,
    point numeric(10,2),
    project text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bwf_project_id uuid,
    building_id uuid,
    evaluator_id uuid,
    pitching_id uuid,
    project_id uuid,
    created_by_id uuid
);


ALTER TABLE public.building_comments OWNER TO postgres;

--
-- Name: building_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.building_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.building_contacts OWNER TO postgres;

--
-- Name: building_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.building_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    building text,
    file text,
    file_name text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    building_id uuid,
    created_by_id uuid
);


ALTER TABLE public.building_files OWNER TO postgres;

--
-- Name: buildings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buildings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    address text,
    address_eng text,
    building_name text,
    building_name_eng text,
    delivery_note text,
    district text,
    first_contact text,
    guideline text,
    noisy_control text,
    real_creator text,
    remarks text,
    second_contact text,
    third_contact text,
    vetting_approval_time text,
    x_comment text,
    x_display_name text,
    x_night_works text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    district_id uuid,
    created_by_id uuid,
    real_creator_id uuid
);


ALTER TABLE public.buildings OWNER TO postgres;

--
-- Name: bwa_pitching_project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwa_pitching_project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pitching_id text,
    project_type_id text
);


ALTER TABLE public.bwa_pitching_project_types OWNER TO postgres;

--
-- Name: bwa_pitching_service_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwa_pitching_service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pitching_id text,
    service_type_id text
);


ALTER TABLE public.bwa_pitching_service_types OWNER TO postgres;

--
-- Name: bwa_pitchings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwa_pitchings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    actual_size text,
    asana_link text,
    b2b_b2c text,
    closed_reason text,
    customer text,
    description text,
    district text,
    enquiry_date timestamp with time zone,
    estimated_expense numeric(12,2),
    estimated_income numeric(12,2),
    height_to_bs text,
    height_to_fc text,
    height_to_tc text,
    main_designer text,
    main_pm text,
    more_pm text,
    n_financial_year text,
    n_project_types text,
    n_service_type text,
    n_team_type text,
    os_money_size text,
    pitching_code text,
    pitching_stages text,
    r_building text,
    real_building_name text,
    real_creator_member_name text,
    real_customer_co_name text,
    real_customer_display_name text,
    real_district_name text,
    send_email boolean,
    site_address text,
    site_photos text,
    size text,
    working_folder text,
    other_pm text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    customer_id uuid,
    district_id uuid,
    main_designer_id uuid,
    main_pm_id uuid,
    more_pm_id uuid,
    n_financial_year_id uuid,
    n_service_type_id uuid,
    n_team_type_id uuid,
    r_building_id uuid,
    other_pm_id uuid,
    created_by_id uuid,
    quote_project_type_id uuid
);


ALTER TABLE public.bwa_pitchings OWNER TO postgres;

--
-- Name: bwa_project_project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwa_project_project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text,
    project_type_id text
);


ALTER TABLE public.bwa_project_project_types OWNER TO postgres;

--
-- Name: bwa_project_service_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwa_project_service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text,
    service_type_id text
);


ALTER TABLE public.bwa_project_service_types OWNER TO postgres;

--
-- Name: bwa_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwa_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    asana_link text,
    b2b_b2c text,
    cost_centre text,
    customer text,
    description text,
    e_outstanding_date timestamp with time zone,
    enquiry_date timestamp with time zone,
    estimated_expense numeric(12,2),
    estimated_income numeric(12,2),
    estimated_profit numeric(12,2),
    external_customer_name text,
    external_project_name text,
    fixed_search text,
    handover_date timestamp with time zone,
    main_air_supplier text,
    main_contractor text,
    main_designer text,
    main_divide text,
    main_network_supplier text,
    main_pm text,
    more_pm text,
    n_financial_year text,
    n_pitching_financial_year text,
    n_project_type text,
    n_service_type text,
    n_team_type text,
    os_schedule_group text,
    payment_status text,
    pitching text,
    project_code text,
    project_name text,
    project_size text,
    project_type_search text,
    r_building text,
    real_building_name text,
    real_cost_centre text,
    real_creator_name text,
    real_customer_display_name text,
    real_customer_name text,
    real_district_name text,
    required_check_date timestamp with time zone,
    service_type_search text,
    signed_date timestamp with time zone,
    site_address text,
    size text,
    sort_financial_year text,
    start_date timestamp with time zone,
    status text,
    supplier text,
    working_folder text,
    x_f_form_s1 text,
    x_f_form_s2 text,
    x_f_form_s3 text,
    x_name_district_building_site_search text,
    x_real_other_name text,
    x_visible boolean,
    xf_site_work_insurance text,
    other_pm text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    cost_centre_id uuid,
    customer_id uuid,
    main_air_supplier_id uuid,
    main_contractor_id uuid,
    main_designer_id uuid,
    main_network_supplier_id uuid,
    main_pm_id uuid,
    more_pm_id uuid,
    n_financial_year_id uuid,
    n_service_type_id uuid,
    n_team_type_id uuid,
    pitching_id uuid,
    r_building_id uuid,
    r_nos_district_id uuid,
    supplier_id uuid,
    other_pm_id uuid,
    created_by_id uuid,
    actual_size text,
    height_to_tc text,
    height_to_bs text,
    height_to_fc text,
    quote_project_type_id uuid,
    defect_done_date timestamp with time zone,
    income_below_estimated_reason text
);


ALTER TABLE public.bwa_projects OWNER TO postgres;

--
-- Name: COLUMN bwa_projects.income_below_estimated_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bwa_projects.income_below_estimated_reason IS 'Required explanation when project income total is below estimated_income; once set, must stay non-empty.';


--
-- Name: bwf_major_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_major_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    is_big_project boolean,
    is_pp boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.bwf_major_quotes OWNER TO postgres;

--
-- Name: bwf_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_pitching text,
    bwf_project text,
    complete_installation_date timestamp with time zone,
    complete_installation_date_est timestamp with time zone,
    defect_factory text,
    defect_fixed_date timestamp with time zone,
    defect_member text,
    defect_notes text,
    defect_supplier text,
    deliver_to_factory text,
    factory text,
    installation_team text,
    installer_needed text,
    n_defect_cause text,
    o_defect_source text,
    o_defect_status text,
    o_delivery_target text,
    o_order_status text,
    product text,
    production_finish_date timestamp with time zone,
    production_finish_date_est timestamp with time zone,
    production_start_date timestamp with time zone,
    quantity integer,
    remarks text,
    site_arrival_date timestamp with time zone,
    site_arrival_date_est timestamp with time zone,
    warehouse text,
    warehouse_arrival_date timestamp with time zone,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bwf_pitching_id uuid,
    bwf_project_id uuid,
    factory_id uuid,
    created_by_id uuid,
    product_id uuid,
    defect_factory_id uuid,
    defect_supplier_id uuid,
    defect_member_id uuid,
    n_defect_cause_id uuid,
    installation_team_id uuid,
    deliver_to_factory_id uuid,
    warehouse_id uuid
);


ALTER TABLE public.bwf_orders OWNER TO postgres;

--
-- Name: bwf_pitching_bwf_service_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_pitching_bwf_service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pitching_id text,
    service_type_id text
);


ALTER TABLE public.bwf_pitching_bwf_service_types OWNER TO postgres;

--
-- Name: bwf_pitching_major_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_pitching_major_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pitching_id text,
    major_quote_id text
);


ALTER TABLE public.bwf_pitching_major_quotes OWNER TO postgres;

--
-- Name: bwf_pitching_service_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_pitching_service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pitching_id text,
    service_item_id text
);


ALTER TABLE public.bwf_pitching_service_items OWNER TO postgres;

--
-- Name: bwf_pitchings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_pitchings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    asana_link text,
    case_close_reason text,
    customer text,
    district text,
    enquiry_date timestamp with time zone,
    estimated_expense numeric(12,2),
    estimated_income numeric(12,2),
    main_designer text,
    main_pm text,
    more_pms text,
    n_bwf_service_types text,
    n_customer_type text,
    n_financial_year text,
    n_major_quotes text,
    n_service_items text,
    n_source text,
    n_team_type text,
    os_size text,
    pitching_code text,
    pitching_name text,
    pitching_stages text,
    quote_content text,
    r_building text,
    r_district text,
    real_building_name text,
    real_creator_name text,
    real_customer_display_name text,
    real_customer_name text,
    send_email boolean,
    site_address text,
    size text,
    working_folder text,
    other_pms text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    customer_id uuid,
    district_id uuid,
    main_designer_id uuid,
    main_pm_id uuid,
    more_pms_id uuid,
    n_bwf_service_types_id uuid,
    n_customer_type_id uuid,
    n_financial_year_id uuid,
    n_major_quotes_id uuid,
    n_service_items_id uuid,
    n_source_id uuid,
    n_team_type_id uuid,
    r_building_id uuid,
    r_district_id uuid,
    other_pms_id uuid,
    created_by_id uuid
);


ALTER TABLE public.bwf_pitchings OWNER TO postgres;

--
-- Name: bwf_product_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_product_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    category text,
    factory_name text,
    image_url text,
    description text,
    material text,
    dimension_l_mm numeric,
    dimension_w_mm numeric,
    dimension_h_mm numeric,
    cost_price numeric,
    sale_price numeric,
    shopify_price numeric,
    shopify_compare_at_price numeric,
    delivery_days integer,
    shopify_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    factory_id text,
    production_lead_time integer,
    shipping_days integer,
    shipping_fee numeric,
    remarks text,
    total_lead_time integer,
    color text,
    images jsonb DEFAULT '[]'::jsonb,
    factory_highlight jsonb DEFAULT '[]'::jsonb,
    lifestyle_image_url text,
    delivery_term_id uuid,
    delivery_term_name text
);


ALTER TABLE public.bwf_product_master OWNER TO postgres;

--
-- Name: bwf_product_product_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_product_product_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id text NOT NULL,
    product_type_id text NOT NULL
);


ALTER TABLE public.bwf_product_product_types OWNER TO postgres;

--
-- Name: bwf_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    product_types text,
    temp_quantity integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    product_types_id uuid
);


ALTER TABLE public.bwf_products OWNER TO postgres;

--
-- Name: bwf_project_bwf_service_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_project_bwf_service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text,
    service_type_id text
);


ALTER TABLE public.bwf_project_bwf_service_types OWNER TO postgres;

--
-- Name: bwf_project_factories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_project_factories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text NOT NULL,
    factory_id text NOT NULL
);


ALTER TABLE public.bwf_project_factories OWNER TO postgres;

--
-- Name: bwf_project_major_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_project_major_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text,
    major_quote_id text
);


ALTER TABLE public.bwf_project_major_quotes OWNER TO postgres;

--
-- Name: bwf_project_service_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_project_service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text,
    service_item_id text
);


ALTER TABLE public.bwf_project_service_items OWNER TO postgres;

--
-- Name: bwf_project_suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_project_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text NOT NULL,
    supplier_id uuid NOT NULL
);


ALTER TABLE public.bwf_project_suppliers OWNER TO postgres;

--
-- Name: bwf_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bwf_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    asana_link text,
    bwf_pitching text,
    cost_center text,
    customer text,
    district text,
    e_outstanding_date timestamp with time zone,
    enquiry_date timestamp with time zone,
    estimated_expense numeric(12,2),
    estimated_income numeric(12,2),
    estimated_profit numeric(12,2),
    factories text,
    fixed_search text,
    handover_date timestamp with time zone,
    main_contractor text,
    main_designer text,
    main_divide text,
    main_pm text,
    more_pm text,
    n_bwf_service_types text,
    n_customer_type text,
    n_financial_year text,
    n_major_quotes text,
    n_pitching_financial_year text,
    n_service_items text,
    n_source text,
    n_team_type text,
    name_district_building_site_search text,
    os_project_defect text,
    os_size text,
    p2_code text,
    payment_status text,
    project_approval text,
    project_code text,
    project_content text,
    project_name text,
    project_type_search text,
    r_building text,
    r_district text,
    real_building_name text,
    real_cost_centre text,
    real_creator_name text,
    real_customer_display_name text,
    real_customer_name text,
    real_other_name text,
    required_check_date timestamp with time zone,
    service_type_search text,
    signed_date timestamp with time zone,
    site_address text,
    size text,
    sort_financial_year text,
    start_date timestamp with time zone,
    status text,
    supplier text,
    working_folder text,
    other_pm text,
    visible boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bwf_pitching_id uuid,
    cost_center_id uuid,
    customer_id uuid,
    district_id uuid,
    factories_id uuid,
    main_contractor_id uuid,
    main_designer_id uuid,
    main_pm_id uuid,
    more_pm_id uuid,
    n_bwf_service_types_id uuid,
    n_customer_type_id uuid,
    n_financial_year_id uuid,
    n_major_quotes_id uuid,
    n_service_items_id uuid,
    n_source_id uuid,
    n_team_type_id uuid,
    r_building_id uuid,
    r_district_id uuid,
    supplier_id uuid,
    other_pm_id uuid,
    created_by_id uuid,
    income_below_estimated_reason text,
    completion_photos text
);


ALTER TABLE public.bwf_projects OWNER TO postgres;

--
-- Name: COLUMN bwf_projects.income_below_estimated_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bwf_projects.income_below_estimated_reason IS 'Required explanation when project income total is below estimated_income; once set, must stay non-empty.';


--
-- Name: COLUMN bwf_projects.completion_photos; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bwf_projects.completion_photos IS 'Comma-separated public image URLs for 完工相片 Completion Photos';


--
-- Name: client_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    code text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.client_types OWNER TO postgres;

--
-- Name: cost_centres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cost_centres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bu_code text,
    bank_notes text,
    business_logo text,
    chinese_display text,
    company_chop text,
    display text,
    project_code_initial text,
    status text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    expense_control_enabled boolean DEFAULT true NOT NULL
);


ALTER TABLE public.cost_centres OWNER TO postgres;

--
-- Name: COLUMN cost_centres.expense_control_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cost_centres.expense_control_enabled IS 'When true, BWA projects assigned to this cost centre are subject to Expense Control (出支票受限). When false, expense create/edit is never locked by the checklist.';


--
-- Name: cr_event_detail_staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cr_event_detail_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cr_event_detail_id text,
    staff_id text
);


ALTER TABLE public.cr_event_detail_staff OWNER TO postgres;

--
-- Name: cr_event_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cr_event_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    consignee text,
    consignee_address text,
    consignee_phone text,
    cost_per_item numeric(12,2),
    cust_gift_item text,
    customer text,
    delivery_date timestamp with time zone,
    delivery_method text,
    event text,
    handler text,
    item_quantity integer,
    related_staff text,
    remarks text,
    status text,
    total_cost numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    customer_id uuid,
    created_by_id uuid,
    event_id uuid,
    handler_id uuid,
    cust_gift_item_id uuid,
    delivery_method_id uuid,
    related_staff_id uuid
);


ALTER TABLE public.cr_event_details OWNER TO postgres;

--
-- Name: cr_gift_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cr_gift_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    event_condition text,
    item_cost numeric(12,2),
    item_image text,
    item_name text,
    item_remarks text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.cr_gift_items OWNER TO postgres;

--
-- Name: customer_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    comment text,
    customer text,
    evaluator text,
    pitching text,
    project text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    customer_id uuid,
    evaluator_id uuid,
    pitching_id uuid,
    project_id uuid,
    created_by_id uuid
);


ALTER TABLE public.customer_comments OWNER TO postgres;

--
-- Name: customer_cr_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_cr_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id text,
    cr_event_id text
);


ALTER TABLE public.customer_cr_events OWNER TO postgres;

--
-- Name: customer_document_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    type_key text NOT NULL,
    code_number_required boolean DEFAULT false NOT NULL,
    enable_expiry_date boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    modified_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_document_types OWNER TO postgres;

--
-- Name: customer_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    type_id uuid NOT NULL,
    file_name text,
    file text,
    legacy_file text,
    code_number text,
    expiry_date timestamp with time zone,
    document_date timestamp with time zone,
    remarks text,
    created_by_id uuid,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    modified_date timestamp with time zone DEFAULT now() NOT NULL,
    source_project_document_id uuid,
    migration_status text DEFAULT 'native'::text NOT NULL,
    CONSTRAINT customer_documents_migration_status_check CHECK ((migration_status = ANY (ARRAY['pending_copy'::text, 'copied'::text, 'copy_failed'::text, 'native'::text, 'number_only'::text])))
);


ALTER TABLE public.customer_documents OWNER TO postgres;

--
-- Name: customer_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    cr_event_detail text,
    event_date timestamp with time zone,
    event_name text,
    event_remarks text,
    event_status text,
    event_theme text,
    event_type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    cr_event_detail_id uuid,
    event_theme_id uuid,
    event_type_id uuid
);


ALTER TABLE public.customer_relations OWNER TO postgres;

--
-- Name: customer_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id text,
    tag_id text,
    customer_uuid uuid,
    tag_uuid uuid,
    collection_uuid uuid
);


ALTER TABLE public.customer_tags OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    address text,
    asana text,
    bwa_income numeric(12,2),
    bwa_pitching_number integer,
    bwa_profit numeric(12,2),
    bwa_project_number integer,
    bwa_receivable numeric(12,2),
    bwf_income numeric(12,2),
    bwf_pitching_no integer,
    bwf_profit numeric(12,2),
    bwf_project_number integer,
    bwf_receivable numeric(12,2),
    brand_name_cn text,
    brand_name_en text,
    branding_icon text,
    cr_event text,
    company_name text,
    customer_name text,
    display_name text,
    email text,
    enquiry_create_date timestamp with time zone,
    member_created_by text,
    phone_display text,
    phone_number_a text,
    phone_number_b text,
    real_created_by_name text,
    remark text,
    status_filter_value text DEFAULT 'Enquiry'::text,
    tags text,
    view_system text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    member_created_by_id uuid,
    created_by_id uuid,
    status text DEFAULT 'Active'::text NOT NULL,
    CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Blacklist'::text])))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: daily_task_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_task_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_date date DEFAULT CURRENT_DATE NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    title text NOT NULL,
    description text,
    module text,
    status text DEFAULT 'completed'::text NOT NULL,
    staff_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.daily_task_logs OWNER TO postgres;

--
-- Name: dashboard_sentences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dashboard_sentences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    text text,
    is_bwa boolean,
    is_bwf boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.dashboard_sentences OWNER TO postgres;

--
-- Name: default_quote_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.default_quote_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    default_quote text,
    default_section text,
    "order" integer,
    quantity numeric(10,2),
    r_item text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    default_quote_id uuid,
    default_section_id uuid,
    r_item_id uuid
);


ALTER TABLE public.default_quote_details OWNER TO postgres;

--
-- Name: default_quote_mains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.default_quote_mains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    name text,
    quote_image text,
    quote_type text,
    real_creator text,
    terms_and_conditions text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    real_creator_id uuid
);


ALTER TABLE public.default_quote_mains OWNER TO postgres;

--
-- Name: default_quote_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.default_quote_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    default_quote text,
    "order" integer,
    r_section text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    default_quote_id uuid,
    r_section_id uuid
);


ALTER TABLE public.default_quote_sections OWNER TO postgres;

--
-- Name: design_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.design_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    nos_task_id uuid NOT NULL,
    source text NOT NULL,
    pitching_id uuid NOT NULL,
    project_id uuid,
    job_type text NOT NULL,
    budget_hours numeric NOT NULL,
    due_date date NOT NULL,
    progress_pct numeric DEFAULT 0 NOT NULL,
    design_stage text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_jobs_budget_hours_check CHECK ((budget_hours >= (0)::numeric)),
    CONSTRAINT design_jobs_design_stage_check CHECK ((design_stage = ANY (ARRAY['剛剛開始'::text, '投標進行中'::text, '客人確定'::text, '客人新要求,大改'::text, '少量修改'::text, '差不多完成'::text, '已經完成'::text]))),
    CONSTRAINT design_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['bwa_pitching'::text, 'bwa_project'::text, 'bwf_pitching'::text, 'bwf_project'::text]))),
    CONSTRAINT design_jobs_progress_pct_check CHECK (((progress_pct >= (0)::numeric) AND (progress_pct <= (100)::numeric))),
    CONSTRAINT design_jobs_source_check CHECK ((source = ANY (ARRAY['bwa'::text, 'bwf'::text])))
);


ALTER TABLE public.design_jobs OWNER TO postgres;

--
-- Name: districts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.districts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chinese_display text,
    name text,
    region text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    region_id uuid
);


ALTER TABLE public.districts OWNER TO postgres;

--
-- Name: expense_control_waivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_control_waivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bwa_project_id uuid NOT NULL,
    item_keys text[] NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    applicant_id uuid NOT NULL,
    reviewer_id uuid,
    reviewer_note text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_control_waivers_item_keys_check CHECK ((cardinality(item_keys) > 0)),
    CONSTRAINT expense_control_waivers_reason_check CHECK ((char_length(TRIM(BOTH FROM reason)) > 0)),
    CONSTRAINT expense_control_waivers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])))
);


ALTER TABLE public.expense_control_waivers OWNER TO postgres;

--
-- Name: expense_product_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_product_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id text,
    product_type_id text
);


ALTER TABLE public.expense_product_types OWNER TO postgres;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    approve_creator text,
    approved_date timestamp with time zone,
    bwf_project text,
    cheque_no text,
    converter_input_amount numeric(12,2),
    disappear boolean,
    factory text,
    installment_amount numeric(12,2),
    n_contract_type text,
    n_product_types text,
    n_supplier_type text,
    outstanding numeric(12,2),
    pdf_file text,
    paid_amount numeric(12,2),
    payment_date timestamp with time zone,
    payment_method text,
    payment_status text,
    project text,
    rank_report text,
    real_creator_name text,
    refundable boolean,
    remark_t text,
    required_po boolean,
    supplier text,
    type_display text,
    invoice_number text,
    invoice_hash text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    approve_creator_id uuid,
    bwf_project_id uuid,
    factory_id uuid,
    project_id uuid,
    supplier_id uuid,
    created_by_id uuid,
    n_contract_type_id uuid,
    n_product_types_id uuid,
    n_supplier_type_id uuid,
    payment_method_id uuid,
    supplier_quotation_file text,
    expected_payment_date timestamp with time zone,
    due_date timestamp with time zone,
    expected_payment_date_log jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: COLUMN expenses.expected_payment_date_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.expenses.expected_payment_date_log IS 'Append-only expected_payment_date changes: [{previous_date, staff_id, changed_at}]. Managed by trg_log_expected_payment_date.';


--
-- Name: factories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.factories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    admin_level text,
    amount numeric(12,2),
    asana_link text,
    auto_level text,
    contact_person text,
    delivery_days text,
    delivery_period text,
    display_name text,
    email text,
    factory_code text,
    factory_eng_name text,
    factory_name text,
    join_date timestamp with time zone,
    key_product_categories text,
    location text,
    logo text,
    moq text,
    manufacture_days text,
    outstanding numeric(12,2),
    phone text,
    priority text,
    product_quality text,
    project_number integer,
    real_level text,
    remarks text,
    sort_key_categories text,
    status text,
    wechat text,
    website text,
    working_folder text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.factories OWNER TO postgres;

--
-- Name: factory_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.factory_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    factory text,
    file text,
    file_name text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    factory_id uuid,
    created_by_id uuid
);


ALTER TABLE public.factory_files OWNER TO postgres;

--
-- Name: financial_years; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financial_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    date_range text,
    display text,
    yy_code text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.financial_years OWNER TO postgres;

--
-- Name: income_expiry_reasons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.income_expiry_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    created_date timestamp with time zone DEFAULT now(),
    modified_date timestamp with time zone DEFAULT now()
);


ALTER TABLE public.income_expiry_reasons OWNER TO postgres;

--
-- Name: income_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.income_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    cost_center_bu text,
    discount_amount numeric(12,2),
    discount_description text,
    due_date timestamp with time zone,
    enable_discount boolean,
    income text,
    invoice_date timestamp with time zone,
    invoice_number text,
    main_item_amount numeric(12,2),
    main_item_name text,
    main_item_price numeric(12,2),
    main_item_quantity numeric(10,2),
    note text,
    project_name text,
    receiver_name text,
    system text,
    total_amount numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    income_id uuid,
    created_by_id uuid,
    cost_center_bu_id uuid,
    pdf_branding jsonb
);


ALTER TABLE public.income_invoices OWNER TO postgres;

--
-- Name: COLUMN income_invoices.pdf_branding; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.income_invoices.pdf_branding IS 'Per-document PDF branding: per-slot cost_centre source + snapshot + visibility.';


--
-- Name: incomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    ao_client_follow_up text,
    ao_design_firm_status text,
    ao_issue_date timestamp with time zone,
    ao_quotation_firm_date timestamp with time zone,
    ao_request_date timestamp with time zone,
    ao_work_days integer,
    ao_work_status text,
    approve_creator text,
    approved_date timestamp with time zone,
    bwf_project text,
    bad_debts numeric(12,2),
    due_date timestamp with time zone,
    income_amount numeric(12,2),
    invoice_number text,
    invoice_hash text,
    n_contract_type text,
    outstanding numeric(12,2),
    outstanding_remark text,
    pdf_file text,
    payment_method text,
    payment_status text,
    payment_amount numeric(12,2),
    project text,
    real_creator_name text,
    receive_date timestamp with time zone,
    remark text,
    status text,
    type_display text,
    date_remark text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    approve_creator_id uuid,
    bwf_project_id uuid,
    project_id uuid,
    created_by_id uuid,
    n_contract_type_id uuid,
    payment_method_id uuid,
    crm_status text,
    expected_payment_date timestamp with time zone,
    expiry_reason_id uuid,
    expected_payment_date_log jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.incomes OWNER TO postgres;

--
-- Name: COLUMN incomes.expected_payment_date_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incomes.expected_payment_date_log IS 'Append-only expected_payment_date changes: [{previous_date, staff_id, changed_at}]. Managed by trg_log_expected_payment_date.';


--
-- Name: internal_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.internal_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_pitching text,
    bwf_project text,
    comment text,
    evaluator text,
    pitching text,
    point numeric(10,2),
    project text,
    staff text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bwf_pitching_id uuid,
    bwf_project_id uuid,
    evaluator_id uuid,
    pitching_id uuid,
    project_id uuid,
    staff_id uuid,
    created_by_id uuid,
    rating_design_creativity numeric,
    rating_drawing_accuracy numeric,
    rating_professional_briefing numeric,
    rating_client_relation numeric,
    rating_document_logic numeric,
    rating_supplier_relation numeric
);


ALTER TABLE public.internal_comments OWNER TO postgres;

--
-- Name: COLUMN internal_comments.point; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.point IS '整體評分 (1-5)';


--
-- Name: COLUMN internal_comments.rating_design_creativity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.rating_design_creativity IS '設計創意 (1-5)';


--
-- Name: COLUMN internal_comments.rating_drawing_accuracy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.rating_drawing_accuracy IS '圖紙精準 (1-5)';


--
-- Name: COLUMN internal_comments.rating_professional_briefing; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.rating_professional_briefing IS '專業說明 (1-5)';


--
-- Name: COLUMN internal_comments.rating_client_relation; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.rating_client_relation IS '客戶關係 (1-5)';


--
-- Name: COLUMN internal_comments.rating_document_logic; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.rating_document_logic IS '文件邏輯 (1-5)';


--
-- Name: COLUMN internal_comments.rating_supplier_relation; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.internal_comments.rating_supplier_relation IS '供應相關係 (1-5)';


--
-- Name: invoice_sub_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_sub_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    amount numeric(12,2),
    invoice text,
    item_name text,
    price numeric(12,2),
    quantity numeric(10,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    invoice_id uuid
);


ALTER TABLE public.invoice_sub_items OWNER TO postgres;

--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    email text,
    ip text,
    password text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.login_logs OWNER TO postgres;

--
-- Name: man_hour_pinned; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.man_hour_pinned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    pin_type text NOT NULL,
    project_id uuid,
    project_name text,
    task_name text,
    task_bubble_id text,
    sorting integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT man_hour_pinned_pin_type_check CHECK ((pin_type = ANY (ARRAY['task'::text, 'bwa_pitching'::text, 'bwa_project'::text, 'bwf_pitching'::text, 'bwf_project'::text])))
);


ALTER TABLE public.man_hour_pinned OWNER TO postgres;

--
-- Name: man_hour_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.man_hour_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    man_hour_date_id uuid,
    man_hour_date_bubble_id text,
    task_name text,
    task_bubble_id text,
    task_type text,
    task_type_bubble_id text,
    task_description text,
    work_hour numeric(5,2) DEFAULT 0 NOT NULL,
    output_count integer,
    output_unit text,
    work_location text,
    project_bubble_id text,
    project_id uuid,
    project_name text,
    brand_bubble_id text,
    brand_name text,
    meeting_topic text,
    meeting_participants text[],
    meeting_method text,
    meeting_duration text,
    meeting_request_date text,
    meeting_invite_sent boolean DEFAULT false,
    asana_link text,
    keywords text,
    images text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    job_type text,
    ai_tools jsonb,
    deliverables jsonb,
    design_job_id uuid,
    design_stage text,
    progress_pct numeric,
    CONSTRAINT chk_man_hour_tasks_job_type CHECK (((job_type IS NULL) OR (job_type = ANY (ARRAY['bwa_project'::text, 'bwa_pitching'::text, 'bwf_project'::text, 'bwf_pitching'::text]))))
);


ALTER TABLE public.man_hour_tasks OWNER TO postgres;

--
-- Name: news; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    banner_image text,
    body_text text,
    creator_member text,
    is_active boolean,
    liked_count integer,
    liked_member text,
    nos_news_type text,
    title text,
    view_count integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    creator_member_id uuid,
    created_by_id uuid,
    nos_news_type_id uuid
);


ALTER TABLE public.news OWNER TO postgres;

--
-- Name: news_comment_liked_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_comment_liked_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id text,
    member_id text
);


ALTER TABLE public.news_comment_liked_members OWNER TO postgres;

--
-- Name: news_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    comment text,
    creator_member text,
    liked_count integer,
    liked_member text,
    news text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    creator_member_id uuid,
    news_id uuid,
    created_by_id uuid
);


ALTER TABLE public.news_comments OWNER TO postgres;

--
-- Name: news_liked_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_liked_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    news_id text,
    member_id text
);


ALTER TABLE public.news_liked_members OWNER TO postgres;

--
-- Name: news_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.news_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    color text,
    display text,
    is_active boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.news_types OWNER TO postgres;

--
-- Name: nos_ai_quote_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_ai_quote_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_ai_quote_types OWNER TO postgres;

--
-- Name: nos_ai_tool_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_ai_tool_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    display text NOT NULL,
    eng_display text,
    sorting integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_date timestamp with time zone DEFAULT now(),
    modified_date timestamp with time zone DEFAULT now(),
    CONSTRAINT nos_ai_tool_types_code_format CHECK ((code ~ '^[a-z][a-z0-9_]*$'::text))
);


ALTER TABLE public.nos_ai_tool_types OWNER TO postgres;

--
-- Name: nos_ai_tools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_ai_tools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display text NOT NULL,
    category text NOT NULL,
    sorting integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_date timestamp with time zone DEFAULT now(),
    modified_date timestamp with time zone DEFAULT now()
);


ALTER TABLE public.nos_ai_tools OWNER TO postgres;

--
-- Name: nos_brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text NOT NULL,
    brand_name text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.nos_brands OWNER TO postgres;

--
-- Name: nos_bv_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_bv_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    value text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_bv_values OWNER TO postgres;

--
-- Name: nos_contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chinese_display text,
    display text,
    is_ao boolean,
    is_recurring boolean,
    rank integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_contracts OWNER TO postgres;

--
-- Name: nos_cr_delivery_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_cr_delivery_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_cr_delivery_methods OWNER TO postgres;

--
-- Name: nos_cr_event_themes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_cr_event_themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    value text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_cr_event_themes OWNER TO postgres;

--
-- Name: nos_cr_event_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_cr_event_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_cr_event_types OWNER TO postgres;

--
-- Name: nos_customer_purpose; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_customer_purpose (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    english_display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_customer_purpose OWNER TO postgres;

--
-- Name: nos_customer_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_customer_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    collection text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid,
    collection_id uuid
);


ALTER TABLE public.nos_customer_tags OWNER TO postgres;

--
-- Name: nos_customer_tags_collection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_customer_tags_collection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    "order" integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_customer_tags_collection OWNER TO postgres;

--
-- Name: nos_defect_causes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_defect_causes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chin_display text,
    display text,
    is_active boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    created_by_id uuid
);


ALTER TABLE public.nos_defect_causes OWNER TO postgres;

--
-- Name: nos_doc_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_doc_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    category text,
    enable_doc_date boolean DEFAULT false,
    enable_expiry_date boolean DEFAULT false,
    is_project_initial_doc boolean DEFAULT false,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_doc_types OWNER TO postgres;

--
-- Name: nos_item_quote_project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_item_quote_project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nos_item_id uuid NOT NULL,
    quote_project_type_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.nos_item_quote_project_types OWNER TO postgres;

--
-- Name: nos_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chinese_name text,
    cost numeric(12,2),
    english_name text,
    quote_project_type text,
    remark text,
    section text,
    status text,
    unit text,
    unit_price numeric(12,2),
    updated boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    unit_id uuid,
    created_by_id uuid,
    section_id uuid
);


ALTER TABLE public.nos_items OWNER TO postgres;

--
-- Name: nos_payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_payment_methods OWNER TO postgres;

--
-- Name: nos_quote_project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_quote_project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    name text,
    prompt text,
    "order" integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_quote_project_types OWNER TO postgres;

--
-- Name: nos_regions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chn_display text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_regions OWNER TO postgres;

--
-- Name: nos_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chinese_name text,
    english_name text,
    quote_project text,
    search_type text,
    "order" integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    quote_project_id uuid
);


ALTER TABLE public.nos_sections OWNER TO postgres;

--
-- Name: nos_service_type_2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_service_type_2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    code text,
    display text,
    is_fast_build boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_service_type_2 OWNER TO postgres;

--
-- Name: nos_site_status_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_site_status_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    is_active boolean,
    os_ss_item_type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    sort_order integer DEFAULT 0,
    display_en text
);


ALTER TABLE public.nos_site_status_items OWNER TO postgres;

--
-- Name: nos_supplier_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_supplier_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    tag_name text,
    tag_type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_supplier_tags OWNER TO postgres;

--
-- Name: nos_task_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_task_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text NOT NULL,
    eng_display text,
    is_active boolean DEFAULT true,
    brand_ids text[],
    team_ids text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    require_project_link boolean DEFAULT true
);


ALTER TABLE public.nos_task_types OWNER TO postgres;

--
-- Name: nos_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text NOT NULL,
    eng_display text,
    is_active boolean DEFAULT true,
    sorting integer,
    task_type_ids text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    require_deliverables boolean DEFAULT false NOT NULL
);


ALTER TABLE public.nos_tasks OWNER TO postgres;

--
-- Name: COLUMN nos_tasks.require_deliverables; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.nos_tasks.require_deliverables IS 'When true, man-hour work report must fill 成果 (deliverables type/count/stage) for this task option.';


--
-- Name: nos_template_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    item text,
    template text,
    template_section text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    item_id uuid,
    template_id uuid,
    template_section_id uuid
);


ALTER TABLE public.nos_template_items OWNER TO postgres;

--
-- Name: nos_template_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_template_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    section text,
    template text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    section_id uuid,
    template_id uuid
);


ALTER TABLE public.nos_template_sections OWNER TO postgres;

--
-- Name: nos_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    name text,
    project_type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_templates OWNER TO postgres;

--
-- Name: nos_tender_reject_presets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_tender_reject_presets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_tender_reject_presets OWNER TO postgres;

--
-- Name: nos_units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chi_name text,
    eng_name text,
    "order" integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_units OWNER TO postgres;

--
-- Name: nos_website_functions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_website_functions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    english_display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.nos_website_functions OWNER TO postgres;

--
-- Name: nos_work_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos_work_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text NOT NULL,
    is_active boolean DEFAULT true,
    is_china boolean DEFAULT false,
    is_gps boolean DEFAULT false,
    is_hk boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.nos_work_locations OWNER TO postgres;

--
-- Name: notification_seen; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_seen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id text,
    seen_id text
);


ALTER TABLE public.notification_seen OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text,
    type text DEFAULT 'info'::text NOT NULL,
    bwa_project_id uuid,
    bwf_project_id uuid,
    income_id uuid,
    expense_id uuid,
    link_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery jsonb DEFAULT '{}'::jsonb NOT NULL,
    recipient_staff_id uuid NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: COLUMN notifications.delivery; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.delivery IS 'Outbound channel results, e.g. {"whatsapp":{"status":"accepted","message_id":"wamid...","to":"852...","sent_at":"..."}}';


--
-- Name: outstanding_remarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.outstanding_remarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_project text,
    crm_status text,
    n_contract_type text,
    project text,
    remarks text,
    url text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    project_id uuid,
    bwf_project_id uuid,
    n_contract_type_id uuid,
    created_by_id uuid
);


ALTER TABLE public.outstanding_remarks OWNER TO postgres;

--
-- Name: permission_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permission_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    permission_id uuid NOT NULL,
    dimension text NOT NULL,
    dimension_value text NOT NULL,
    effect text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT permission_assignments_dimension_check CHECK ((dimension = ANY (ARRAY['role'::text, 'bu'::text, 'team'::text, 'position'::text, 'user'::text]))),
    CONSTRAINT permission_assignments_effect_check CHECK ((effect = ANY (ARRAY['allow'::text, 'deny'::text])))
);


ALTER TABLE public.permission_assignments OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    action text NOT NULL,
    display_name text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: pitching_bv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pitching_bv (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_pitching text,
    case_closed_count integer,
    enquiry_date timestamp with time zone,
    handler text,
    pitching text,
    pitching_count integer,
    pitching_status text,
    project text,
    project_count integer,
    quotation_count integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bwf_pitching_id uuid,
    handler_id uuid,
    pitching_id uuid
);


ALTER TABLE public.pitching_bv OWNER TO postgres;

--
-- Name: pitching_close_reasons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pitching_close_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    is_bwf boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.pitching_close_reasons OWNER TO postgres;

--
-- Name: po_sub_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.po_sub_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    amount numeric(12,2),
    completion_date timestamp with time zone,
    description text,
    is_active boolean,
    item_name text,
    po text,
    price numeric(12,2),
    quantity numeric(10,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.po_sub_items OWNER TO postgres;

--
-- Name: product_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.product_types OWNER TO postgres;

--
-- Name: project_bv; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_bv (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    actual_bv numeric(12,2),
    actual_gp numeric(12,2),
    bwf_project text,
    estimated_bv numeric(12,2),
    estimated_gp numeric(12,2),
    handler text,
    handover_date timestamp with time zone,
    n_financial_year text,
    n_team_type text,
    project text,
    ratio numeric(10,4),
    shared_actual_gp numeric(12,2),
    shared_estimated_gp numeric(12,2),
    signed_date timestamp with time zone,
    total_sales numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    handler_id uuid,
    n_financial_year_id uuid,
    n_team_type_id uuid,
    project_id uuid,
    bwf_project_id uuid
);


ALTER TABLE public.project_bv OWNER TO postgres;

--
-- Name: project_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    doc_name text,
    doc_type text,
    document_date timestamp with time zone,
    expiry_date timestamp with time zone,
    pitching text,
    project text,
    remark text,
    file text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    doc_type_id uuid,
    project_id uuid,
    bwf_project_id uuid,
    created_by_id uuid
);


ALTER TABLE public.project_documents OWNER TO postgres;

--
-- Name: project_initial_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_initial_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    n_expense_type text,
    pitching text,
    amount numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    n_expense_type_id uuid,
    created_by_id uuid,
    bwf_pitching_id uuid
);


ALTER TABLE public.project_initial_expenses OWNER TO postgres;

--
-- Name: project_schedule_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_schedule_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_project_with_custom text,
    display text,
    is_bwa boolean,
    is_bwf_ob boolean,
    is_custom boolean,
    is_fast_build boolean,
    is_handover_date boolean,
    is_start_date boolean,
    os_schedule_groups text,
    project_with_custom text,
    sort integer,
    stage text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    project_with_custom_id uuid,
    bwf_project_with_custom_id uuid,
    os_schedule_groups_id uuid
);


ALTER TABLE public.project_schedule_tasks OWNER TO postgres;

--
-- Name: project_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_project text,
    date timestamp with time zone,
    main_pm text,
    payment_schedule text,
    project text,
    schedule_type text,
    working_schedule text,
    is_na boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    main_pm_id uuid,
    project_id uuid,
    bwf_project_id uuid,
    payment_schedule_id uuid,
    working_schedule_id uuid
);


ALTER TABLE public.project_schedules OWNER TO postgres;

--
-- Name: project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chin_display text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    site_status_required boolean DEFAULT false NOT NULL
);


ALTER TABLE public.project_types OWNER TO postgres;

--
-- Name: project_weekly_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_weekly_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    file text,
    meeting_date timestamp with time zone,
    project text,
    report_name text,
    week_number integer,
    za_meeting_team text,
    zb_key_focus text,
    zc_completed_work text,
    zd_next_week_work text,
    ze_additional_items text,
    zf_urgent_client_confirm text,
    zg_site_changes text,
    zh_factors_affecting_handover text,
    zi_overall_site_schedule text,
    zj_payment_schedule text,
    zk_appendix text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    project_id uuid,
    created_by_id uuid,
    display_project_name text
);


ALTER TABLE public.project_weekly_reports OWNER TO postgres;

--
-- Name: COLUMN project_weekly_reports.display_project_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.project_weekly_reports.display_project_name IS 'Editable project title shown on 10-day report PDF header/footer; independent of bwa_projects.project_name';


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    cost_centre text,
    expense text,
    is_active boolean,
    main_item_amount numeric(12,2),
    main_item_completion_date timestamp with time zone,
    main_item_description text,
    main_item_name text,
    main_item_price numeric(12,2),
    main_item_quantity numeric(10,2),
    po_date timestamp with time zone,
    po_number text,
    payment_terms text,
    project_name text,
    receiver_name text,
    signed_date timestamp with time zone,
    signed_file text,
    t_and_c text,
    total_amount numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    cost_centre_id uuid
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: q_term_section_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.q_term_section_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    description text,
    star boolean,
    term_head text,
    total text,
    number text,
    "order" integer,
    quote text,
    term_section text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    quote_id uuid,
    term_head_id uuid
);


ALTER TABLE public.q_term_section_details OWNER TO postgres;

--
-- Name: q_term_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.q_term_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    head_name text,
    "order" integer,
    quote text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    quote_id uuid
);


ALTER TABLE public.q_term_sections OWNER TO postgres;

--
-- Name: qms_box_access_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_box_access_log (
    id bigint NOT NULL,
    actor_auth_user_id uuid NOT NULL,
    action text NOT NULL,
    item_type text,
    item_id text,
    outcome text NOT NULL,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_box_access_log_action_check CHECK ((action = ANY (ARRAY['status'::text, 'browse'::text, 'download'::text, 'analysis'::text, 'lookup'::text]))),
    CONSTRAINT qms_box_access_log_error_check CHECK ((((outcome = ANY (ARRAY['attempted'::text, 'allowed'::text])) AND (error_code IS NULL)) OR ((outcome = ANY (ARRAY['denied'::text, 'failed'::text])) AND (error_code IS NOT NULL) AND (length(TRIM(BOTH FROM error_code)) > 0)))),
    CONSTRAINT qms_box_access_log_item_check CHECK ((((item_type IS NULL) AND (item_id IS NULL)) OR ((item_type IS NOT NULL) AND (item_id IS NOT NULL) AND (length(TRIM(BOTH FROM item_id)) > 0)))),
    CONSTRAINT qms_box_access_log_item_type_check CHECK (((item_type IS NULL) OR (item_type = ANY (ARRAY['folder'::text, 'file'::text])))),
    CONSTRAINT qms_box_access_log_outcome_check CHECK ((outcome = ANY (ARRAY['attempted'::text, 'allowed'::text, 'denied'::text, 'failed'::text])))
);


ALTER TABLE public.qms_box_access_log OWNER TO postgres;

--
-- Name: qms_box_access_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_box_access_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.qms_box_access_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: qms_cost_coverages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_cost_coverages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cost_version_id uuid NOT NULL,
    cost_line_id uuid NOT NULL,
    requirement_scope_key text NOT NULL,
    component_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT qms_cost_coverages_component_type_check CHECK ((component_type = ANY (ARRAY['MATERIAL'::text, 'INSTALLATION'::text, 'BUNDLE'::text, 'OTHER'::text]))),
    CONSTRAINT qms_cost_coverages_requirement_scope_key_check CHECK ((length(TRIM(BOTH FROM requirement_scope_key)) > 0))
);


ALTER TABLE public.qms_cost_coverages OWNER TO postgres;

--
-- Name: TABLE qms_cost_coverages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_cost_coverages IS 'Maps a requirement scope + pricing component to exactly one active cost line. A bundle line may cover several scopes; a scope may be split by component. The partial unique index forbids two active sources for the same scope+component.';


--
-- Name: qms_supplier_quote_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_supplier_quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_quote_revision_id uuid NOT NULL,
    supplier_quote_section_id uuid,
    source_item_no text,
    source_item_name text NOT NULL,
    source_description text,
    source_quantity numeric,
    source_unit_text text,
    source_unit_price numeric,
    source_line_total numeric,
    pricing_status text DEFAULT 'priced'::text NOT NULL,
    page_no integer,
    field_confidences jsonb,
    standard_item_id uuid,
    normalized_unit_id uuid,
    normalized_unit_cost numeric,
    review_decision text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    component_type text,
    component_source text DEFAULT 'unset'::text NOT NULL,
    standard_variant_id uuid,
    scope_signature text,
    loss_rule numeric,
    quality_status text DEFAULT 'unreviewed'::text NOT NULL,
    normalized_unit_price numeric,
    CONSTRAINT qms_supplier_quote_items_component_source_chk CHECK ((component_source = ANY (ARRAY['unset'::text, 'extracted'::text, 'human'::text]))),
    CONSTRAINT qms_supplier_quote_items_component_type_chk CHECK (((component_type IS NULL) OR (component_type = ANY (ARRAY['MATERIAL'::text, 'INSTALLATION'::text, 'BUNDLE'::text, 'OTHER'::text])))),
    CONSTRAINT qms_supplier_quote_items_loss_rule_chk CHECK (((loss_rule IS NULL) OR (loss_rule >= (0)::numeric))),
    CONSTRAINT qms_supplier_quote_items_pricing_status_check CHECK ((pricing_status = ANY (ARRAY['priced'::text, 'included'::text, 'free'::text, 'tbc'::text, 'by_bw'::text, 'cancelled'::text, 'excluded'::text, 'optional'::text]))),
    CONSTRAINT qms_supplier_quote_items_quality_status_chk CHECK ((quality_status = ANY (ARRAY['unreviewed'::text, 'reviewed'::text, 'excluded'::text])))
);


ALTER TABLE public.qms_supplier_quote_items OWNER TO postgres;

--
-- Name: TABLE qms_supplier_quote_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_supplier_quote_items IS 'Original supplier quote lines. source_* fields are immutable original text; corrections go into normalized_/reviewed fields or the next revision.';


--
-- Name: COLUMN qms_supplier_quote_items.pricing_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.pricing_status IS 'priced counts toward totals; free is true zero cost; included/excluded/by_bw/cancelled/tbc must never be treated as zero cost or enter formal cost.';


--
-- Name: COLUMN qms_supplier_quote_items.component_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.component_type IS 'Pricing component (MATERIAL / INSTALLATION / BUNDLE / OTHER). Human reviewer confirms; extraction only suggests. Never inferred from the cost layer.';


--
-- Name: COLUMN qms_supplier_quote_items.component_source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.component_source IS 'unset / extracted (suggested by OCR) / human (confirmed by reviewer). Only human or explicitly accepted values count as confirmed.';


--
-- Name: COLUMN qms_supplier_quote_items.standard_variant_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.standard_variant_id IS 'Matched QMS item variant (qcatalogue layer). Null means not yet classified; the line must not enter historical cost statistics.';


--
-- Name: COLUMN qms_supplier_quote_items.scope_signature; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.scope_signature IS 'Stable key of the已核實 include/exclude scope; lines only compare when scope signatures are compatible.';


--
-- Name: COLUMN qms_supplier_quote_items.loss_rule; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.loss_rule IS 'Optional material loss/wastage rule (e.g. 0.10). Applied to material purchase quantity only; never to installation quantity or the customer sell quantity.';


--
-- Name: COLUMN qms_supplier_quote_items.quality_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.quality_status IS 'unreviewed / reviewed / excluded. Excluded lines never enter historical cost statistics but remain queryable.';


--
-- Name: COLUMN qms_supplier_quote_items.normalized_unit_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_items.normalized_unit_price IS 'Standardised unit price after controlled unit conversion; the original source_unit_price is never overwritten.';


--
-- Name: qms_supplier_quote_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_supplier_quote_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_id uuid NOT NULL,
    revision_no text NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_quote_no text NOT NULL,
    quote_date date,
    valid_until date,
    source_project_name text,
    source_site_address text,
    source_area_sq_ft numeric,
    currency_code text DEFAULT 'HKD'::text NOT NULL,
    subtotal numeric,
    discount_amount numeric,
    total_amount numeric,
    status text DEFAULT 'extracted'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    extraction_schema_version text DEFAULT 'qms-supplier-quote-v1'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_supplier_quote_revisions_revision_no_check CHECK ((length(TRIM(BOTH FROM revision_no)) > 0)),
    CONSTRAINT qms_supplier_quote_revisions_status_check CHECK ((status = ANY (ARRAY['extracted'::text, 'reviewed'::text, 'approved'::text, 'superseded'::text]))),
    CONSTRAINT qms_supplier_quote_revisions_supplier_quote_no_check CHECK ((length(TRIM(BOTH FROM supplier_quote_no)) > 0))
);


ALTER TABLE public.qms_supplier_quote_revisions OWNER TO postgres;

--
-- Name: TABLE qms_supplier_quote_revisions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_supplier_quote_revisions IS 'Immutable supplier quotation versions. R2 stays fixed; a later R3 creates a new row and never overwrites R2.';


--
-- Name: COLUMN qms_supplier_quote_revisions.supplier_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_revisions.supplier_id IS 'PMS suppliers.id chosen by a human reviewer; never auto-created or auto-selected by name.';


--
-- Name: qms_cost_reference_samples; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.qms_cost_reference_samples AS
 SELECT i.id AS supplier_quote_item_id,
    i.supplier_quote_revision_id,
    r.supplier_id,
    i.standard_item_id,
    i.standard_variant_id,
    i.component_type,
    i.normalized_unit_id,
    i.scope_signature,
    i.normalized_unit_cost,
    i.pricing_status,
    r.currency_code,
    COALESCE(r.quote_date, (r.created_at)::date) AS source_date,
    r.supplier_quote_no,
    r.revision_no,
    r.status AS revision_status
   FROM (public.qms_supplier_quote_items i
     JOIN public.qms_supplier_quote_revisions r ON ((r.id = i.supplier_quote_revision_id)))
  WHERE ((r.status = 'approved'::text) AND (i.pricing_status = 'priced'::text) AND (i.normalized_unit_cost IS NOT NULL) AND (i.standard_variant_id IS NOT NULL) AND (i.normalized_unit_id IS NOT NULL));


ALTER VIEW public.qms_cost_reference_samples OWNER TO postgres;

--
-- Name: VIEW qms_cost_reference_samples; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.qms_cost_reference_samples IS 'Eligible historical supplier cost lines for statistics. Excludes non-approved revisions, non-priced lines (included/free/tbc/bw/cancelled/excluded/optional), unclassified lines and lines without a comparable normalised unit. Derived view only; it is never a second mutable price source.';


--
-- Name: qms_cost_source_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_cost_source_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cost_line_id uuid NOT NULL,
    source_type text NOT NULL,
    supplier_quote_revision_id uuid,
    supplier_quote_item_id uuid,
    estimate_run_id uuid,
    original_unit_id uuid,
    original_unit_price numeric,
    original_unit_text text,
    normalized_unit_id uuid,
    normalized_unit_price numeric,
    currency_code text DEFAULT 'HKD'::text NOT NULL,
    scope_signature text,
    override_reason text,
    selected_by uuid NOT NULL,
    selected_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT qms_cost_source_snapshots_source_type_check CHECK ((source_type = ANY (ARRAY['SUPPLIER_SELECTED'::text, 'HISTORICAL_ESTIMATE'::text, 'MANUAL'::text, 'UNPRICED'::text])))
);


ALTER TABLE public.qms_cost_source_snapshots OWNER TO postgres;

--
-- Name: TABLE qms_cost_source_snapshots; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_cost_source_snapshots IS 'Frozen provenance for one cost line: supplier revision/item or estimate run, original and normalised unit/price, currency and the human override reason. Background updates never change an existing snapshot.';


--
-- Name: qms_drawing_analyses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_drawing_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_auth_user_id uuid NOT NULL,
    status text DEFAULT 'uploaded'::text NOT NULL,
    project_type text DEFAULT 'Office'::text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL,
    storage_bucket text DEFAULT 'internal-documents'::text NOT NULL,
    storage_object_path text NOT NULL,
    provider text DEFAULT 'xai'::text NOT NULL,
    model text DEFAULT 'grok-4.6'::text NOT NULL,
    provider_file_expires_at timestamp with time zone,
    result jsonb,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    archived_at timestamp with time zone,
    CONSTRAINT qms_drawing_analyses_answers_check CHECK ((jsonb_typeof(answers) = 'array'::text)),
    CONSTRAINT qms_drawing_analyses_file_size_bytes_check CHECK (((file_size_bytes > 0) AND (file_size_bytes <= 50331648))),
    CONSTRAINT qms_drawing_analyses_mime_type_check CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'image/png'::text, 'image/jpeg'::text]))),
    CONSTRAINT qms_drawing_analyses_questions_check CHECK ((jsonb_typeof(questions) = 'array'::text)),
    CONSTRAINT qms_drawing_analyses_status_check CHECK ((status = ANY (ARRAY['uploaded'::text, 'analyzing'::text, 'questions_ready'::text, 'refining'::text, 'draft_ready'::text, 'failed'::text, 'archived'::text])))
);


ALTER TABLE public.qms_drawing_analyses OWNER TO postgres;

--
-- Name: TABLE qms_drawing_analyses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_drawing_analyses IS 'Versioned QMS drawing-analysis jobs. Results are evidence for a human-reviewed draft, never an approved quotation.';


--
-- Name: COLUMN qms_drawing_analyses.result; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_drawing_analyses.result IS 'Structured Grok analysis with source references and confidence. Must not contain provider secrets or invented prices.';


--
-- Name: qms_estimate_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_estimate_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    standard_variant_id uuid NOT NULL,
    component_type text,
    normalized_unit_id uuid,
    scope_signature text,
    window_months integer DEFAULT 24 NOT NULL,
    sample_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    sample_count integer DEFAULT 0 NOT NULL,
    supplier_count integer DEFAULT 0 NOT NULL,
    minimum numeric,
    median numeric,
    maximum numeric,
    average numeric,
    rules_version text DEFAULT 'estimate-v1'::text NOT NULL,
    estimated_by uuid,
    estimated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT qms_estimate_runs_component_type_check CHECK (((component_type IS NULL) OR (component_type = ANY (ARRAY['MATERIAL'::text, 'INSTALLATION'::text, 'BUNDLE'::text, 'OTHER'::text])))),
    CONSTRAINT qms_estimate_runs_sample_count_check CHECK ((sample_count >= 0)),
    CONSTRAINT qms_estimate_runs_sample_ids_check CHECK ((jsonb_typeof(sample_ids) = 'array'::text)),
    CONSTRAINT qms_estimate_runs_supplier_count_check CHECK ((supplier_count >= 0)),
    CONSTRAINT qms_estimate_runs_window_months_check CHECK ((window_months >= 1))
);


ALTER TABLE public.qms_estimate_runs OWNER TO postgres;

--
-- Name: TABLE qms_estimate_runs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_estimate_runs IS 'Immutable record of a historical estimate: the sample set, method, window and statistics that produced low/base/high. Historical estimates never reflow into new samples.';


--
-- Name: qms_historical_quote_import_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_historical_quote_import_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_id uuid NOT NULL,
    revision_no integer NOT NULL,
    revision_type text NOT NULL,
    snapshot jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_historical_quote_import_revisions_revision_no_check CHECK ((revision_no > 0)),
    CONSTRAINT qms_historical_quote_import_revisions_revision_type_check CHECK ((revision_type = ANY (ARRAY['extraction'::text, 'human_review'::text]))),
    CONSTRAINT qms_historical_quote_import_revisions_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


ALTER TABLE public.qms_historical_quote_import_revisions OWNER TO postgres;

--
-- Name: TABLE qms_historical_quote_import_revisions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_historical_quote_import_revisions IS 'Append-only extraction and human-review snapshots for historical customer quotation imports.';


--
-- Name: qms_historical_quote_imports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_historical_quote_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_auth_user_id uuid NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    original_filename text NOT NULL,
    mime_type text DEFAULT 'application/pdf'::text NOT NULL,
    file_size_bytes bigint NOT NULL,
    sha256 text NOT NULL,
    storage_bucket text DEFAULT 'internal-documents'::text NOT NULL,
    storage_object_path text NOT NULL,
    provider text DEFAULT 'xai'::text NOT NULL,
    model text DEFAULT 'grok-4.6'::text NOT NULL,
    extraction_schema_version text DEFAULT 'qms-historical-quote-v1'::text NOT NULL,
    extracted_result jsonb,
    reviewed_result jsonb,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extracted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    archived_at timestamp with time zone,
    linked_quotation_id uuid,
    link_mode text,
    CONSTRAINT qms_historical_quote_imports_file_size_bytes_check CHECK (((file_size_bytes > 0) AND (file_size_bytes <= 52428800))),
    CONSTRAINT qms_historical_quote_imports_link_mode_check CHECK (((link_mode IS NULL) OR (link_mode = ANY (ARRAY['linked_existing'::text, 'created_draft'::text])))),
    CONSTRAINT qms_historical_quote_imports_mime_type_check CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::text, 'application/vnd.ms-excel'::text]))),
    CONSTRAINT qms_historical_quote_imports_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT qms_historical_quote_imports_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'needs_review'::text, 'confirmed'::text, 'failed'::text, 'archived'::text])))
);


ALTER TABLE public.qms_historical_quote_imports OWNER TO postgres;

--
-- Name: TABLE qms_historical_quote_imports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_historical_quote_imports IS 'Customer-facing historical quotation PDFs and fixed-template Excel workbooks imported into QMS. These records are not supplier costs or PMS formal quotations.';


--
-- Name: COLUMN qms_historical_quote_imports.extracted_result; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_historical_quote_imports.extracted_result IS 'Immutable machine extraction snapshot. Human corrections are stored separately in reviewed_result and revision snapshots.';


--
-- Name: COLUMN qms_historical_quote_imports.linked_quotation_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_historical_quote_imports.linked_quotation_id IS 'PMS quotations.id created or linked when the import is human-confirmed; source of truth for OCR remains reviewed_result.';


--
-- Name: COLUMN qms_historical_quote_imports.link_mode; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_historical_quote_imports.link_mode IS 'linked_existing = matched an existing PMS quotation by quote number; created_draft = inserted a new Draft quotation.';


--
-- Name: qms_item_professional_description_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_item_professional_description_audit (
    id bigint NOT NULL,
    description_id uuid NOT NULL,
    revision integer NOT NULL,
    actor uuid NOT NULL,
    action text NOT NULL,
    snapshot jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_item_professional_description_audit_action_check CHECK ((action = ANY (ARRAY['created'::text, 'updated'::text, 'submitted'::text, 'approved'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT qms_item_professional_description_audit_revision_check CHECK ((revision >= 0)),
    CONSTRAINT qms_item_professional_description_audit_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


ALTER TABLE public.qms_item_professional_description_audit OWNER TO postgres;

--
-- Name: qms_item_professional_description_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_item_professional_description_audit ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.qms_item_professional_description_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: qms_item_professional_descriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_item_professional_descriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    version_no integer DEFAULT 1 NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    description_zh_hk text NOT NULL,
    description_en text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    published_at timestamp with time zone,
    CONSTRAINT qms_item_professional_descriptions_approval_check CHECK (((approved_at IS NULL) = (approved_by IS NULL))),
    CONSTRAINT qms_item_professional_descriptions_description_en_check CHECK (((description_en IS NULL) OR (length(TRIM(BOTH FROM description_en)) > 0))),
    CONSTRAINT qms_item_professional_descriptions_description_zh_hk_check CHECK ((length(TRIM(BOTH FROM description_zh_hk)) > 0)),
    CONSTRAINT qms_item_professional_descriptions_published_check CHECK (((status <> 'published'::text) OR ((approved_at IS NOT NULL) AND (approved_by IS NOT NULL) AND (published_at IS NOT NULL)))),
    CONSTRAINT qms_item_professional_descriptions_revision_check CHECK ((revision >= 0)),
    CONSTRAINT qms_item_professional_descriptions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT qms_item_professional_descriptions_version_no_check CHECK ((version_no > 0))
);


ALTER TABLE public.qms_item_professional_descriptions OWNER TO postgres;

--
-- Name: qms_item_variant_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_item_variant_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id uuid NOT NULL,
    alias_text text NOT NULL,
    normalized_alias text NOT NULL,
    source text DEFAULT 'approved'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT qms_item_variant_aliases_alias_text_check CHECK ((length(TRIM(BOTH FROM alias_text)) > 0)),
    CONSTRAINT qms_item_variant_aliases_normalized_alias_check CHECK ((length(TRIM(BOTH FROM normalized_alias)) > 0)),
    CONSTRAINT qms_item_variant_aliases_source_check CHECK ((source = ANY (ARRAY['approved'::text, 'learned'::text])))
);


ALTER TABLE public.qms_item_variant_aliases OWNER TO postgres;

--
-- Name: TABLE qms_item_variant_aliases; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_item_variant_aliases IS 'Approved or learned aliases that map supplier原文 descriptions to a QMS variant. Used by the P0 classification strategy; a hit still requires matching required attributes and scope before auto-classification.';


--
-- Name: qms_item_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_item_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    standard_item_id uuid NOT NULL,
    variant_key text NOT NULL,
    label text NOT NULL,
    required_attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    normalized_unit_id uuid,
    scope_key text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    CONSTRAINT qms_item_variants_label_check CHECK ((length(TRIM(BOTH FROM label)) > 0)),
    CONSTRAINT qms_item_variants_required_attributes_check CHECK ((jsonb_typeof(required_attributes) = 'object'::text)),
    CONSTRAINT qms_item_variants_variant_key_check CHECK ((length(TRIM(BOTH FROM variant_key)) > 0))
);


ALTER TABLE public.qms_item_variants OWNER TO postgres;

--
-- Name: TABLE qms_item_variants; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_item_variants IS 'QMS comparable specification layer over a PMS nos_items standard item. Two supplier lines only share a comparison group when their variant (specification, unit, scope) matches. active stores the stable key, label and required attributes; no PMS nos_items column is changed.';


--
-- Name: qms_page_permission_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_page_permission_audit (
    revision integer NOT NULL,
    actor uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_entries jsonb NOT NULL,
    entries jsonb NOT NULL
);


ALTER TABLE public.qms_page_permission_audit OWNER TO postgres;

--
-- Name: qms_page_permission_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_page_permission_settings (
    id smallint NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    entries jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT qms_page_permission_settings_entries_check CHECK ((jsonb_typeof(entries) = 'array'::text)),
    CONSTRAINT qms_page_permission_settings_id_check CHECK ((id = 1)),
    CONSTRAINT qms_page_permission_settings_revision_check CHECK ((revision >= 0))
);


ALTER TABLE public.qms_page_permission_settings OWNER TO postgres;

--
-- Name: qms_quotation_cost_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_cost_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    cost_revision_no integer NOT NULL,
    quotation_version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quotation_cost_revisions_cost_revision_no_check CHECK ((cost_revision_no >= 1)),
    CONSTRAINT qms_quotation_cost_revisions_quotation_version_number_check CHECK ((quotation_version_number >= 1)),
    CONSTRAINT qms_quotation_cost_revisions_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


ALTER TABLE public.qms_quotation_cost_revisions OWNER TO postgres;

--
-- Name: TABLE qms_quotation_cost_revisions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_cost_revisions IS 'Append-only cost snapshots capturing document links, per-item allocations, unallocated lines, totals, reconciliation and mismatch overrides for audit.';


--
-- Name: qms_quotation_industries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_industries (
    quotation_id uuid NOT NULL,
    industry_id text,
    industry_name text NOT NULL,
    updated_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qms_quotation_industries OWNER TO postgres;

--
-- Name: TABLE qms_quotation_industries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_industries IS 'QMS-owned customer industry for a PMS quotation. Read to restore 客戶產業 when editing an Office quotation.';


--
-- Name: COLUMN qms_quotation_industries.quotation_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_industries.quotation_id IS 'PMS quotations.id this industry applies to.';


--
-- Name: COLUMN qms_quotation_industries.industry_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_industries.industry_id IS 'PMS client_types.id of the selected industry when known.';


--
-- Name: COLUMN qms_quotation_industries.industry_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_industries.industry_name IS 'PMS client_types.display value (source label) selected by the user.';


--
-- Name: qms_quotation_item_cost_bindings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_item_cost_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_item_identity_id uuid NOT NULL,
    quotation_supplier_link_id uuid NOT NULL,
    supplier_quote_item_id uuid NOT NULL,
    mapping_kind text DEFAULT 'manual'::text NOT NULL,
    applied_quantity numeric,
    applied_unit_id uuid,
    conversion_factor numeric,
    allocated_cost_amount numeric,
    status text DEFAULT 'proposed'::text NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_scope_id uuid,
    component_type text,
    include_optional boolean DEFAULT false NOT NULL,
    adopted_pricing_status text,
    CONSTRAINT qms_quotation_item_cost_bindings_adopted_status_check CHECK (((adopted_pricing_status IS NULL) OR (adopted_pricing_status = ANY (ARRAY['priced'::text, 'free'::text, 'included'::text, 'optional'::text, 'optional_adopted'::text])))),
    CONSTRAINT qms_quotation_item_cost_bindings_component_type_check CHECK (((component_type IS NULL) OR (component_type = ANY (ARRAY['MATERIAL'::text, 'INSTALLATION'::text, 'BUNDLE'::text, 'OTHER'::text])))),
    CONSTRAINT qms_quotation_item_cost_bindings_mapping_kind_check CHECK ((mapping_kind = ANY (ARRAY['exact'::text, 'partial'::text, 'split'::text, 'combined'::text, 'manual'::text]))),
    CONSTRAINT qms_quotation_item_cost_bindings_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'superseded'::text])))
);


ALTER TABLE public.qms_quotation_item_cost_bindings OWNER TO postgres;

--
-- Name: TABLE qms_quotation_item_cost_bindings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_item_cost_bindings IS 'Many-to-many allocation between a stable QMS item identity and supplier source lines. A supplier line may split across items; an item may combine several lines. Formal item cost is the sum of confirmed allocations, written by the backend into quotation_section_items.cost.';


--
-- Name: COLUMN qms_quotation_item_cost_bindings.cost_scope_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_item_cost_bindings.cost_scope_id IS 'Competition group this allocation belongs to. NULL on legacy rows: the awarded-only filter falls back to the document link source_role.';


--
-- Name: COLUMN qms_quotation_item_cost_bindings.component_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_item_cost_bindings.component_type IS 'Human-confirmed component for this allocation; projection uses this, never the raw source line component. Must equal the scope component and lie in expected_components.';


--
-- Name: COLUMN qms_quotation_item_cost_bindings.include_optional; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_item_cost_bindings.include_optional IS 'Whether a human adopted an optional source line into formal cost.';


--
-- Name: COLUMN qms_quotation_item_cost_bindings.adopted_pricing_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_item_cost_bindings.adopted_pricing_status IS 'Effective pricing status for cost: priced/free copied from source, optional (not adopted), optional_adopted (counts as priced), included (null until manually allocated).';


--
-- Name: qms_quotation_item_identities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_item_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    current_quotation_section_item_id uuid,
    catalog_item_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    retired_at timestamp with time zone,
    expected_components text[],
    CONSTRAINT qms_quotation_item_identities_expected_components_check CHECK (public.qms_expected_components_valid(expected_components))
);


ALTER TABLE public.qms_quotation_item_identities OWNER TO postgres;

--
-- Name: TABLE qms_quotation_item_identities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_item_identities IS 'Stable identity for a QMS quotation item. current_quotation_section_item_id points at the live PMS item row and is remapped inside the same revise transaction after children are rebuilt, so cost bindings survive formal quotation saves.';


--
-- Name: COLUMN qms_quotation_item_identities.expected_components; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_item_identities.expected_components IS 'Expected priced components for this item. NULL = undecided (read-time substitute [''BUNDLE'']); non-null must be one of eight legal values. Coverage counts each expected component separately.';


--
-- Name: qms_quotation_remarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_remarks (
    quotation_id uuid NOT NULL,
    remarks text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qms_quotation_remarks OWNER TO postgres;

--
-- Name: TABLE qms_quotation_remarks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_remarks IS 'QMS-owned main-works remarks (Remarks 註:) for a quotation. Rendered above the 裝修工程總價 total strip on the customer PDF and on-screen detail; written by qms_save_quotation.';


--
-- Name: qms_quotation_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    archived_version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quotation_revisions_archived_version_number_check CHECK ((archived_version_number >= 1)),
    CONSTRAINT qms_quotation_revisions_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


ALTER TABLE public.qms_quotation_revisions OWNER TO postgres;

--
-- Name: TABLE qms_quotation_revisions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_revisions IS 'Append-only snapshots of PMS quotations taken immediately before a QMS formal revision overwrite. Live row keeps the current version_number.';


--
-- Name: COLUMN qms_quotation_revisions.quotation_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_revisions.quotation_id IS 'PMS quotations.id for the live quotation that was revised.';


--
-- Name: COLUMN qms_quotation_revisions.archived_version_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_revisions.archived_version_number IS 'PMS version_number value that this snapshot represents (the version replaced by the revise).';


--
-- Name: COLUMN qms_quotation_revisions.snapshot; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_revisions.snapshot IS 'Full detail-shaped JSON sufficient to render read-only overview and customer PDF for that archived version.';


--
-- Name: qms_quotation_section_ordinals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_section_ordinals (
    section_id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    ordinal text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qms_quotation_section_ordinals OWNER TO postgres;

--
-- Name: TABLE qms_quotation_section_ordinals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_section_ordinals IS 'QMS-owned customer-facing section ordinal (number or English letter, e.g. 11 or B). Read to number the customer PDF sections; written by qms_save_quotation and the historical-import confirm function.';


--
-- Name: COLUMN qms_quotation_section_ordinals.section_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_section_ordinals.section_id IS 'PMS quotation_sections.id this ordinal applies to (cascades on section rebuild).';


--
-- Name: COLUMN qms_quotation_section_ordinals.ordinal; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_section_ordinals.ordinal IS 'Section ordinal label; numbers sort first then English letters A-Z.';


--
-- Name: qms_quotation_section_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_section_prices (
    section_id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    special_price numeric(14,2),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qms_quotation_section_prices OWNER TO postgres;

--
-- Name: TABLE qms_quotation_section_prices; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_section_prices IS 'QMS-owned section-level 優惠價 for a PMS quotation_section. Read to render the per-section discount; written by qms_save_quotation and the historical-import confirm function.';


--
-- Name: COLUMN qms_quotation_section_prices.section_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_section_prices.section_id IS 'PMS quotation_sections.id this special price applies to (cascades on section rebuild).';


--
-- Name: COLUMN qms_quotation_section_prices.quotation_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_section_prices.quotation_id IS 'PMS quotations.id owning the section.';


--
-- Name: COLUMN qms_quotation_section_prices.special_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_section_prices.special_price IS 'Customer-facing 優惠價 for the section; null means no section discount.';


--
-- Name: qms_quotation_site_conditions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_site_conditions (
    quotation_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qms_quotation_site_conditions OWNER TO postgres;

--
-- Name: TABLE qms_quotation_site_conditions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_site_conditions IS 'QMS-owned 工地情況 JSON snapshot for a quotation. Read to restore the Office quotation site-condition step when editing; written by qms_save_quotation.';


--
-- Name: qms_quotation_supplier_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quotation_supplier_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    supplier_quote_revision_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    source_role text DEFAULT 'reference_cost'::text NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    context_mismatch_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    override_reason text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    CONSTRAINT qms_quotation_supplier_links_source_role_check CHECK ((source_role = ANY (ARRAY['awarded_cost'::text, 'reference_cost'::text, 'alternate_cost'::text]))),
    CONSTRAINT qms_quotation_supplier_links_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'superseded'::text, 'detached'::text])))
);


ALTER TABLE public.qms_quotation_supplier_links OWNER TO postgres;

--
-- Name: TABLE qms_quotation_supplier_links; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quotation_supplier_links IS 'Document-level binding from a PMS quotation to a supplier quote revision. Detaching or switching only supersedes the old link; rows are never hard-deleted.';


--
-- Name: COLUMN qms_quotation_supplier_links.source_role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_supplier_links.source_role IS 'reference_cost is the default when the source site/area mismatch the quotation; switching to awarded_cost requires a human override_reason and audit.';


--
-- Name: COLUMN qms_quotation_supplier_links.override_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quotation_supplier_links.override_reason IS 'Required human reason when a mismatched supplier document is confirmed as formal awarded cost.';


--
-- Name: qms_quote_cost_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packet_id uuid,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    before jsonb,
    after jsonb,
    reason text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_cost_audits_entity_type_check CHECK ((entity_type = ANY (ARRAY['packet'::text, 'scope'::text, 'file'::text, 'scope_source'::text])))
);


ALTER TABLE public.qms_quote_cost_audits OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_audits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_audits IS 'Append-only audit of target changes, signature decisions, role switches, optional adoption, currency conversion, validity exceptions and duplicate aliasing. Rows are never updated or deleted.';


--
-- Name: qms_quote_cost_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cost_version_id uuid NOT NULL,
    cost_layer text NOT NULL,
    component_type text NOT NULL,
    cost_source_type text NOT NULL,
    quantity numeric,
    unit_id uuid,
    loss_rule numeric,
    low_amount numeric,
    base_amount numeric,
    high_amount numeric,
    is_chargeable boolean DEFAULT true NOT NULL,
    free_reason text,
    included_by_line_id uuid,
    manual_description text,
    manual_note text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT qms_quote_cost_lines_amount_chk CHECK (((high_amount IS NULL) OR (low_amount IS NULL) OR (high_amount >= low_amount))),
    CONSTRAINT qms_quote_cost_lines_component_type_check CHECK ((component_type = ANY (ARRAY['MATERIAL'::text, 'INSTALLATION'::text, 'BUNDLE'::text, 'OTHER'::text]))),
    CONSTRAINT qms_quote_cost_lines_cost_layer_check CHECK ((cost_layer = ANY (ARRAY['MAIN'::text, 'MATERIAL_SPECIALIST'::text, 'EXTRA_MANUAL'::text]))),
    CONSTRAINT qms_quote_cost_lines_cost_source_type_check CHECK ((cost_source_type = ANY (ARRAY['SUPPLIER_SELECTED'::text, 'HISTORICAL_ESTIMATE'::text, 'MANUAL'::text, 'UNPRICED'::text]))),
    CONSTRAINT qms_quote_cost_lines_free_chk CHECK (((base_amount IS NULL) OR (base_amount <> (0)::numeric) OR ((free_reason IS NOT NULL) AND (length(TRIM(BOTH FROM free_reason)) > 0)))),
    CONSTRAINT qms_quote_cost_lines_loss_rule_check CHECK (((loss_rule IS NULL) OR (loss_rule >= (0)::numeric)))
);


ALTER TABLE public.qms_quote_cost_lines OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_lines; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_lines IS 'One internal cost line. amount columns are null when unpriced (never 0). A confirmed free line stores 0 with a free_reason. An included line has is_chargeable=false and points at included_by_line_id.';


--
-- Name: qms_quote_cost_packet_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_packet_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packet_id uuid NOT NULL,
    import_id uuid NOT NULL,
    box_file_id text,
    signature_suggestion jsonb,
    signature_decision text,
    signature_confirmed_by uuid,
    signature_confirmed_at timestamp with time zone,
    suspected_duplicate boolean DEFAULT false NOT NULL,
    batch_id uuid,
    attempt_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_cost_packet_files_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT qms_quote_cost_packet_files_signature_decision_check CHECK ((signature_decision = ANY (ARRAY['signed'::text, 'unsigned'::text, 'unknown'::text]))),
    CONSTRAINT qms_quote_cost_packet_files_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'needs_review'::text, 'approved'::text, 'failed'::text, 'archived'::text])))
);


ALTER TABLE public.qms_quote_cost_packet_files OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_packet_files; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_packet_files IS 'QMS-only packet member. File authority (SHA, MIME, storage path, processing status) lives in qms_supplier_quote_imports; this table keeps only competition-group context. status is a display mirror: queued exists only before the import row is created; after that the import status wins.';


--
-- Name: qms_quote_cost_packets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_packets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_cost_packets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


ALTER TABLE public.qms_quote_cost_packets OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_packets; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_packets IS 'QMS-only packet of supplier quote files for one PMS quotation (1:1). A folder of competing supplier quotes belongs to one packet; membership is not yet cost.';


--
-- Name: qms_quote_cost_scope_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_scope_files (
    scope_id uuid NOT NULL,
    packet_file_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qms_quote_cost_scope_files OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_scope_files; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_scope_files IS 'Many-to-many membership: one supplier file may compete in several competition groups (e.g. a combined quote covering ceiling and partitions).';


--
-- Name: qms_quote_cost_scope_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_scope_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_id uuid NOT NULL,
    supplier_quote_revision_id uuid NOT NULL,
    source_role text DEFAULT 'reference_cost'::text NOT NULL,
    override_reason text,
    status text DEFAULT 'proposed'::text NOT NULL,
    legacy boolean DEFAULT false NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_cost_scope_sources_source_role_check CHECK ((source_role = ANY (ARRAY['awarded_cost'::text, 'reference_cost'::text, 'alternate_cost'::text]))),
    CONSTRAINT qms_quote_cost_scope_sources_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'superseded'::text, 'detached'::text])))
);


ALTER TABLE public.qms_quote_cost_scope_sources OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_scope_sources; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_scope_sources IS 'Role authority: source_role is the role of one supplier revision WITHIN one competition group, not a global document role. The same revision may be awarded_cost in group A and reference_cost in group B. legacy=true marks backfilled rows that predate packets (member check waived).';


--
-- Name: qms_quote_cost_scopes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_scopes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packet_id uuid NOT NULL,
    quote_item_key uuid,
    component_type text DEFAULT 'BUNDLE'::text NOT NULL,
    target_source text DEFAULT 'suggested'::text NOT NULL,
    source_folder_path text,
    suggestion jsonb,
    target_confirmed_by uuid,
    target_confirmed_at timestamp with time zone,
    status text DEFAULT 'unset'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_cost_scopes_component_type_check CHECK ((component_type = ANY (ARRAY['MATERIAL'::text, 'INSTALLATION'::text, 'BUNDLE'::text, 'OTHER'::text]))),
    CONSTRAINT qms_quote_cost_scopes_status_check CHECK ((status = ANY (ARRAY['unset'::text, 'pending_review'::text, 'pending_approval'::text, 'approved'::text, 'bound'::text, 'orphaned'::text]))),
    CONSTRAINT qms_quote_cost_scopes_target_source_check CHECK ((target_source = ANY (ARRAY['suggested'::text, 'manual'::text])))
);


ALTER TABLE public.qms_quote_cost_scopes OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_scopes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_scopes IS 'QMS-only competition group targeting one quotation Item plus one priced component (default BUNDLE). A folder is a suggestion source only; the human confirms the target. Retiring the target identity orphans the group (and supersedes its sources); it never silently rebinds.';


--
-- Name: qms_quote_cost_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_cost_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    customer_quote_version_number integer NOT NULL,
    revision integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    mutation_revision integer DEFAULT 0 NOT NULL,
    version_token text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    published_by uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT qms_quote_cost_versions_customer_quote_version_number_check CHECK ((customer_quote_version_number >= 1)),
    CONSTRAINT qms_quote_cost_versions_mutation_revision_check CHECK ((mutation_revision >= 0)),
    CONSTRAINT qms_quote_cost_versions_revision_check CHECK ((revision >= 1)),
    CONSTRAINT qms_quote_cost_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'superseded'::text, 'archived'::text])))
);


ALTER TABLE public.qms_quote_cost_versions OWNER TO postgres;

--
-- Name: TABLE qms_quote_cost_versions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_cost_versions IS 'Internal cost version for a quotation. Kept separate from the customer quote version: changing internal cost does not resend customer documents, and a published cost version is never edited in place.';


--
-- Name: qms_quote_evaluations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    quote_version_number integer NOT NULL,
    rule_version text NOT NULL,
    source_set jsonb DEFAULT '[]'::jsonb NOT NULL,
    result jsonb NOT NULL,
    as_of_utc timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_evaluations_quote_version_number_check CHECK ((quote_version_number >= 1)),
    CONSTRAINT qms_quote_evaluations_result_check CHECK ((jsonb_typeof(result) = 'object'::text)),
    CONSTRAINT qms_quote_evaluations_rule_version_check CHECK (((length(rule_version) >= 1) AND (length(rule_version) <= 100))),
    CONSTRAINT qms_quote_evaluations_source_set_check CHECK ((jsonb_typeof(source_set) = 'array'::text))
);


ALTER TABLE public.qms_quote_evaluations OWNER TO postgres;

--
-- Name: TABLE qms_quote_evaluations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_evaluations IS 'Append-only quote evaluation snapshots. Each row binds a quote version, rule version, source set and as-of instant; old snapshots are kept when a quote is re-evaluated. Internal only, never on the customer PDF.';


--
-- Name: COLUMN qms_quote_evaluations.quote_version_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quote_evaluations.quote_version_number IS 'PMS quotations.version_number the evaluation was computed against.';


--
-- Name: COLUMN qms_quote_evaluations.rule_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quote_evaluations.rule_version IS 'Evaluation rule version (e.g. candidate-2026-09-15) for reproducibility.';


--
-- Name: COLUMN qms_quote_evaluations.source_set; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quote_evaluations.source_set IS 'Identifiers of the sources backing the evaluation, for auditability.';


--
-- Name: COLUMN qms_quote_evaluations.as_of_utc; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_quote_evaluations.as_of_utc IS 'UTC instant the evaluation was computed; display in Asia/Hong_Kong only.';


--
-- Name: qms_quote_exclusion_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_exclusion_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    CONSTRAINT qms_quote_exclusion_options_label_check CHECK ((length(TRIM(BOTH FROM label)) > 0))
);


ALTER TABLE public.qms_quote_exclusion_options OWNER TO postgres;

--
-- Name: qms_quote_project_type_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_project_type_labels (
    source_name text NOT NULL,
    label_zh text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT qms_quote_project_type_labels_label_zh_check CHECK ((length(TRIM(BOTH FROM label_zh)) > 0))
);


ALTER TABLE public.qms_quote_project_type_labels OWNER TO postgres;

--
-- Name: qms_quote_share_annotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_share_annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_link_id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    page_number integer NOT NULL,
    anchor_x numeric(6,5) NOT NULL,
    anchor_y numeric(6,5) NOT NULL,
    quoted_text text,
    body text NOT NULL,
    author_name text,
    status text DEFAULT 'open'::text NOT NULL,
    snapshot_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT qms_quote_share_annotations_anchor_x_check CHECK (((anchor_x >= (0)::numeric) AND (anchor_x <= (1)::numeric))),
    CONSTRAINT qms_quote_share_annotations_anchor_y_check CHECK (((anchor_y >= (0)::numeric) AND (anchor_y <= (1)::numeric))),
    CONSTRAINT qms_quote_share_annotations_author_name_check CHECK (((author_name IS NULL) OR (char_length(author_name) <= 60))),
    CONSTRAINT qms_quote_share_annotations_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1000))),
    CONSTRAINT qms_quote_share_annotations_page_number_check CHECK (((page_number >= 1) AND (page_number <= 200))),
    CONSTRAINT qms_quote_share_annotations_quoted_text_check CHECK (((quoted_text IS NULL) OR (char_length(quoted_text) <= 200))),
    CONSTRAINT qms_quote_share_annotations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))
);


ALTER TABLE public.qms_quote_share_annotations OWNER TO postgres;

--
-- Name: TABLE qms_quote_share_annotations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_share_annotations IS 'QMS customer annotations pinned on a frozen public quote share snapshot. page_number plus the normalized anchor_x / anchor_y locate the pin inside one A4 page. Rows are only read or written by the qms-quote-share Edge Function with the service role; no anon or authenticated access.';


--
-- Name: qms_quote_share_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    quotation_id uuid NOT NULL,
    quote_number text,
    customer_name text,
    quote_title text,
    snapshot jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (timezone('utc'::text, now()) + '30 days'::interval) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    view_count integer DEFAULT 0 NOT NULL,
    last_viewed_at timestamp with time zone,
    CONSTRAINT qms_quote_share_links_snapshot_object CHECK ((jsonb_typeof(snapshot) = 'object'::text)),
    CONSTRAINT qms_quote_share_links_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text]))),
    CONSTRAINT qms_quote_share_links_token_check CHECK ((length(token) >= 22))
);


ALTER TABLE public.qms_quote_share_links OWNER TO postgres;

--
-- Name: TABLE qms_quote_share_links; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_share_links IS 'QMS customer-facing quote share links. snapshot is a frozen, cost-stripped copy of one authorized quotation. Rows are only read or written by the qms-quote-share Edge Function with the service role; no anon or authenticated access.';


--
-- Name: qms_quote_site_media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_site_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_auth_user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    category text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint NOT NULL,
    storage_bucket text DEFAULT 'internal-documents'::text NOT NULL,
    storage_object_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_quote_site_media_category_check CHECK ((category = ANY (ARRAY['photo'::text, 'drawing'::text])))
);


ALTER TABLE public.qms_quote_site_media OWNER TO postgres;

--
-- Name: TABLE qms_quote_site_media; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_site_media IS 'QMS-owned site-condition photos/drawings for an Office quotation draft. Files are stored privately; rows are owner-scoped and written only by the qms-quote-site-media Edge Function.';


--
-- Name: qms_quote_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_quote_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    project_type text NOT NULL,
    area_min numeric,
    area_max numeric,
    status text DEFAULT 'draft'::text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    CONSTRAINT qms_quote_templates_content_object CHECK ((jsonb_typeof(content) = 'object'::text)),
    CONSTRAINT qms_quote_templates_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT qms_quote_templates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


ALTER TABLE public.qms_quote_templates OWNER TO postgres;

--
-- Name: TABLE qms_quote_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_quote_templates IS 'QMS quotation templates, one row per type. content holds the common spaces/sections/items/terms/paymentTerms only.';


--
-- Name: qms_supplier_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_supplier_profiles (
    supplier_id uuid NOT NULL,
    role_tags text[] DEFAULT '{}'::text[] NOT NULL,
    trade_tags text[] DEFAULT '{}'::text[] NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid
);


ALTER TABLE public.qms_supplier_profiles OWNER TO postgres;

--
-- Name: TABLE qms_supplier_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_supplier_profiles IS 'QMS-owned, non-exclusive supplier role and trade tags. A supplier may carry several roles (main contractor, material/specialist) and several trades (wallpaper, flooring, air-conditioning, network). Cost attribution is still decided by each quotation''s actual scope, never by the supplier name.';


--
-- Name: qms_supplier_quote_import_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_supplier_quote_import_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_id uuid NOT NULL,
    revision_no integer NOT NULL,
    revision_type text NOT NULL,
    snapshot jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_supplier_quote_import_revisions_revision_no_check CHECK ((revision_no > 0)),
    CONSTRAINT qms_supplier_quote_import_revisions_revision_type_check CHECK ((revision_type = ANY (ARRAY['extraction'::text, 'human_review'::text]))),
    CONSTRAINT qms_supplier_quote_import_revisions_snapshot_check CHECK ((jsonb_typeof(snapshot) = 'object'::text))
);


ALTER TABLE public.qms_supplier_quote_import_revisions OWNER TO postgres;

--
-- Name: TABLE qms_supplier_quote_import_revisions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_supplier_quote_import_revisions IS 'Append-only extraction and human-review snapshots for supplier quote imports.';


--
-- Name: qms_supplier_quote_imports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_supplier_quote_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_auth_user_id uuid NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    original_filename text NOT NULL,
    mime_type text DEFAULT 'application/pdf'::text NOT NULL,
    file_size_bytes bigint NOT NULL,
    sha256 text NOT NULL,
    storage_bucket text DEFAULT 'internal-documents'::text NOT NULL,
    storage_object_path text NOT NULL,
    provider text DEFAULT 'xai'::text NOT NULL,
    model text DEFAULT 'grok-4.6'::text NOT NULL,
    extraction_schema_version text DEFAULT 'qms-supplier-quote-v1'::text NOT NULL,
    extracted_result jsonb,
    reviewed_result jsonb,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extracted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    archived_at timestamp with time zone,
    duplicate_of_import_id uuid,
    CONSTRAINT qms_supplier_quote_imports_file_size_bytes_check CHECK (((file_size_bytes > 0) AND (file_size_bytes <= 20971520))),
    CONSTRAINT qms_supplier_quote_imports_mime_type_check CHECK ((mime_type = ANY (ARRAY['application/pdf'::text, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::text, 'application/vnd.ms-excel'::text]))),
    CONSTRAINT qms_supplier_quote_imports_no_self_alias CHECK (((duplicate_of_import_id IS NULL) OR (duplicate_of_import_id <> id))),
    CONSTRAINT qms_supplier_quote_imports_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT qms_supplier_quote_imports_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'needs_review'::text, 'approved'::text, 'failed'::text, 'archived'::text])))
);


ALTER TABLE public.qms_supplier_quote_imports OWNER TO postgres;

--
-- Name: TABLE qms_supplier_quote_imports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_supplier_quote_imports IS 'Supplier-provided quotation PDFs imported into QMS for cost review. Supplier documents are never customer quotations and never flow into customer PDFs.';


--
-- Name: COLUMN qms_supplier_quote_imports.mime_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_imports.mime_type IS 'Source document type: PDF or a supplier spreadsheet (.xlsx/.xls). Excel is read with structured header detection or the same strict schema; macros/external links are never executed.';


--
-- Name: COLUMN qms_supplier_quote_imports.extracted_result; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_imports.extracted_result IS 'Immutable machine extraction snapshot. Human corrections live in reviewed_result and revision snapshots; original supplier text is never overwritten by QMS items.';


--
-- Name: COLUMN qms_supplier_quote_imports.duplicate_of_import_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.qms_supplier_quote_imports.duplicate_of_import_id IS 'Non-null marks this import as an alias (same supplier quote as another file, e.g. the Excel twin of a PDF). Alias imports own no revision and are never an independent cost source; original files and download rights stay per owner.';


--
-- Name: qms_supplier_quote_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qms_supplier_quote_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_quote_revision_id uuid NOT NULL,
    source_section_no text,
    name text NOT NULL,
    subtotal numeric,
    page_no integer,
    confidence text DEFAULT 'medium'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qms_supplier_quote_sections_confidence_check CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


ALTER TABLE public.qms_supplier_quote_sections OWNER TO postgres;

--
-- Name: TABLE qms_supplier_quote_sections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.qms_supplier_quote_sections IS 'Supplier quote sections with source number, subtotal and extraction confidence.';


--
-- Name: quotation_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_pitching text,
    n_expense_type text,
    pitching text,
    amount numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    bwf_pitching_id uuid,
    n_expense_type_id uuid,
    created_by_id uuid
);


ALTER TABLE public.quotation_expenses OWNER TO postgres;

--
-- Name: quotation_section_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_section_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    description text,
    cost numeric(12,2),
    opt boolean,
    quote text,
    section text,
    abandon boolean,
    c_unit text,
    item text,
    order_number integer,
    quantity numeric(10,2),
    sub_total_cost numeric(12,2),
    sub_total_price numeric(12,2),
    unit text,
    unit_price numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    quote_id uuid,
    item_id uuid,
    c_unit_id uuid,
    section_id uuid
);


ALTER TABLE public.quotation_section_items OWNER TO postgres;

--
-- Name: quotation_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    name text,
    "order" integer,
    quote text,
    r_section text,
    real_order integer,
    s_discount numeric(12,2),
    s_margin numeric(12,2),
    s_total numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    r_section_id uuid,
    quotation_id uuid
);


ALTER TABLE public.quotation_sections OWNER TO postgres;

--
-- Name: quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    company_address text,
    company_name text,
    contact_person text,
    contact_tel text,
    contract_type text,
    date timestamp with time zone,
    discount_method text,
    discount_percent numeric(10,2),
    discount_type_p text,
    email text,
    fixed_discount numeric(12,2),
    l_version text,
    name text,
    pm_tel text,
    pitching text,
    project text,
    project_manager text,
    project_type text,
    quo_head text,
    quotation_no text,
    quote_updated_name text,
    real_creator text,
    reference_number text,
    size text,
    status text,
    work_address text,
    remark_under_section text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    customer_id uuid,
    cost_centre_id uuid,
    created_by_id uuid,
    version_number integer DEFAULT 1,
    project_type_id uuid,
    contract_type_id uuid,
    terms_and_conditions text,
    engineering_identity_id text
);


ALTER TABLE public.quotations OWNER TO postgres;

--
-- Name: COLUMN quotations.terms_and_conditions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quotations.terms_and_conditions IS 'Rich text (HTML) terms and conditions content for this quotation';


--
-- Name: COLUMN quotations.engineering_identity_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.quotations.engineering_identity_id IS 'Canonical, cross-version independent engineering identity. Null until a verified import or human assigns one; never derived from quotations.project. Enables deduplication so each independent project counts once.';


--
-- Name: receipt_sub_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipt_sub_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid,
    item_name text,
    quantity numeric(10,2),
    price numeric(12,2),
    amount numeric(12,2),
    created_by_id uuid,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.receipt_sub_items OWNER TO postgres;

--
-- Name: receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    amount_received numeric(12,2),
    customer_name text,
    enable_price_difference boolean,
    income text,
    invoices text,
    notes text,
    payment_date timestamp with time zone,
    price_difference numeric(12,2),
    price_difference_description text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    income_id uuid,
    invoice_id uuid,
    created_by_id uuid,
    project_name text,
    receipt_date timestamp with time zone,
    payment_method text,
    system text,
    cost_center_bu_id uuid,
    pdf_branding jsonb
);


ALTER TABLE public.receipts OWNER TO postgres;

--
-- Name: COLUMN receipts.pdf_branding; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.receipts.pdf_branding IS 'Per-document PDF branding: per-slot cost_centre source + snapshot + visibility.';


--
-- Name: recurring_incomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recurring_incomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    contract_pdf text,
    expiry_date timestamp with time zone,
    number_of_installment integer,
    project text,
    r_incomes text,
    start_date timestamp with time zone,
    total_amount numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    project_id uuid,
    r_incomes_id uuid
);


ALTER TABLE public.recurring_incomes OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_key text NOT NULL,
    display_name text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: service_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    is_branding boolean,
    is_fast_build boolean,
    is_furniture boolean,
    is_material boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.service_items OWNER TO postgres;

--
-- Name: service_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    site_status_required boolean DEFAULT false NOT NULL,
    chin_display text
);


ALTER TABLE public.service_types OWNER TO postgres;

--
-- Name: COLUMN service_types.chin_display; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.service_types.chin_display IS 'Chinese display name for UI / case PDF 牽涉工程';


--
-- Name: site_status_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_status_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_status_id uuid NOT NULL,
    question_id uuid NOT NULL,
    value jsonb,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    modified_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.site_status_answers OWNER TO postgres;

--
-- Name: site_status_item_quantities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_status_item_quantities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    item text,
    os_service_area text,
    quantity integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    site_status_id text,
    question_type text,
    item_display text,
    item_id uuid,
    created_by_id uuid
);


ALTER TABLE public.site_status_item_quantities OWNER TO postgres;

--
-- Name: site_status_question_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_status_question_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    label_zh text NOT NULL,
    label_en text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    modified_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.site_status_question_options OWNER TO postgres;

--
-- Name: site_status_question_project_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_status_question_project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    quote_project_type_id uuid NOT NULL,
    created_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.site_status_question_project_types OWNER TO postgres;

--
-- Name: site_status_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_status_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid,
    label_zh text NOT NULL,
    label_en text,
    answer_type text DEFAULT 'text'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    modified_date timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_status_questions_answer_type_check CHECK ((answer_type = ANY (ARRAY['text'::text, 'textarea'::text, 'single_select'::text, 'multi_select'::text, 'number'::text, 'quantity_list'::text, 'select_with_area'::text, 'date'::text, 'yes_no'::text])))
);


ALTER TABLE public.site_status_questions OWNER TO postgres;

--
-- Name: site_status_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_status_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_zh text NOT NULL,
    title_en text,
    icon text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    modified_date timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.site_status_sections OWNER TO postgres;

--
-- Name: site_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    pitching text,
    project text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    project_id uuid,
    created_by_id uuid,
    p1_status_b4 text,
    p2_bmo_noise_control text,
    p3_service_needs text,
    p4_design_needs text,
    p5_tender_method text,
    ac1_status_b4 text,
    ac2_types text,
    ac3_source text,
    ac4_other_service text,
    f1_status_b4 text,
    f2_service_types text,
    f3_finishing_material text,
    f4_thickness text,
    f5_tiling_areas text,
    r1_status_b4 text,
    r2_room_quantities text,
    r3_pantry text,
    r4_partitions text,
    r5_fire_doors text,
    w1_status_b4 text,
    w2_finishing_material text,
    w3_creative_walls text,
    c1_status_b4 text,
    c2_material_b4 text,
    c3_services text,
    c4_finishing_material text,
    e1_status_b4 text,
    e2_system_type text,
    e3_hardwares text,
    e4_monitors text,
    o1_fitted_furnitures text,
    o2_certificate text
);


ALTER TABLE public.site_statuses OWNER TO postgres;

--
-- Name: site_statuses_legacy_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_statuses_legacy_backup (
    id uuid,
    bubble_id text,
    ac1_status_b4 text,
    ac2_types text,
    ac3_source text,
    ac4_other_service text,
    c1_status_b4 text,
    c2_material_b4 text,
    c3_services text,
    c4_finishing_material text,
    e1_status_b4 text,
    e2_system_type text,
    e3_hardwares text,
    e4_monitors text,
    f1_status_b4 text,
    f2_service_types text,
    f3_finishing_material text,
    f4_thickness text,
    f5_tiling_areas text,
    o1_fitted_furnitures text,
    o2_certificate text,
    p1_status_b4 text,
    p2_bmo_noise_control text,
    p3_service_needs text,
    p4_design_needs text,
    p5_tender_method text,
    pitching text,
    project text,
    r1_status_b4 text,
    r2_room_quantities text,
    r3_pantry text,
    r4_partitions text,
    r5_fire_doors text,
    w1_status_b4 text,
    w2_finishing_material text,
    w3_creative_walls text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    project_id uuid,
    created_by_id uuid
);


ALTER TABLE public.site_statuses_legacy_backup OWNER TO postgres;

--
-- Name: source_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.source_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.source_types OWNER TO postgres;

--
-- Name: specific_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.specific_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dimension text NOT NULL,
    dimension_value text NOT NULL,
    module text NOT NULL,
    rule_key text NOT NULL,
    condition_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    effect text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT specific_rules_dimension_check CHECK ((dimension = ANY (ARRAY['role'::text, 'bu'::text, 'team'::text, 'position'::text, 'user'::text]))),
    CONSTRAINT specific_rules_effect_check CHECK ((effect = ANY (ARRAY['allow'::text, 'deny'::text])))
);


ALTER TABLE public.specific_rules OWNER TO postgres;

--
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bu text,
    dual_system boolean,
    email text,
    entry_date timestamp with time zone,
    full_name text,
    hit_rate numeric(10,2),
    image text,
    n_team_type text,
    name text,
    outstanding_alert_reset boolean,
    past_6_hit numeric(10,2),
    past_6_project numeric(10,2),
    past_6_quotation numeric(10,2),
    "position" text,
    private_phone text,
    project_number integer,
    quotation_number integer,
    quote_initial text,
    role text,
    status text,
    termination_date timestamp with time zone,
    work_phone text,
    member text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bu_id uuid,
    n_team_type_id uuid,
    member_id uuid,
    created_by_id uuid
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- Name: staff_bv_deductions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_bv_deductions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    n_financial_year_id uuid NOT NULL,
    deduction_bv numeric DEFAULT 0 NOT NULL,
    reason text,
    created_by uuid,
    created_date timestamp with time zone DEFAULT now(),
    modified_date timestamp with time zone DEFAULT now(),
    CONSTRAINT staff_bv_deductions_deduction_bv_check CHECK ((deduction_bv >= (0)::numeric))
);


ALTER TABLE public.staff_bv_deductions OWNER TO postgres;

--
-- Name: staff_supplier_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_supplier_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bwf_project text,
    comment text,
    evaluator text,
    factory text,
    point numeric(10,2),
    project text,
    supplier text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    evaluator_id uuid,
    supplier_id uuid,
    factory_id uuid,
    project_id uuid,
    bwf_project_id uuid,
    created_by_id uuid,
    rating_time_management numeric,
    rating_professional_skill numeric,
    rating_service_attitude numeric
);


ALTER TABLE public.staff_supplier_comments OWNER TO postgres;

--
-- Name: COLUMN staff_supplier_comments.point; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_supplier_comments.point IS '整體評分 (1-5)';


--
-- Name: COLUMN staff_supplier_comments.rating_time_management; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_supplier_comments.rating_time_management IS '時間管理 (1-5)';


--
-- Name: COLUMN staff_supplier_comments.rating_professional_skill; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_supplier_comments.rating_professional_skill IS '專業技能 (1-5)';


--
-- Name: COLUMN staff_supplier_comments.rating_service_attitude; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.staff_supplier_comments.rating_service_attitude IS '服務態度 (1-5)';


--
-- Name: supplier_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    comment text,
    member text,
    point numeric(10,2),
    supplier text,
    tender text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.supplier_feedback OWNER TO postgres;

--
-- Name: supplier_file_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_file_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.supplier_file_types OWNER TO postgres;

--
-- Name: supplier_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    code_number text,
    expiry_date timestamp with time zone,
    file text,
    file_name text,
    institution text,
    remarks text,
    supplier text,
    type text,
    type_name text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    type_id uuid,
    supplier_id uuid,
    created_by_id uuid
);


ALTER TABLE public.supplier_files OWNER TO postgres;

--
-- Name: supplier_level_pass_out_dates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_level_pass_out_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    day integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.supplier_level_pass_out_dates OWNER TO postgres;

--
-- Name: supplier_level_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_level_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    amount numeric(12,2),
    count integer,
    level text,
    month integer,
    point numeric(10,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.supplier_level_roles OWNER TO postgres;

--
-- Name: supplier_login_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_login_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    code text,
    expiry_date timestamp with time zone,
    ip_address text,
    login_date timestamp with time zone,
    status text,
    supplier text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.supplier_login_codes OWNER TO postgres;

--
-- Name: supplier_pricings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_pricings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chn_name text,
    editor text,
    eng_name text,
    item text,
    item_unit_price numeric(12,2),
    supplier text,
    unit text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    editor_id uuid,
    item_id uuid,
    unit_id uuid,
    supplier_id uuid,
    created_by_id uuid
);


ALTER TABLE public.supplier_pricings OWNER TO postgres;

--
-- Name: supplier_recent_statuses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_recent_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    supplier text,
    text text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    supplier_id uuid,
    created_by_id uuid
);


ALTER TABLE public.supplier_recent_statuses OWNER TO postgres;

--
-- Name: supplier_register_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_register_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    basic_profession text,
    decorative_profession text,
    drawing_experience text,
    job_mode text,
    mechanical_profession text,
    payment_style text,
    project_type text,
    site_target text,
    supplier text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    supplier_id uuid,
    created_by_id uuid
);


ALTER TABLE public.supplier_register_forms OWNER TO postgres;

--
-- Name: supplier_rule_displays; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_rule_displays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    dropdown_a text,
    dropdown_c text,
    dropdown_b text,
    level text,
    show_b boolean,
    show_c boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.supplier_rule_displays OWNER TO postgres;

--
-- Name: supplier_supplier_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_supplier_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.supplier_supplier_tags OWNER TO postgres;

--
-- Name: supplier_supplier_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_supplier_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_type_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.supplier_supplier_types OWNER TO postgres;

--
-- Name: supplier_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    chinese_display text,
    display text,
    is_bwf boolean,
    "order" integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.supplier_types OWNER TO postgres;

--
-- Name: COLUMN supplier_types.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.supplier_types.is_active IS 'When false, the type is hidden from frontend dropdowns, filters, and dialogs.';


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    account_description text,
    account_status text,
    address text,
    admin_level text,
    amount numeric(12,2),
    asana_link text,
    auto_level text,
    chinese_name text,
    company_office_photo text,
    contact_persons text,
    contact1_chn_given_name text,
    contact1_chn_nickname text,
    contact1_chn_surname text,
    contact1_eng_givenname text,
    contact1_eng_nickname text,
    contact1_eng_surname text,
    contact1_gender text,
    contact1_job_title text,
    contact1_name_card text,
    contact1_phone text,
    contact2_chn_given_name text,
    contact2_chn_nickname text,
    contact2_chn_surname text,
    contact2_eng_givenname text,
    contact2_eng_nickname text,
    contact2_eng_surname text,
    contact2_gender text,
    contact2_job_title text,
    contact2_name_card text,
    contact2_phone text,
    director_hkid text,
    disable_comments boolean,
    display_name text,
    district text,
    email text,
    establish_year text,
    expense text,
    fax_no text,
    join_date timestamp with time zone,
    level_modified_date timestamp with time zone,
    level_pass_out_day text,
    moq text,
    n_type text,
    name text,
    order_days text,
    outstanding numeric(12,2),
    paid numeric(12,2),
    past_12_project integer,
    past_6_project integer,
    past12_count integer,
    phone text,
    professional_skill text,
    project text,
    project_number integer,
    real_level text,
    referer_name text,
    referer_set text,
    register_form text,
    related_file text,
    remark text,
    sort_type text,
    status text,
    supplier_tags text,
    website text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    district_id uuid,
    n_type_id uuid,
    created_by_id uuid
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: target_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.target_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    amount numeric(12,2),
    financial_year text,
    gross_profit numeric(12,2),
    sales numeric(12,2),
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    financial_year_id uuid
);


ALTER TABLE public.target_sales OWNER TO postgres;

--
-- Name: team_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    display text,
    is_bwf boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.team_types OWNER TO postgres;

--
-- Name: tender_bids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_bids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    bid_price numeric(12,2),
    final_price numeric(12,2),
    pdf_file text,
    rating_attitude numeric(5,2),
    rating_communication numeric(5,2),
    rating_cost numeric(5,2),
    rating_design numeric(5,2),
    rating_overall numeric(5,2),
    rating_past_coop numeric(5,2),
    rating_past_experience numeric(5,2),
    rating_qualification numeric(5,2),
    rating_time_consumption numeric(5,2),
    staff_internal_reason text,
    staff_short_respond text,
    status text,
    submission_date timestamp with time zone,
    supplier text,
    tender text,
    tender_deadline timestamp with time zone,
    witness text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    witness_id uuid
);


ALTER TABLE public.tender_bids OWNER TO postgres;

--
-- Name: tender_message_bids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_message_bids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    bid_id text
);


ALTER TABLE public.tender_message_bids OWNER TO postgres;

--
-- Name: tender_message_receivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_message_receivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    receiver_id text
);


ALTER TABLE public.tender_message_receivers OWNER TO postgres;

--
-- Name: tender_message_seen; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_message_seen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text,
    seen_id text
);


ALTER TABLE public.tender_message_seen OWNER TO postgres;

--
-- Name: tender_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    attachment text,
    bids text,
    message text,
    receiver_list text,
    receiver_type text,
    removed boolean,
    reply_to text,
    seen_list text,
    sender_name text,
    sender_type text,
    tender text,
    type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    bids_id uuid,
    reply_to_id uuid
);


ALTER TABLE public.tender_messages OWNER TO postgres;

--
-- Name: tender_rejected_suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_rejected_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id text,
    supplier_id uuid
);


ALTER TABLE public.tender_rejected_suppliers OWNER TO postgres;

--
-- Name: tender_responds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_responds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    briefing_date_change timestamp with time zone,
    briefing_participant_count integer,
    briefing_session_reply text,
    respond text,
    site_visit_date_change timestamp with time zone,
    site_visit_participant_count integer,
    site_visit_reply text,
    supplier text,
    tender text,
    tender_respond_type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.tender_responds OWNER TO postgres;

--
-- Name: tender_seen; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_seen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id text,
    seen_id text
);


ALTER TABLE public.tender_seen OWNER TO postgres;

--
-- Name: tender_selective_suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender_selective_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_id text,
    supplier_id uuid
);


ALTER TABLE public.tender_selective_suppliers OWNER TO postgres;

--
-- Name: tenders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    additional_information text,
    bwf_pitching text,
    bwf_project text,
    briefing_session_date timestamp with time zone,
    briefing_session_location text,
    budget numeric(12,2),
    drawing_designer text,
    dropbox_link text,
    est_end_date timestamp with time zone,
    est_start_date timestamp with time zone,
    files text,
    image_1 text,
    image_2 text,
    image_3 text,
    pdf_requirement text,
    pitching text,
    project text,
    project_description text,
    project_type text,
    rating_attitude_pct numeric(5,2),
    rating_communication_pct numeric(5,2),
    rating_cost_pct numeric(5,2),
    rating_design_pct numeric(5,2),
    rating_past_coop_pct numeric(5,2),
    rating_past_experience_pct numeric(5,2),
    rating_qualification_pct numeric(5,2),
    rating_time_consumption_pct numeric(5,2),
    rejected_supplier text,
    seen_list text,
    selective_supplier text,
    site_visit_date timestamp with time zone,
    supplier_type text,
    tender_code text,
    tender_deadline timestamp with time zone,
    tender_deadline_b4_extend timestamp with time zone,
    tender_name text,
    tender_type text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    drawing_designer_id uuid,
    supplier_type_id uuid,
    project_type_id uuid
);


ALTER TABLE public.tenders OWNER TO postgres;

--
-- Name: term_template_section_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.term_template_section_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    description text,
    template_name text,
    template_section text,
    term_head text,
    total text,
    number text,
    "order" integer,
    star boolean,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    template_name_id uuid,
    template_section_id uuid
);


ALTER TABLE public.term_template_section_details OWNER TO postgres;

--
-- Name: term_template_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.term_template_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    head_name text,
    "order" integer,
    template_name text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    template_name_id uuid
);


ALTER TABLE public.term_template_sections OWNER TO postgres;

--
-- Name: term_template_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.term_template_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    default_chi text,
    default_eng text,
    lan text,
    name text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text
);


ALTER TABLE public.term_template_types OWNER TO postgres;

--
-- Name: three_d_collection_liked_staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.three_d_collection_liked_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id text,
    staff_id text
);


ALTER TABLE public.three_d_collection_liked_staff OWNER TO postgres;

--
-- Name: three_d_collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.three_d_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    collab_designer text,
    description text,
    display_name text,
    liked_staff text,
    likes_count integer,
    main_designer text,
    o_3d_status text,
    r_pitching text,
    r_project text,
    real_created_date timestamp with time zone,
    tags text,
    version_number integer,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    collab_designer_id uuid,
    main_designer_id uuid,
    r_pitching_id uuid,
    r_project_id uuid,
    created_by_id uuid
);


ALTER TABLE public.three_d_collections OWNER TO postgres;

--
-- Name: three_d_renders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.three_d_renders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    image text,
    "order" integer,
    pitching text,
    project text,
    r_3d_collection text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    slug text,
    pitching_id uuid,
    project_id uuid,
    r_3d_collection_id uuid,
    created_by_id uuid
);


ALTER TABLE public.three_d_renders OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bubble_id text,
    slug text,
    created_by text,
    created_date timestamp with time zone,
    modified_date timestamp with time zone,
    two_fa_code text,
    ip text,
    member text,
    supplier text,
    user_type text,
    view_system text,
    special text,
    member_id uuid,
    supplier_id uuid,
    created_by_id uuid,
    customer text,
    customer_id uuid,
    email text,
    auth_user_id uuid,
    is_developer boolean DEFAULT false NOT NULL,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    last_login_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.is_developer; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.is_developer IS 'When true, this auth user may impersonate (switch to) other staff accounts in-app without logging out. Checked against the real logged-in email, never the impersonated staff.';


--
-- Name: COLUMN users.approval_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.approval_status IS 'Account approval state: pending | approved. New users auto-created on first login start as pending and are gated to /pending-approval until an admin approves them.';


--
-- Name: COLUMN users.last_login_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.last_login_at IS 'Updated on each successful PMS login.';


--
-- Name: ai_prompt_by_project_types ai_prompt_by_project_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_prompt_by_project_types
    ADD CONSTRAINT ai_prompt_by_project_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: ai_prompt_by_project_types ai_prompt_by_project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_prompt_by_project_types
    ADD CONSTRAINT ai_prompt_by_project_types_pkey PRIMARY KEY (id);


--
-- Name: ai_quote_demo_items ai_quote_demo_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_demo_items
    ADD CONSTRAINT ai_quote_demo_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: ai_quote_demo_items ai_quote_demo_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_demo_items
    ADD CONSTRAINT ai_quote_demo_items_pkey PRIMARY KEY (id);


--
-- Name: ai_quote_sub_item_details ai_quote_sub_item_details_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_item_details
    ADD CONSTRAINT ai_quote_sub_item_details_bubble_id_key UNIQUE (bubble_id);


--
-- Name: ai_quote_sub_item_details ai_quote_sub_item_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_item_details
    ADD CONSTRAINT ai_quote_sub_item_details_pkey PRIMARY KEY (id);


--
-- Name: ai_quote_sub_items ai_quote_sub_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_items
    ADD CONSTRAINT ai_quote_sub_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: ai_quote_sub_items ai_quote_sub_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_items
    ADD CONSTRAINT ai_quote_sub_items_pkey PRIMARY KEY (id);


--
-- Name: ai_quotes ai_quotes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quotes
    ADD CONSTRAINT ai_quotes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: ai_quotes ai_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quotes
    ADD CONSTRAINT ai_quotes_pkey PRIMARY KEY (id);


--
-- Name: ap_report_remarks ap_report_remarks_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ap_report_remarks
    ADD CONSTRAINT ap_report_remarks_bubble_id_key UNIQUE (bubble_id);


--
-- Name: ap_report_remarks ap_report_remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ap_report_remarks
    ADD CONSTRAINT ap_report_remarks_pkey PRIMARY KEY (id);


--
-- Name: asana_oauth_tokens asana_oauth_tokens_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asana_oauth_tokens
    ADD CONSTRAINT asana_oauth_tokens_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: asana_oauth_tokens asana_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asana_oauth_tokens
    ADD CONSTRAINT asana_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: blocked_views blocked_views_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_views
    ADD CONSTRAINT blocked_views_bubble_id_key UNIQUE (bubble_id);


--
-- Name: blocked_views blocked_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_views
    ADD CONSTRAINT blocked_views_pkey PRIMARY KEY (id);


--
-- Name: building_comments building_comments_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT building_comments_bubble_id_key UNIQUE (bubble_id);


--
-- Name: building_comments building_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT building_comments_pkey PRIMARY KEY (id);


--
-- Name: building_contacts building_contacts_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_contacts
    ADD CONSTRAINT building_contacts_bubble_id_key UNIQUE (bubble_id);


--
-- Name: building_contacts building_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_contacts
    ADD CONSTRAINT building_contacts_pkey PRIMARY KEY (id);


--
-- Name: building_files building_files_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_files
    ADD CONSTRAINT building_files_bubble_id_key UNIQUE (bubble_id);


--
-- Name: building_files building_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_files
    ADD CONSTRAINT building_files_pkey PRIMARY KEY (id);


--
-- Name: buildings buildings_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_bubble_id_key UNIQUE (bubble_id);


--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);


--
-- Name: bwa_pitching_project_types bwa_pitching_project_types_pitching_id_project_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitching_project_types
    ADD CONSTRAINT bwa_pitching_project_types_pitching_id_project_type_id_key UNIQUE (pitching_id, project_type_id);


--
-- Name: bwa_pitching_project_types bwa_pitching_project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitching_project_types
    ADD CONSTRAINT bwa_pitching_project_types_pkey PRIMARY KEY (id);


--
-- Name: bwa_pitching_service_types bwa_pitching_service_types_pitching_id_service_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitching_service_types
    ADD CONSTRAINT bwa_pitching_service_types_pitching_id_service_type_id_key UNIQUE (pitching_id, service_type_id);


--
-- Name: bwa_pitching_service_types bwa_pitching_service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitching_service_types
    ADD CONSTRAINT bwa_pitching_service_types_pkey PRIMARY KEY (id);


--
-- Name: bwa_pitchings bwa_pitchings_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT bwa_pitchings_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwa_pitchings bwa_pitchings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT bwa_pitchings_pkey PRIMARY KEY (id);


--
-- Name: bwa_project_project_types bwa_project_project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_project_project_types
    ADD CONSTRAINT bwa_project_project_types_pkey PRIMARY KEY (id);


--
-- Name: bwa_project_project_types bwa_project_project_types_project_id_project_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_project_project_types
    ADD CONSTRAINT bwa_project_project_types_project_id_project_type_id_key UNIQUE (project_id, project_type_id);


--
-- Name: bwa_project_service_types bwa_project_service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_project_service_types
    ADD CONSTRAINT bwa_project_service_types_pkey PRIMARY KEY (id);


--
-- Name: bwa_project_service_types bwa_project_service_types_project_id_service_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_project_service_types
    ADD CONSTRAINT bwa_project_service_types_project_id_service_type_id_key UNIQUE (project_id, service_type_id);


--
-- Name: bwa_projects bwa_projects_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT bwa_projects_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwa_projects bwa_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT bwa_projects_pkey PRIMARY KEY (id);


--
-- Name: bwf_major_quotes bwf_major_quotes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_major_quotes
    ADD CONSTRAINT bwf_major_quotes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwf_major_quotes bwf_major_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_major_quotes
    ADD CONSTRAINT bwf_major_quotes_pkey PRIMARY KEY (id);


--
-- Name: bwf_orders bwf_orders_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT bwf_orders_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwf_orders bwf_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT bwf_orders_pkey PRIMARY KEY (id);


--
-- Name: bwf_pitching_bwf_service_types bwf_pitching_bwf_service_types_pitching_id_service_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitching_bwf_service_types
    ADD CONSTRAINT bwf_pitching_bwf_service_types_pitching_id_service_type_id_key UNIQUE (pitching_id, service_type_id);


--
-- Name: bwf_pitching_bwf_service_types bwf_pitching_bwf_service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitching_bwf_service_types
    ADD CONSTRAINT bwf_pitching_bwf_service_types_pkey PRIMARY KEY (id);


--
-- Name: bwf_pitching_major_quotes bwf_pitching_major_quotes_pitching_id_major_quote_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitching_major_quotes
    ADD CONSTRAINT bwf_pitching_major_quotes_pitching_id_major_quote_id_key UNIQUE (pitching_id, major_quote_id);


--
-- Name: bwf_pitching_major_quotes bwf_pitching_major_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitching_major_quotes
    ADD CONSTRAINT bwf_pitching_major_quotes_pkey PRIMARY KEY (id);


--
-- Name: bwf_pitching_service_items bwf_pitching_service_items_pitching_id_service_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitching_service_items
    ADD CONSTRAINT bwf_pitching_service_items_pitching_id_service_item_id_key UNIQUE (pitching_id, service_item_id);


--
-- Name: bwf_pitching_service_items bwf_pitching_service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitching_service_items
    ADD CONSTRAINT bwf_pitching_service_items_pkey PRIMARY KEY (id);


--
-- Name: bwf_pitchings bwf_pitchings_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT bwf_pitchings_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwf_pitchings bwf_pitchings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT bwf_pitchings_pkey PRIMARY KEY (id);


--
-- Name: bwf_product_master bwf_product_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_product_master
    ADD CONSTRAINT bwf_product_master_pkey PRIMARY KEY (id);


--
-- Name: bwf_product_product_types bwf_product_product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_product_product_types
    ADD CONSTRAINT bwf_product_product_types_pkey PRIMARY KEY (id);


--
-- Name: bwf_product_product_types bwf_product_product_types_product_id_product_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_product_product_types
    ADD CONSTRAINT bwf_product_product_types_product_id_product_type_id_key UNIQUE (product_id, product_type_id);


--
-- Name: bwf_products bwf_products_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_products
    ADD CONSTRAINT bwf_products_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwf_products bwf_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_products
    ADD CONSTRAINT bwf_products_pkey PRIMARY KEY (id);


--
-- Name: bwf_project_bwf_service_types bwf_project_bwf_service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_bwf_service_types
    ADD CONSTRAINT bwf_project_bwf_service_types_pkey PRIMARY KEY (id);


--
-- Name: bwf_project_bwf_service_types bwf_project_bwf_service_types_project_id_service_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_bwf_service_types
    ADD CONSTRAINT bwf_project_bwf_service_types_project_id_service_type_id_key UNIQUE (project_id, service_type_id);


--
-- Name: bwf_project_factories bwf_project_factories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_factories
    ADD CONSTRAINT bwf_project_factories_pkey PRIMARY KEY (id);


--
-- Name: bwf_project_factories bwf_project_factories_project_id_factory_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_factories
    ADD CONSTRAINT bwf_project_factories_project_id_factory_id_key UNIQUE (project_id, factory_id);


--
-- Name: bwf_project_major_quotes bwf_project_major_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_major_quotes
    ADD CONSTRAINT bwf_project_major_quotes_pkey PRIMARY KEY (id);


--
-- Name: bwf_project_major_quotes bwf_project_major_quotes_project_id_major_quote_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_major_quotes
    ADD CONSTRAINT bwf_project_major_quotes_project_id_major_quote_id_key UNIQUE (project_id, major_quote_id);


--
-- Name: bwf_project_service_items bwf_project_service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_service_items
    ADD CONSTRAINT bwf_project_service_items_pkey PRIMARY KEY (id);


--
-- Name: bwf_project_service_items bwf_project_service_items_project_id_service_item_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_service_items
    ADD CONSTRAINT bwf_project_service_items_project_id_service_item_id_key UNIQUE (project_id, service_item_id);


--
-- Name: bwf_project_suppliers bwf_project_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_suppliers
    ADD CONSTRAINT bwf_project_suppliers_pkey PRIMARY KEY (id);


--
-- Name: bwf_project_suppliers bwf_project_suppliers_project_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_suppliers
    ADD CONSTRAINT bwf_project_suppliers_project_id_supplier_id_key UNIQUE (project_id, supplier_id);


--
-- Name: bwf_projects bwf_projects_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT bwf_projects_bubble_id_key UNIQUE (bubble_id);


--
-- Name: bwf_projects bwf_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT bwf_projects_pkey PRIMARY KEY (id);


--
-- Name: client_types client_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_types
    ADD CONSTRAINT client_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: client_types client_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_types
    ADD CONSTRAINT client_types_pkey PRIMARY KEY (id);


--
-- Name: cost_centres cost_centres_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_centres
    ADD CONSTRAINT cost_centres_bubble_id_key UNIQUE (bubble_id);


--
-- Name: cost_centres cost_centres_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_centres
    ADD CONSTRAINT cost_centres_pkey PRIMARY KEY (id);


--
-- Name: cr_event_detail_staff cr_event_detail_staff_cr_event_detail_id_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_detail_staff
    ADD CONSTRAINT cr_event_detail_staff_cr_event_detail_id_staff_id_key UNIQUE (cr_event_detail_id, staff_id);


--
-- Name: cr_event_detail_staff cr_event_detail_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_detail_staff
    ADD CONSTRAINT cr_event_detail_staff_pkey PRIMARY KEY (id);


--
-- Name: cr_event_details cr_event_details_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT cr_event_details_bubble_id_key UNIQUE (bubble_id);


--
-- Name: cr_event_details cr_event_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT cr_event_details_pkey PRIMARY KEY (id);


--
-- Name: cr_gift_items cr_gift_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_gift_items
    ADD CONSTRAINT cr_gift_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: cr_gift_items cr_gift_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_gift_items
    ADD CONSTRAINT cr_gift_items_pkey PRIMARY KEY (id);


--
-- Name: customer_comments customer_comments_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT customer_comments_bubble_id_key UNIQUE (bubble_id);


--
-- Name: customer_comments customer_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT customer_comments_pkey PRIMARY KEY (id);


--
-- Name: customer_cr_events customer_cr_events_customer_id_cr_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_cr_events
    ADD CONSTRAINT customer_cr_events_customer_id_cr_event_id_key UNIQUE (customer_id, cr_event_id);


--
-- Name: customer_cr_events customer_cr_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_cr_events
    ADD CONSTRAINT customer_cr_events_pkey PRIMARY KEY (id);


--
-- Name: customer_document_types customer_document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_document_types
    ADD CONSTRAINT customer_document_types_pkey PRIMARY KEY (id);


--
-- Name: customer_document_types customer_document_types_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_document_types
    ADD CONSTRAINT customer_document_types_type_key UNIQUE (type);


--
-- Name: customer_document_types customer_document_types_type_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_document_types
    ADD CONSTRAINT customer_document_types_type_key_key UNIQUE (type_key);


--
-- Name: customer_documents customer_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_documents
    ADD CONSTRAINT customer_documents_pkey PRIMARY KEY (id);


--
-- Name: customer_documents customer_documents_source_project_document_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_documents
    ADD CONSTRAINT customer_documents_source_project_document_id_key UNIQUE (source_project_document_id);


--
-- Name: customer_relations customer_relations_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_relations
    ADD CONSTRAINT customer_relations_bubble_id_key UNIQUE (bubble_id);


--
-- Name: customer_relations customer_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_relations
    ADD CONSTRAINT customer_relations_pkey PRIMARY KEY (id);


--
-- Name: customer_tags customer_tags_customer_id_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_customer_id_tag_id_key UNIQUE (customer_id, tag_id);


--
-- Name: customer_tags customer_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT customer_tags_pkey PRIMARY KEY (id);


--
-- Name: customers customers_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_bubble_id_key UNIQUE (bubble_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: daily_task_logs daily_task_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_task_logs
    ADD CONSTRAINT daily_task_logs_pkey PRIMARY KEY (id);


--
-- Name: dashboard_sentences dashboard_sentences_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_sentences
    ADD CONSTRAINT dashboard_sentences_bubble_id_key UNIQUE (bubble_id);


--
-- Name: dashboard_sentences dashboard_sentences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_sentences
    ADD CONSTRAINT dashboard_sentences_pkey PRIMARY KEY (id);


--
-- Name: default_quote_details default_quote_details_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_details
    ADD CONSTRAINT default_quote_details_bubble_id_key UNIQUE (bubble_id);


--
-- Name: default_quote_details default_quote_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_details
    ADD CONSTRAINT default_quote_details_pkey PRIMARY KEY (id);


--
-- Name: default_quote_mains default_quote_mains_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_mains
    ADD CONSTRAINT default_quote_mains_bubble_id_key UNIQUE (bubble_id);


--
-- Name: default_quote_mains default_quote_mains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_mains
    ADD CONSTRAINT default_quote_mains_pkey PRIMARY KEY (id);


--
-- Name: default_quote_sections default_quote_sections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_sections
    ADD CONSTRAINT default_quote_sections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: default_quote_sections default_quote_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_sections
    ADD CONSTRAINT default_quote_sections_pkey PRIMARY KEY (id);


--
-- Name: design_jobs design_jobs_pitching_source_task_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_jobs
    ADD CONSTRAINT design_jobs_pitching_source_task_unique UNIQUE (pitching_id, source, nos_task_id);


--
-- Name: design_jobs design_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_jobs
    ADD CONSTRAINT design_jobs_pkey PRIMARY KEY (id);


--
-- Name: districts districts_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_bubble_id_key UNIQUE (bubble_id);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


--
-- Name: expense_control_waivers expense_control_waivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_control_waivers
    ADD CONSTRAINT expense_control_waivers_pkey PRIMARY KEY (id);


--
-- Name: expense_product_types expense_product_types_expense_id_product_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_product_types
    ADD CONSTRAINT expense_product_types_expense_id_product_type_id_key UNIQUE (expense_id, product_type_id);


--
-- Name: expense_product_types expense_product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_product_types
    ADD CONSTRAINT expense_product_types_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_bubble_id_key UNIQUE (bubble_id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: factories factories_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factories
    ADD CONSTRAINT factories_bubble_id_key UNIQUE (bubble_id);


--
-- Name: factories factories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factories
    ADD CONSTRAINT factories_pkey PRIMARY KEY (id);


--
-- Name: factory_files factory_files_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factory_files
    ADD CONSTRAINT factory_files_bubble_id_key UNIQUE (bubble_id);


--
-- Name: factory_files factory_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factory_files
    ADD CONSTRAINT factory_files_pkey PRIMARY KEY (id);


--
-- Name: financial_years financial_years_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_bubble_id_key UNIQUE (bubble_id);


--
-- Name: financial_years financial_years_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_pkey PRIMARY KEY (id);


--
-- Name: income_expiry_reasons income_expiry_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_expiry_reasons
    ADD CONSTRAINT income_expiry_reasons_pkey PRIMARY KEY (id);


--
-- Name: income_invoices income_invoices_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_invoices
    ADD CONSTRAINT income_invoices_bubble_id_key UNIQUE (bubble_id);


--
-- Name: income_invoices income_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_invoices
    ADD CONSTRAINT income_invoices_pkey PRIMARY KEY (id);


--
-- Name: incomes incomes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: incomes incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);


--
-- Name: internal_comments internal_comments_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT internal_comments_bubble_id_key UNIQUE (bubble_id);


--
-- Name: internal_comments internal_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT internal_comments_pkey PRIMARY KEY (id);


--
-- Name: invoice_sub_items invoice_sub_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_sub_items
    ADD CONSTRAINT invoice_sub_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: invoice_sub_items invoice_sub_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_sub_items
    ADD CONSTRAINT invoice_sub_items_pkey PRIMARY KEY (id);


--
-- Name: login_logs login_logs_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_bubble_id_key UNIQUE (bubble_id);


--
-- Name: login_logs login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);


--
-- Name: man_hour_dates man_hour_dates_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_dates
    ADD CONSTRAINT man_hour_dates_bubble_id_key UNIQUE (bubble_id);


--
-- Name: man_hour_dates man_hour_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_dates
    ADD CONSTRAINT man_hour_dates_pkey PRIMARY KEY (id);


--
-- Name: man_hour_pinned man_hour_pinned_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_pinned
    ADD CONSTRAINT man_hour_pinned_pkey PRIMARY KEY (id);


--
-- Name: man_hour_tasks man_hour_tasks_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_tasks
    ADD CONSTRAINT man_hour_tasks_bubble_id_key UNIQUE (bubble_id);


--
-- Name: man_hour_tasks man_hour_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_tasks
    ADD CONSTRAINT man_hour_tasks_pkey PRIMARY KEY (id);


--
-- Name: news news_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_bubble_id_key UNIQUE (bubble_id);


--
-- Name: news_comment_liked_members news_comment_liked_members_comment_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comment_liked_members
    ADD CONSTRAINT news_comment_liked_members_comment_id_member_id_key UNIQUE (comment_id, member_id);


--
-- Name: news_comment_liked_members news_comment_liked_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comment_liked_members
    ADD CONSTRAINT news_comment_liked_members_pkey PRIMARY KEY (id);


--
-- Name: news_comments news_comments_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT news_comments_bubble_id_key UNIQUE (bubble_id);


--
-- Name: news_comments news_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT news_comments_pkey PRIMARY KEY (id);


--
-- Name: news_liked_members news_liked_members_news_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_liked_members
    ADD CONSTRAINT news_liked_members_news_id_member_id_key UNIQUE (news_id, member_id);


--
-- Name: news_liked_members news_liked_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_liked_members
    ADD CONSTRAINT news_liked_members_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: news_types news_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_types
    ADD CONSTRAINT news_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: news_types news_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_types
    ADD CONSTRAINT news_types_pkey PRIMARY KEY (id);


--
-- Name: nos_ai_quote_types nos_ai_quote_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_quote_types
    ADD CONSTRAINT nos_ai_quote_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_ai_quote_types nos_ai_quote_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_quote_types
    ADD CONSTRAINT nos_ai_quote_types_pkey PRIMARY KEY (id);


--
-- Name: nos_ai_tool_types nos_ai_tool_types_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_tool_types
    ADD CONSTRAINT nos_ai_tool_types_code_key UNIQUE (code);


--
-- Name: nos_ai_tool_types nos_ai_tool_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_tool_types
    ADD CONSTRAINT nos_ai_tool_types_pkey PRIMARY KEY (id);


--
-- Name: nos_ai_tools nos_ai_tools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_tools
    ADD CONSTRAINT nos_ai_tools_pkey PRIMARY KEY (id);


--
-- Name: nos_brands nos_brands_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_brands
    ADD CONSTRAINT nos_brands_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_brands nos_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_brands
    ADD CONSTRAINT nos_brands_pkey PRIMARY KEY (id);


--
-- Name: nos_bv_values nos_bv_values_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_bv_values
    ADD CONSTRAINT nos_bv_values_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_bv_values nos_bv_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_bv_values
    ADD CONSTRAINT nos_bv_values_pkey PRIMARY KEY (id);


--
-- Name: nos_contracts nos_contracts_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_contracts
    ADD CONSTRAINT nos_contracts_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_contracts nos_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_contracts
    ADD CONSTRAINT nos_contracts_pkey PRIMARY KEY (id);


--
-- Name: nos_cr_delivery_methods nos_cr_delivery_methods_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_delivery_methods
    ADD CONSTRAINT nos_cr_delivery_methods_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_cr_delivery_methods nos_cr_delivery_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_delivery_methods
    ADD CONSTRAINT nos_cr_delivery_methods_pkey PRIMARY KEY (id);


--
-- Name: nos_cr_event_themes nos_cr_event_themes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_event_themes
    ADD CONSTRAINT nos_cr_event_themes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_cr_event_themes nos_cr_event_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_event_themes
    ADD CONSTRAINT nos_cr_event_themes_pkey PRIMARY KEY (id);


--
-- Name: nos_cr_event_types nos_cr_event_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_event_types
    ADD CONSTRAINT nos_cr_event_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_cr_event_types nos_cr_event_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_event_types
    ADD CONSTRAINT nos_cr_event_types_pkey PRIMARY KEY (id);


--
-- Name: nos_customer_purpose nos_customer_purpose_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_purpose
    ADD CONSTRAINT nos_customer_purpose_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_customer_purpose nos_customer_purpose_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_purpose
    ADD CONSTRAINT nos_customer_purpose_pkey PRIMARY KEY (id);


--
-- Name: nos_customer_tags nos_customer_tags_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags
    ADD CONSTRAINT nos_customer_tags_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_customer_tags_collection nos_customer_tags_collection_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags_collection
    ADD CONSTRAINT nos_customer_tags_collection_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_customer_tags_collection nos_customer_tags_collection_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags_collection
    ADD CONSTRAINT nos_customer_tags_collection_pkey PRIMARY KEY (id);


--
-- Name: nos_customer_tags nos_customer_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags
    ADD CONSTRAINT nos_customer_tags_pkey PRIMARY KEY (id);


--
-- Name: nos_defect_causes nos_defect_causes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_defect_causes
    ADD CONSTRAINT nos_defect_causes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_defect_causes nos_defect_causes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_defect_causes
    ADD CONSTRAINT nos_defect_causes_pkey PRIMARY KEY (id);


--
-- Name: nos_doc_types nos_doc_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_doc_types
    ADD CONSTRAINT nos_doc_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_doc_types nos_doc_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_doc_types
    ADD CONSTRAINT nos_doc_types_pkey PRIMARY KEY (id);


--
-- Name: nos_item_quote_project_types nos_item_quote_project_types_nos_item_id_quote_project_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_item_quote_project_types
    ADD CONSTRAINT nos_item_quote_project_types_nos_item_id_quote_project_type_key UNIQUE (nos_item_id, quote_project_type_id);


--
-- Name: nos_item_quote_project_types nos_item_quote_project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_item_quote_project_types
    ADD CONSTRAINT nos_item_quote_project_types_pkey PRIMARY KEY (id);


--
-- Name: nos_items nos_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_items
    ADD CONSTRAINT nos_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_items nos_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_items
    ADD CONSTRAINT nos_items_pkey PRIMARY KEY (id);


--
-- Name: nos_payment_methods nos_payment_methods_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_payment_methods
    ADD CONSTRAINT nos_payment_methods_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_payment_methods nos_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_payment_methods
    ADD CONSTRAINT nos_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: nos_quote_project_types nos_quote_project_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_quote_project_types
    ADD CONSTRAINT nos_quote_project_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_quote_project_types nos_quote_project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_quote_project_types
    ADD CONSTRAINT nos_quote_project_types_pkey PRIMARY KEY (id);


--
-- Name: nos_regions nos_regions_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_regions
    ADD CONSTRAINT nos_regions_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_regions nos_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_regions
    ADD CONSTRAINT nos_regions_pkey PRIMARY KEY (id);


--
-- Name: nos_sections nos_sections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_sections
    ADD CONSTRAINT nos_sections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_sections nos_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_sections
    ADD CONSTRAINT nos_sections_pkey PRIMARY KEY (id);


--
-- Name: nos_service_type_2 nos_service_type_2_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_service_type_2
    ADD CONSTRAINT nos_service_type_2_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_service_type_2 nos_service_type_2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_service_type_2
    ADD CONSTRAINT nos_service_type_2_pkey PRIMARY KEY (id);


--
-- Name: nos_site_status_items nos_site_status_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_site_status_items
    ADD CONSTRAINT nos_site_status_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_site_status_items nos_site_status_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_site_status_items
    ADD CONSTRAINT nos_site_status_items_pkey PRIMARY KEY (id);


--
-- Name: nos_supplier_tags nos_supplier_tags_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_supplier_tags
    ADD CONSTRAINT nos_supplier_tags_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_supplier_tags nos_supplier_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_supplier_tags
    ADD CONSTRAINT nos_supplier_tags_pkey PRIMARY KEY (id);


--
-- Name: nos_task_types nos_task_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_task_types
    ADD CONSTRAINT nos_task_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_task_types nos_task_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_task_types
    ADD CONSTRAINT nos_task_types_pkey PRIMARY KEY (id);


--
-- Name: nos_tasks nos_tasks_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_tasks
    ADD CONSTRAINT nos_tasks_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_tasks nos_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_tasks
    ADD CONSTRAINT nos_tasks_pkey PRIMARY KEY (id);


--
-- Name: nos_template_items nos_template_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_items
    ADD CONSTRAINT nos_template_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_template_items nos_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_items
    ADD CONSTRAINT nos_template_items_pkey PRIMARY KEY (id);


--
-- Name: nos_template_sections nos_template_sections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_sections
    ADD CONSTRAINT nos_template_sections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_template_sections nos_template_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_sections
    ADD CONSTRAINT nos_template_sections_pkey PRIMARY KEY (id);


--
-- Name: nos_templates nos_templates_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_templates
    ADD CONSTRAINT nos_templates_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_templates nos_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_templates
    ADD CONSTRAINT nos_templates_pkey PRIMARY KEY (id);


--
-- Name: nos_tender_reject_presets nos_tender_reject_presets_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_tender_reject_presets
    ADD CONSTRAINT nos_tender_reject_presets_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_tender_reject_presets nos_tender_reject_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_tender_reject_presets
    ADD CONSTRAINT nos_tender_reject_presets_pkey PRIMARY KEY (id);


--
-- Name: nos_units nos_units_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_units
    ADD CONSTRAINT nos_units_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_units nos_units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_units
    ADD CONSTRAINT nos_units_pkey PRIMARY KEY (id);


--
-- Name: nos_website_functions nos_website_functions_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_website_functions
    ADD CONSTRAINT nos_website_functions_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_website_functions nos_website_functions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_website_functions
    ADD CONSTRAINT nos_website_functions_pkey PRIMARY KEY (id);


--
-- Name: nos_work_locations nos_work_locations_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_work_locations
    ADD CONSTRAINT nos_work_locations_bubble_id_key UNIQUE (bubble_id);


--
-- Name: nos_work_locations nos_work_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_work_locations
    ADD CONSTRAINT nos_work_locations_pkey PRIMARY KEY (id);


--
-- Name: notification_seen notification_seen_notification_id_seen_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_seen
    ADD CONSTRAINT notification_seen_notification_id_seen_id_key UNIQUE (notification_id, seen_id);


--
-- Name: notification_seen notification_seen_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_seen
    ADD CONSTRAINT notification_seen_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: outstanding_remarks outstanding_remarks_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outstanding_remarks
    ADD CONSTRAINT outstanding_remarks_bubble_id_key UNIQUE (bubble_id);


--
-- Name: outstanding_remarks outstanding_remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outstanding_remarks
    ADD CONSTRAINT outstanding_remarks_pkey PRIMARY KEY (id);


--
-- Name: permission_assignments permission_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permission_assignments
    ADD CONSTRAINT permission_assignments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_module_action_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_module_action_key UNIQUE (module, action);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pitching_bv pitching_bv_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_bv
    ADD CONSTRAINT pitching_bv_bubble_id_key UNIQUE (bubble_id);


--
-- Name: pitching_bv pitching_bv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_bv
    ADD CONSTRAINT pitching_bv_pkey PRIMARY KEY (id);


--
-- Name: pitching_close_reasons pitching_close_reasons_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_close_reasons
    ADD CONSTRAINT pitching_close_reasons_bubble_id_key UNIQUE (bubble_id);


--
-- Name: pitching_close_reasons pitching_close_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_close_reasons
    ADD CONSTRAINT pitching_close_reasons_pkey PRIMARY KEY (id);


--
-- Name: po_sub_items po_sub_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_sub_items
    ADD CONSTRAINT po_sub_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: po_sub_items po_sub_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.po_sub_items
    ADD CONSTRAINT po_sub_items_pkey PRIMARY KEY (id);


--
-- Name: product_types product_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: product_types product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_pkey PRIMARY KEY (id);


--
-- Name: project_bv project_bv_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT project_bv_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_bv project_bv_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT project_bv_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_documents project_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);


--
-- Name: project_initial_expenses project_initial_expenses_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_initial_expenses
    ADD CONSTRAINT project_initial_expenses_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_initial_expenses project_initial_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_initial_expenses
    ADD CONSTRAINT project_initial_expenses_pkey PRIMARY KEY (id);


--
-- Name: project_schedules project_schedule_tasks_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT project_schedule_tasks_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_schedules project_schedule_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT project_schedule_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_schedule_tasks project_schedules_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedule_tasks
    ADD CONSTRAINT project_schedules_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_schedule_tasks project_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedule_tasks
    ADD CONSTRAINT project_schedules_pkey PRIMARY KEY (id);


--
-- Name: project_types project_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_types project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_pkey PRIMARY KEY (id);


--
-- Name: project_weekly_reports project_weekly_reports_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_weekly_reports
    ADD CONSTRAINT project_weekly_reports_bubble_id_key UNIQUE (bubble_id);


--
-- Name: project_weekly_reports project_weekly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_weekly_reports
    ADD CONSTRAINT project_weekly_reports_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_bubble_id_key UNIQUE (bubble_id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: q_term_section_details q_term_section_details_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_section_details
    ADD CONSTRAINT q_term_section_details_bubble_id_key UNIQUE (bubble_id);


--
-- Name: q_term_section_details q_term_section_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_section_details
    ADD CONSTRAINT q_term_section_details_pkey PRIMARY KEY (id);


--
-- Name: q_term_sections q_term_sections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_sections
    ADD CONSTRAINT q_term_sections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: q_term_sections q_term_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_sections
    ADD CONSTRAINT q_term_sections_pkey PRIMARY KEY (id);


--
-- Name: qms_box_access_log qms_box_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_box_access_log
    ADD CONSTRAINT qms_box_access_log_pkey PRIMARY KEY (id);


--
-- Name: qms_cost_coverages qms_cost_coverages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_coverages
    ADD CONSTRAINT qms_cost_coverages_pkey PRIMARY KEY (id);


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_cost_line_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_cost_line_id_key UNIQUE (cost_line_id);


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_pkey PRIMARY KEY (id);


--
-- Name: qms_drawing_analyses qms_drawing_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_drawing_analyses
    ADD CONSTRAINT qms_drawing_analyses_pkey PRIMARY KEY (id);


--
-- Name: qms_drawing_analyses qms_drawing_analyses_storage_object_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_drawing_analyses
    ADD CONSTRAINT qms_drawing_analyses_storage_object_path_key UNIQUE (storage_object_path);


--
-- Name: qms_estimate_runs qms_estimate_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_estimate_runs
    ADD CONSTRAINT qms_estimate_runs_pkey PRIMARY KEY (id);


--
-- Name: qms_historical_quote_import_revisions qms_historical_quote_import_revisions_import_id_revision_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_import_revisions
    ADD CONSTRAINT qms_historical_quote_import_revisions_import_id_revision_no_key UNIQUE (import_id, revision_no);


--
-- Name: qms_historical_quote_import_revisions qms_historical_quote_import_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_import_revisions
    ADD CONSTRAINT qms_historical_quote_import_revisions_pkey PRIMARY KEY (id);


--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_owner_auth_user_id_sha256_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_imports
    ADD CONSTRAINT qms_historical_quote_imports_owner_auth_user_id_sha256_key UNIQUE (owner_auth_user_id, sha256);


--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_imports
    ADD CONSTRAINT qms_historical_quote_imports_pkey PRIMARY KEY (id);


--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_storage_object_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_imports
    ADD CONSTRAINT qms_historical_quote_imports_storage_object_path_key UNIQUE (storage_object_path);


--
-- Name: qms_item_professional_description_audit qms_item_professional_description_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_professional_description_audit
    ADD CONSTRAINT qms_item_professional_description_audit_pkey PRIMARY KEY (id);


--
-- Name: qms_item_professional_description_audit qms_item_professional_description_audit_revision_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_professional_description_audit
    ADD CONSTRAINT qms_item_professional_description_audit_revision_key UNIQUE (description_id, revision);


--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_item_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_professional_descriptions
    ADD CONSTRAINT qms_item_professional_descriptions_item_version_key UNIQUE (item_id, version_no);


--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_professional_descriptions
    ADD CONSTRAINT qms_item_professional_descriptions_pkey PRIMARY KEY (id);


--
-- Name: qms_item_variant_aliases qms_item_variant_aliases_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_variant_aliases
    ADD CONSTRAINT qms_item_variant_aliases_key UNIQUE (variant_id, normalized_alias);


--
-- Name: qms_item_variant_aliases qms_item_variant_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_variant_aliases
    ADD CONSTRAINT qms_item_variant_aliases_pkey PRIMARY KEY (id);


--
-- Name: qms_item_variants qms_item_variants_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_variants
    ADD CONSTRAINT qms_item_variants_key UNIQUE (standard_item_id, variant_key);


--
-- Name: qms_item_variants qms_item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_variants
    ADD CONSTRAINT qms_item_variants_pkey PRIMARY KEY (id);


--
-- Name: qms_page_permission_audit qms_page_permission_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_page_permission_audit
    ADD CONSTRAINT qms_page_permission_audit_pkey PRIMARY KEY (revision);


--
-- Name: qms_page_permission_settings qms_page_permission_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_page_permission_settings
    ADD CONSTRAINT qms_page_permission_settings_pkey PRIMARY KEY (id);


--
-- Name: qms_quotation_cost_revisions qms_quotation_cost_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_cost_revisions
    ADD CONSTRAINT qms_quotation_cost_revisions_pkey PRIMARY KEY (id);


--
-- Name: qms_quotation_cost_revisions qms_quotation_cost_revisions_quotation_id_cost_revision_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_cost_revisions
    ADD CONSTRAINT qms_quotation_cost_revisions_quotation_id_cost_revision_no_key UNIQUE (quotation_id, cost_revision_no);


--
-- Name: qms_quotation_industries qms_quotation_industries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_industries
    ADD CONSTRAINT qms_quotation_industries_pkey PRIMARY KEY (quotation_id);


--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_cost_bindings
    ADD CONSTRAINT qms_quotation_item_cost_bindings_pkey PRIMARY KEY (id);


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_current_quotation_section_ite_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_identities
    ADD CONSTRAINT qms_quotation_item_identities_current_quotation_section_ite_key UNIQUE (current_quotation_section_item_id);


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_identities
    ADD CONSTRAINT qms_quotation_item_identities_pkey PRIMARY KEY (id);


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_quotation_id_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_identities
    ADD CONSTRAINT qms_quotation_item_identities_quotation_id_id_key UNIQUE (quotation_id, id);


--
-- Name: qms_quotation_remarks qms_quotation_remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_remarks
    ADD CONSTRAINT qms_quotation_remarks_pkey PRIMARY KEY (quotation_id);


--
-- Name: qms_quotation_revisions qms_quotation_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_revisions
    ADD CONSTRAINT qms_quotation_revisions_pkey PRIMARY KEY (id);


--
-- Name: qms_quotation_revisions qms_quotation_revisions_quotation_id_archived_version_numbe_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_revisions
    ADD CONSTRAINT qms_quotation_revisions_quotation_id_archived_version_numbe_key UNIQUE (quotation_id, archived_version_number);


--
-- Name: qms_quotation_section_ordinals qms_quotation_section_ordinals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_ordinals
    ADD CONSTRAINT qms_quotation_section_ordinals_pkey PRIMARY KEY (section_id);


--
-- Name: qms_quotation_section_prices qms_quotation_section_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_prices
    ADD CONSTRAINT qms_quotation_section_prices_pkey PRIMARY KEY (section_id);


--
-- Name: qms_quotation_site_conditions qms_quotation_site_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_site_conditions
    ADD CONSTRAINT qms_quotation_site_conditions_pkey PRIMARY KEY (quotation_id);


--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_supplier_links
    ADD CONSTRAINT qms_quotation_supplier_links_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_audits qms_quote_cost_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_audits
    ADD CONSTRAINT qms_quote_cost_audits_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_lines qms_quote_cost_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_lines
    ADD CONSTRAINT qms_quote_cost_lines_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_packet_files qms_quote_cost_packet_files_packet_id_import_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packet_files
    ADD CONSTRAINT qms_quote_cost_packet_files_packet_id_import_id_key UNIQUE (packet_id, import_id);


--
-- Name: qms_quote_cost_packet_files qms_quote_cost_packet_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packet_files
    ADD CONSTRAINT qms_quote_cost_packet_files_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_packets qms_quote_cost_packets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packets
    ADD CONSTRAINT qms_quote_cost_packets_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_packets qms_quote_cost_packets_quotation_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packets
    ADD CONSTRAINT qms_quote_cost_packets_quotation_id_key UNIQUE (quotation_id);


--
-- Name: qms_quote_cost_scope_files qms_quote_cost_scope_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_files
    ADD CONSTRAINT qms_quote_cost_scope_files_pkey PRIMARY KEY (scope_id, packet_file_id);


--
-- Name: qms_quote_cost_scope_sources qms_quote_cost_scope_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_sources
    ADD CONSTRAINT qms_quote_cost_scope_sources_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_scopes qms_quote_cost_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scopes
    ADD CONSTRAINT qms_quote_cost_scopes_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_versions qms_quote_cost_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_versions
    ADD CONSTRAINT qms_quote_cost_versions_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_cost_versions qms_quote_cost_versions_quotation_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_versions
    ADD CONSTRAINT qms_quote_cost_versions_quotation_id_revision_key UNIQUE (quotation_id, revision);


--
-- Name: qms_quote_evaluations qms_quote_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_evaluations
    ADD CONSTRAINT qms_quote_evaluations_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_exclusion_options qms_quote_exclusion_options_label_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_exclusion_options
    ADD CONSTRAINT qms_quote_exclusion_options_label_key UNIQUE (label);


--
-- Name: qms_quote_exclusion_options qms_quote_exclusion_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_exclusion_options
    ADD CONSTRAINT qms_quote_exclusion_options_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_project_type_labels qms_quote_project_type_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_project_type_labels
    ADD CONSTRAINT qms_quote_project_type_labels_pkey PRIMARY KEY (source_name);


--
-- Name: qms_quote_share_annotations qms_quote_share_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_share_annotations
    ADD CONSTRAINT qms_quote_share_annotations_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_share_links qms_quote_share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_share_links
    ADD CONSTRAINT qms_quote_share_links_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_share_links qms_quote_share_links_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_share_links
    ADD CONSTRAINT qms_quote_share_links_token_key UNIQUE (token);


--
-- Name: qms_quote_site_media qms_quote_site_media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_site_media
    ADD CONSTRAINT qms_quote_site_media_pkey PRIMARY KEY (id);


--
-- Name: qms_quote_site_media qms_quote_site_media_storage_object_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_site_media
    ADD CONSTRAINT qms_quote_site_media_storage_object_path_key UNIQUE (storage_object_path);


--
-- Name: qms_quote_templates qms_quote_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_templates
    ADD CONSTRAINT qms_quote_templates_name_key UNIQUE (name);


--
-- Name: qms_quote_templates qms_quote_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_templates
    ADD CONSTRAINT qms_quote_templates_pkey PRIMARY KEY (id);


--
-- Name: qms_supplier_profiles qms_supplier_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_profiles
    ADD CONSTRAINT qms_supplier_profiles_pkey PRIMARY KEY (supplier_id);


--
-- Name: qms_supplier_quote_import_revisions qms_supplier_quote_import_revisions_import_id_revision_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_import_revisions
    ADD CONSTRAINT qms_supplier_quote_import_revisions_import_id_revision_no_key UNIQUE (import_id, revision_no);


--
-- Name: qms_supplier_quote_import_revisions qms_supplier_quote_import_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_import_revisions
    ADD CONSTRAINT qms_supplier_quote_import_revisions_pkey PRIMARY KEY (id);


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_owner_auth_user_id_sha256_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_imports
    ADD CONSTRAINT qms_supplier_quote_imports_owner_auth_user_id_sha256_key UNIQUE (owner_auth_user_id, sha256);


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_imports
    ADD CONSTRAINT qms_supplier_quote_imports_pkey PRIMARY KEY (id);


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_storage_object_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_imports
    ADD CONSTRAINT qms_supplier_quote_imports_storage_object_path_key UNIQUE (storage_object_path);


--
-- Name: qms_supplier_quote_items qms_supplier_quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_items
    ADD CONSTRAINT qms_supplier_quote_items_pkey PRIMARY KEY (id);


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_revisions
    ADD CONSTRAINT qms_supplier_quote_revisions_pkey PRIMARY KEY (id);


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_supplier_id_supplier_quote_no__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_revisions
    ADD CONSTRAINT qms_supplier_quote_revisions_supplier_id_supplier_quote_no__key UNIQUE (supplier_id, supplier_quote_no, revision_no);


--
-- Name: qms_supplier_quote_sections qms_supplier_quote_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_sections
    ADD CONSTRAINT qms_supplier_quote_sections_pkey PRIMARY KEY (id);


--
-- Name: quotation_expenses quotation_expenses_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_expenses
    ADD CONSTRAINT quotation_expenses_bubble_id_key UNIQUE (bubble_id);


--
-- Name: quotation_expenses quotation_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_expenses
    ADD CONSTRAINT quotation_expenses_pkey PRIMARY KEY (id);


--
-- Name: quotation_section_items quotation_section_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_section_items
    ADD CONSTRAINT quotation_section_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: quotation_section_items quotation_section_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_section_items
    ADD CONSTRAINT quotation_section_items_pkey PRIMARY KEY (id);


--
-- Name: quotation_sections quotation_sections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_sections
    ADD CONSTRAINT quotation_sections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: quotation_sections quotation_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_sections
    ADD CONSTRAINT quotation_sections_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_bubble_id_key UNIQUE (bubble_id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: receipt_sub_items receipt_sub_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_sub_items
    ADD CONSTRAINT receipt_sub_items_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_bubble_id_key UNIQUE (bubble_id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: recurring_incomes recurring_incomes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_incomes
    ADD CONSTRAINT recurring_incomes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: recurring_incomes recurring_incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_incomes
    ADD CONSTRAINT recurring_incomes_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: roles roles_role_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_key_key UNIQUE (role_key);


--
-- Name: service_items service_items_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_bubble_id_key UNIQUE (bubble_id);


--
-- Name: service_items service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_pkey PRIMARY KEY (id);


--
-- Name: service_types service_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: service_types service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);


--
-- Name: site_status_answers site_status_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_answers
    ADD CONSTRAINT site_status_answers_pkey PRIMARY KEY (id);


--
-- Name: site_status_answers site_status_answers_site_status_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_answers
    ADD CONSTRAINT site_status_answers_site_status_id_question_id_key UNIQUE (site_status_id, question_id);


--
-- Name: site_status_item_quantities site_status_item_quantities_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_item_quantities
    ADD CONSTRAINT site_status_item_quantities_bubble_id_key UNIQUE (bubble_id);


--
-- Name: site_status_item_quantities site_status_item_quantities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_item_quantities
    ADD CONSTRAINT site_status_item_quantities_pkey PRIMARY KEY (id);


--
-- Name: site_status_question_options site_status_question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_question_options
    ADD CONSTRAINT site_status_question_options_pkey PRIMARY KEY (id);


--
-- Name: site_status_question_project_types site_status_question_project__question_id_quote_project_typ_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_question_project_types
    ADD CONSTRAINT site_status_question_project__question_id_quote_project_typ_key UNIQUE (question_id, quote_project_type_id);


--
-- Name: site_status_question_project_types site_status_question_project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_question_project_types
    ADD CONSTRAINT site_status_question_project_types_pkey PRIMARY KEY (id);


--
-- Name: site_status_questions site_status_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_questions
    ADD CONSTRAINT site_status_questions_pkey PRIMARY KEY (id);


--
-- Name: site_status_sections site_status_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_sections
    ADD CONSTRAINT site_status_sections_pkey PRIMARY KEY (id);


--
-- Name: site_statuses site_statuses_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_statuses
    ADD CONSTRAINT site_statuses_bubble_id_key UNIQUE (bubble_id);


--
-- Name: site_statuses site_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_statuses
    ADD CONSTRAINT site_statuses_pkey PRIMARY KEY (id);


--
-- Name: source_types source_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_types
    ADD CONSTRAINT source_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: source_types source_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.source_types
    ADD CONSTRAINT source_types_pkey PRIMARY KEY (id);


--
-- Name: specific_rules specific_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.specific_rules
    ADD CONSTRAINT specific_rules_pkey PRIMARY KEY (id);


--
-- Name: staff staff_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_bubble_id_key UNIQUE (bubble_id);


--
-- Name: staff_bv_deductions staff_bv_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_bv_deductions
    ADD CONSTRAINT staff_bv_deductions_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_supplier_comments staff_supplier_comments_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT staff_supplier_comments_bubble_id_key UNIQUE (bubble_id);


--
-- Name: staff_supplier_comments staff_supplier_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT staff_supplier_comments_pkey PRIMARY KEY (id);


--
-- Name: supplier_feedback supplier_feedback_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_feedback
    ADD CONSTRAINT supplier_feedback_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_feedback supplier_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_feedback
    ADD CONSTRAINT supplier_feedback_pkey PRIMARY KEY (id);


--
-- Name: supplier_file_types supplier_file_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_file_types
    ADD CONSTRAINT supplier_file_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_file_types supplier_file_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_file_types
    ADD CONSTRAINT supplier_file_types_pkey PRIMARY KEY (id);


--
-- Name: supplier_files supplier_files_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_files
    ADD CONSTRAINT supplier_files_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_files supplier_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_files
    ADD CONSTRAINT supplier_files_pkey PRIMARY KEY (id);


--
-- Name: supplier_level_pass_out_dates supplier_level_pass_out_dates_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_level_pass_out_dates
    ADD CONSTRAINT supplier_level_pass_out_dates_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_level_pass_out_dates supplier_level_pass_out_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_level_pass_out_dates
    ADD CONSTRAINT supplier_level_pass_out_dates_pkey PRIMARY KEY (id);


--
-- Name: supplier_level_roles supplier_level_roles_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_level_roles
    ADD CONSTRAINT supplier_level_roles_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_level_roles supplier_level_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_level_roles
    ADD CONSTRAINT supplier_level_roles_pkey PRIMARY KEY (id);


--
-- Name: supplier_login_codes supplier_login_codes_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_login_codes
    ADD CONSTRAINT supplier_login_codes_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_login_codes supplier_login_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_login_codes
    ADD CONSTRAINT supplier_login_codes_pkey PRIMARY KEY (id);


--
-- Name: supplier_pricings supplier_pricings_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT supplier_pricings_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_pricings supplier_pricings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT supplier_pricings_pkey PRIMARY KEY (id);


--
-- Name: supplier_recent_statuses supplier_recent_statuses_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_recent_statuses
    ADD CONSTRAINT supplier_recent_statuses_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_recent_statuses supplier_recent_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_recent_statuses
    ADD CONSTRAINT supplier_recent_statuses_pkey PRIMARY KEY (id);


--
-- Name: supplier_register_forms supplier_register_forms_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_register_forms
    ADD CONSTRAINT supplier_register_forms_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_register_forms supplier_register_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_register_forms
    ADD CONSTRAINT supplier_register_forms_pkey PRIMARY KEY (id);


--
-- Name: supplier_rule_displays supplier_rule_displays_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_rule_displays
    ADD CONSTRAINT supplier_rule_displays_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_rule_displays supplier_rule_displays_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_rule_displays
    ADD CONSTRAINT supplier_rule_displays_pkey PRIMARY KEY (id);


--
-- Name: supplier_supplier_tags supplier_supplier_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_tags
    ADD CONSTRAINT supplier_supplier_tags_pkey PRIMARY KEY (id);


--
-- Name: supplier_supplier_tags supplier_supplier_tags_supplier_id_supplier_tag_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_tags
    ADD CONSTRAINT supplier_supplier_tags_supplier_id_supplier_tag_id_key UNIQUE (supplier_id, supplier_tag_id);


--
-- Name: supplier_supplier_types supplier_supplier_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_types
    ADD CONSTRAINT supplier_supplier_types_pkey PRIMARY KEY (id);


--
-- Name: supplier_supplier_types supplier_supplier_types_supplier_id_supplier_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_types
    ADD CONSTRAINT supplier_supplier_types_supplier_id_supplier_type_id_key UNIQUE (supplier_id, supplier_type_id);


--
-- Name: supplier_types supplier_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_types
    ADD CONSTRAINT supplier_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: supplier_types supplier_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_types
    ADD CONSTRAINT supplier_types_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_bubble_id_key UNIQUE (bubble_id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: target_sales target_sales_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.target_sales
    ADD CONSTRAINT target_sales_bubble_id_key UNIQUE (bubble_id);


--
-- Name: target_sales target_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.target_sales
    ADD CONSTRAINT target_sales_pkey PRIMARY KEY (id);


--
-- Name: team_types team_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_types
    ADD CONSTRAINT team_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: team_types team_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_types
    ADD CONSTRAINT team_types_pkey PRIMARY KEY (id);


--
-- Name: tender_bids tender_bids_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_bids
    ADD CONSTRAINT tender_bids_bubble_id_key UNIQUE (bubble_id);


--
-- Name: tender_bids tender_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_bids
    ADD CONSTRAINT tender_bids_pkey PRIMARY KEY (id);


--
-- Name: tender_message_bids tender_message_bids_message_id_bid_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_message_bids
    ADD CONSTRAINT tender_message_bids_message_id_bid_id_key UNIQUE (message_id, bid_id);


--
-- Name: tender_message_bids tender_message_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_message_bids
    ADD CONSTRAINT tender_message_bids_pkey PRIMARY KEY (id);


--
-- Name: tender_message_receivers tender_message_receivers_message_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_message_receivers
    ADD CONSTRAINT tender_message_receivers_message_id_receiver_id_key UNIQUE (message_id, receiver_id);


--
-- Name: tender_message_receivers tender_message_receivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_message_receivers
    ADD CONSTRAINT tender_message_receivers_pkey PRIMARY KEY (id);


--
-- Name: tender_message_seen tender_message_seen_message_id_seen_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_message_seen
    ADD CONSTRAINT tender_message_seen_message_id_seen_id_key UNIQUE (message_id, seen_id);


--
-- Name: tender_message_seen tender_message_seen_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_message_seen
    ADD CONSTRAINT tender_message_seen_pkey PRIMARY KEY (id);


--
-- Name: tender_messages tender_messages_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_messages
    ADD CONSTRAINT tender_messages_bubble_id_key UNIQUE (bubble_id);


--
-- Name: tender_messages tender_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_messages
    ADD CONSTRAINT tender_messages_pkey PRIMARY KEY (id);


--
-- Name: tender_rejected_suppliers tender_rejected_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_rejected_suppliers
    ADD CONSTRAINT tender_rejected_suppliers_pkey PRIMARY KEY (id);


--
-- Name: tender_rejected_suppliers tender_rejected_suppliers_tender_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_rejected_suppliers
    ADD CONSTRAINT tender_rejected_suppliers_tender_id_supplier_id_key UNIQUE (tender_id, supplier_id);


--
-- Name: tender_responds tender_responds_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_responds
    ADD CONSTRAINT tender_responds_bubble_id_key UNIQUE (bubble_id);


--
-- Name: tender_responds tender_responds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_responds
    ADD CONSTRAINT tender_responds_pkey PRIMARY KEY (id);


--
-- Name: tender_seen tender_seen_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_seen
    ADD CONSTRAINT tender_seen_pkey PRIMARY KEY (id);


--
-- Name: tender_seen tender_seen_tender_id_seen_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_seen
    ADD CONSTRAINT tender_seen_tender_id_seen_id_key UNIQUE (tender_id, seen_id);


--
-- Name: tender_selective_suppliers tender_selective_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_selective_suppliers
    ADD CONSTRAINT tender_selective_suppliers_pkey PRIMARY KEY (id);


--
-- Name: tender_selective_suppliers tender_selective_suppliers_tender_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_selective_suppliers
    ADD CONSTRAINT tender_selective_suppliers_tender_id_supplier_id_key UNIQUE (tender_id, supplier_id);


--
-- Name: tenders tenders_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_bubble_id_key UNIQUE (bubble_id);


--
-- Name: tenders tenders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_pkey PRIMARY KEY (id);


--
-- Name: term_template_section_details term_template_section_details_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_section_details
    ADD CONSTRAINT term_template_section_details_bubble_id_key UNIQUE (bubble_id);


--
-- Name: term_template_section_details term_template_section_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_section_details
    ADD CONSTRAINT term_template_section_details_pkey PRIMARY KEY (id);


--
-- Name: term_template_sections term_template_sections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_sections
    ADD CONSTRAINT term_template_sections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: term_template_sections term_template_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_sections
    ADD CONSTRAINT term_template_sections_pkey PRIMARY KEY (id);


--
-- Name: term_template_types term_template_types_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_types
    ADD CONSTRAINT term_template_types_bubble_id_key UNIQUE (bubble_id);


--
-- Name: term_template_types term_template_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_types
    ADD CONSTRAINT term_template_types_pkey PRIMARY KEY (id);


--
-- Name: three_d_collection_liked_staff three_d_collection_liked_staff_collection_id_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collection_liked_staff
    ADD CONSTRAINT three_d_collection_liked_staff_collection_id_staff_id_key UNIQUE (collection_id, staff_id);


--
-- Name: three_d_collection_liked_staff three_d_collection_liked_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collection_liked_staff
    ADD CONSTRAINT three_d_collection_liked_staff_pkey PRIMARY KEY (id);


--
-- Name: three_d_collections three_d_collections_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT three_d_collections_bubble_id_key UNIQUE (bubble_id);


--
-- Name: three_d_collections three_d_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT three_d_collections_pkey PRIMARY KEY (id);


--
-- Name: three_d_renders three_d_renders_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_renders
    ADD CONSTRAINT three_d_renders_bubble_id_key UNIQUE (bubble_id);


--
-- Name: three_d_renders three_d_renders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_renders
    ADD CONSTRAINT three_d_renders_pkey PRIMARY KEY (id);


--
-- Name: staff_bv_deductions uq_staff_bv_deductions_staff_fy; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_bv_deductions
    ADD CONSTRAINT uq_staff_bv_deductions_staff_fy UNIQUE (staff_id, n_financial_year_id);


--
-- Name: users users_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: users users_bubble_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_bubble_id_key UNIQUE (bubble_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: asana_oauth_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX asana_oauth_tokens_user_id_idx ON public.asana_oauth_tokens USING btree (user_id);


--
-- Name: idx_3d_collections_collab_designer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_collections_collab_designer_id ON public.three_d_collections USING btree (collab_designer_id);


--
-- Name: idx_3d_collections_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_collections_created_by_id ON public.three_d_collections USING btree (created_by_id);


--
-- Name: idx_3d_collections_main_designer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_collections_main_designer_id ON public.three_d_collections USING btree (main_designer_id);


--
-- Name: idx_3d_collections_r_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_collections_r_pitching_id ON public.three_d_collections USING btree (r_pitching_id);


--
-- Name: idx_3d_collections_r_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_collections_r_project_id ON public.three_d_collections USING btree (r_project_id);


--
-- Name: idx_3d_renders_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_renders_created_by_id ON public.three_d_renders USING btree (created_by_id);


--
-- Name: idx_3d_renders_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_renders_pitching_id ON public.three_d_renders USING btree (pitching_id);


--
-- Name: idx_3d_renders_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_renders_project_id ON public.three_d_renders USING btree (project_id);


--
-- Name: idx_3d_renders_r_3d_collection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_3d_renders_r_3d_collection_id ON public.three_d_renders USING btree (r_3d_collection_id);


--
-- Name: idx_ai_quote_sub_item_details_ai_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_quote_sub_item_details_ai_quote_id ON public.ai_quote_sub_item_details USING btree (ai_quote_id);


--
-- Name: idx_ai_quote_sub_item_details_sub_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_quote_sub_item_details_sub_item_id ON public.ai_quote_sub_item_details USING btree (ai_quote_sub_item_id);


--
-- Name: idx_ai_quote_sub_items_ai_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_quote_sub_items_ai_quote_id ON public.ai_quote_sub_items USING btree (ai_quote_id);


--
-- Name: idx_ap_report_remarks_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ap_report_remarks_bwf_project_id ON public.ap_report_remarks USING btree (bwf_project_id);


--
-- Name: idx_ap_report_remarks_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ap_report_remarks_project_id ON public.ap_report_remarks USING btree (project_id);


--
-- Name: idx_ap_report_remarks_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ap_report_remarks_supplier_id ON public.ap_report_remarks USING btree (supplier_id);


--
-- Name: idx_blocked_views_blocked_bu_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocked_views_blocked_bu_id ON public.blocked_views USING btree (blocked_bu_id);


--
-- Name: idx_blocked_views_blocked_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocked_views_blocked_member_id ON public.blocked_views USING btree (blocked_member_id);


--
-- Name: idx_blocked_views_blocked_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocked_views_blocked_team_id ON public.blocked_views USING btree (blocked_team_id);


--
-- Name: idx_buildings_building_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buildings_building_name ON public.buildings USING btree (building_name);


--
-- Name: idx_buildings_real_creator_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buildings_real_creator_id ON public.buildings USING btree (real_creator_id);


--
-- Name: idx_bwa_pitchings_pitching_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwa_pitchings_pitching_code ON public.bwa_pitchings USING btree (pitching_code);


--
-- Name: idx_bwa_projects_created_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwa_projects_created_date ON public.bwa_projects USING btree (created_date DESC NULLS LAST);


--
-- Name: idx_bwa_projects_project_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwa_projects_project_code ON public.bwa_projects USING btree (project_code);


--
-- Name: idx_bwa_projects_signed_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwa_projects_signed_date ON public.bwa_projects USING btree (signed_date DESC NULLS LAST);


--
-- Name: idx_bwf_orders_defect_factory_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_defect_factory_id ON public.bwf_orders USING btree (defect_factory_id);


--
-- Name: idx_bwf_orders_defect_member_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_defect_member_id ON public.bwf_orders USING btree (defect_member_id);


--
-- Name: idx_bwf_orders_defect_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_defect_supplier_id ON public.bwf_orders USING btree (defect_supplier_id);


--
-- Name: idx_bwf_orders_deliver_to_factory_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_deliver_to_factory_id ON public.bwf_orders USING btree (deliver_to_factory_id);


--
-- Name: idx_bwf_orders_installation_team_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_installation_team_id ON public.bwf_orders USING btree (installation_team_id);


--
-- Name: idx_bwf_orders_n_defect_cause_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_n_defect_cause_id ON public.bwf_orders USING btree (n_defect_cause_id);


--
-- Name: idx_bwf_orders_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_product_id ON public.bwf_orders USING btree (product_id);


--
-- Name: idx_bwf_orders_warehouse_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_orders_warehouse_id ON public.bwf_orders USING btree (warehouse_id);


--
-- Name: idx_bwf_pitchings_pitching_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_pitchings_pitching_code ON public.bwf_pitchings USING btree (pitching_code);


--
-- Name: idx_bwf_product_master_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_product_master_category ON public.bwf_product_master USING btree (category);


--
-- Name: idx_bwf_product_master_factory_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_product_master_factory_id ON public.bwf_product_master USING btree (factory_id);


--
-- Name: idx_bwf_product_master_factory_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_product_master_factory_name ON public.bwf_product_master USING btree (factory_name);


--
-- Name: idx_bwf_product_master_shopify_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_product_master_shopify_id ON public.bwf_product_master USING btree (shopify_id);


--
-- Name: idx_bwf_product_product_types_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_product_product_types_product_id ON public.bwf_product_product_types USING btree (product_id);


--
-- Name: idx_bwf_product_product_types_product_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_product_product_types_product_type_id ON public.bwf_product_product_types USING btree (product_type_id);


--
-- Name: idx_bwf_products_product_types_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_products_product_types_id ON public.bwf_products USING btree (product_types_id);


--
-- Name: idx_bwf_project_factories_factory_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_project_factories_factory_id ON public.bwf_project_factories USING btree (factory_id);


--
-- Name: idx_bwf_project_factories_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_project_factories_project_id ON public.bwf_project_factories USING btree (project_id);


--
-- Name: idx_bwf_project_suppliers_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_project_suppliers_project_id ON public.bwf_project_suppliers USING btree (project_id);


--
-- Name: idx_bwf_project_suppliers_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_project_suppliers_supplier_id ON public.bwf_project_suppliers USING btree (supplier_id);


--
-- Name: idx_bwf_projects_created_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_projects_created_date ON public.bwf_projects USING btree (created_date DESC NULLS LAST);


--
-- Name: idx_bwf_projects_project_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_projects_project_code ON public.bwf_projects USING btree (project_code);


--
-- Name: idx_bwf_projects_signed_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwf_projects_signed_date ON public.bwf_projects USING btree (signed_date DESC NULLS LAST);


--
-- Name: idx_bwf_unique_title_factory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_bwf_unique_title_factory ON public.bwf_product_master USING btree (COALESCE(title, ''::text), COALESCE(factory_name, ''::text));


--
-- Name: idx_cr_event_details_cust_gift_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cr_event_details_cust_gift_item_id ON public.cr_event_details USING btree (cust_gift_item_id);


--
-- Name: idx_cr_event_details_delivery_method_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cr_event_details_delivery_method_id ON public.cr_event_details USING btree (delivery_method_id);


--
-- Name: idx_cr_event_details_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cr_event_details_event_id ON public.cr_event_details USING btree (event_id);


--
-- Name: idx_cr_event_details_handler_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cr_event_details_handler_id ON public.cr_event_details USING btree (handler_id);


--
-- Name: idx_cr_event_details_related_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cr_event_details_related_staff_id ON public.cr_event_details USING btree (related_staff_id);


--
-- Name: idx_customer_documents_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_documents_customer_id ON public.customer_documents USING btree (customer_id);


--
-- Name: idx_customer_documents_migration_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_documents_migration_status ON public.customer_documents USING btree (migration_status);


--
-- Name: idx_customer_documents_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_documents_type_id ON public.customer_documents USING btree (type_id);


--
-- Name: idx_customer_relations_cr_event_detail_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_relations_cr_event_detail_id ON public.customer_relations USING btree (cr_event_detail_id);


--
-- Name: idx_customer_relations_event_theme_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_relations_event_theme_id ON public.customer_relations USING btree (event_theme_id);


--
-- Name: idx_customer_relations_event_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_relations_event_type_id ON public.customer_relations USING btree (event_type_id);


--
-- Name: idx_customer_tags_collection_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tags_collection_uuid ON public.customer_tags USING btree (collection_uuid);


--
-- Name: idx_customer_tags_customer_collection; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tags_customer_collection ON public.customer_tags USING btree (customer_uuid, collection_uuid);


--
-- Name: idx_customer_tags_customer_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tags_customer_uuid ON public.customer_tags USING btree (customer_uuid);


--
-- Name: idx_customer_tags_tag_uuid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tags_tag_uuid ON public.customer_tags USING btree (tag_uuid);


--
-- Name: idx_customer_tags_uuid_pair; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_customer_tags_uuid_pair ON public.customer_tags USING btree (customer_uuid, tag_uuid);


--
-- Name: idx_customers_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_company_name ON public.customers USING btree (company_name);


--
-- Name: idx_customers_display_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_display_name ON public.customers USING btree (display_name);


--
-- Name: idx_customers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status ON public.customers USING btree (status);


--
-- Name: idx_daily_task_logs_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_task_logs_category ON public.daily_task_logs USING btree (category);


--
-- Name: idx_daily_task_logs_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_task_logs_date ON public.daily_task_logs USING btree (task_date DESC);


--
-- Name: idx_daily_task_logs_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_task_logs_module ON public.daily_task_logs USING btree (module);


--
-- Name: idx_default_quote_details_default_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_quote_details_default_quote_id ON public.default_quote_details USING btree (default_quote_id);


--
-- Name: idx_default_quote_details_default_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_quote_details_default_section_id ON public.default_quote_details USING btree (default_section_id);


--
-- Name: idx_default_quote_details_r_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_quote_details_r_item_id ON public.default_quote_details USING btree (r_item_id);


--
-- Name: idx_default_quote_mains_real_creator_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_quote_mains_real_creator_id ON public.default_quote_mains USING btree (real_creator_id);


--
-- Name: idx_default_quote_sections_default_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_quote_sections_default_quote_id ON public.default_quote_sections USING btree (default_quote_id);


--
-- Name: idx_default_quote_sections_r_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_default_quote_sections_r_section_id ON public.default_quote_sections USING btree (r_section_id);


--
-- Name: idx_design_jobs_pitching_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_design_jobs_pitching_source ON public.design_jobs USING btree (pitching_id, source);


--
-- Name: idx_design_jobs_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_design_jobs_project_id ON public.design_jobs USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_design_jobs_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_design_jobs_staff_id ON public.design_jobs USING btree (staff_id);


--
-- Name: idx_districts_region_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_districts_region_id ON public.districts USING btree (region_id);


--
-- Name: idx_expense_control_waivers_applicant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_control_waivers_applicant ON public.expense_control_waivers USING btree (applicant_id);


--
-- Name: idx_expense_control_waivers_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_control_waivers_created ON public.expense_control_waivers USING btree (created_at DESC);


--
-- Name: idx_expense_control_waivers_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_control_waivers_project ON public.expense_control_waivers USING btree (bwa_project_id);


--
-- Name: idx_expense_control_waivers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expense_control_waivers_status ON public.expense_control_waivers USING btree (status);


--
-- Name: idx_expenses_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_bwf_project_id ON public.expenses USING btree (bwf_project_id);


--
-- Name: idx_expenses_n_contract_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_n_contract_type_id ON public.expenses USING btree (n_contract_type_id);


--
-- Name: idx_expenses_n_product_types_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_n_product_types_id ON public.expenses USING btree (n_product_types_id);


--
-- Name: idx_expenses_n_supplier_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_n_supplier_type_id ON public.expenses USING btree (n_supplier_type_id);


--
-- Name: idx_expenses_payment_method_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_payment_method_id ON public.expenses USING btree (payment_method_id);


--
-- Name: idx_expenses_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_project ON public.expenses USING btree (project);


--
-- Name: idx_expenses_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_project_id ON public.expenses USING btree (project_id);


--
-- Name: idx_expenses_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_supplier ON public.expenses USING btree (supplier);


--
-- Name: idx_factories_factory_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_factories_factory_name ON public.factories USING btree (factory_name);


--
-- Name: idx_income_expiry_reasons_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_income_expiry_reasons_is_active ON public.income_expiry_reasons USING btree (is_active);


--
-- Name: idx_income_expiry_reasons_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_income_expiry_reasons_sort ON public.income_expiry_reasons USING btree (sort);


--
-- Name: idx_income_invoices_cost_center_bu_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_income_invoices_cost_center_bu_id ON public.income_invoices USING btree (cost_center_bu_id);


--
-- Name: idx_incomes_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_bwf_project_id ON public.incomes USING btree (bwf_project_id);


--
-- Name: idx_incomes_expiry_reason_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_expiry_reason_id ON public.incomes USING btree (expiry_reason_id);


--
-- Name: idx_incomes_n_contract_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_n_contract_type_id ON public.incomes USING btree (n_contract_type_id);


--
-- Name: idx_incomes_payment_method_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_payment_method_id ON public.incomes USING btree (payment_method_id);


--
-- Name: idx_incomes_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_payment_status ON public.incomes USING btree (payment_status);


--
-- Name: idx_incomes_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_project ON public.incomes USING btree (project);


--
-- Name: idx_incomes_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incomes_project_id ON public.incomes USING btree (project_id);


--
-- Name: idx_invoice_sub_items_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_sub_items_invoice_id ON public.invoice_sub_items USING btree (invoice_id);


--
-- Name: idx_man_hour_dates_bubble_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_dates_bubble_id ON public.man_hour_dates USING btree (bubble_id);


--
-- Name: idx_man_hour_dates_report_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_dates_report_date ON public.man_hour_dates USING btree (report_date DESC);


--
-- Name: idx_man_hour_dates_staff_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_dates_staff_date ON public.man_hour_dates USING btree (staff_id, report_date);


--
-- Name: idx_man_hour_pinned_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_man_hour_pinned_unique ON public.man_hour_pinned USING btree (staff_id, pin_type, COALESCE((project_id)::text, ''::text), COALESCE(task_name, ''::text));


--
-- Name: idx_man_hour_pinned_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_pinned_user ON public.man_hour_pinned USING btree (staff_id, pin_type);


--
-- Name: idx_man_hour_tasks_bubble_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_bubble_id ON public.man_hour_tasks USING btree (bubble_id);


--
-- Name: idx_man_hour_tasks_date_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_date_id ON public.man_hour_tasks USING btree (man_hour_date_id);


--
-- Name: idx_man_hour_tasks_design_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_design_job_id ON public.man_hour_tasks USING btree (design_job_id) WHERE (design_job_id IS NOT NULL);


--
-- Name: idx_man_hour_tasks_job_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_job_type ON public.man_hour_tasks USING btree (job_type);


--
-- Name: idx_man_hour_tasks_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_project ON public.man_hour_tasks USING btree (project_id);


--
-- Name: idx_man_hour_tasks_project_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_project_job ON public.man_hour_tasks USING btree (project_id, job_type);


--
-- Name: idx_man_hour_tasks_work_hour; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_man_hour_tasks_work_hour ON public.man_hour_tasks USING btree (work_hour);


--
-- Name: idx_news_nos_news_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_news_nos_news_type_id ON public.news USING btree (nos_news_type_id);


--
-- Name: idx_niqpt_nos_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_niqpt_nos_item_id ON public.nos_item_quote_project_types USING btree (nos_item_id);


--
-- Name: idx_niqpt_quote_project_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_niqpt_quote_project_type_id ON public.nos_item_quote_project_types USING btree (quote_project_type_id);


--
-- Name: idx_nos_ai_tool_types_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_ai_tool_types_is_active ON public.nos_ai_tool_types USING btree (is_active);


--
-- Name: idx_nos_ai_tool_types_sorting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_ai_tool_types_sorting ON public.nos_ai_tool_types USING btree (sorting);


--
-- Name: idx_nos_ai_tools_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_ai_tools_category ON public.nos_ai_tools USING btree (category);


--
-- Name: idx_nos_ai_tools_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_ai_tools_is_active ON public.nos_ai_tools USING btree (is_active);


--
-- Name: idx_nos_ai_tools_sorting; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_ai_tools_sorting ON public.nos_ai_tools USING btree (sorting);


--
-- Name: idx_nos_brands_bubble_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_brands_bubble_id ON public.nos_brands USING btree (bubble_id);


--
-- Name: idx_nos_brands_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_brands_is_active ON public.nos_brands USING btree (is_active);


--
-- Name: idx_nos_customer_tags_collection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_customer_tags_collection_id ON public.nos_customer_tags USING btree (collection_id);


--
-- Name: idx_nos_doc_types_bubble_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_doc_types_bubble_id ON public.nos_doc_types USING btree (bubble_id);


--
-- Name: idx_nos_doc_types_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_doc_types_category ON public.nos_doc_types USING btree (category);


--
-- Name: idx_nos_items_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_items_created_by_id ON public.nos_items USING btree (created_by_id);


--
-- Name: idx_nos_items_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_items_section_id ON public.nos_items USING btree (section_id);


--
-- Name: idx_nos_items_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_items_unit_id ON public.nos_items USING btree (unit_id);


--
-- Name: idx_nos_sections_quote_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_sections_quote_project_id ON public.nos_sections USING btree (quote_project_id);


--
-- Name: idx_nos_template_items_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_template_items_item_id ON public.nos_template_items USING btree (item_id);


--
-- Name: idx_nos_template_items_template_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_template_items_template_id ON public.nos_template_items USING btree (template_id);


--
-- Name: idx_nos_template_items_template_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_template_items_template_section_id ON public.nos_template_items USING btree (template_section_id);


--
-- Name: idx_nos_template_sections_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_template_sections_section_id ON public.nos_template_sections USING btree (section_id);


--
-- Name: idx_nos_template_sections_template_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_template_sections_template_id ON public.nos_template_sections USING btree (template_id);


--
-- Name: idx_nos_work_locations_bubble_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_work_locations_bubble_id ON public.nos_work_locations USING btree (bubble_id);


--
-- Name: idx_nos_work_locations_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nos_work_locations_is_active ON public.nos_work_locations USING btree (is_active);


--
-- Name: idx_noss_items_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_noss_items_type ON public.nos_site_status_items USING btree (os_ss_item_type);


--
-- Name: idx_notifications_bwa_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_bwa_project ON public.notifications USING btree (bwa_project_id) WHERE (bwa_project_id IS NOT NULL);


--
-- Name: idx_notifications_bwf_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_bwf_project ON public.notifications USING btree (bwf_project_id) WHERE (bwf_project_id IS NOT NULL);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_expense; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_expense ON public.notifications USING btree (expense_id) WHERE (expense_id IS NOT NULL);


--
-- Name: idx_notifications_income; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_income ON public.notifications USING btree (income_id) WHERE (income_id IS NOT NULL);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_staff_id);


--
-- Name: idx_notifications_recipient_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_recipient_unread ON public.notifications USING btree (recipient_staff_id) WHERE (is_read = false);


--
-- Name: idx_outstanding_remarks_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outstanding_remarks_bwf_project_id ON public.outstanding_remarks USING btree (bwf_project_id);


--
-- Name: idx_outstanding_remarks_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outstanding_remarks_created_by_id ON public.outstanding_remarks USING btree (created_by_id);


--
-- Name: idx_outstanding_remarks_n_contract_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outstanding_remarks_n_contract_type_id ON public.outstanding_remarks USING btree (n_contract_type_id);


--
-- Name: idx_outstanding_remarks_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_outstanding_remarks_project_id ON public.outstanding_remarks USING btree (project_id);


--
-- Name: idx_permission_assignments_dimension; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permission_assignments_dimension ON public.permission_assignments USING btree (dimension, dimension_value);


--
-- Name: idx_permission_assignments_permission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permission_assignments_permission_id ON public.permission_assignments USING btree (permission_id);


--
-- Name: idx_permissions_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);


--
-- Name: idx_permissions_module_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_permissions_module_action ON public.permissions USING btree (module, action);


--
-- Name: idx_pitching_bv_bwf_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pitching_bv_bwf_pitching_id ON public.pitching_bv USING btree (bwf_pitching_id);


--
-- Name: idx_pitching_bv_handler_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pitching_bv_handler_id ON public.pitching_bv USING btree (handler_id);


--
-- Name: idx_pitching_bv_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pitching_bv_pitching_id ON public.pitching_bv USING btree (pitching_id);


--
-- Name: idx_project_bv_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_bv_bwf_project_id ON public.project_bv USING btree (bwf_project_id);


--
-- Name: idx_project_bv_handler_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_bv_handler_id ON public.project_bv USING btree (handler_id);


--
-- Name: idx_project_bv_n_financial_year_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_bv_n_financial_year_id ON public.project_bv USING btree (n_financial_year_id);


--
-- Name: idx_project_bv_n_team_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_bv_n_team_type_id ON public.project_bv USING btree (n_team_type_id);


--
-- Name: idx_project_bv_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_bv_project_id ON public.project_bv USING btree (project_id);


--
-- Name: idx_project_documents_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_documents_bwf_project_id ON public.project_documents USING btree (bwf_project_id);


--
-- Name: idx_project_documents_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_documents_created_by_id ON public.project_documents USING btree (created_by_id);


--
-- Name: idx_project_documents_doc_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_documents_doc_type_id ON public.project_documents USING btree (doc_type_id);


--
-- Name: idx_project_documents_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_documents_pitching_id ON public.project_documents USING btree (pitching_id);


--
-- Name: idx_project_documents_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_documents_project_id ON public.project_documents USING btree (project_id);


--
-- Name: idx_project_initial_expenses_bwf_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_initial_expenses_bwf_pitching_id ON public.project_initial_expenses USING btree (bwf_pitching_id);


--
-- Name: idx_project_initial_expenses_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_initial_expenses_created_by_id ON public.project_initial_expenses USING btree (created_by_id);


--
-- Name: idx_project_initial_expenses_n_expense_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_initial_expenses_n_expense_type_id ON public.project_initial_expenses USING btree (n_expense_type_id);


--
-- Name: idx_project_initial_expenses_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_initial_expenses_pitching_id ON public.project_initial_expenses USING btree (pitching_id);


--
-- Name: idx_project_schedule_tasks_bwf_project_with_custom_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedule_tasks_bwf_project_with_custom_id ON public.project_schedule_tasks USING btree (bwf_project_with_custom_id);


--
-- Name: idx_project_schedule_tasks_os_schedule_groups_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedule_tasks_os_schedule_groups_id ON public.project_schedule_tasks USING btree (os_schedule_groups_id);


--
-- Name: idx_project_schedule_tasks_project_with_custom_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedule_tasks_project_with_custom_id ON public.project_schedule_tasks USING btree (project_with_custom_id);


--
-- Name: idx_project_schedules_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedules_bwf_project_id ON public.project_schedules USING btree (bwf_project_id);


--
-- Name: idx_project_schedules_main_pm_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedules_main_pm_id ON public.project_schedules USING btree (main_pm_id);


--
-- Name: idx_project_schedules_payment_schedule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedules_payment_schedule_id ON public.project_schedules USING btree (payment_schedule_id);


--
-- Name: idx_project_schedules_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedules_project_id ON public.project_schedules USING btree (project_id);


--
-- Name: idx_project_schedules_working_schedule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_schedules_working_schedule_id ON public.project_schedules USING btree (working_schedule_id);


--
-- Name: idx_project_weekly_reports_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_weekly_reports_project_id ON public.project_weekly_reports USING btree (project_id);


--
-- Name: idx_purchase_orders_cost_centre_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_purchase_orders_cost_centre_id ON public.purchase_orders USING btree (cost_centre_id);


--
-- Name: idx_purchase_orders_po_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders USING btree (po_number);


--
-- Name: idx_q_term_section_details_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_q_term_section_details_quote_id ON public.q_term_section_details USING btree (quote_id);


--
-- Name: idx_q_term_section_details_term_head_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_q_term_section_details_term_head_id ON public.q_term_section_details USING btree (term_head_id);


--
-- Name: idx_q_term_sections_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_q_term_sections_quote_id ON public.q_term_sections USING btree (quote_id);


--
-- Name: idx_quotation_expenses_bwf_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_expenses_bwf_pitching_id ON public.quotation_expenses USING btree (bwf_pitching_id);


--
-- Name: idx_quotation_expenses_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_expenses_created_by_id ON public.quotation_expenses USING btree (created_by_id);


--
-- Name: idx_quotation_expenses_n_expense_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_expenses_n_expense_type_id ON public.quotation_expenses USING btree (n_expense_type_id);


--
-- Name: idx_quotation_expenses_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_expenses_pitching_id ON public.quotation_expenses USING btree (pitching_id);


--
-- Name: idx_quotation_section_items_c_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_section_items_c_unit_id ON public.quotation_section_items USING btree (c_unit_id);


--
-- Name: idx_quotation_section_items_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_section_items_item_id ON public.quotation_section_items USING btree (item_id);


--
-- Name: idx_quotation_section_items_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_section_items_quote_id ON public.quotation_section_items USING btree (quote_id);


--
-- Name: idx_quotation_sections_r_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_sections_r_section_id ON public.quotation_sections USING btree (r_section_id);


--
-- Name: idx_quotations_contract_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotations_contract_type_id ON public.quotations USING btree (contract_type_id);


--
-- Name: idx_quotations_pitching; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotations_pitching ON public.quotations USING btree (pitching);


--
-- Name: idx_quotations_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotations_project ON public.quotations USING btree (project);


--
-- Name: idx_quotations_project_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotations_project_type_id ON public.quotations USING btree (project_type_id);


--
-- Name: idx_receipt_sub_items_receipt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receipt_sub_items_receipt_id ON public.receipt_sub_items USING btree (receipt_id);


--
-- Name: idx_receipts_cost_center_bu_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receipts_cost_center_bu_id ON public.receipts USING btree (cost_center_bu_id);


--
-- Name: idx_receipts_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receipts_created_by_id ON public.receipts USING btree (created_by_id);


--
-- Name: idx_receipts_income_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receipts_income_id ON public.receipts USING btree (income_id);


--
-- Name: idx_receipts_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receipts_invoice_id ON public.receipts USING btree (invoice_id);


--
-- Name: idx_recurring_incomes_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recurring_incomes_project_id ON public.recurring_incomes USING btree (project_id);


--
-- Name: idx_recurring_incomes_r_incomes_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recurring_incomes_r_incomes_id ON public.recurring_incomes USING btree (r_incomes_id);


--
-- Name: idx_site_statuses_pitching; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_site_statuses_pitching ON public.site_statuses USING btree (pitching);


--
-- Name: idx_site_statuses_pitching_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_site_statuses_pitching_id ON public.site_statuses USING btree (pitching_id);


--
-- Name: idx_site_statuses_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_site_statuses_project ON public.site_statuses USING btree (project);


--
-- Name: idx_site_statuses_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_site_statuses_project_id ON public.site_statuses USING btree (project_id);


--
-- Name: idx_specific_rules_dimension; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_specific_rules_dimension ON public.specific_rules USING btree (dimension, dimension_value);


--
-- Name: idx_specific_rules_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_specific_rules_module ON public.specific_rules USING btree (module);


--
-- Name: idx_specific_rules_rule_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_specific_rules_rule_key ON public.specific_rules USING btree (rule_key);


--
-- Name: idx_ssa_question; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssa_question ON public.site_status_answers USING btree (question_id);


--
-- Name: idx_ssa_site_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssa_site_status ON public.site_status_answers USING btree (site_status_id);


--
-- Name: idx_ssc_bwf_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssc_bwf_project_id ON public.staff_supplier_comments USING btree (bwf_project_id);


--
-- Name: idx_ssc_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssc_created_by_id ON public.staff_supplier_comments USING btree (created_by_id);


--
-- Name: idx_ssc_evaluator_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssc_evaluator_id ON public.staff_supplier_comments USING btree (evaluator_id);


--
-- Name: idx_ssc_factory_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssc_factory_id ON public.staff_supplier_comments USING btree (factory_id);


--
-- Name: idx_ssc_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssc_project_id ON public.staff_supplier_comments USING btree (project_id);


--
-- Name: idx_ssc_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssc_supplier_id ON public.staff_supplier_comments USING btree (supplier_id);


--
-- Name: idx_ssiq_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssiq_item ON public.site_status_item_quantities USING btree (item);


--
-- Name: idx_ssiq_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssiq_item_id ON public.site_status_item_quantities USING btree (item_id);


--
-- Name: idx_ssiq_question_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssiq_question_type ON public.site_status_item_quantities USING btree (question_type);


--
-- Name: idx_ssiq_site_status_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssiq_site_status_id ON public.site_status_item_quantities USING btree (site_status_id);


--
-- Name: idx_ssq_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssq_section ON public.site_status_questions USING btree (section_id);


--
-- Name: idx_ssqo_question; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssqo_question ON public.site_status_question_options USING btree (question_id);


--
-- Name: idx_ssqpt_question; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssqpt_question ON public.site_status_question_project_types USING btree (question_id);


--
-- Name: idx_ssqpt_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ssqpt_type ON public.site_status_question_project_types USING btree (quote_project_type_id);


--
-- Name: idx_sst_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sst_supplier_id ON public.supplier_supplier_types USING btree (supplier_id);


--
-- Name: idx_sst_supplier_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sst_supplier_type_id ON public.supplier_supplier_types USING btree (supplier_type_id);


--
-- Name: idx_sst_tags_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sst_tags_supplier_id ON public.supplier_supplier_tags USING btree (supplier_id);


--
-- Name: idx_sst_tags_supplier_tag_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sst_tags_supplier_tag_id ON public.supplier_supplier_tags USING btree (supplier_tag_id);


--
-- Name: idx_staff_bv_deductions_fy_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_bv_deductions_fy_id ON public.staff_bv_deductions USING btree (n_financial_year_id);


--
-- Name: idx_staff_bv_deductions_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_bv_deductions_staff_id ON public.staff_bv_deductions USING btree (staff_id);


--
-- Name: idx_staff_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_email ON public.staff USING btree (email);


--
-- Name: idx_staff_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_status ON public.staff USING btree (status);


--
-- Name: idx_supplier_files_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_files_created_by_id ON public.supplier_files USING btree (created_by_id);


--
-- Name: idx_supplier_files_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_files_supplier_id ON public.supplier_files USING btree (supplier_id);


--
-- Name: idx_supplier_files_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_files_type_id ON public.supplier_files USING btree (type_id);


--
-- Name: idx_supplier_pricings_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_pricings_created_by_id ON public.supplier_pricings USING btree (created_by_id);


--
-- Name: idx_supplier_pricings_editor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_pricings_editor_id ON public.supplier_pricings USING btree (editor_id);


--
-- Name: idx_supplier_pricings_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_pricings_item_id ON public.supplier_pricings USING btree (item_id);


--
-- Name: idx_supplier_pricings_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_pricings_supplier_id ON public.supplier_pricings USING btree (supplier_id);


--
-- Name: idx_supplier_pricings_unit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_pricings_unit_id ON public.supplier_pricings USING btree (unit_id);


--
-- Name: idx_supplier_recent_statuses_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_recent_statuses_created_by_id ON public.supplier_recent_statuses USING btree (created_by_id);


--
-- Name: idx_supplier_recent_statuses_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_recent_statuses_supplier_id ON public.supplier_recent_statuses USING btree (supplier_id);


--
-- Name: idx_supplier_register_forms_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_register_forms_created_by_id ON public.supplier_register_forms USING btree (created_by_id);


--
-- Name: idx_supplier_register_forms_supplier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_register_forms_supplier_id ON public.supplier_register_forms USING btree (supplier_id);


--
-- Name: idx_supplier_types_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_types_is_active ON public.supplier_types USING btree (is_active);


--
-- Name: idx_suppliers_created_by_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_created_by_id ON public.suppliers USING btree (created_by_id);


--
-- Name: idx_suppliers_display_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_display_name ON public.suppliers USING btree (display_name);


--
-- Name: idx_suppliers_district_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_district_id ON public.suppliers USING btree (district_id);


--
-- Name: idx_suppliers_n_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_n_type_id ON public.suppliers USING btree (n_type_id);


--
-- Name: idx_suppliers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_suppliers_status ON public.suppliers USING btree (status);


--
-- Name: idx_target_sales_financial_year_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_target_sales_financial_year_id ON public.target_sales USING btree (financial_year_id);


--
-- Name: idx_tender_bids_tender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tender_bids_tender ON public.tender_bids USING btree (tender);


--
-- Name: idx_tender_bids_witness_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tender_bids_witness_id ON public.tender_bids USING btree (witness_id);


--
-- Name: idx_tender_messages_bids_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tender_messages_bids_id ON public.tender_messages USING btree (bids_id);


--
-- Name: idx_tender_messages_reply_to_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tender_messages_reply_to_id ON public.tender_messages USING btree (reply_to_id);


--
-- Name: idx_tenders_drawing_designer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenders_drawing_designer_id ON public.tenders USING btree (drawing_designer_id);


--
-- Name: idx_tenders_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenders_project ON public.tenders USING btree (project);


--
-- Name: idx_tenders_project_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenders_project_type_id ON public.tenders USING btree (project_type_id);


--
-- Name: idx_tenders_supplier_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenders_supplier_type_id ON public.tenders USING btree (supplier_type_id);


--
-- Name: idx_term_template_section_details_template_name_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_term_template_section_details_template_name_id ON public.term_template_section_details USING btree (template_name_id);


--
-- Name: idx_term_template_section_details_template_section_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_term_template_section_details_template_section_id ON public.term_template_section_details USING btree (template_section_id);


--
-- Name: idx_term_template_sections_template_name_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_term_template_sections_template_name_id ON public.term_template_sections USING btree (template_name_id);


--
-- Name: idx_users_approval_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_approval_status ON public.users USING btree (approval_status);


--
-- Name: idx_users_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_auth_user_id ON public.users USING btree (auth_user_id);


--
-- Name: idx_users_bubble_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_bubble_id ON public.users USING btree (bubble_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_member ON public.users USING btree (member);


--
-- Name: idx_users_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_supplier ON public.users USING btree (supplier);


--
-- Name: idx_users_user_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_user_type ON public.users USING btree (user_type);


--
-- Name: income_expiry_reasons_display_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX income_expiry_reasons_display_unique ON public.income_expiry_reasons USING btree (display);


--
-- Name: qms_box_access_log_action_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_box_access_log_action_created_at_idx ON public.qms_box_access_log USING btree (action, created_at DESC);


--
-- Name: qms_box_access_log_actor_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_box_access_log_actor_created_at_idx ON public.qms_box_access_log USING btree (actor_auth_user_id, created_at DESC);


--
-- Name: qms_cost_coverages_active_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX qms_cost_coverages_active_key ON public.qms_cost_coverages USING btree (cost_version_id, requirement_scope_key, component_type) WHERE is_active;


--
-- Name: qms_cost_coverages_line_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_cost_coverages_line_idx ON public.qms_cost_coverages USING btree (cost_line_id);


--
-- Name: qms_cost_source_snapshots_supplier_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_cost_source_snapshots_supplier_idx ON public.qms_cost_source_snapshots USING btree (supplier_quote_revision_id, supplier_quote_item_id);


--
-- Name: qms_drawing_analyses_owner_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_drawing_analyses_owner_created_idx ON public.qms_drawing_analyses USING btree (owner_auth_user_id, created_at DESC);


--
-- Name: qms_drawing_analyses_status_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_drawing_analyses_status_created_idx ON public.qms_drawing_analyses USING btree (status, created_at DESC);


--
-- Name: qms_estimate_runs_quote_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_estimate_runs_quote_idx ON public.qms_estimate_runs USING btree (quotation_id, estimated_at DESC);


--
-- Name: qms_historical_quote_import_revisions_import_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_historical_quote_import_revisions_import_idx ON public.qms_historical_quote_import_revisions USING btree (import_id, revision_no DESC);


--
-- Name: qms_historical_quote_imports_linked_quotation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_historical_quote_imports_linked_quotation_idx ON public.qms_historical_quote_imports USING btree (linked_quotation_id) WHERE (linked_quotation_id IS NOT NULL);


--
-- Name: qms_historical_quote_imports_owner_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_historical_quote_imports_owner_created_idx ON public.qms_historical_quote_imports USING btree (owner_auth_user_id, created_at DESC);


--
-- Name: qms_historical_quote_imports_status_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_historical_quote_imports_status_created_idx ON public.qms_historical_quote_imports USING btree (status, created_at DESC);


--
-- Name: qms_item_professional_description_audit_changed_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_item_professional_description_audit_changed_at_idx ON public.qms_item_professional_description_audit USING btree (changed_at DESC);


--
-- Name: qms_item_professional_descriptions_item_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_item_professional_descriptions_item_status_idx ON public.qms_item_professional_descriptions USING btree (item_id, status, version_no DESC);


--
-- Name: qms_item_variant_aliases_lookup_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_item_variant_aliases_lookup_idx ON public.qms_item_variant_aliases USING btree (normalized_alias);


--
-- Name: qms_item_variants_item_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_item_variants_item_idx ON public.qms_item_variants USING btree (standard_item_id, is_active);


--
-- Name: qms_quotation_cost_revisions_quote_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_cost_revisions_quote_idx ON public.qms_quotation_cost_revisions USING btree (quotation_id, cost_revision_no DESC);


--
-- Name: qms_quotation_item_cost_bindings_identity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_item_cost_bindings_identity_idx ON public.qms_quotation_item_cost_bindings USING btree (quote_item_identity_id, status);


--
-- Name: qms_quotation_item_cost_bindings_link_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_item_cost_bindings_link_idx ON public.qms_quotation_item_cost_bindings USING btree (quotation_supplier_link_id);


--
-- Name: qms_quotation_item_identities_quote_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_item_identities_quote_idx ON public.qms_quotation_item_identities USING btree (quotation_id, created_at);


--
-- Name: qms_quotation_revisions_quotation_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_revisions_quotation_created_idx ON public.qms_quotation_revisions USING btree (quotation_id, created_at DESC);


--
-- Name: qms_quotation_revisions_quotation_version_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_revisions_quotation_version_idx ON public.qms_quotation_revisions USING btree (quotation_id, archived_version_number DESC);


--
-- Name: qms_quotation_section_ordinals_quotation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_section_ordinals_quotation_idx ON public.qms_quotation_section_ordinals USING btree (quotation_id);


--
-- Name: qms_quotation_section_prices_quotation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_section_prices_quotation_idx ON public.qms_quotation_section_prices USING btree (quotation_id);


--
-- Name: qms_quotation_supplier_links_quote_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quotation_supplier_links_quote_idx ON public.qms_quotation_supplier_links USING btree (quotation_id, created_at DESC);


--
-- Name: qms_quote_cost_audits_packet_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_cost_audits_packet_idx ON public.qms_quote_cost_audits USING btree (packet_id, created_at DESC);


--
-- Name: qms_quote_cost_lines_version_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_cost_lines_version_idx ON public.qms_quote_cost_lines USING btree (cost_version_id, cost_layer, sort_order);


--
-- Name: qms_quote_cost_packet_files_packet_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_cost_packet_files_packet_idx ON public.qms_quote_cost_packet_files USING btree (packet_id, created_at);


--
-- Name: qms_quote_cost_scope_sources_awarded_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX qms_quote_cost_scope_sources_awarded_key ON public.qms_quote_cost_scope_sources USING btree (scope_id) WHERE ((status = 'confirmed'::text) AND (source_role = 'awarded_cost'::text));


--
-- Name: qms_quote_cost_scope_sources_confirmed_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX qms_quote_cost_scope_sources_confirmed_key ON public.qms_quote_cost_scope_sources USING btree (scope_id, supplier_quote_revision_id) WHERE (status = 'confirmed'::text);


--
-- Name: qms_quote_cost_scope_sources_scope_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_cost_scope_sources_scope_idx ON public.qms_quote_cost_scope_sources USING btree (scope_id, source_role, status);


--
-- Name: qms_quote_cost_scopes_key_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX qms_quote_cost_scopes_key_active ON public.qms_quote_cost_scopes USING btree (packet_id, quote_item_key, component_type) WHERE (status <> 'orphaned'::text);


--
-- Name: qms_quote_cost_scopes_packet_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_cost_scopes_packet_idx ON public.qms_quote_cost_scopes USING btree (packet_id, created_at);


--
-- Name: qms_quote_cost_versions_quote_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_cost_versions_quote_idx ON public.qms_quote_cost_versions USING btree (quotation_id, revision DESC);


--
-- Name: qms_quote_evaluations_quote_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_evaluations_quote_created_idx ON public.qms_quote_evaluations USING btree (quotation_id, created_at DESC);


--
-- Name: qms_quote_exclusion_options_active_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_exclusion_options_active_sort_idx ON public.qms_quote_exclusion_options USING btree (is_active, sort_order, label);


--
-- Name: qms_quote_share_annotations_link_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_share_annotations_link_idx ON public.qms_quote_share_annotations USING btree (share_link_id, created_at);


--
-- Name: qms_quote_share_annotations_quotation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_share_annotations_quotation_idx ON public.qms_quote_share_annotations USING btree (quotation_id, created_at DESC);


--
-- Name: qms_quote_share_links_active_token_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_share_links_active_token_idx ON public.qms_quote_share_links USING btree (token) WHERE (status = 'active'::text);


--
-- Name: qms_quote_share_links_quotation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_share_links_quotation_idx ON public.qms_quote_share_links USING btree (quotation_id, created_at DESC);


--
-- Name: qms_quote_site_media_owner_job_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_site_media_owner_job_idx ON public.qms_quote_site_media USING btree (owner_auth_user_id, job_id, created_at);


--
-- Name: qms_quote_templates_type_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_quote_templates_type_status_idx ON public.qms_quote_templates USING btree (project_type, status);


--
-- Name: qms_supplier_profiles_role_tags_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_supplier_profiles_role_tags_idx ON public.qms_supplier_profiles USING gin (role_tags);


--
-- Name: qms_supplier_profiles_trade_tags_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_supplier_profiles_trade_tags_idx ON public.qms_supplier_profiles USING gin (trade_tags);


--
-- Name: qms_supplier_quote_items_revision_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_supplier_quote_items_revision_idx ON public.qms_supplier_quote_items USING btree (supplier_quote_revision_id, source_item_no);


--
-- Name: qms_supplier_quote_items_variant_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_supplier_quote_items_variant_idx ON public.qms_supplier_quote_items USING btree (standard_variant_id, component_type, normalized_unit_id);


--
-- Name: qms_supplier_quote_sections_revision_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX qms_supplier_quote_sections_revision_idx ON public.qms_supplier_quote_sections USING btree (supplier_quote_revision_id, sort_order);


--
-- Name: quotations_engineering_identity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotations_engineering_identity_idx ON public.quotations USING btree (engineering_identity_id) WHERE (engineering_identity_id IS NOT NULL);


--
-- Name: qms_box_access_log qms_box_access_log_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER qms_box_access_log_append_only BEFORE DELETE OR UPDATE ON public.qms_box_access_log FOR EACH ROW EXECUTE FUNCTION public.qms_reject_box_access_log_mutation();


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_orphan_scopes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER qms_quotation_item_identities_orphan_scopes AFTER UPDATE OF retired_at ON public.qms_quotation_item_identities FOR EACH ROW EXECUTE FUNCTION public.qms_quote_cost_orphan_scopes_on_retire();


--
-- Name: qms_quote_cost_audits qms_quote_cost_audits_block_mutation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER qms_quote_cost_audits_block_mutation BEFORE DELETE OR UPDATE ON public.qms_quote_cost_audits FOR EACH ROW EXECUTE FUNCTION public.qms_quote_cost_audits_block_mutation();


--
-- Name: qms_quote_evaluations qms_quote_evaluations_no_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER qms_quote_evaluations_no_update BEFORE DELETE OR UPDATE ON public.qms_quote_evaluations FOR EACH ROW EXECUTE FUNCTION public.qms_quote_evaluations_immutable();


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_flatten_alias; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER qms_supplier_quote_imports_flatten_alias BEFORE INSERT OR UPDATE OF duplicate_of_import_id ON public.qms_supplier_quote_imports FOR EACH ROW EXECUTE FUNCTION public.qms_supplier_quote_imports_flatten_alias();


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_forbid_alias; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER qms_supplier_quote_revisions_forbid_alias BEFORE INSERT ON public.qms_supplier_quote_revisions FOR EACH ROW EXECUTE FUNCTION public.qms_supplier_quote_revisions_forbid_alias();


--
-- Name: bwa_pitchings trg_bwa_pitchings_customer_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwa_pitchings_customer_stats AFTER INSERT OR DELETE OR UPDATE ON public.bwa_pitchings FOR EACH ROW EXECUTE FUNCTION public.trigger_bwa_pitching_customer_stats();


--
-- Name: bwa_projects trg_bwa_projects_customer_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwa_projects_customer_stats AFTER INSERT OR DELETE OR UPDATE ON public.bwa_projects FOR EACH ROW EXECUTE FUNCTION public.trigger_bwa_project_customer_stats();


--
-- Name: bwa_projects trg_bwa_projects_recalc_bv; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwa_projects_recalc_bv AFTER INSERT OR DELETE OR UPDATE ON public.bwa_projects FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_project_bv_from_project();


--
-- Name: bwf_pitchings trg_bwf_pitchings_customer_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwf_pitchings_customer_stats AFTER INSERT OR DELETE OR UPDATE ON public.bwf_pitchings FOR EACH ROW EXECUTE FUNCTION public.trigger_bwf_pitching_customer_stats();


--
-- Name: bwf_product_master trg_bwf_product_master_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwf_product_master_updated_at BEFORE UPDATE ON public.bwf_product_master FOR EACH ROW EXECUTE FUNCTION public.update_bwf_product_master_updated_at();


--
-- Name: bwf_projects trg_bwf_projects_customer_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwf_projects_customer_stats AFTER INSERT OR DELETE OR UPDATE ON public.bwf_projects FOR EACH ROW EXECUTE FUNCTION public.trigger_bwf_project_customer_stats();


--
-- Name: bwf_projects trg_bwf_projects_recalc_bv; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_bwf_projects_recalc_bv AFTER INSERT OR DELETE OR UPDATE ON public.bwf_projects FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_project_bv_from_project();


--
-- Name: expense_control_waivers trg_expense_control_waivers_no_overlap; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expense_control_waivers_no_overlap BEFORE INSERT OR UPDATE OF item_keys, status, bwa_project_id ON public.expense_control_waivers FOR EACH ROW EXECUTE FUNCTION public.expense_control_waivers_no_overlap();


--
-- Name: expenses trg_expenses_customer_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expenses_customer_stats AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.trigger_expense_customer_stats();


--
-- Name: expenses trg_expenses_expected_payment_date_log; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expenses_expected_payment_date_log BEFORE UPDATE ON public.expenses FOR EACH ROW WHEN (((((old.expected_payment_date AT TIME ZONE 'Asia/Hong_Kong'::text))::date IS DISTINCT FROM ((new.expected_payment_date AT TIME ZONE 'Asia/Hong_Kong'::text))::date) OR (COALESCE(old.expected_payment_date_log, '[]'::jsonb) IS DISTINCT FROM COALESCE(new.expected_payment_date_log, '[]'::jsonb)))) EXECUTE FUNCTION public.trg_log_expected_payment_date();


--
-- Name: expenses trg_expenses_recalc_bv; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_expenses_recalc_bv AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_project_bv_from_child();


--
-- Name: incomes trg_incomes_customer_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incomes_customer_stats AFTER INSERT OR DELETE OR UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.trigger_income_customer_stats();


--
-- Name: incomes trg_incomes_expected_payment_date_log; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incomes_expected_payment_date_log BEFORE UPDATE ON public.incomes FOR EACH ROW WHEN (((((old.expected_payment_date AT TIME ZONE 'Asia/Hong_Kong'::text))::date IS DISTINCT FROM ((new.expected_payment_date AT TIME ZONE 'Asia/Hong_Kong'::text))::date) OR (COALESCE(old.expected_payment_date_log, '[]'::jsonb) IS DISTINCT FROM COALESCE(new.expected_payment_date_log, '[]'::jsonb)))) EXECUTE FUNCTION public.trg_log_expected_payment_date();


--
-- Name: incomes trg_incomes_recalc_bv; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incomes_recalc_bv AFTER INSERT OR DELETE OR UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_project_bv_from_child();


--
-- Name: project_bv trg_project_bv_self_recalc_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_project_bv_self_recalc_insert AFTER INSERT ON public.project_bv REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_recalc_project_bv_self();


--
-- Name: project_bv trg_project_bv_self_recalc_ratio; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_project_bv_self_recalc_ratio AFTER UPDATE OF ratio ON public.project_bv FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_project_bv_on_ratio();


--
-- Name: bwa_pitchings trg_sync_bwa_project_os_schedule_group_on_pitching_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_bwa_project_os_schedule_group_on_pitching_update AFTER UPDATE ON public.bwa_pitchings FOR EACH ROW EXECUTE FUNCTION public.sync_bwa_project_os_schedule_group_from_pitching();


--
-- Name: notifications trigger_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_notifications_updated_at();


--
-- Name: asana_oauth_tokens asana_oauth_tokens_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asana_oauth_tokens
    ADD CONSTRAINT asana_oauth_tokens_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: asana_oauth_tokens asana_oauth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asana_oauth_tokens
    ADD CONSTRAINT asana_oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings bwa_pitchings_quote_project_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT bwa_pitchings_quote_project_type_id_fkey FOREIGN KEY (quote_project_type_id) REFERENCES public.nos_quote_project_types(id);


--
-- Name: bwa_projects bwa_projects_quote_project_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT bwa_projects_quote_project_type_id_fkey FOREIGN KEY (quote_project_type_id) REFERENCES public.nos_quote_project_types(id);


--
-- Name: bwf_project_suppliers bwf_project_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_project_suppliers
    ADD CONSTRAINT bwf_project_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: customer_documents customer_documents_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_documents
    ADD CONSTRAINT customer_documents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_documents customer_documents_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_documents
    ADD CONSTRAINT customer_documents_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.customer_document_types(id);


--
-- Name: design_jobs design_jobs_nos_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_jobs
    ADD CONSTRAINT design_jobs_nos_task_id_fkey FOREIGN KEY (nos_task_id) REFERENCES public.nos_tasks(id);


--
-- Name: design_jobs design_jobs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.design_jobs
    ADD CONSTRAINT design_jobs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: expense_control_waivers expense_control_waivers_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_control_waivers
    ADD CONSTRAINT expense_control_waivers_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.staff(id);


--
-- Name: expense_control_waivers expense_control_waivers_bwa_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_control_waivers
    ADD CONSTRAINT expense_control_waivers_bwa_project_id_fkey FOREIGN KEY (bwa_project_id) REFERENCES public.bwa_projects(id) ON DELETE CASCADE;


--
-- Name: expense_control_waivers expense_control_waivers_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_control_waivers
    ADD CONSTRAINT expense_control_waivers_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.staff(id);


--
-- Name: ai_prompt_by_project_types fk_ai_prompt_by_project_types_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_prompt_by_project_types
    ADD CONSTRAINT fk_ai_prompt_by_project_types_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_quote_demo_items fk_ai_quote_demo_items_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_demo_items
    ADD CONSTRAINT fk_ai_quote_demo_items_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_quote_sub_item_details fk_ai_quote_sub_item_details_ai_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_item_details
    ADD CONSTRAINT fk_ai_quote_sub_item_details_ai_quote_id FOREIGN KEY (ai_quote_id) REFERENCES public.ai_quotes(id) ON DELETE SET NULL;


--
-- Name: ai_quote_sub_item_details fk_ai_quote_sub_item_details_ai_quote_sub_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_item_details
    ADD CONSTRAINT fk_ai_quote_sub_item_details_ai_quote_sub_item_id FOREIGN KEY (ai_quote_sub_item_id) REFERENCES public.ai_quote_sub_items(id) ON DELETE SET NULL;


--
-- Name: ai_quote_sub_item_details fk_ai_quote_sub_item_details_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_item_details
    ADD CONSTRAINT fk_ai_quote_sub_item_details_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_quote_sub_items fk_ai_quote_sub_items_ai_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_items
    ADD CONSTRAINT fk_ai_quote_sub_items_ai_quote_id FOREIGN KEY (ai_quote_id) REFERENCES public.ai_quotes(id) ON DELETE SET NULL;


--
-- Name: ai_quote_sub_items fk_ai_quote_sub_items_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quote_sub_items
    ADD CONSTRAINT fk_ai_quote_sub_items_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_quotes fk_ai_quotes_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_quotes
    ADD CONSTRAINT fk_ai_quotes_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ap_report_remarks fk_ap_report_remarks_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ap_report_remarks
    ADD CONSTRAINT fk_ap_report_remarks_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: ap_report_remarks fk_ap_report_remarks_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ap_report_remarks
    ADD CONSTRAINT fk_ap_report_remarks_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ap_report_remarks fk_ap_report_remarks_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ap_report_remarks
    ADD CONSTRAINT fk_ap_report_remarks_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: ap_report_remarks fk_ap_report_remarks_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ap_report_remarks
    ADD CONSTRAINT fk_ap_report_remarks_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: blocked_views fk_blocked_views_blocked_bu_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_views
    ADD CONSTRAINT fk_blocked_views_blocked_bu_id FOREIGN KEY (blocked_bu_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: blocked_views fk_blocked_views_blocked_member_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_views
    ADD CONSTRAINT fk_blocked_views_blocked_member_id FOREIGN KEY (blocked_member_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: blocked_views fk_blocked_views_blocked_team_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_views
    ADD CONSTRAINT fk_blocked_views_blocked_team_id FOREIGN KEY (blocked_team_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: blocked_views fk_blocked_views_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_views
    ADD CONSTRAINT fk_blocked_views_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: building_comments fk_building_comments_building_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT fk_building_comments_building_id FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;


--
-- Name: building_comments fk_building_comments_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT fk_building_comments_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: building_comments fk_building_comments_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT fk_building_comments_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: building_comments fk_building_comments_evaluator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT fk_building_comments_evaluator_id FOREIGN KEY (evaluator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: building_comments fk_building_comments_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT fk_building_comments_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: building_comments fk_building_comments_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_comments
    ADD CONSTRAINT fk_building_comments_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: building_contacts fk_building_contacts_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_contacts
    ADD CONSTRAINT fk_building_contacts_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: building_files fk_building_files_building_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_files
    ADD CONSTRAINT fk_building_files_building_id FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;


--
-- Name: building_files fk_building_files_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.building_files
    ADD CONSTRAINT fk_building_files_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: buildings fk_buildings_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT fk_buildings_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: buildings fk_buildings_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT fk_buildings_district_id FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: buildings fk_buildings_real_creator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT fk_buildings_real_creator_id FOREIGN KEY (real_creator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_district_id FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_main_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_main_designer_id FOREIGN KEY (main_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_main_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_main_pm_id FOREIGN KEY (main_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_more_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_more_pm_id FOREIGN KEY (more_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_n_financial_year_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_n_financial_year_id FOREIGN KEY (n_financial_year_id) REFERENCES public.financial_years(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_n_service_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_n_service_type_id FOREIGN KEY (n_service_type_id) REFERENCES public.service_types(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_n_team_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_n_team_type_id FOREIGN KEY (n_team_type_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_other_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_other_pm_id FOREIGN KEY (other_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_pitchings fk_bwa_pitchings_r_building_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_pitchings
    ADD CONSTRAINT fk_bwa_pitchings_r_building_id FOREIGN KEY (r_building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_cost_centre_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_cost_centre_id FOREIGN KEY (cost_centre_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_main_air_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_main_air_supplier_id FOREIGN KEY (main_air_supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_main_contractor_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_main_contractor_id FOREIGN KEY (main_contractor_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_main_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_main_designer_id FOREIGN KEY (main_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_main_network_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_main_network_supplier_id FOREIGN KEY (main_network_supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_main_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_main_pm_id FOREIGN KEY (main_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_more_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_more_pm_id FOREIGN KEY (more_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_n_financial_year_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_n_financial_year_id FOREIGN KEY (n_financial_year_id) REFERENCES public.financial_years(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_n_service_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_n_service_type_id FOREIGN KEY (n_service_type_id) REFERENCES public.service_types(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_n_team_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_n_team_type_id FOREIGN KEY (n_team_type_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_other_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_other_pm_id FOREIGN KEY (other_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_r_building_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_r_building_id FOREIGN KEY (r_building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_r_nos_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_r_nos_district_id FOREIGN KEY (r_nos_district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: bwa_projects fk_bwa_projects_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwa_projects
    ADD CONSTRAINT fk_bwa_projects_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwf_major_quotes fk_bwf_major_quotes_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_major_quotes
    ADD CONSTRAINT fk_bwf_major_quotes_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_bwf_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_bwf_pitching_id FOREIGN KEY (bwf_pitching_id) REFERENCES public.bwf_pitchings(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_defect_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_defect_factory_id FOREIGN KEY (defect_factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_defect_member_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_defect_member_id FOREIGN KEY (defect_member_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_defect_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_defect_supplier_id FOREIGN KEY (defect_supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_deliver_to_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_deliver_to_factory_id FOREIGN KEY (deliver_to_factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_installation_team_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_installation_team_id FOREIGN KEY (installation_team_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_n_defect_cause_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_n_defect_cause_id FOREIGN KEY (n_defect_cause_id) REFERENCES public.nos_defect_causes(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_product_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_product_id FOREIGN KEY (product_id) REFERENCES public.bwf_products(id) ON DELETE SET NULL;


--
-- Name: bwf_orders fk_bwf_orders_warehouse_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_orders
    ADD CONSTRAINT fk_bwf_orders_warehouse_id FOREIGN KEY (warehouse_id) REFERENCES public.suppliers(id);


--
-- Name: bwf_pitchings fk_bwf_pitchings_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_district_id FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_main_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_main_designer_id FOREIGN KEY (main_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_main_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_main_pm_id FOREIGN KEY (main_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_more_pms_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_more_pms_id FOREIGN KEY (more_pms_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_bwf_service_types_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_bwf_service_types_id FOREIGN KEY (n_bwf_service_types_id) REFERENCES public.nos_service_type_2(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_customer_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_customer_type_id FOREIGN KEY (n_customer_type_id) REFERENCES public.client_types(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_financial_year_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_financial_year_id FOREIGN KEY (n_financial_year_id) REFERENCES public.financial_years(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_major_quotes_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_major_quotes_id FOREIGN KEY (n_major_quotes_id) REFERENCES public.bwf_major_quotes(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_service_items_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_service_items_id FOREIGN KEY (n_service_items_id) REFERENCES public.service_items(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_source_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_source_id FOREIGN KEY (n_source_id) REFERENCES public.source_types(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_n_team_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_n_team_type_id FOREIGN KEY (n_team_type_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_other_pms_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_other_pms_id FOREIGN KEY (other_pms_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_r_building_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_r_building_id FOREIGN KEY (r_building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;


--
-- Name: bwf_pitchings fk_bwf_pitchings_r_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_pitchings
    ADD CONSTRAINT fk_bwf_pitchings_r_district_id FOREIGN KEY (r_district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: bwf_products fk_bwf_products_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_products
    ADD CONSTRAINT fk_bwf_products_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwf_products fk_bwf_products_product_types_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_products
    ADD CONSTRAINT fk_bwf_products_product_types_id FOREIGN KEY (product_types_id) REFERENCES public.product_types(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_bwf_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_bwf_pitching_id FOREIGN KEY (bwf_pitching_id) REFERENCES public.bwf_pitchings(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_cost_center_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_cost_center_id FOREIGN KEY (cost_center_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_district_id FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_factories_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_factories_id FOREIGN KEY (factories_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_main_contractor_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_main_contractor_id FOREIGN KEY (main_contractor_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_main_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_main_designer_id FOREIGN KEY (main_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_main_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_main_pm_id FOREIGN KEY (main_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_more_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_more_pm_id FOREIGN KEY (more_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_bwf_service_types_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_bwf_service_types_id FOREIGN KEY (n_bwf_service_types_id) REFERENCES public.nos_service_type_2(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_customer_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_customer_type_id FOREIGN KEY (n_customer_type_id) REFERENCES public.client_types(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_financial_year_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_financial_year_id FOREIGN KEY (n_financial_year_id) REFERENCES public.financial_years(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_major_quotes_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_major_quotes_id FOREIGN KEY (n_major_quotes_id) REFERENCES public.bwf_major_quotes(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_service_items_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_service_items_id FOREIGN KEY (n_service_items_id) REFERENCES public.service_items(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_source_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_source_id FOREIGN KEY (n_source_id) REFERENCES public.source_types(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_n_team_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_n_team_type_id FOREIGN KEY (n_team_type_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_other_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_other_pm_id FOREIGN KEY (other_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_r_building_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_r_building_id FOREIGN KEY (r_building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_r_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_r_district_id FOREIGN KEY (r_district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: bwf_projects fk_bwf_projects_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bwf_projects
    ADD CONSTRAINT fk_bwf_projects_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: client_types fk_client_types_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_types
    ADD CONSTRAINT fk_client_types_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cost_centres fk_cost_centres_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cost_centres
    ADD CONSTRAINT fk_cost_centres_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_cust_gift_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_cust_gift_item_id FOREIGN KEY (cust_gift_item_id) REFERENCES public.cr_gift_items(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_delivery_method_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_delivery_method_id FOREIGN KEY (delivery_method_id) REFERENCES public.nos_cr_delivery_methods(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_event_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_event_id FOREIGN KEY (event_id) REFERENCES public.customer_relations(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_handler_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_handler_id FOREIGN KEY (handler_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: cr_event_details fk_cr_event_details_related_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_event_details
    ADD CONSTRAINT fk_cr_event_details_related_staff_id FOREIGN KEY (related_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: cr_gift_items fk_cr_gift_items_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cr_gift_items
    ADD CONSTRAINT fk_cr_gift_items_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_comments fk_customer_comments_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT fk_customer_comments_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_comments fk_customer_comments_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT fk_customer_comments_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: customer_comments fk_customer_comments_evaluator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT fk_customer_comments_evaluator_id FOREIGN KEY (evaluator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: customer_comments fk_customer_comments_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT fk_customer_comments_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: customer_comments fk_customer_comments_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_comments
    ADD CONSTRAINT fk_customer_comments_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: customer_relations fk_customer_relations_cr_event_detail_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_relations
    ADD CONSTRAINT fk_customer_relations_cr_event_detail_id FOREIGN KEY (cr_event_detail_id) REFERENCES public.cr_event_details(id) ON DELETE SET NULL;


--
-- Name: customer_relations fk_customer_relations_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_relations
    ADD CONSTRAINT fk_customer_relations_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customer_relations fk_customer_relations_event_theme_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_relations
    ADD CONSTRAINT fk_customer_relations_event_theme_id FOREIGN KEY (event_theme_id) REFERENCES public.nos_cr_event_themes(id) ON DELETE SET NULL;


--
-- Name: customer_relations fk_customer_relations_event_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_relations
    ADD CONSTRAINT fk_customer_relations_event_type_id FOREIGN KEY (event_type_id) REFERENCES public.nos_cr_event_types(id) ON DELETE SET NULL;


--
-- Name: customer_tags fk_customer_tags_collection_uuid; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT fk_customer_tags_collection_uuid FOREIGN KEY (collection_uuid) REFERENCES public.nos_customer_tags_collection(id) ON DELETE SET NULL;


--
-- Name: customer_tags fk_customer_tags_customer_uuid; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT fk_customer_tags_customer_uuid FOREIGN KEY (customer_uuid) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_tags fk_customer_tags_tag_uuid; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tags
    ADD CONSTRAINT fk_customer_tags_tag_uuid FOREIGN KEY (tag_uuid) REFERENCES public.nos_customer_tags(id) ON DELETE CASCADE;


--
-- Name: customers fk_customers_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customers fk_customers_member_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_member_created_by_id FOREIGN KEY (member_created_by_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: dashboard_sentences fk_dashboard_sentences_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dashboard_sentences
    ADD CONSTRAINT fk_dashboard_sentences_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: default_quote_details fk_default_quote_details_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_details
    ADD CONSTRAINT fk_default_quote_details_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: default_quote_details fk_default_quote_details_default_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_details
    ADD CONSTRAINT fk_default_quote_details_default_quote_id FOREIGN KEY (default_quote_id) REFERENCES public.default_quote_mains(id) ON DELETE SET NULL;


--
-- Name: default_quote_details fk_default_quote_details_default_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_details
    ADD CONSTRAINT fk_default_quote_details_default_section_id FOREIGN KEY (default_section_id) REFERENCES public.default_quote_sections(id) ON DELETE SET NULL;


--
-- Name: default_quote_details fk_default_quote_details_r_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_details
    ADD CONSTRAINT fk_default_quote_details_r_item_id FOREIGN KEY (r_item_id) REFERENCES public.nos_items(id) ON DELETE SET NULL;


--
-- Name: default_quote_mains fk_default_quote_mains_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_mains
    ADD CONSTRAINT fk_default_quote_mains_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: default_quote_mains fk_default_quote_mains_real_creator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_mains
    ADD CONSTRAINT fk_default_quote_mains_real_creator_id FOREIGN KEY (real_creator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: default_quote_sections fk_default_quote_sections_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_sections
    ADD CONSTRAINT fk_default_quote_sections_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: default_quote_sections fk_default_quote_sections_default_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_sections
    ADD CONSTRAINT fk_default_quote_sections_default_quote_id FOREIGN KEY (default_quote_id) REFERENCES public.default_quote_mains(id) ON DELETE SET NULL;


--
-- Name: default_quote_sections fk_default_quote_sections_r_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.default_quote_sections
    ADD CONSTRAINT fk_default_quote_sections_r_section_id FOREIGN KEY (r_section_id) REFERENCES public.nos_sections(id) ON DELETE SET NULL;


--
-- Name: districts fk_districts_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT fk_districts_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: districts fk_districts_region_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT fk_districts_region_id FOREIGN KEY (region_id) REFERENCES public.nos_regions(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_approve_creator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_approve_creator_id FOREIGN KEY (approve_creator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_n_contract_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_n_contract_type_id FOREIGN KEY (n_contract_type_id) REFERENCES public.nos_contracts(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_n_product_types_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_n_product_types_id FOREIGN KEY (n_product_types_id) REFERENCES public.product_types(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_n_supplier_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_n_supplier_type_id FOREIGN KEY (n_supplier_type_id) REFERENCES public.supplier_types(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_payment_method_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_payment_method_id FOREIGN KEY (payment_method_id) REFERENCES public.nos_payment_methods(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: expenses fk_expenses_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: factories fk_factories_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factories
    ADD CONSTRAINT fk_factories_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: factory_files fk_factory_files_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factory_files
    ADD CONSTRAINT fk_factory_files_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: factory_files fk_factory_files_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.factory_files
    ADD CONSTRAINT fk_factory_files_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id) ON DELETE SET NULL;


--
-- Name: financial_years fk_financial_years_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT fk_financial_years_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: income_invoices fk_income_invoices_cost_center_bu_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_invoices
    ADD CONSTRAINT fk_income_invoices_cost_center_bu_id FOREIGN KEY (cost_center_bu_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: income_invoices fk_income_invoices_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_invoices
    ADD CONSTRAINT fk_income_invoices_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: income_invoices fk_income_invoices_income_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_invoices
    ADD CONSTRAINT fk_income_invoices_income_id FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE CASCADE;


--
-- Name: incomes fk_incomes_approve_creator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT fk_incomes_approve_creator_id FOREIGN KEY (approve_creator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: incomes fk_incomes_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT fk_incomes_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: incomes fk_incomes_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT fk_incomes_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: incomes fk_incomes_n_contract_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT fk_incomes_n_contract_type_id FOREIGN KEY (n_contract_type_id) REFERENCES public.nos_contracts(id) ON DELETE SET NULL;


--
-- Name: incomes fk_incomes_payment_method_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT fk_incomes_payment_method_id FOREIGN KEY (payment_method_id) REFERENCES public.nos_payment_methods(id) ON DELETE SET NULL;


--
-- Name: incomes fk_incomes_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT fk_incomes_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_bwf_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_bwf_pitching_id FOREIGN KEY (bwf_pitching_id) REFERENCES public.bwf_pitchings(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_evaluator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_evaluator_id FOREIGN KEY (evaluator_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: internal_comments fk_internal_comments_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.internal_comments
    ADD CONSTRAINT fk_internal_comments_staff_id FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: invoice_sub_items fk_invoice_sub_items_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_sub_items
    ADD CONSTRAINT fk_invoice_sub_items_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoice_sub_items fk_invoice_sub_items_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_sub_items
    ADD CONSTRAINT fk_invoice_sub_items_invoice_id FOREIGN KEY (invoice_id) REFERENCES public.income_invoices(id) ON DELETE SET NULL;


--
-- Name: login_logs fk_login_logs_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT fk_login_logs_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: news_comments fk_news_comments_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT fk_news_comments_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: news_comments fk_news_comments_creator_member_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT fk_news_comments_creator_member_id FOREIGN KEY (creator_member_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: news_comments fk_news_comments_news_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_comments
    ADD CONSTRAINT fk_news_comments_news_id FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE SET NULL;


--
-- Name: news fk_news_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT fk_news_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: news fk_news_creator_member_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT fk_news_creator_member_id FOREIGN KEY (creator_member_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: news fk_news_nos_news_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT fk_news_nos_news_type_id FOREIGN KEY (nos_news_type_id) REFERENCES public.news_types(id) ON DELETE SET NULL;


--
-- Name: news_types fk_news_types_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.news_types
    ADD CONSTRAINT fk_news_types_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_item_quote_project_types fk_niqpt_nos_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_item_quote_project_types
    ADD CONSTRAINT fk_niqpt_nos_item_id FOREIGN KEY (nos_item_id) REFERENCES public.nos_items(id) ON DELETE CASCADE;


--
-- Name: nos_item_quote_project_types fk_niqpt_quote_project_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_item_quote_project_types
    ADD CONSTRAINT fk_niqpt_quote_project_type_id FOREIGN KEY (quote_project_type_id) REFERENCES public.nos_quote_project_types(id) ON DELETE CASCADE;


--
-- Name: nos_ai_quote_types fk_nos_ai_quote_types_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_quote_types
    ADD CONSTRAINT fk_nos_ai_quote_types_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_bv_values fk_nos_bv_values_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_bv_values
    ADD CONSTRAINT fk_nos_bv_values_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_contracts fk_nos_contracts_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_contracts
    ADD CONSTRAINT fk_nos_contracts_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_cr_delivery_methods fk_nos_cr_delivery_methods_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_delivery_methods
    ADD CONSTRAINT fk_nos_cr_delivery_methods_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_cr_event_themes fk_nos_cr_event_themes_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_event_themes
    ADD CONSTRAINT fk_nos_cr_event_themes_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_cr_event_types fk_nos_cr_event_types_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_cr_event_types
    ADD CONSTRAINT fk_nos_cr_event_types_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_customer_purpose fk_nos_customer_purpose_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_purpose
    ADD CONSTRAINT fk_nos_customer_purpose_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_customer_tags_collection fk_nos_customer_tags_collection_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags_collection
    ADD CONSTRAINT fk_nos_customer_tags_collection_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_customer_tags fk_nos_customer_tags_collection_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags
    ADD CONSTRAINT fk_nos_customer_tags_collection_id FOREIGN KEY (collection_id) REFERENCES public.nos_customer_tags_collection(id) ON DELETE SET NULL;


--
-- Name: nos_customer_tags fk_nos_customer_tags_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_customer_tags
    ADD CONSTRAINT fk_nos_customer_tags_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_defect_causes fk_nos_defect_causes_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_defect_causes
    ADD CONSTRAINT fk_nos_defect_causes_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_items fk_nos_items_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_items
    ADD CONSTRAINT fk_nos_items_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: nos_items fk_nos_items_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_items
    ADD CONSTRAINT fk_nos_items_section_id FOREIGN KEY (section_id) REFERENCES public.nos_sections(id) ON DELETE SET NULL;


--
-- Name: nos_items fk_nos_items_unit_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_items
    ADD CONSTRAINT fk_nos_items_unit_id FOREIGN KEY (unit_id) REFERENCES public.nos_units(id) ON DELETE SET NULL;


--
-- Name: nos_sections fk_nos_sections_quote_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_sections
    ADD CONSTRAINT fk_nos_sections_quote_project_id FOREIGN KEY (quote_project_id) REFERENCES public.nos_quote_project_types(id) ON DELETE SET NULL;


--
-- Name: nos_template_items fk_nos_template_items_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_items
    ADD CONSTRAINT fk_nos_template_items_item_id FOREIGN KEY (item_id) REFERENCES public.nos_items(id) ON DELETE SET NULL;


--
-- Name: nos_template_items fk_nos_template_items_template_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_items
    ADD CONSTRAINT fk_nos_template_items_template_id FOREIGN KEY (template_id) REFERENCES public.nos_templates(id) ON DELETE SET NULL;


--
-- Name: nos_template_items fk_nos_template_items_template_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_items
    ADD CONSTRAINT fk_nos_template_items_template_section_id FOREIGN KEY (template_section_id) REFERENCES public.nos_template_sections(id) ON DELETE SET NULL;


--
-- Name: nos_template_sections fk_nos_template_sections_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_sections
    ADD CONSTRAINT fk_nos_template_sections_section_id FOREIGN KEY (section_id) REFERENCES public.nos_sections(id) ON DELETE SET NULL;


--
-- Name: nos_template_sections fk_nos_template_sections_template_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_template_sections
    ADD CONSTRAINT fk_nos_template_sections_template_id FOREIGN KEY (template_id) REFERENCES public.nos_templates(id) ON DELETE SET NULL;


--
-- Name: outstanding_remarks fk_outstanding_remarks_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outstanding_remarks
    ADD CONSTRAINT fk_outstanding_remarks_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: outstanding_remarks fk_outstanding_remarks_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outstanding_remarks
    ADD CONSTRAINT fk_outstanding_remarks_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: outstanding_remarks fk_outstanding_remarks_n_contract_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outstanding_remarks
    ADD CONSTRAINT fk_outstanding_remarks_n_contract_type_id FOREIGN KEY (n_contract_type_id) REFERENCES public.nos_contracts(id) ON DELETE SET NULL;


--
-- Name: outstanding_remarks fk_outstanding_remarks_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outstanding_remarks
    ADD CONSTRAINT fk_outstanding_remarks_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: pitching_bv fk_pitching_bv_bwf_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_bv
    ADD CONSTRAINT fk_pitching_bv_bwf_pitching_id FOREIGN KEY (bwf_pitching_id) REFERENCES public.bwf_pitchings(id) ON DELETE SET NULL;


--
-- Name: pitching_bv fk_pitching_bv_handler_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_bv
    ADD CONSTRAINT fk_pitching_bv_handler_id FOREIGN KEY (handler_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: pitching_bv fk_pitching_bv_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pitching_bv
    ADD CONSTRAINT fk_pitching_bv_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: project_bv fk_project_bv_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT fk_project_bv_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: project_bv fk_project_bv_handler_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT fk_project_bv_handler_id FOREIGN KEY (handler_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: project_bv fk_project_bv_n_financial_year_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT fk_project_bv_n_financial_year_id FOREIGN KEY (n_financial_year_id) REFERENCES public.financial_years(id) ON DELETE SET NULL;


--
-- Name: project_bv fk_project_bv_n_team_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT fk_project_bv_n_team_type_id FOREIGN KEY (n_team_type_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: project_bv fk_project_bv_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_bv
    ADD CONSTRAINT fk_project_bv_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: project_documents fk_project_documents_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT fk_project_documents_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: project_documents fk_project_documents_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT fk_project_documents_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_documents fk_project_documents_doc_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT fk_project_documents_doc_type_id FOREIGN KEY (doc_type_id) REFERENCES public.nos_doc_types(id);


--
-- Name: project_documents fk_project_documents_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT fk_project_documents_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: project_documents fk_project_documents_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT fk_project_documents_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: project_initial_expenses fk_project_initial_expenses_bwf_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_initial_expenses
    ADD CONSTRAINT fk_project_initial_expenses_bwf_pitching_id FOREIGN KEY (bwf_pitching_id) REFERENCES public.bwf_pitchings(id) ON DELETE SET NULL;


--
-- Name: project_initial_expenses fk_project_initial_expenses_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_initial_expenses
    ADD CONSTRAINT fk_project_initial_expenses_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_initial_expenses fk_project_initial_expenses_n_expense_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_initial_expenses
    ADD CONSTRAINT fk_project_initial_expenses_n_expense_type_id FOREIGN KEY (n_expense_type_id) REFERENCES public.supplier_types(id) ON DELETE SET NULL;


--
-- Name: project_initial_expenses fk_project_initial_expenses_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_initial_expenses
    ADD CONSTRAINT fk_project_initial_expenses_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: project_schedule_tasks fk_project_schedule_tasks_bwf_project_with_custom_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedule_tasks
    ADD CONSTRAINT fk_project_schedule_tasks_bwf_project_with_custom_id FOREIGN KEY (bwf_project_with_custom_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: project_schedule_tasks fk_project_schedule_tasks_os_schedule_groups_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedule_tasks
    ADD CONSTRAINT fk_project_schedule_tasks_os_schedule_groups_id FOREIGN KEY (os_schedule_groups_id) REFERENCES public.project_schedule_tasks(id) ON DELETE SET NULL;


--
-- Name: project_schedule_tasks fk_project_schedule_tasks_project_with_custom_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedule_tasks
    ADD CONSTRAINT fk_project_schedule_tasks_project_with_custom_id FOREIGN KEY (project_with_custom_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: project_schedules fk_project_schedules_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT fk_project_schedules_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: project_schedules fk_project_schedules_main_pm_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT fk_project_schedules_main_pm_id FOREIGN KEY (main_pm_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: project_schedules fk_project_schedules_payment_schedule_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT fk_project_schedules_payment_schedule_id FOREIGN KEY (payment_schedule_id) REFERENCES public.project_schedule_tasks(id) ON DELETE SET NULL;


--
-- Name: project_schedules fk_project_schedules_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT fk_project_schedules_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: project_schedules fk_project_schedules_working_schedule_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_schedules
    ADD CONSTRAINT fk_project_schedules_working_schedule_id FOREIGN KEY (working_schedule_id) REFERENCES public.project_schedule_tasks(id) ON DELETE SET NULL;


--
-- Name: project_weekly_reports fk_project_weekly_reports_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_weekly_reports
    ADD CONSTRAINT fk_project_weekly_reports_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: project_weekly_reports fk_project_weekly_reports_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_weekly_reports
    ADD CONSTRAINT fk_project_weekly_reports_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id);


--
-- Name: purchase_orders fk_purchase_orders_cost_centre_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_purchase_orders_cost_centre_id FOREIGN KEY (cost_centre_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: q_term_section_details fk_q_term_section_details_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_section_details
    ADD CONSTRAINT fk_q_term_section_details_quote_id FOREIGN KEY (quote_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: q_term_section_details fk_q_term_section_details_term_head_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_section_details
    ADD CONSTRAINT fk_q_term_section_details_term_head_id FOREIGN KEY (term_head_id) REFERENCES public.q_term_sections(id) ON DELETE SET NULL;


--
-- Name: q_term_sections fk_q_term_sections_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.q_term_sections
    ADD CONSTRAINT fk_q_term_sections_quote_id FOREIGN KEY (quote_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: quotation_expenses fk_quotation_expenses_bwf_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_expenses
    ADD CONSTRAINT fk_quotation_expenses_bwf_pitching_id FOREIGN KEY (bwf_pitching_id) REFERENCES public.bwf_pitchings(id) ON DELETE SET NULL;


--
-- Name: quotation_expenses fk_quotation_expenses_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_expenses
    ADD CONSTRAINT fk_quotation_expenses_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: quotation_expenses fk_quotation_expenses_n_expense_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_expenses
    ADD CONSTRAINT fk_quotation_expenses_n_expense_type_id FOREIGN KEY (n_expense_type_id) REFERENCES public.supplier_types(id) ON DELETE SET NULL;


--
-- Name: quotation_expenses fk_quotation_expenses_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_expenses
    ADD CONSTRAINT fk_quotation_expenses_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: quotation_section_items fk_quotation_section_items_c_unit_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_section_items
    ADD CONSTRAINT fk_quotation_section_items_c_unit_id FOREIGN KEY (c_unit_id) REFERENCES public.nos_units(id) ON DELETE SET NULL;


--
-- Name: quotation_section_items fk_quotation_section_items_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_section_items
    ADD CONSTRAINT fk_quotation_section_items_item_id FOREIGN KEY (item_id) REFERENCES public.nos_items(id) ON DELETE SET NULL;


--
-- Name: quotation_section_items fk_quotation_section_items_quote_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_section_items
    ADD CONSTRAINT fk_quotation_section_items_quote_id FOREIGN KEY (quote_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: quotation_section_items fk_quotation_section_items_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_section_items
    ADD CONSTRAINT fk_quotation_section_items_section_id FOREIGN KEY (section_id) REFERENCES public.quotation_sections(id) ON DELETE CASCADE;


--
-- Name: quotation_sections fk_quotation_sections_quotation_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_sections
    ADD CONSTRAINT fk_quotation_sections_quotation_id FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_sections fk_quotation_sections_r_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_sections
    ADD CONSTRAINT fk_quotation_sections_r_section_id FOREIGN KEY (r_section_id) REFERENCES public.nos_sections(id) ON DELETE SET NULL;


--
-- Name: quotations fk_quotations_contract_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT fk_quotations_contract_type_id FOREIGN KEY (contract_type_id) REFERENCES public.nos_contracts(id) ON DELETE SET NULL;


--
-- Name: quotations fk_quotations_cost_centre_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT fk_quotations_cost_centre_id FOREIGN KEY (cost_centre_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: quotations fk_quotations_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT fk_quotations_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: quotations fk_quotations_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT fk_quotations_customer_id FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: quotations fk_quotations_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT fk_quotations_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: quotations fk_quotations_project_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT fk_quotations_project_type_id FOREIGN KEY (project_type_id) REFERENCES public.nos_quote_project_types(id) ON DELETE SET NULL;


--
-- Name: receipts fk_receipts_cost_center_bu_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_cost_center_bu_id FOREIGN KEY (cost_center_bu_id) REFERENCES public.cost_centres(id);


--
-- Name: receipts fk_receipts_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: receipts fk_receipts_income_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_income_id FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE SET NULL;


--
-- Name: receipts fk_receipts_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT fk_receipts_invoice_id FOREIGN KEY (invoice_id) REFERENCES public.income_invoices(id) ON DELETE SET NULL;


--
-- Name: recurring_incomes fk_recurring_incomes_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_incomes
    ADD CONSTRAINT fk_recurring_incomes_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: recurring_incomes fk_recurring_incomes_r_incomes_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_incomes
    ADD CONSTRAINT fk_recurring_incomes_r_incomes_id FOREIGN KEY (r_incomes_id) REFERENCES public.incomes(id) ON DELETE SET NULL;


--
-- Name: site_status_item_quantities fk_site_status_item_quantities_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_item_quantities
    ADD CONSTRAINT fk_site_status_item_quantities_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: site_status_item_quantities fk_site_status_item_quantities_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_item_quantities
    ADD CONSTRAINT fk_site_status_item_quantities_item_id FOREIGN KEY (item_id) REFERENCES public.nos_site_status_items(id) ON DELETE SET NULL;


--
-- Name: site_statuses fk_site_statuses_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_statuses
    ADD CONSTRAINT fk_site_statuses_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: site_statuses fk_site_statuses_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_statuses
    ADD CONSTRAINT fk_site_statuses_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: site_statuses fk_site_statuses_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_statuses
    ADD CONSTRAINT fk_site_statuses_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: staff_supplier_comments fk_ssc_bwf_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT fk_ssc_bwf_project_id FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id);


--
-- Name: staff_supplier_comments fk_ssc_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT fk_ssc_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: staff_supplier_comments fk_ssc_evaluator_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT fk_ssc_evaluator_id FOREIGN KEY (evaluator_id) REFERENCES public.staff(id);


--
-- Name: staff_supplier_comments fk_ssc_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT fk_ssc_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: staff_supplier_comments fk_ssc_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT fk_ssc_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id);


--
-- Name: staff_supplier_comments fk_ssc_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_supplier_comments
    ADD CONSTRAINT fk_ssc_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: supplier_supplier_types fk_sst_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_types
    ADD CONSTRAINT fk_sst_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_supplier_types fk_sst_supplier_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_types
    ADD CONSTRAINT fk_sst_supplier_type_id FOREIGN KEY (supplier_type_id) REFERENCES public.supplier_types(id) ON DELETE CASCADE;


--
-- Name: supplier_supplier_tags fk_sst_tags_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_tags
    ADD CONSTRAINT fk_sst_tags_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: supplier_supplier_tags fk_sst_tags_supplier_tag_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_supplier_tags
    ADD CONSTRAINT fk_sst_tags_supplier_tag_id FOREIGN KEY (supplier_tag_id) REFERENCES public.nos_supplier_tags(id) ON DELETE CASCADE;


--
-- Name: staff fk_staff_bu_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT fk_staff_bu_id FOREIGN KEY (bu_id) REFERENCES public.cost_centres(id) ON DELETE SET NULL;


--
-- Name: staff fk_staff_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT fk_staff_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff fk_staff_n_team_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT fk_staff_n_team_type_id FOREIGN KEY (n_team_type_id) REFERENCES public.team_types(id) ON DELETE SET NULL;


--
-- Name: supplier_files fk_supplier_files_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_files
    ADD CONSTRAINT fk_supplier_files_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_files fk_supplier_files_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_files
    ADD CONSTRAINT fk_supplier_files_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: supplier_files fk_supplier_files_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_files
    ADD CONSTRAINT fk_supplier_files_type_id FOREIGN KEY (type_id) REFERENCES public.supplier_file_types(id) ON DELETE SET NULL;


--
-- Name: supplier_pricings fk_supplier_pricings_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT fk_supplier_pricings_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_pricings fk_supplier_pricings_editor_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT fk_supplier_pricings_editor_id FOREIGN KEY (editor_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: supplier_pricings fk_supplier_pricings_item_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT fk_supplier_pricings_item_id FOREIGN KEY (item_id) REFERENCES public.nos_items(id) ON DELETE SET NULL;


--
-- Name: supplier_pricings fk_supplier_pricings_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT fk_supplier_pricings_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: supplier_pricings fk_supplier_pricings_unit_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_pricings
    ADD CONSTRAINT fk_supplier_pricings_unit_id FOREIGN KEY (unit_id) REFERENCES public.nos_units(id) ON DELETE SET NULL;


--
-- Name: supplier_recent_statuses fk_supplier_recent_statuses_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_recent_statuses
    ADD CONSTRAINT fk_supplier_recent_statuses_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_recent_statuses fk_supplier_recent_statuses_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_recent_statuses
    ADD CONSTRAINT fk_supplier_recent_statuses_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: supplier_register_forms fk_supplier_register_forms_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_register_forms
    ADD CONSTRAINT fk_supplier_register_forms_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supplier_register_forms fk_supplier_register_forms_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_register_forms
    ADD CONSTRAINT fk_supplier_register_forms_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: suppliers fk_suppliers_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT fk_suppliers_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: suppliers fk_suppliers_district_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT fk_suppliers_district_id FOREIGN KEY (district_id) REFERENCES public.districts(id) ON DELETE SET NULL;


--
-- Name: suppliers fk_suppliers_n_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT fk_suppliers_n_type_id FOREIGN KEY (n_type_id) REFERENCES public.supplier_types(id) ON DELETE SET NULL;


--
-- Name: target_sales fk_target_sales_financial_year_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.target_sales
    ADD CONSTRAINT fk_target_sales_financial_year_id FOREIGN KEY (financial_year_id) REFERENCES public.financial_years(id) ON DELETE SET NULL;


--
-- Name: tender_bids fk_tender_bids_witness_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_bids
    ADD CONSTRAINT fk_tender_bids_witness_id FOREIGN KEY (witness_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: tender_messages fk_tender_messages_bids_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_messages
    ADD CONSTRAINT fk_tender_messages_bids_id FOREIGN KEY (bids_id) REFERENCES public.tender_bids(id) ON DELETE SET NULL;


--
-- Name: tender_messages fk_tender_messages_reply_to_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_messages
    ADD CONSTRAINT fk_tender_messages_reply_to_id FOREIGN KEY (reply_to_id) REFERENCES public.tender_messages(id) ON DELETE SET NULL;


--
-- Name: tenders fk_tenders_drawing_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT fk_tenders_drawing_designer_id FOREIGN KEY (drawing_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: tenders fk_tenders_project_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT fk_tenders_project_type_id FOREIGN KEY (project_type_id) REFERENCES public.project_types(id) ON DELETE SET NULL;


--
-- Name: tenders fk_tenders_supplier_type_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT fk_tenders_supplier_type_id FOREIGN KEY (supplier_type_id) REFERENCES public.supplier_types(id) ON DELETE SET NULL;


--
-- Name: term_template_section_details fk_term_template_section_details_template_name_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_section_details
    ADD CONSTRAINT fk_term_template_section_details_template_name_id FOREIGN KEY (template_name_id) REFERENCES public.term_template_types(id) ON DELETE SET NULL;


--
-- Name: term_template_section_details fk_term_template_section_details_template_section_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_section_details
    ADD CONSTRAINT fk_term_template_section_details_template_section_id FOREIGN KEY (template_section_id) REFERENCES public.term_template_sections(id) ON DELETE SET NULL;


--
-- Name: term_template_sections fk_term_template_sections_template_name_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.term_template_sections
    ADD CONSTRAINT fk_term_template_sections_template_name_id FOREIGN KEY (template_name_id) REFERENCES public.term_template_types(id) ON DELETE SET NULL;


--
-- Name: three_d_collections fk_three_d_collections_collab_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT fk_three_d_collections_collab_designer_id FOREIGN KEY (collab_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: three_d_collections fk_three_d_collections_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT fk_three_d_collections_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: three_d_collections fk_three_d_collections_main_designer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT fk_three_d_collections_main_designer_id FOREIGN KEY (main_designer_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: three_d_collections fk_three_d_collections_r_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT fk_three_d_collections_r_pitching_id FOREIGN KEY (r_pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: three_d_collections fk_three_d_collections_r_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_collections
    ADD CONSTRAINT fk_three_d_collections_r_project_id FOREIGN KEY (r_project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: three_d_renders fk_three_d_renders_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_renders
    ADD CONSTRAINT fk_three_d_renders_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: three_d_renders fk_three_d_renders_pitching_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_renders
    ADD CONSTRAINT fk_three_d_renders_pitching_id FOREIGN KEY (pitching_id) REFERENCES public.bwa_pitchings(id) ON DELETE SET NULL;


--
-- Name: three_d_renders fk_three_d_renders_project_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_renders
    ADD CONSTRAINT fk_three_d_renders_project_id FOREIGN KEY (project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: three_d_renders fk_three_d_renders_r_3d_collection_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.three_d_renders
    ADD CONSTRAINT fk_three_d_renders_r_3d_collection_id FOREIGN KEY (r_3d_collection_id) REFERENCES public.three_d_collections(id) ON DELETE SET NULL;


--
-- Name: users fk_users_created_by_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_created_by_id FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_users_member_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_member_id FOREIGN KEY (member_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: users fk_users_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: incomes incomes_expiry_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_expiry_reason_id_fkey FOREIGN KEY (expiry_reason_id) REFERENCES public.income_expiry_reasons(id) ON DELETE RESTRICT;


--
-- Name: man_hour_dates man_hour_dates_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_dates
    ADD CONSTRAINT man_hour_dates_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: man_hour_pinned man_hour_pinned_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_pinned
    ADD CONSTRAINT man_hour_pinned_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: man_hour_tasks man_hour_tasks_design_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_tasks
    ADD CONSTRAINT man_hour_tasks_design_job_id_fkey FOREIGN KEY (design_job_id) REFERENCES public.design_jobs(id) ON DELETE SET NULL;


--
-- Name: man_hour_tasks man_hour_tasks_man_hour_date_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.man_hour_tasks
    ADD CONSTRAINT man_hour_tasks_man_hour_date_id_fkey FOREIGN KEY (man_hour_date_id) REFERENCES public.man_hour_dates(id) ON DELETE CASCADE;


--
-- Name: nos_ai_tools nos_ai_tools_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos_ai_tools
    ADD CONSTRAINT nos_ai_tools_category_fkey FOREIGN KEY (category) REFERENCES public.nos_ai_tool_types(code) ON UPDATE CASCADE;


--
-- Name: notifications notifications_bwa_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_bwa_project_id_fkey FOREIGN KEY (bwa_project_id) REFERENCES public.bwa_projects(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_bwf_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_bwf_project_id_fkey FOREIGN KEY (bwf_project_id) REFERENCES public.bwf_projects(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_income_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.incomes(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_recipient_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_staff_id_fkey FOREIGN KEY (recipient_staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: permission_assignments permission_assignments_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permission_assignments
    ADD CONSTRAINT permission_assignments_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: qms_cost_coverages qms_cost_coverages_cost_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_coverages
    ADD CONSTRAINT qms_cost_coverages_cost_line_id_fkey FOREIGN KEY (cost_line_id) REFERENCES public.qms_quote_cost_lines(id) ON DELETE CASCADE;


--
-- Name: qms_cost_coverages qms_cost_coverages_cost_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_coverages
    ADD CONSTRAINT qms_cost_coverages_cost_version_id_fkey FOREIGN KEY (cost_version_id) REFERENCES public.qms_quote_cost_versions(id) ON DELETE CASCADE;


--
-- Name: qms_cost_coverages qms_cost_coverages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_coverages
    ADD CONSTRAINT qms_cost_coverages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_cost_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_cost_line_id_fkey FOREIGN KEY (cost_line_id) REFERENCES public.qms_quote_cost_lines(id) ON DELETE CASCADE;


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_estimate_run_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_estimate_run_fk FOREIGN KEY (estimate_run_id) REFERENCES public.qms_estimate_runs(id) ON DELETE SET NULL;


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_selected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_selected_by_fkey FOREIGN KEY (selected_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_supplier_quote_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_supplier_quote_item_id_fkey FOREIGN KEY (supplier_quote_item_id) REFERENCES public.qms_supplier_quote_items(id) ON DELETE RESTRICT;


--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_supplier_quote_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_cost_source_snapshots
    ADD CONSTRAINT qms_cost_source_snapshots_supplier_quote_revision_id_fkey FOREIGN KEY (supplier_quote_revision_id) REFERENCES public.qms_supplier_quote_revisions(id) ON DELETE RESTRICT;


--
-- Name: qms_drawing_analyses qms_drawing_analyses_owner_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_drawing_analyses
    ADD CONSTRAINT qms_drawing_analyses_owner_auth_user_id_fkey FOREIGN KEY (owner_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_estimate_runs qms_estimate_runs_estimated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_estimate_runs
    ADD CONSTRAINT qms_estimate_runs_estimated_by_fkey FOREIGN KEY (estimated_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_estimate_runs qms_estimate_runs_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_estimate_runs
    ADD CONSTRAINT qms_estimate_runs_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_estimate_runs qms_estimate_runs_standard_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_estimate_runs
    ADD CONSTRAINT qms_estimate_runs_standard_variant_id_fkey FOREIGN KEY (standard_variant_id) REFERENCES public.qms_item_variants(id) ON DELETE RESTRICT;


--
-- Name: qms_historical_quote_import_revisions qms_historical_quote_import_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_import_revisions
    ADD CONSTRAINT qms_historical_quote_import_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_historical_quote_import_revisions qms_historical_quote_import_revisions_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_import_revisions
    ADD CONSTRAINT qms_historical_quote_import_revisions_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.qms_historical_quote_imports(id) ON DELETE RESTRICT;


--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_linked_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_imports
    ADD CONSTRAINT qms_historical_quote_imports_linked_quotation_id_fkey FOREIGN KEY (linked_quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_owner_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_imports
    ADD CONSTRAINT qms_historical_quote_imports_owner_auth_user_id_fkey FOREIGN KEY (owner_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_historical_quote_imports
    ADD CONSTRAINT qms_historical_quote_imports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_item_professional_description_audit qms_item_professional_description_audit_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_professional_description_audit
    ADD CONSTRAINT qms_item_professional_description_audit_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.qms_item_professional_descriptions(id) ON DELETE RESTRICT;


--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_professional_descriptions
    ADD CONSTRAINT qms_item_professional_descriptions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.nos_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: qms_item_variant_aliases qms_item_variant_aliases_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_variant_aliases
    ADD CONSTRAINT qms_item_variant_aliases_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.qms_item_variants(id) ON DELETE CASCADE;


--
-- Name: qms_item_variants qms_item_variants_standard_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_item_variants
    ADD CONSTRAINT qms_item_variants_standard_item_id_fkey FOREIGN KEY (standard_item_id) REFERENCES public.nos_items(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_cost_revisions qms_quotation_cost_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_cost_revisions
    ADD CONSTRAINT qms_quotation_cost_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_cost_revisions qms_quotation_cost_revisions_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_cost_revisions
    ADD CONSTRAINT qms_quotation_cost_revisions_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_industries qms_quotation_industries_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_industries
    ADD CONSTRAINT qms_quotation_industries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_binding_quotation_supplier_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_cost_bindings
    ADD CONSTRAINT qms_quotation_item_cost_binding_quotation_supplier_link_id_fkey FOREIGN KEY (quotation_supplier_link_id) REFERENCES public.qms_quotation_supplier_links(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_bindings_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_cost_bindings
    ADD CONSTRAINT qms_quotation_item_cost_bindings_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_bindings_cost_scope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_cost_bindings
    ADD CONSTRAINT qms_quotation_item_cost_bindings_cost_scope_id_fkey FOREIGN KEY (cost_scope_id) REFERENCES public.qms_quote_cost_scopes(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_bindings_quote_item_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_cost_bindings
    ADD CONSTRAINT qms_quotation_item_cost_bindings_quote_item_identity_id_fkey FOREIGN KEY (quote_item_identity_id) REFERENCES public.qms_quotation_item_identities(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_bindings_supplier_quote_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_cost_bindings
    ADD CONSTRAINT qms_quotation_item_cost_bindings_supplier_quote_item_id_fkey FOREIGN KEY (supplier_quote_item_id) REFERENCES public.qms_supplier_quote_items(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_identities
    ADD CONSTRAINT qms_quotation_item_identities_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.nos_items(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_current_quotation_section_it_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_identities
    ADD CONSTRAINT qms_quotation_item_identities_current_quotation_section_it_fkey FOREIGN KEY (current_quotation_section_item_id) REFERENCES public.quotation_section_items(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_item_identities
    ADD CONSTRAINT qms_quotation_item_identities_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_remarks qms_quotation_remarks_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_remarks
    ADD CONSTRAINT qms_quotation_remarks_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_remarks qms_quotation_remarks_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_remarks
    ADD CONSTRAINT qms_quotation_remarks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_revisions qms_quotation_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_revisions
    ADD CONSTRAINT qms_quotation_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_section_ordinals qms_quotation_section_ordinals_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_ordinals
    ADD CONSTRAINT qms_quotation_section_ordinals_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_section_ordinals qms_quotation_section_ordinals_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_ordinals
    ADD CONSTRAINT qms_quotation_section_ordinals_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.quotation_sections(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_section_ordinals qms_quotation_section_ordinals_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_ordinals
    ADD CONSTRAINT qms_quotation_section_ordinals_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_section_prices qms_quotation_section_prices_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_prices
    ADD CONSTRAINT qms_quotation_section_prices_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_section_prices qms_quotation_section_prices_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_prices
    ADD CONSTRAINT qms_quotation_section_prices_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.quotation_sections(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_section_prices qms_quotation_section_prices_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_section_prices
    ADD CONSTRAINT qms_quotation_section_prices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_site_conditions qms_quotation_site_conditions_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_site_conditions
    ADD CONSTRAINT qms_quotation_site_conditions_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_site_conditions qms_quotation_site_conditions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_site_conditions
    ADD CONSTRAINT qms_quotation_site_conditions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_supplier_links
    ADD CONSTRAINT qms_quotation_supplier_links_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_supplier_links
    ADD CONSTRAINT qms_quotation_supplier_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_supplier_links
    ADD CONSTRAINT qms_quotation_supplier_links_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_supplier_links
    ADD CONSTRAINT qms_quotation_supplier_links_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_supplier_quote_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quotation_supplier_links
    ADD CONSTRAINT qms_quotation_supplier_links_supplier_quote_revision_id_fkey FOREIGN KEY (supplier_quote_revision_id) REFERENCES public.qms_supplier_quote_revisions(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_audits qms_quote_cost_audits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_audits
    ADD CONSTRAINT qms_quote_cost_audits_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_audits qms_quote_cost_audits_packet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_audits
    ADD CONSTRAINT qms_quote_cost_audits_packet_id_fkey FOREIGN KEY (packet_id) REFERENCES public.qms_quote_cost_packets(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_lines qms_quote_cost_lines_cost_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_lines
    ADD CONSTRAINT qms_quote_cost_lines_cost_version_id_fkey FOREIGN KEY (cost_version_id) REFERENCES public.qms_quote_cost_versions(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_lines qms_quote_cost_lines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_lines
    ADD CONSTRAINT qms_quote_cost_lines_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_lines qms_quote_cost_lines_included_by_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_lines
    ADD CONSTRAINT qms_quote_cost_lines_included_by_line_id_fkey FOREIGN KEY (included_by_line_id) REFERENCES public.qms_quote_cost_lines(id) ON DELETE SET NULL;


--
-- Name: qms_quote_cost_packet_files qms_quote_cost_packet_files_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packet_files
    ADD CONSTRAINT qms_quote_cost_packet_files_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.qms_supplier_quote_imports(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_packet_files qms_quote_cost_packet_files_packet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packet_files
    ADD CONSTRAINT qms_quote_cost_packet_files_packet_id_fkey FOREIGN KEY (packet_id) REFERENCES public.qms_quote_cost_packets(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_packet_files qms_quote_cost_packet_files_signature_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packet_files
    ADD CONSTRAINT qms_quote_cost_packet_files_signature_confirmed_by_fkey FOREIGN KEY (signature_confirmed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_packets qms_quote_cost_packets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packets
    ADD CONSTRAINT qms_quote_cost_packets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_packets qms_quote_cost_packets_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_packets
    ADD CONSTRAINT qms_quote_cost_packets_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_scope_files qms_quote_cost_scope_files_packet_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_files
    ADD CONSTRAINT qms_quote_cost_scope_files_packet_file_id_fkey FOREIGN KEY (packet_file_id) REFERENCES public.qms_quote_cost_packet_files(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_scope_files qms_quote_cost_scope_files_scope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_files
    ADD CONSTRAINT qms_quote_cost_scope_files_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.qms_quote_cost_scopes(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_scope_sources qms_quote_cost_scope_sources_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_sources
    ADD CONSTRAINT qms_quote_cost_scope_sources_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_scope_sources qms_quote_cost_scope_sources_scope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_sources
    ADD CONSTRAINT qms_quote_cost_scope_sources_scope_id_fkey FOREIGN KEY (scope_id) REFERENCES public.qms_quote_cost_scopes(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_scope_sources qms_quote_cost_scope_sources_supplier_quote_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scope_sources
    ADD CONSTRAINT qms_quote_cost_scope_sources_supplier_quote_revision_id_fkey FOREIGN KEY (supplier_quote_revision_id) REFERENCES public.qms_supplier_quote_revisions(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_scopes qms_quote_cost_scopes_packet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scopes
    ADD CONSTRAINT qms_quote_cost_scopes_packet_id_fkey FOREIGN KEY (packet_id) REFERENCES public.qms_quote_cost_packets(id) ON DELETE CASCADE;


--
-- Name: qms_quote_cost_scopes qms_quote_cost_scopes_quote_item_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scopes
    ADD CONSTRAINT qms_quote_cost_scopes_quote_item_key_fkey FOREIGN KEY (quote_item_key) REFERENCES public.qms_quotation_item_identities(id) ON DELETE SET NULL;


--
-- Name: qms_quote_cost_scopes qms_quote_cost_scopes_target_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_scopes
    ADD CONSTRAINT qms_quote_cost_scopes_target_confirmed_by_fkey FOREIGN KEY (target_confirmed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_versions qms_quote_cost_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_versions
    ADD CONSTRAINT qms_quote_cost_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_versions qms_quote_cost_versions_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_versions
    ADD CONSTRAINT qms_quote_cost_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_cost_versions qms_quote_cost_versions_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_cost_versions
    ADD CONSTRAINT qms_quote_cost_versions_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: qms_quote_evaluations qms_quote_evaluations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_evaluations
    ADD CONSTRAINT qms_quote_evaluations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_evaluations qms_quote_evaluations_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_evaluations
    ADD CONSTRAINT qms_quote_evaluations_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE RESTRICT;


--
-- Name: qms_quote_share_annotations qms_quote_share_annotations_share_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_share_annotations
    ADD CONSTRAINT qms_quote_share_annotations_share_link_id_fkey FOREIGN KEY (share_link_id) REFERENCES public.qms_quote_share_links(id) ON DELETE CASCADE;


--
-- Name: qms_quote_site_media qms_quote_site_media_owner_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_quote_site_media
    ADD CONSTRAINT qms_quote_site_media_owner_auth_user_id_fkey FOREIGN KEY (owner_auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: qms_supplier_profiles qms_supplier_profiles_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_profiles
    ADD CONSTRAINT qms_supplier_profiles_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: qms_supplier_quote_import_revisions qms_supplier_quote_import_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_import_revisions
    ADD CONSTRAINT qms_supplier_quote_import_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_import_revisions qms_supplier_quote_import_revisions_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_import_revisions
    ADD CONSTRAINT qms_supplier_quote_import_revisions_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.qms_supplier_quote_imports(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_duplicate_of_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_imports
    ADD CONSTRAINT qms_supplier_quote_imports_duplicate_of_import_id_fkey FOREIGN KEY (duplicate_of_import_id) REFERENCES public.qms_supplier_quote_imports(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_owner_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_imports
    ADD CONSTRAINT qms_supplier_quote_imports_owner_auth_user_id_fkey FOREIGN KEY (owner_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_imports
    ADD CONSTRAINT qms_supplier_quote_imports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_items qms_supplier_quote_items_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_items
    ADD CONSTRAINT qms_supplier_quote_items_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_items qms_supplier_quote_items_standard_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_items
    ADD CONSTRAINT qms_supplier_quote_items_standard_variant_id_fkey FOREIGN KEY (standard_variant_id) REFERENCES public.qms_item_variants(id) ON DELETE SET NULL;


--
-- Name: qms_supplier_quote_items qms_supplier_quote_items_supplier_quote_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_items
    ADD CONSTRAINT qms_supplier_quote_items_supplier_quote_revision_id_fkey FOREIGN KEY (supplier_quote_revision_id) REFERENCES public.qms_supplier_quote_revisions(id) ON DELETE CASCADE;


--
-- Name: qms_supplier_quote_items qms_supplier_quote_items_supplier_quote_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_items
    ADD CONSTRAINT qms_supplier_quote_items_supplier_quote_section_id_fkey FOREIGN KEY (supplier_quote_section_id) REFERENCES public.qms_supplier_quote_sections(id) ON DELETE SET NULL;


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_revisions
    ADD CONSTRAINT qms_supplier_quote_revisions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_revisions
    ADD CONSTRAINT qms_supplier_quote_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_revisions
    ADD CONSTRAINT qms_supplier_quote_revisions_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.qms_supplier_quote_imports(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_revisions
    ADD CONSTRAINT qms_supplier_quote_revisions_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: qms_supplier_quote_sections qms_supplier_quote_sections_supplier_quote_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qms_supplier_quote_sections
    ADD CONSTRAINT qms_supplier_quote_sections_supplier_quote_revision_id_fkey FOREIGN KEY (supplier_quote_revision_id) REFERENCES public.qms_supplier_quote_revisions(id) ON DELETE CASCADE;


--
-- Name: receipt_sub_items receipt_sub_items_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_sub_items
    ADD CONSTRAINT receipt_sub_items_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: receipt_sub_items receipt_sub_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipt_sub_items
    ADD CONSTRAINT receipt_sub_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE;


--
-- Name: site_status_answers site_status_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_answers
    ADD CONSTRAINT site_status_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.site_status_questions(id) ON DELETE CASCADE;


--
-- Name: site_status_answers site_status_answers_site_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_answers
    ADD CONSTRAINT site_status_answers_site_status_id_fkey FOREIGN KEY (site_status_id) REFERENCES public.site_statuses(id) ON DELETE CASCADE;


--
-- Name: site_status_question_options site_status_question_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_question_options
    ADD CONSTRAINT site_status_question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.site_status_questions(id) ON DELETE CASCADE;


--
-- Name: site_status_question_project_types site_status_question_project_types_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_question_project_types
    ADD CONSTRAINT site_status_question_project_types_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.site_status_questions(id) ON DELETE CASCADE;


--
-- Name: site_status_question_project_types site_status_question_project_types_quote_project_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_question_project_types
    ADD CONSTRAINT site_status_question_project_types_quote_project_type_id_fkey FOREIGN KEY (quote_project_type_id) REFERENCES public.nos_quote_project_types(id) ON DELETE CASCADE;


--
-- Name: site_status_questions site_status_questions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_status_questions
    ADD CONSTRAINT site_status_questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.site_status_sections(id) ON DELETE SET NULL;


--
-- Name: staff_bv_deductions staff_bv_deductions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_bv_deductions
    ADD CONSTRAINT staff_bv_deductions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: staff_bv_deductions staff_bv_deductions_n_financial_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_bv_deductions
    ADD CONSTRAINT staff_bv_deductions_n_financial_year_id_fkey FOREIGN KEY (n_financial_year_id) REFERENCES public.financial_years(id) ON DELETE RESTRICT;


--
-- Name: staff_bv_deductions staff_bv_deductions_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_bv_deductions
    ADD CONSTRAINT staff_bv_deductions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: tender_rejected_suppliers tender_rejected_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_rejected_suppliers
    ADD CONSTRAINT tender_rejected_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: tender_selective_suppliers tender_selective_suppliers_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender_selective_suppliers
    ADD CONSTRAINT tender_selective_suppliers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: nos_brands Anon read nos_brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon read nos_brands" ON public.nos_brands FOR SELECT TO anon USING (true);


--
-- Name: nos_work_locations Anon read nos_work_locations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon read nos_work_locations" ON public.nos_work_locations FOR SELECT TO anon USING (true);


--
-- Name: man_hour_pinned Authenticated delete man_hour_pinned; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated delete man_hour_pinned" ON public.man_hour_pinned FOR DELETE TO authenticated USING (true);


--
-- Name: staff_bv_deductions Authenticated delete staff_bv_deductions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated delete staff_bv_deductions" ON public.staff_bv_deductions FOR DELETE TO authenticated USING (true);


--
-- Name: man_hour_pinned Authenticated insert man_hour_pinned; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated insert man_hour_pinned" ON public.man_hour_pinned FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: nos_brands Authenticated insert nos_brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated insert nos_brands" ON public.nos_brands FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: nos_task_types Authenticated insert nos_task_types; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated insert nos_task_types" ON public.nos_task_types FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: nos_tasks Authenticated insert nos_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated insert nos_tasks" ON public.nos_tasks FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: nos_work_locations Authenticated insert nos_work_locations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated insert nos_work_locations" ON public.nos_work_locations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: staff_bv_deductions Authenticated insert staff_bv_deductions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated insert staff_bv_deductions" ON public.staff_bv_deductions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: man_hour_pinned Authenticated read man_hour_pinned; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read man_hour_pinned" ON public.man_hour_pinned FOR SELECT TO authenticated USING (true);


--
-- Name: nos_brands Authenticated read nos_brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read nos_brands" ON public.nos_brands FOR SELECT TO authenticated USING (true);


--
-- Name: nos_task_types Authenticated read nos_task_types; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read nos_task_types" ON public.nos_task_types FOR SELECT TO authenticated USING (true);


--
-- Name: nos_tasks Authenticated read nos_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read nos_tasks" ON public.nos_tasks FOR SELECT TO authenticated USING (true);


--
-- Name: nos_work_locations Authenticated read nos_work_locations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read nos_work_locations" ON public.nos_work_locations FOR SELECT TO authenticated USING (true);


--
-- Name: staff_bv_deductions Authenticated read staff_bv_deductions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read staff_bv_deductions" ON public.staff_bv_deductions FOR SELECT TO authenticated USING (true);


--
-- Name: man_hour_pinned Authenticated update man_hour_pinned; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated update man_hour_pinned" ON public.man_hour_pinned FOR UPDATE TO authenticated USING (true);


--
-- Name: nos_brands Authenticated update nos_brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated update nos_brands" ON public.nos_brands FOR UPDATE TO authenticated USING (true);


--
-- Name: nos_task_types Authenticated update nos_task_types; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated update nos_task_types" ON public.nos_task_types FOR UPDATE TO authenticated USING (true);


--
-- Name: nos_tasks Authenticated update nos_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated update nos_tasks" ON public.nos_tasks FOR UPDATE TO authenticated USING (true);


--
-- Name: nos_work_locations Authenticated update nos_work_locations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated update nos_work_locations" ON public.nos_work_locations FOR UPDATE TO authenticated USING (true);


--
-- Name: staff_bv_deductions Authenticated update staff_bv_deductions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated update staff_bv_deductions" ON public.staff_bv_deductions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: bwa_pitchings BWA pitchings read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "BWA pitchings read access" ON public.bwa_pitchings FOR SELECT USING (true);


--
-- Name: bwa_projects BWA projects read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "BWA projects read access" ON public.bwa_projects FOR SELECT USING (true);


--
-- Name: bwa_projects BWA projects write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "BWA projects write access" ON public.bwa_projects USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_pitchings BWF pitchings read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "BWF pitchings read access" ON public.bwf_pitchings FOR SELECT USING (true);


--
-- Name: bwf_projects BWF projects read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "BWF projects read access" ON public.bwf_projects FOR SELECT USING (true);


--
-- Name: bwf_projects BWF projects write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "BWF projects write access" ON public.bwf_projects USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: buildings Buildings read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Buildings read access" ON public.buildings FOR SELECT USING (true);


--
-- Name: client_types Client types read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Client types read access" ON public.client_types FOR SELECT USING (true);


--
-- Name: cost_centres Cost centres delete access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cost centres delete access" ON public.cost_centres FOR DELETE TO authenticated USING (true);


--
-- Name: cost_centres Cost centres insert access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cost centres insert access" ON public.cost_centres FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cost_centres Cost centres read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cost centres read access" ON public.cost_centres FOR SELECT USING (true);


--
-- Name: cost_centres Cost centres update access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cost centres update access" ON public.cost_centres FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: customers Customers read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers read access" ON public.customers FOR SELECT USING (true);


--
-- Name: customers Customers write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers write access" ON public.customers USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: districts Districts read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Districts read access" ON public.districts FOR SELECT USING (true);


--
-- Name: expenses Expenses read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Expenses read access" ON public.expenses FOR SELECT USING (true);


--
-- Name: expenses Expenses write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Expenses write access" ON public.expenses USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: financial_years Financial years read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Financial years read access" ON public.financial_years FOR SELECT USING (true);


--
-- Name: incomes Incomes read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Incomes read access" ON public.incomes FOR SELECT USING (true);


--
-- Name: incomes Incomes write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Incomes write access" ON public.incomes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwa_pitching_project_types Junction pitching project types read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Junction pitching project types read" ON public.bwa_pitching_project_types FOR SELECT USING (true);


--
-- Name: bwa_pitching_service_types Junction pitching service types read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Junction pitching service types read" ON public.bwa_pitching_service_types FOR SELECT USING (true);


--
-- Name: bwa_project_project_types Junction project project types read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Junction project project types read" ON public.bwa_project_project_types FOR SELECT USING (true);


--
-- Name: bwa_project_service_types Junction project service types read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Junction project service types read" ON public.bwa_project_service_types FOR SELECT USING (true);


--
-- Name: project_types Project types read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Project types read access" ON public.project_types FOR SELECT USING (true);


--
-- Name: purchase_orders Purchase orders read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Purchase orders read access" ON public.purchase_orders FOR SELECT USING (true);


--
-- Name: purchase_orders Purchase orders write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Purchase orders write access" ON public.purchase_orders USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quotations Quotations read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quotations read access" ON public.quotations FOR SELECT USING (true);


--
-- Name: quotations Quotations write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Quotations write access" ON public.quotations USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: design_jobs Service role full access design_jobs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access design_jobs" ON public.design_jobs TO service_role USING (true) WITH CHECK (true);


--
-- Name: man_hour_dates Service role full access man_hour_dates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access man_hour_dates" ON public.man_hour_dates TO service_role USING (true) WITH CHECK (true);


--
-- Name: man_hour_pinned Service role full access man_hour_pinned; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access man_hour_pinned" ON public.man_hour_pinned TO service_role USING (true) WITH CHECK (true);


--
-- Name: man_hour_tasks Service role full access man_hour_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access man_hour_tasks" ON public.man_hour_tasks TO service_role USING (true) WITH CHECK (true);


--
-- Name: nos_brands Service role full access nos_brands; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access nos_brands" ON public.nos_brands TO service_role USING (true) WITH CHECK (true);


--
-- Name: nos_task_types Service role full access nos_task_types; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access nos_task_types" ON public.nos_task_types TO service_role USING (true) WITH CHECK (true);


--
-- Name: nos_tasks Service role full access nos_tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access nos_tasks" ON public.nos_tasks TO service_role USING (true) WITH CHECK (true);


--
-- Name: nos_work_locations Service role full access nos_work_locations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access nos_work_locations" ON public.nos_work_locations TO service_role USING (true) WITH CHECK (true);


--
-- Name: staff_bv_deductions Service role full access staff_bv_deductions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access staff_bv_deductions" ON public.staff_bv_deductions TO service_role USING (true) WITH CHECK (true);


--
-- Name: service_types Service types read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service types read access" ON public.service_types FOR SELECT USING (true);


--
-- Name: source_types Source types read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Source types read access" ON public.source_types FOR SELECT USING (true);


--
-- Name: staff Staff read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff read access" ON public.staff FOR SELECT USING (true);


--
-- Name: staff_supplier_comments Staff supplier comments read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff supplier comments read access" ON public.staff_supplier_comments FOR SELECT USING (true);


--
-- Name: staff_supplier_comments Staff supplier comments write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff supplier comments write access" ON public.staff_supplier_comments USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: staff Staff write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff write access" ON public.staff USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_types Supplier types read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Supplier types read access" ON public.supplier_types FOR SELECT USING (true);


--
-- Name: suppliers Suppliers read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Suppliers read access" ON public.suppliers FOR SELECT USING (true);


--
-- Name: suppliers Suppliers write access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Suppliers write access" ON public.suppliers USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: team_types Team types read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Team types read access" ON public.team_types FOR SELECT USING (true);


--
-- Name: ai_prompt_by_project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_prompt_by_project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompt_by_project_types ai_prompt_by_project_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_prompt_by_project_types auth read" ON public.ai_prompt_by_project_types FOR SELECT USING (true);


--
-- Name: ai_prompt_by_project_types ai_prompt_by_project_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_prompt_by_project_types auth write" ON public.ai_prompt_by_project_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: ai_quote_demo_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_quote_demo_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_quote_demo_items ai_quote_demo_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quote_demo_items auth read" ON public.ai_quote_demo_items FOR SELECT USING (true);


--
-- Name: ai_quote_demo_items ai_quote_demo_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quote_demo_items auth write" ON public.ai_quote_demo_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: ai_quote_sub_item_details; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_quote_sub_item_details ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_quote_sub_item_details ai_quote_sub_item_details auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quote_sub_item_details auth read" ON public.ai_quote_sub_item_details FOR SELECT USING (true);


--
-- Name: ai_quote_sub_item_details ai_quote_sub_item_details auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quote_sub_item_details auth write" ON public.ai_quote_sub_item_details USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: ai_quote_sub_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_quote_sub_items ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_quote_sub_items ai_quote_sub_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quote_sub_items auth read" ON public.ai_quote_sub_items FOR SELECT USING (true);


--
-- Name: ai_quote_sub_items ai_quote_sub_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quote_sub_items auth write" ON public.ai_quote_sub_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: ai_quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ai_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_quotes ai_quotes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quotes auth read" ON public.ai_quotes FOR SELECT USING (true);


--
-- Name: ai_quotes ai_quotes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_quotes auth write" ON public.ai_quotes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: ap_report_remarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ap_report_remarks ENABLE ROW LEVEL SECURITY;

--
-- Name: ap_report_remarks ap_report_remarks auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ap_report_remarks auth read" ON public.ap_report_remarks FOR SELECT USING (true);


--
-- Name: ap_report_remarks ap_report_remarks auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ap_report_remarks auth write" ON public.ap_report_remarks USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: asana_oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.asana_oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blocked_views ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_views blocked_views auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blocked_views auth read" ON public.blocked_views FOR SELECT USING (true);


--
-- Name: blocked_views blocked_views auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blocked_views auth write" ON public.blocked_views USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: building_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.building_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: building_comments building_comments auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "building_comments auth read" ON public.building_comments FOR SELECT USING (true);


--
-- Name: building_comments building_comments auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "building_comments auth write" ON public.building_comments USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: building_contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.building_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: building_contacts building_contacts auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "building_contacts auth read" ON public.building_contacts FOR SELECT USING (true);


--
-- Name: building_contacts building_contacts auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "building_contacts auth write" ON public.building_contacts USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: building_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.building_files ENABLE ROW LEVEL SECURITY;

--
-- Name: building_files building_files auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "building_files auth read" ON public.building_files FOR SELECT USING (true);


--
-- Name: building_files building_files auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "building_files auth write" ON public.building_files USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: buildings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

--
-- Name: bwa_pitching_project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwa_pitching_project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwa_pitching_service_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwa_pitching_service_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwa_pitchings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwa_pitchings ENABLE ROW LEVEL SECURITY;

--
-- Name: bwa_project_project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwa_project_project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwa_project_service_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwa_project_service_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwa_projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwa_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_major_quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_major_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_major_quotes bwf_major_quotes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_major_quotes auth read" ON public.bwf_major_quotes FOR SELECT USING (true);


--
-- Name: bwf_major_quotes bwf_major_quotes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_major_quotes auth write" ON public.bwf_major_quotes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_orders bwf_orders auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_orders auth read" ON public.bwf_orders FOR SELECT USING (true);


--
-- Name: bwf_orders bwf_orders auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_orders auth write" ON public.bwf_orders USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_pitching_bwf_service_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_pitching_bwf_service_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_pitching_bwf_service_types bwf_pitching_bwf_service_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_pitching_bwf_service_types auth read" ON public.bwf_pitching_bwf_service_types FOR SELECT USING (true);


--
-- Name: bwf_pitching_bwf_service_types bwf_pitching_bwf_service_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_pitching_bwf_service_types auth write" ON public.bwf_pitching_bwf_service_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_pitching_major_quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_pitching_major_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_pitching_major_quotes bwf_pitching_major_quotes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_pitching_major_quotes auth read" ON public.bwf_pitching_major_quotes FOR SELECT USING (true);


--
-- Name: bwf_pitching_major_quotes bwf_pitching_major_quotes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_pitching_major_quotes auth write" ON public.bwf_pitching_major_quotes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_pitching_service_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_pitching_service_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_pitching_service_items bwf_pitching_service_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_pitching_service_items auth read" ON public.bwf_pitching_service_items FOR SELECT USING (true);


--
-- Name: bwf_pitching_service_items bwf_pitching_service_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_pitching_service_items auth write" ON public.bwf_pitching_service_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_pitchings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_pitchings ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_product_master; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_product_master ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_product_product_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_product_product_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_product_product_types bwf_product_product_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_product_product_types auth read" ON public.bwf_product_product_types FOR SELECT USING (true);


--
-- Name: bwf_product_product_types bwf_product_product_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_product_product_types auth write" ON public.bwf_product_product_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_products ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_products bwf_products auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_products auth read" ON public.bwf_products FOR SELECT USING (true);


--
-- Name: bwf_products bwf_products auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_products auth write" ON public.bwf_products USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_project_bwf_service_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_project_bwf_service_types ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_project_bwf_service_types bwf_project_bwf_service_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_bwf_service_types auth read" ON public.bwf_project_bwf_service_types FOR SELECT USING (true);


--
-- Name: bwf_project_bwf_service_types bwf_project_bwf_service_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_bwf_service_types auth write" ON public.bwf_project_bwf_service_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_project_factories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_project_factories ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_project_factories bwf_project_factories auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_factories auth read" ON public.bwf_project_factories FOR SELECT USING (true);


--
-- Name: bwf_project_factories bwf_project_factories auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_factories auth write" ON public.bwf_project_factories USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_project_major_quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_project_major_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_project_major_quotes bwf_project_major_quotes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_major_quotes auth read" ON public.bwf_project_major_quotes FOR SELECT USING (true);


--
-- Name: bwf_project_major_quotes bwf_project_major_quotes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_major_quotes auth write" ON public.bwf_project_major_quotes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_project_service_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_project_service_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_project_service_items bwf_project_service_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_service_items auth read" ON public.bwf_project_service_items FOR SELECT USING (true);


--
-- Name: bwf_project_service_items bwf_project_service_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_service_items auth write" ON public.bwf_project_service_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_project_suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_project_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: bwf_project_suppliers bwf_project_suppliers auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_suppliers auth read" ON public.bwf_project_suppliers FOR SELECT USING (true);


--
-- Name: bwf_project_suppliers bwf_project_suppliers auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "bwf_project_suppliers auth write" ON public.bwf_project_suppliers USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bwf_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: client_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_types ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_centres; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cost_centres ENABLE ROW LEVEL SECURITY;

--
-- Name: cr_event_detail_staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cr_event_detail_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: cr_event_detail_staff cr_event_detail_staff auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cr_event_detail_staff auth read" ON public.cr_event_detail_staff FOR SELECT USING (true);


--
-- Name: cr_event_detail_staff cr_event_detail_staff auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cr_event_detail_staff auth write" ON public.cr_event_detail_staff USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: cr_event_details; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cr_event_details ENABLE ROW LEVEL SECURITY;

--
-- Name: cr_event_details cr_event_details auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cr_event_details auth read" ON public.cr_event_details FOR SELECT USING (true);


--
-- Name: cr_event_details cr_event_details auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cr_event_details auth write" ON public.cr_event_details USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: cr_gift_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cr_gift_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cr_gift_items cr_gift_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cr_gift_items auth read" ON public.cr_gift_items FOR SELECT USING (true);


--
-- Name: cr_gift_items cr_gift_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cr_gift_items auth write" ON public.cr_gift_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customer_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_comments customer_comments auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_comments auth read" ON public.customer_comments FOR SELECT USING (true);


--
-- Name: customer_comments customer_comments auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_comments auth write" ON public.customer_comments USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customer_cr_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_cr_events ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_cr_events customer_cr_events auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_cr_events auth read" ON public.customer_cr_events FOR SELECT USING (true);


--
-- Name: customer_cr_events customer_cr_events auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_cr_events auth write" ON public.customer_cr_events USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customer_document_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_document_types ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_document_types customer_document_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_document_types auth read" ON public.customer_document_types FOR SELECT USING (true);


--
-- Name: customer_document_types customer_document_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_document_types auth write" ON public.customer_document_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customer_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_documents customer_documents auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_documents auth read" ON public.customer_documents FOR SELECT USING (true);


--
-- Name: customer_documents customer_documents auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_documents auth write" ON public.customer_documents USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customer_relations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_relations ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_relations customer_relations auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_relations auth read" ON public.customer_relations FOR SELECT USING (true);


--
-- Name: customer_relations customer_relations auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_relations auth write" ON public.customer_relations USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customer_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_tags customer_tags auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_tags auth read" ON public.customer_tags FOR SELECT USING (true);


--
-- Name: customer_tags customer_tags auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customer_tags auth write" ON public.customer_tags USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_task_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_task_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_task_logs daily_task_logs auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "daily_task_logs auth read" ON public.daily_task_logs FOR SELECT USING (true);


--
-- Name: daily_task_logs daily_task_logs auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "daily_task_logs auth write" ON public.daily_task_logs USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: dashboard_sentences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dashboard_sentences ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_sentences dashboard_sentences auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "dashboard_sentences auth read" ON public.dashboard_sentences FOR SELECT USING (true);


--
-- Name: dashboard_sentences dashboard_sentences auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "dashboard_sentences auth write" ON public.dashboard_sentences USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: default_quote_details; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.default_quote_details ENABLE ROW LEVEL SECURITY;

--
-- Name: default_quote_details default_quote_details auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "default_quote_details auth read" ON public.default_quote_details FOR SELECT USING (true);


--
-- Name: default_quote_details default_quote_details auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "default_quote_details auth write" ON public.default_quote_details USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: default_quote_mains; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.default_quote_mains ENABLE ROW LEVEL SECURITY;

--
-- Name: default_quote_mains default_quote_mains auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "default_quote_mains auth read" ON public.default_quote_mains FOR SELECT USING (true);


--
-- Name: default_quote_mains default_quote_mains auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "default_quote_mains auth write" ON public.default_quote_mains USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: default_quote_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.default_quote_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: default_quote_sections default_quote_sections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "default_quote_sections auth read" ON public.default_quote_sections FOR SELECT USING (true);


--
-- Name: default_quote_sections default_quote_sections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "default_quote_sections auth write" ON public.default_quote_sections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: design_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.design_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: design_jobs design_jobs delete policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "design_jobs delete policy" ON public.design_jobs FOR DELETE TO authenticated USING ((auth.role() = 'authenticated'::text));


--
-- Name: design_jobs design_jobs insert policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "design_jobs insert policy" ON public.design_jobs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: design_jobs design_jobs select policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "design_jobs select policy" ON public.design_jobs FOR SELECT TO authenticated USING (true);


--
-- Name: design_jobs design_jobs update policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "design_jobs update policy" ON public.design_jobs FOR UPDATE TO authenticated USING ((auth.role() = 'authenticated'::text));


--
-- Name: districts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_control_waivers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_control_waivers ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_control_waivers expense_control_waivers_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_control_waivers_insert_authenticated ON public.expense_control_waivers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: expense_control_waivers expense_control_waivers_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_control_waivers_select_all ON public.expense_control_waivers FOR SELECT USING (true);


--
-- Name: expense_control_waivers expense_control_waivers_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY expense_control_waivers_update_authenticated ON public.expense_control_waivers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: expense_product_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expense_product_types ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_product_types expense_product_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "expense_product_types auth read" ON public.expense_product_types FOR SELECT USING (true);


--
-- Name: expense_product_types expense_product_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "expense_product_types auth write" ON public.expense_product_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: factories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;

--
-- Name: factories factories auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "factories auth read" ON public.factories FOR SELECT USING (true);


--
-- Name: factories factories auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "factories auth write" ON public.factories USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: factory_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.factory_files ENABLE ROW LEVEL SECURITY;

--
-- Name: factory_files factory_files auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "factory_files auth read" ON public.factory_files FOR SELECT USING (true);


--
-- Name: factory_files factory_files auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "factory_files auth write" ON public.factory_files USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: financial_years; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

--
-- Name: income_expiry_reasons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.income_expiry_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: income_expiry_reasons income_expiry_reasons auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "income_expiry_reasons auth read" ON public.income_expiry_reasons FOR SELECT USING (true);


--
-- Name: income_expiry_reasons income_expiry_reasons auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "income_expiry_reasons auth write" ON public.income_expiry_reasons USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: income_invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.income_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: income_invoices income_invoices auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "income_invoices auth read" ON public.income_invoices FOR SELECT USING (true);


--
-- Name: income_invoices income_invoices auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "income_invoices auth write" ON public.income_invoices USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: incomes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.internal_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_comments internal_comments auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "internal_comments auth read" ON public.internal_comments FOR SELECT USING (true);


--
-- Name: internal_comments internal_comments auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "internal_comments auth write" ON public.internal_comments USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: invoice_sub_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.invoice_sub_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_sub_items invoice_sub_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "invoice_sub_items auth read" ON public.invoice_sub_items FOR SELECT USING (true);


--
-- Name: invoice_sub_items invoice_sub_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "invoice_sub_items auth write" ON public.invoice_sub_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: login_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: login_logs login_logs auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "login_logs auth read" ON public.login_logs FOR SELECT USING (true);


--
-- Name: login_logs login_logs auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "login_logs auth write" ON public.login_logs USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: man_hour_dates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.man_hour_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: man_hour_dates man_hour_dates all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_dates all" ON public.man_hour_dates USING (true) WITH CHECK (true);


--
-- Name: man_hour_dates man_hour_dates delete policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_dates delete policy" ON public.man_hour_dates FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: man_hour_dates man_hour_dates insert policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_dates insert policy" ON public.man_hour_dates FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: man_hour_dates man_hour_dates select policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_dates select policy" ON public.man_hour_dates FOR SELECT USING (true);


--
-- Name: man_hour_dates man_hour_dates update policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_dates update policy" ON public.man_hour_dates FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: man_hour_pinned; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.man_hour_pinned ENABLE ROW LEVEL SECURITY;

--
-- Name: man_hour_pinned man_hour_pinned all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_pinned all" ON public.man_hour_pinned USING (true) WITH CHECK (true);


--
-- Name: man_hour_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.man_hour_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: man_hour_tasks man_hour_tasks all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_tasks all" ON public.man_hour_tasks USING (true) WITH CHECK (true);


--
-- Name: man_hour_tasks man_hour_tasks delete policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_tasks delete policy" ON public.man_hour_tasks FOR DELETE USING ((auth.role() = 'authenticated'::text));


--
-- Name: man_hour_tasks man_hour_tasks insert policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_tasks insert policy" ON public.man_hour_tasks FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: man_hour_tasks man_hour_tasks select policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_tasks select policy" ON public.man_hour_tasks FOR SELECT USING (true);


--
-- Name: man_hour_tasks man_hour_tasks update policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "man_hour_tasks update policy" ON public.man_hour_tasks FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: news; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

--
-- Name: news news auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news auth read" ON public.news FOR SELECT USING (true);


--
-- Name: news news auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news auth write" ON public.news USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: news_comment_liked_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news_comment_liked_members ENABLE ROW LEVEL SECURITY;

--
-- Name: news_comment_liked_members news_comment_liked_members auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_comment_liked_members auth read" ON public.news_comment_liked_members FOR SELECT USING (true);


--
-- Name: news_comment_liked_members news_comment_liked_members auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_comment_liked_members auth write" ON public.news_comment_liked_members USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: news_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: news_comments news_comments auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_comments auth read" ON public.news_comments FOR SELECT USING (true);


--
-- Name: news_comments news_comments auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_comments auth write" ON public.news_comments USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: news_liked_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news_liked_members ENABLE ROW LEVEL SECURITY;

--
-- Name: news_liked_members news_liked_members auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_liked_members auth read" ON public.news_liked_members FOR SELECT USING (true);


--
-- Name: news_liked_members news_liked_members auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_liked_members auth write" ON public.news_liked_members USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: news_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.news_types ENABLE ROW LEVEL SECURITY;

--
-- Name: news_types news_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_types auth read" ON public.news_types FOR SELECT USING (true);


--
-- Name: news_types news_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "news_types auth write" ON public.news_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_ai_quote_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_ai_quote_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_ai_quote_types nos_ai_quote_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_ai_quote_types auth read" ON public.nos_ai_quote_types FOR SELECT USING (true);


--
-- Name: nos_ai_quote_types nos_ai_quote_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_ai_quote_types auth write" ON public.nos_ai_quote_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_ai_tool_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_ai_tool_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_ai_tool_types nos_ai_tool_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_ai_tool_types auth read" ON public.nos_ai_tool_types FOR SELECT USING (true);


--
-- Name: nos_ai_tool_types nos_ai_tool_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_ai_tool_types auth write" ON public.nos_ai_tool_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_ai_tools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_ai_tools ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_ai_tools nos_ai_tools auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_ai_tools auth read" ON public.nos_ai_tools FOR SELECT USING (true);


--
-- Name: nos_ai_tools nos_ai_tools auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_ai_tools auth write" ON public.nos_ai_tools USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_brands; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_brands ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_bv_values; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_bv_values ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_bv_values nos_bv_values auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_bv_values auth read" ON public.nos_bv_values FOR SELECT USING (true);


--
-- Name: nos_bv_values nos_bv_values auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_bv_values auth write" ON public.nos_bv_values USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_contracts nos_contracts auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_contracts auth read" ON public.nos_contracts FOR SELECT USING (true);


--
-- Name: nos_contracts nos_contracts auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_contracts auth write" ON public.nos_contracts USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_cr_delivery_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_cr_delivery_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_cr_delivery_methods nos_cr_delivery_methods auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_cr_delivery_methods auth read" ON public.nos_cr_delivery_methods FOR SELECT USING (true);


--
-- Name: nos_cr_delivery_methods nos_cr_delivery_methods auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_cr_delivery_methods auth write" ON public.nos_cr_delivery_methods USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_cr_event_themes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_cr_event_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_cr_event_themes nos_cr_event_themes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_cr_event_themes auth read" ON public.nos_cr_event_themes FOR SELECT USING (true);


--
-- Name: nos_cr_event_themes nos_cr_event_themes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_cr_event_themes auth write" ON public.nos_cr_event_themes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_cr_event_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_cr_event_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_cr_event_types nos_cr_event_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_cr_event_types auth read" ON public.nos_cr_event_types FOR SELECT USING (true);


--
-- Name: nos_cr_event_types nos_cr_event_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_cr_event_types auth write" ON public.nos_cr_event_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_customer_purpose; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_customer_purpose ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_customer_purpose nos_customer_purpose auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_customer_purpose auth read" ON public.nos_customer_purpose FOR SELECT USING (true);


--
-- Name: nos_customer_purpose nos_customer_purpose auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_customer_purpose auth write" ON public.nos_customer_purpose USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_customer_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_customer_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_customer_tags nos_customer_tags auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_customer_tags auth read" ON public.nos_customer_tags FOR SELECT USING (true);


--
-- Name: nos_customer_tags nos_customer_tags auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_customer_tags auth write" ON public.nos_customer_tags USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_customer_tags_collection; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_customer_tags_collection ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_customer_tags_collection nos_customer_tags_collection auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_customer_tags_collection auth read" ON public.nos_customer_tags_collection FOR SELECT USING (true);


--
-- Name: nos_customer_tags_collection nos_customer_tags_collection auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_customer_tags_collection auth write" ON public.nos_customer_tags_collection USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_defect_causes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_defect_causes ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_defect_causes nos_defect_causes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_defect_causes auth read" ON public.nos_defect_causes FOR SELECT USING (true);


--
-- Name: nos_defect_causes nos_defect_causes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_defect_causes auth write" ON public.nos_defect_causes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_doc_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_doc_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_doc_types nos_doc_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_doc_types auth read" ON public.nos_doc_types FOR SELECT USING (true);


--
-- Name: nos_doc_types nos_doc_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_doc_types auth write" ON public.nos_doc_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_item_quote_project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_item_quote_project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_item_quote_project_types nos_item_quote_project_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_item_quote_project_types auth read" ON public.nos_item_quote_project_types FOR SELECT USING (true);


--
-- Name: nos_item_quote_project_types nos_item_quote_project_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_item_quote_project_types auth write" ON public.nos_item_quote_project_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_items ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_items nos_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_items auth read" ON public.nos_items FOR SELECT USING (true);


--
-- Name: nos_items nos_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_items auth write" ON public.nos_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_payment_methods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_payment_methods nos_payment_methods auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_payment_methods auth read" ON public.nos_payment_methods FOR SELECT USING (true);


--
-- Name: nos_payment_methods nos_payment_methods auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_payment_methods auth write" ON public.nos_payment_methods USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_quote_project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_quote_project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_quote_project_types nos_quote_project_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_quote_project_types auth read" ON public.nos_quote_project_types FOR SELECT USING (true);


--
-- Name: nos_quote_project_types nos_quote_project_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_quote_project_types auth write" ON public.nos_quote_project_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_regions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_regions ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_regions nos_regions auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_regions auth read" ON public.nos_regions FOR SELECT USING (true);


--
-- Name: nos_regions nos_regions auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_regions auth write" ON public.nos_regions USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_sections nos_sections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_sections auth read" ON public.nos_sections FOR SELECT USING (true);


--
-- Name: nos_sections nos_sections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_sections auth write" ON public.nos_sections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_service_type_2; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_service_type_2 ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_service_type_2 nos_service_type_2 auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_service_type_2 auth read" ON public.nos_service_type_2 FOR SELECT USING (true);


--
-- Name: nos_service_type_2 nos_service_type_2 auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_service_type_2 auth write" ON public.nos_service_type_2 USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_site_status_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_site_status_items ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_site_status_items nos_site_status_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_site_status_items auth read" ON public.nos_site_status_items FOR SELECT USING (true);


--
-- Name: nos_site_status_items nos_site_status_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_site_status_items auth write" ON public.nos_site_status_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_supplier_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_supplier_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_supplier_tags nos_supplier_tags auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_supplier_tags auth read" ON public.nos_supplier_tags FOR SELECT USING (true);


--
-- Name: nos_supplier_tags nos_supplier_tags auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_supplier_tags auth write" ON public.nos_supplier_tags USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_task_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_task_types ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_template_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_template_items ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_template_items nos_template_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_template_items auth read" ON public.nos_template_items FOR SELECT USING (true);


--
-- Name: nos_template_items nos_template_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_template_items auth write" ON public.nos_template_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_template_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_template_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_template_sections nos_template_sections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_template_sections auth read" ON public.nos_template_sections FOR SELECT USING (true);


--
-- Name: nos_template_sections nos_template_sections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_template_sections auth write" ON public.nos_template_sections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_templates nos_templates auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_templates auth read" ON public.nos_templates FOR SELECT USING (true);


--
-- Name: nos_templates nos_templates auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_templates auth write" ON public.nos_templates USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_tender_reject_presets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_tender_reject_presets ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_tender_reject_presets nos_tender_reject_presets auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_tender_reject_presets auth read" ON public.nos_tender_reject_presets FOR SELECT USING (true);


--
-- Name: nos_tender_reject_presets nos_tender_reject_presets auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_tender_reject_presets auth write" ON public.nos_tender_reject_presets USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_units; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_units ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_units nos_units auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_units auth read" ON public.nos_units FOR SELECT USING (true);


--
-- Name: nos_units nos_units auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_units auth write" ON public.nos_units USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_website_functions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_website_functions ENABLE ROW LEVEL SECURITY;

--
-- Name: nos_website_functions nos_website_functions auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_website_functions auth read" ON public.nos_website_functions FOR SELECT USING (true);


--
-- Name: nos_website_functions nos_website_functions auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "nos_website_functions auth write" ON public.nos_website_functions USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: nos_work_locations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.nos_work_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_seen; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_seen ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_seen notification_seen auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_seen auth read" ON public.notification_seen FOR SELECT USING (true);


--
-- Name: notification_seen notification_seen auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notification_seen auth write" ON public.notification_seen USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_insert_authenticated ON public.notifications FOR INSERT TO authenticated WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: notifications notifications_select_own_or_developer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_select_own_or_developer ON public.notifications FOR SELECT TO authenticated USING (((recipient_staff_id IN ( SELECT users.member_id
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.member_id IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.is_developer = true))))));


--
-- Name: notifications notifications_update_own_or_developer; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_update_own_or_developer ON public.notifications FOR UPDATE TO authenticated USING (((recipient_staff_id IN ( SELECT users.member_id
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.member_id IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.is_developer = true)))))) WITH CHECK (((recipient_staff_id IN ( SELECT users.member_id
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.member_id IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.auth_user_id = auth.uid()) AND (users.is_developer = true))))));


--
-- Name: outstanding_remarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.outstanding_remarks ENABLE ROW LEVEL SECURITY;

--
-- Name: outstanding_remarks outstanding_remarks auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "outstanding_remarks auth read" ON public.outstanding_remarks FOR SELECT USING (true);


--
-- Name: outstanding_remarks outstanding_remarks auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "outstanding_remarks auth write" ON public.outstanding_remarks USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: permission_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.permission_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: permission_assignments permission_assignments auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permission_assignments auth read" ON public.permission_assignments FOR SELECT USING (true);


--
-- Name: permission_assignments permission_assignments auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permission_assignments auth write" ON public.permission_assignments USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permissions auth read" ON public.permissions FOR SELECT USING (true);


--
-- Name: permissions permissions auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "permissions auth write" ON public.permissions USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: pitching_bv; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pitching_bv ENABLE ROW LEVEL SECURITY;

--
-- Name: pitching_bv pitching_bv auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pitching_bv auth read" ON public.pitching_bv FOR SELECT USING (true);


--
-- Name: pitching_bv pitching_bv auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pitching_bv auth write" ON public.pitching_bv USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: pitching_close_reasons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pitching_close_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: pitching_close_reasons pitching_close_reasons auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pitching_close_reasons auth read" ON public.pitching_close_reasons FOR SELECT USING (true);


--
-- Name: pitching_close_reasons pitching_close_reasons auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pitching_close_reasons auth write" ON public.pitching_close_reasons USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: po_sub_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.po_sub_items ENABLE ROW LEVEL SECURITY;

--
-- Name: po_sub_items po_sub_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "po_sub_items auth read" ON public.po_sub_items FOR SELECT USING (true);


--
-- Name: po_sub_items po_sub_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "po_sub_items auth write" ON public.po_sub_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: product_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

--
-- Name: product_types product_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "product_types auth read" ON public.product_types FOR SELECT USING (true);


--
-- Name: product_types product_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "product_types auth write" ON public.product_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: project_bv; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_bv ENABLE ROW LEVEL SECURITY;

--
-- Name: project_bv project_bv auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_bv auth read" ON public.project_bv FOR SELECT USING (true);


--
-- Name: project_bv project_bv auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_bv auth write" ON public.project_bv USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: project_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: project_documents project_documents auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_documents auth read" ON public.project_documents FOR SELECT USING (true);


--
-- Name: project_documents project_documents auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_documents auth write" ON public.project_documents USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: project_initial_expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_initial_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: project_initial_expenses project_initial_expenses auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_initial_expenses auth read" ON public.project_initial_expenses FOR SELECT USING (true);


--
-- Name: project_initial_expenses project_initial_expenses auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_initial_expenses auth write" ON public.project_initial_expenses USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: project_schedule_tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_schedule_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: project_schedule_tasks project_schedule_tasks all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_schedule_tasks all" ON public.project_schedule_tasks USING (true) WITH CHECK (true);


--
-- Name: project_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: project_schedules project_schedules all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_schedules all" ON public.project_schedules USING (true) WITH CHECK (true);


--
-- Name: project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: project_weekly_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_weekly_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: project_weekly_reports project_weekly_reports auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_weekly_reports auth read" ON public.project_weekly_reports FOR SELECT USING (true);


--
-- Name: project_weekly_reports project_weekly_reports auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "project_weekly_reports auth write" ON public.project_weekly_reports USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: q_term_section_details; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.q_term_section_details ENABLE ROW LEVEL SECURITY;

--
-- Name: q_term_section_details q_term_section_details auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "q_term_section_details auth read" ON public.q_term_section_details FOR SELECT USING (true);


--
-- Name: q_term_section_details q_term_section_details auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "q_term_section_details auth write" ON public.q_term_section_details USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: q_term_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.q_term_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: q_term_sections q_term_sections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "q_term_sections auth read" ON public.q_term_sections FOR SELECT USING (true);


--
-- Name: q_term_sections q_term_sections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "q_term_sections auth write" ON public.q_term_sections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: qms_box_access_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_box_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_box_access_log qms_box_access_log_super_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_box_access_log_super_admin_read ON public.qms_box_access_log FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_cost_coverages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_cost_coverages ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_cost_coverages qms_cost_coverages_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_cost_coverages_select_quote ON public.qms_cost_coverages FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.qms_quote_cost_versions v
     JOIN public.quotations q ON ((q.id = v.quotation_id)))
  WHERE (v.id = qms_cost_coverages.cost_version_id)))));


--
-- Name: qms_cost_source_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_cost_source_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_cost_source_snapshots qms_cost_source_snapshots_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_cost_source_snapshots_select_quote ON public.qms_cost_source_snapshots FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.qms_quote_cost_lines l
     JOIN public.qms_quote_cost_versions v ON ((v.id = l.cost_version_id)))
     JOIN public.quotations q ON ((q.id = v.quotation_id)))
  WHERE (l.id = qms_cost_source_snapshots.cost_line_id)))));


--
-- Name: qms_drawing_analyses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_drawing_analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_drawing_analyses qms_drawing_analyses_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_drawing_analyses_select_own ON public.qms_drawing_analyses FOR SELECT TO authenticated USING ((owner_auth_user_id = auth.uid()));


--
-- Name: qms_estimate_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_estimate_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_estimate_runs qms_estimate_runs_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_estimate_runs_select_quote ON public.qms_estimate_runs FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_estimate_runs.quotation_id)))));


--
-- Name: qms_historical_quote_import_revisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_historical_quote_import_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_historical_quote_import_revisions qms_historical_quote_import_revisions_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_historical_quote_import_revisions_select_own ON public.qms_historical_quote_import_revisions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.qms_historical_quote_imports i
  WHERE ((i.id = qms_historical_quote_import_revisions.import_id) AND (i.owner_auth_user_id = auth.uid())))));


--
-- Name: qms_historical_quote_imports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_historical_quote_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_historical_quote_imports qms_historical_quote_imports_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_historical_quote_imports_select_own ON public.qms_historical_quote_imports FOR SELECT TO authenticated USING ((owner_auth_user_id = auth.uid()));


--
-- Name: qms_item_professional_description_audit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_item_professional_description_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_item_professional_description_audit qms_item_professional_description_audit_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_professional_description_audit_read ON public.qms_item_professional_description_audit FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_item_professional_descriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_item_professional_descriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_professional_descriptions_delete ON public.qms_item_professional_descriptions FOR DELETE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_professional_descriptions_insert ON public.qms_item_professional_descriptions FOR INSERT TO authenticated WITH CHECK (((public.qms_permission_actor_role() = 'super_admin'::text) AND (EXISTS ( SELECT 1
   FROM public.nos_items item
  WHERE (item.id = qms_item_professional_descriptions.item_id)))));


--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_professional_descriptions_read ON public.qms_item_professional_descriptions FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.nos_items item
  WHERE (item.id = qms_item_professional_descriptions.item_id)))));


--
-- Name: qms_item_professional_descriptions qms_item_professional_descriptions_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_professional_descriptions_update ON public.qms_item_professional_descriptions FOR UPDATE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK (((public.qms_permission_actor_role() = 'super_admin'::text) AND (EXISTS ( SELECT 1
   FROM public.nos_items item
  WHERE (item.id = qms_item_professional_descriptions.item_id)))));


--
-- Name: qms_item_variant_aliases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_item_variant_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_item_variant_aliases qms_item_variant_aliases_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_variant_aliases_read ON public.qms_item_variant_aliases FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_item_variant_aliases qms_item_variant_aliases_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_variant_aliases_write ON public.qms_item_variant_aliases TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_item_variants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_item_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_item_variants qms_item_variants_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_variants_read ON public.qms_item_variants FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_item_variants qms_item_variants_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_item_variants_write ON public.qms_item_variants TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_page_permission_audit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_page_permission_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_page_permission_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_page_permission_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_page_permission_audit qms_permission_audit_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_permission_audit_read ON public.qms_page_permission_audit FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_page_permission_settings qms_permission_settings_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_permission_settings_read ON public.qms_page_permission_settings FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_quotation_cost_revisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_cost_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_cost_revisions qms_quotation_cost_revisions_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_cost_revisions_select_quote ON public.qms_quotation_cost_revisions FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_cost_revisions.quotation_id)))));


--
-- Name: qms_quotation_industries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_industries ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_industries qms_quotation_industries_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_industries_select_readable_quotes ON public.qms_quotation_industries FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_industries.quotation_id))));


--
-- Name: qms_quotation_item_cost_bindings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_item_cost_bindings ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_item_cost_bindings qms_quotation_item_cost_bindings_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_item_cost_bindings_select_quote ON public.qms_quotation_item_cost_bindings FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.qms_quotation_item_identities qi
     JOIN public.quotations q ON ((q.id = qi.quotation_id)))
  WHERE (qi.id = qms_quotation_item_cost_bindings.quote_item_identity_id)))));


--
-- Name: qms_quotation_item_identities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_item_identities ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_item_identities qms_quotation_item_identities_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_item_identities_select_quote ON public.qms_quotation_item_identities FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_item_identities.quotation_id)))));


--
-- Name: qms_quotation_remarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_remarks ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_remarks qms_quotation_remarks_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_remarks_select_readable_quotes ON public.qms_quotation_remarks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_remarks.quotation_id))));


--
-- Name: qms_quotation_revisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_revisions qms_quotation_revisions_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_revisions_select_readable_quotes ON public.qms_quotation_revisions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_revisions.quotation_id))));


--
-- Name: qms_quotation_section_ordinals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_section_ordinals ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_section_ordinals qms_quotation_section_ordinals_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_section_ordinals_select_readable_quotes ON public.qms_quotation_section_ordinals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_section_ordinals.quotation_id))));


--
-- Name: qms_quotation_section_prices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_section_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_section_prices qms_quotation_section_prices_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_section_prices_select_readable_quotes ON public.qms_quotation_section_prices FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_section_prices.quotation_id))));


--
-- Name: qms_quotation_site_conditions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_site_conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_site_conditions qms_quotation_site_conditions_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_site_conditions_select_readable_quotes ON public.qms_quotation_site_conditions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_site_conditions.quotation_id))));


--
-- Name: qms_quotation_supplier_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quotation_supplier_links ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quotation_supplier_links qms_quotation_supplier_links_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quotation_supplier_links_select_quote ON public.qms_quotation_supplier_links FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quotation_supplier_links.quotation_id)))));


--
-- Name: qms_quote_cost_audits; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_audits ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_audits qms_quote_cost_audits_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_audits_select_quote ON public.qms_quote_cost_audits FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.qms_quote_cost_packets p
     JOIN public.quotations q ON ((q.id = p.quotation_id)))
  WHERE (p.id = qms_quote_cost_audits.packet_id)))));


--
-- Name: qms_quote_cost_lines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_lines qms_quote_cost_lines_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_lines_select_quote ON public.qms_quote_cost_lines FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.qms_quote_cost_versions v
     JOIN public.quotations q ON ((q.id = v.quotation_id)))
  WHERE (v.id = qms_quote_cost_lines.cost_version_id)))));


--
-- Name: qms_quote_cost_packet_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_packet_files ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_packet_files qms_quote_cost_packet_files_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_packet_files_select_quote ON public.qms_quote_cost_packet_files FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.qms_quote_cost_packets p
     JOIN public.quotations q ON ((q.id = p.quotation_id)))
  WHERE (p.id = qms_quote_cost_packet_files.packet_id)))));


--
-- Name: qms_quote_cost_packets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_packets ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_packets qms_quote_cost_packets_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_packets_select_quote ON public.qms_quote_cost_packets FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quote_cost_packets.quotation_id)))));


--
-- Name: qms_quote_cost_scope_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_scope_files ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_scope_files qms_quote_cost_scope_files_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_scope_files_select_quote ON public.qms_quote_cost_scope_files FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.qms_quote_cost_scopes s
     JOIN public.qms_quote_cost_packets p ON ((p.id = s.packet_id)))
     JOIN public.quotations q ON ((q.id = p.quotation_id)))
  WHERE (s.id = qms_quote_cost_scope_files.scope_id)))));


--
-- Name: qms_quote_cost_scope_sources; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_scope_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_scope_sources qms_quote_cost_scope_sources_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_scope_sources_select_quote ON public.qms_quote_cost_scope_sources FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.qms_quote_cost_scopes s
     JOIN public.qms_quote_cost_packets p ON ((p.id = s.packet_id)))
     JOIN public.quotations q ON ((q.id = p.quotation_id)))
  WHERE (s.id = qms_quote_cost_scope_sources.scope_id)))));


--
-- Name: qms_quote_cost_scopes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_scopes ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_scopes qms_quote_cost_scopes_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_scopes_select_quote ON public.qms_quote_cost_scopes FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.qms_quote_cost_packets p
     JOIN public.quotations q ON ((q.id = p.quotation_id)))
  WHERE (p.id = qms_quote_cost_scopes.packet_id)))));


--
-- Name: qms_quote_cost_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_cost_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_cost_versions qms_quote_cost_versions_select_quote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_cost_versions_select_quote ON public.qms_quote_cost_versions FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quote_cost_versions.quotation_id)))));


--
-- Name: qms_quote_evaluations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_evaluations qms_quote_evaluations_select_readable_quotes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_evaluations_select_readable_quotes ON public.qms_quote_evaluations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.quotations q
  WHERE (q.id = qms_quote_evaluations.quotation_id))));


--
-- Name: qms_quote_exclusion_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_exclusion_options ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_exclusion_options qms_quote_exclusion_options_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_exclusion_options_delete ON public.qms_quote_exclusion_options FOR DELETE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_exclusion_options qms_quote_exclusion_options_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_exclusion_options_insert ON public.qms_quote_exclusion_options FOR INSERT TO authenticated WITH CHECK ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_quote_exclusion_options qms_quote_exclusion_options_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_exclusion_options_read ON public.qms_quote_exclusion_options FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_quote_exclusion_options qms_quote_exclusion_options_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_exclusion_options_update ON public.qms_quote_exclusion_options FOR UPDATE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_project_type_labels; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_project_type_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_project_type_labels qms_quote_project_type_labels_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_project_type_labels_delete ON public.qms_quote_project_type_labels FOR DELETE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_project_type_labels qms_quote_project_type_labels_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_project_type_labels_insert ON public.qms_quote_project_type_labels FOR INSERT TO authenticated WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_project_type_labels qms_quote_project_type_labels_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_project_type_labels_read ON public.qms_quote_project_type_labels FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_quote_project_type_labels qms_quote_project_type_labels_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_project_type_labels_update ON public.qms_quote_project_type_labels FOR UPDATE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_share_annotations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_share_annotations ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_share_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_site_media; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_site_media ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_site_media qms_quote_site_media_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_site_media_select_own ON public.qms_quote_site_media FOR SELECT TO authenticated USING ((owner_auth_user_id = auth.uid()));


--
-- Name: qms_quote_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_quote_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_quote_templates qms_quote_templates_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_templates_delete ON public.qms_quote_templates FOR DELETE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_templates qms_quote_templates_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_templates_insert ON public.qms_quote_templates FOR INSERT TO authenticated WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_quote_templates qms_quote_templates_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_templates_read ON public.qms_quote_templates FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_quote_templates qms_quote_templates_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_quote_templates_update ON public.qms_quote_templates FOR UPDATE TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_supplier_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_supplier_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_supplier_profiles qms_supplier_profiles_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_profiles_read ON public.qms_supplier_profiles FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_supplier_profiles qms_supplier_profiles_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_profiles_write ON public.qms_supplier_profiles TO authenticated USING ((public.qms_permission_actor_role() = 'super_admin'::text)) WITH CHECK ((public.qms_permission_actor_role() = 'super_admin'::text));


--
-- Name: qms_supplier_quote_import_revisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_supplier_quote_import_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_supplier_quote_import_revisions qms_supplier_quote_import_revisions_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_quote_import_revisions_select_own ON public.qms_supplier_quote_import_revisions FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.qms_supplier_quote_imports i
  WHERE ((i.id = qms_supplier_quote_import_revisions.import_id) AND (i.owner_auth_user_id = auth.uid()))))));


--
-- Name: qms_supplier_quote_imports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_supplier_quote_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_supplier_quote_imports qms_supplier_quote_imports_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_quote_imports_select_own ON public.qms_supplier_quote_imports FOR SELECT TO authenticated USING (((public.qms_permission_actor_role() IS NOT NULL) AND (owner_auth_user_id = auth.uid())));


--
-- Name: qms_supplier_quote_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_supplier_quote_items ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_supplier_quote_items qms_supplier_quote_items_select_actor; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_quote_items_select_actor ON public.qms_supplier_quote_items FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_supplier_quote_revisions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_supplier_quote_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_supplier_quote_revisions qms_supplier_quote_revisions_select_actor; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_quote_revisions_select_actor ON public.qms_supplier_quote_revisions FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: qms_supplier_quote_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.qms_supplier_quote_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: qms_supplier_quote_sections qms_supplier_quote_sections_select_actor; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY qms_supplier_quote_sections_select_actor ON public.qms_supplier_quote_sections FOR SELECT TO authenticated USING ((public.qms_permission_actor_role() IS NOT NULL));


--
-- Name: quotation_expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quotation_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: quotation_expenses quotation_expenses auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "quotation_expenses auth read" ON public.quotation_expenses FOR SELECT USING (true);


--
-- Name: quotation_expenses quotation_expenses auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "quotation_expenses auth write" ON public.quotation_expenses USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quotation_section_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quotation_section_items ENABLE ROW LEVEL SECURITY;

--
-- Name: quotation_section_items quotation_section_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "quotation_section_items auth read" ON public.quotation_section_items FOR SELECT USING (true);


--
-- Name: quotation_section_items quotation_section_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "quotation_section_items auth write" ON public.quotation_section_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quotation_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quotation_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: quotation_sections quotation_sections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "quotation_sections auth read" ON public.quotation_sections FOR SELECT USING (true);


--
-- Name: quotation_sections quotation_sections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "quotation_sections auth write" ON public.quotation_sections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: quotations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

--
-- Name: receipt_sub_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.receipt_sub_items ENABLE ROW LEVEL SECURITY;

--
-- Name: receipt_sub_items receipt_sub_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "receipt_sub_items auth read" ON public.receipt_sub_items FOR SELECT USING (true);


--
-- Name: receipt_sub_items receipt_sub_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "receipt_sub_items auth write" ON public.receipt_sub_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: receipts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: receipts receipts auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "receipts auth read" ON public.receipts FOR SELECT USING (true);


--
-- Name: receipts receipts auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "receipts auth write" ON public.receipts USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: recurring_incomes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.recurring_incomes ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_incomes recurring_incomes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recurring_incomes auth read" ON public.recurring_incomes FOR SELECT USING (true);


--
-- Name: recurring_incomes recurring_incomes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recurring_incomes auth write" ON public.recurring_incomes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "roles auth read" ON public.roles FOR SELECT USING (true);


--
-- Name: roles roles auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "roles auth write" ON public.roles USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: service_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;

--
-- Name: service_items service_items auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_items auth read" ON public.service_items FOR SELECT USING (true);


--
-- Name: service_items service_items auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_items auth write" ON public.service_items USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: bwf_product_master service_role_full_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY service_role_full_access ON public.bwf_product_master USING (true) WITH CHECK (true);


--
-- Name: service_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_answers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_status_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_answers site_status_answers all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_status_answers all" ON public.site_status_answers USING (true) WITH CHECK (true);


--
-- Name: site_status_item_quantities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_status_item_quantities ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_item_quantities site_status_item_quantities all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_status_item_quantities all" ON public.site_status_item_quantities USING (true) WITH CHECK (true);


--
-- Name: site_status_question_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_status_question_options ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_question_options site_status_question_options all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_status_question_options all" ON public.site_status_question_options USING (true) WITH CHECK (true);


--
-- Name: site_status_question_project_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_status_question_project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_question_project_types site_status_question_project_types all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_status_question_project_types all" ON public.site_status_question_project_types USING (true) WITH CHECK (true);


--
-- Name: site_status_questions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_status_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_questions site_status_questions all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_status_questions all" ON public.site_status_questions USING (true) WITH CHECK (true);


--
-- Name: site_status_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_status_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: site_status_sections site_status_sections all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_status_sections all" ON public.site_status_sections USING (true) WITH CHECK (true);


--
-- Name: site_statuses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.site_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: site_statuses site_statuses all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "site_statuses all" ON public.site_statuses USING (true) WITH CHECK (true);


--
-- Name: source_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.source_types ENABLE ROW LEVEL SECURITY;

--
-- Name: specific_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.specific_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: specific_rules specific_rules auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "specific_rules auth read" ON public.specific_rules FOR SELECT USING (true);


--
-- Name: specific_rules specific_rules auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "specific_rules auth write" ON public.specific_rules USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_bv_deductions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff_bv_deductions ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_supplier_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff_supplier_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_feedback; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_feedback supplier_feedback auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_feedback auth read" ON public.supplier_feedback FOR SELECT USING (true);


--
-- Name: supplier_feedback supplier_feedback auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_feedback auth write" ON public.supplier_feedback USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_file_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_file_types ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_file_types supplier_file_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_file_types auth read" ON public.supplier_file_types FOR SELECT USING (true);


--
-- Name: supplier_file_types supplier_file_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_file_types auth write" ON public.supplier_file_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_files ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_files supplier_files auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_files auth read" ON public.supplier_files FOR SELECT USING (true);


--
-- Name: supplier_files supplier_files auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_files auth write" ON public.supplier_files USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_level_pass_out_dates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_level_pass_out_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_level_pass_out_dates supplier_level_pass_out_dates auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_level_pass_out_dates auth read" ON public.supplier_level_pass_out_dates FOR SELECT USING (true);


--
-- Name: supplier_level_pass_out_dates supplier_level_pass_out_dates auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_level_pass_out_dates auth write" ON public.supplier_level_pass_out_dates USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_level_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_level_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_level_roles supplier_level_roles auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_level_roles auth read" ON public.supplier_level_roles FOR SELECT USING (true);


--
-- Name: supplier_level_roles supplier_level_roles auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_level_roles auth write" ON public.supplier_level_roles USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_login_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_login_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_login_codes supplier_login_codes auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_login_codes auth read" ON public.supplier_login_codes FOR SELECT USING (true);


--
-- Name: supplier_login_codes supplier_login_codes auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_login_codes auth write" ON public.supplier_login_codes USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_pricings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_pricings ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_pricings supplier_pricings auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_pricings auth read" ON public.supplier_pricings FOR SELECT USING (true);


--
-- Name: supplier_pricings supplier_pricings auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_pricings auth write" ON public.supplier_pricings USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_recent_statuses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_recent_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_recent_statuses supplier_recent_statuses auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_recent_statuses auth read" ON public.supplier_recent_statuses FOR SELECT USING (true);


--
-- Name: supplier_recent_statuses supplier_recent_statuses auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_recent_statuses auth write" ON public.supplier_recent_statuses USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_register_forms; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_register_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_register_forms supplier_register_forms auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_register_forms auth read" ON public.supplier_register_forms FOR SELECT USING (true);


--
-- Name: supplier_register_forms supplier_register_forms auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_register_forms auth write" ON public.supplier_register_forms USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_rule_displays; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_rule_displays ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_rule_displays supplier_rule_displays auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_rule_displays auth read" ON public.supplier_rule_displays FOR SELECT USING (true);


--
-- Name: supplier_rule_displays supplier_rule_displays auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_rule_displays auth write" ON public.supplier_rule_displays USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_supplier_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_supplier_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_supplier_tags supplier_supplier_tags auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_supplier_tags auth read" ON public.supplier_supplier_tags FOR SELECT USING (true);


--
-- Name: supplier_supplier_tags supplier_supplier_tags auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_supplier_tags auth write" ON public.supplier_supplier_tags USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_supplier_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_supplier_types ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_supplier_types supplier_supplier_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_supplier_types auth read" ON public.supplier_supplier_types FOR SELECT USING (true);


--
-- Name: supplier_supplier_types supplier_supplier_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "supplier_supplier_types auth write" ON public.supplier_supplier_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: supplier_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.supplier_types ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: target_sales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.target_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: target_sales target_sales auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "target_sales auth read" ON public.target_sales FOR SELECT USING (true);


--
-- Name: target_sales target_sales auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "target_sales auth write" ON public.target_sales USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: team_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.team_types ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_bids; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_bids ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_bids tender_bids auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_bids auth read" ON public.tender_bids FOR SELECT USING (true);


--
-- Name: tender_bids tender_bids auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_bids auth write" ON public.tender_bids USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_message_bids; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_message_bids ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_message_bids tender_message_bids auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_message_bids auth read" ON public.tender_message_bids FOR SELECT USING (true);


--
-- Name: tender_message_bids tender_message_bids auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_message_bids auth write" ON public.tender_message_bids USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_message_receivers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_message_receivers ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_message_receivers tender_message_receivers auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_message_receivers auth read" ON public.tender_message_receivers FOR SELECT USING (true);


--
-- Name: tender_message_receivers tender_message_receivers auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_message_receivers auth write" ON public.tender_message_receivers USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_message_seen; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_message_seen ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_message_seen tender_message_seen auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_message_seen auth read" ON public.tender_message_seen FOR SELECT USING (true);


--
-- Name: tender_message_seen tender_message_seen auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_message_seen auth write" ON public.tender_message_seen USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_messages tender_messages auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_messages auth read" ON public.tender_messages FOR SELECT USING (true);


--
-- Name: tender_messages tender_messages auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_messages auth write" ON public.tender_messages USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_rejected_suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_rejected_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_rejected_suppliers tender_rejected_suppliers auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_rejected_suppliers auth read" ON public.tender_rejected_suppliers FOR SELECT USING (true);


--
-- Name: tender_rejected_suppliers tender_rejected_suppliers auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_rejected_suppliers auth write" ON public.tender_rejected_suppliers USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_responds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_responds ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_responds tender_responds auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_responds auth read" ON public.tender_responds FOR SELECT USING (true);


--
-- Name: tender_responds tender_responds auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_responds auth write" ON public.tender_responds USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_seen; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_seen ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_seen tender_seen auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_seen auth read" ON public.tender_seen FOR SELECT USING (true);


--
-- Name: tender_seen tender_seen auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_seen auth write" ON public.tender_seen USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tender_selective_suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tender_selective_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: tender_selective_suppliers tender_selective_suppliers auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_selective_suppliers auth read" ON public.tender_selective_suppliers FOR SELECT USING (true);


--
-- Name: tender_selective_suppliers tender_selective_suppliers auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tender_selective_suppliers auth write" ON public.tender_selective_suppliers USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: tenders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

--
-- Name: tenders tenders auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenders auth read" ON public.tenders FOR SELECT USING (true);


--
-- Name: tenders tenders auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenders auth write" ON public.tenders USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: term_template_section_details; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.term_template_section_details ENABLE ROW LEVEL SECURITY;

--
-- Name: term_template_section_details term_template_section_details auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "term_template_section_details auth read" ON public.term_template_section_details FOR SELECT USING (true);


--
-- Name: term_template_section_details term_template_section_details auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "term_template_section_details auth write" ON public.term_template_section_details USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: term_template_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.term_template_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: term_template_sections term_template_sections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "term_template_sections auth read" ON public.term_template_sections FOR SELECT USING (true);


--
-- Name: term_template_sections term_template_sections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "term_template_sections auth write" ON public.term_template_sections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: term_template_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.term_template_types ENABLE ROW LEVEL SECURITY;

--
-- Name: term_template_types term_template_types auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "term_template_types auth read" ON public.term_template_types FOR SELECT USING (true);


--
-- Name: term_template_types term_template_types auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "term_template_types auth write" ON public.term_template_types USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: three_d_collection_liked_staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.three_d_collection_liked_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: three_d_collection_liked_staff three_d_collection_liked_staff auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "three_d_collection_liked_staff auth read" ON public.three_d_collection_liked_staff FOR SELECT USING (true);


--
-- Name: three_d_collection_liked_staff three_d_collection_liked_staff auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "three_d_collection_liked_staff auth write" ON public.three_d_collection_liked_staff USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: three_d_collections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.three_d_collections ENABLE ROW LEVEL SECURITY;

--
-- Name: three_d_collections three_d_collections auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "three_d_collections auth read" ON public.three_d_collections FOR SELECT USING (true);


--
-- Name: three_d_collections three_d_collections auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "three_d_collections auth write" ON public.three_d_collections USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: three_d_renders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.three_d_renders ENABLE ROW LEVEL SECURITY;

--
-- Name: three_d_renders three_d_renders auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "three_d_renders auth read" ON public.three_d_renders FOR SELECT USING (true);


--
-- Name: three_d_renders three_d_renders auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "three_d_renders auth write" ON public.three_d_renders USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users auth read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users auth read" ON public.users FOR SELECT USING (true);


--
-- Name: users users auth write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users auth write" ON public.users USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION auto_close_stale_pitchings(p_deadline_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer) TO anon;
GRANT ALL ON FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.auto_close_stale_pitchings(p_deadline_days integer) TO service_role;


--
-- Name: FUNCTION check_permission(p_user_id uuid, p_module text, p_action text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_permission(p_user_id uuid, p_module text, p_action text) TO anon;
GRANT ALL ON FUNCTION public.check_permission(p_user_id uuid, p_module text, p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.check_permission(p_user_id uuid, p_module text, p_action text) TO service_role;


--
-- Name: FUNCTION check_specific_rule(p_user_id uuid, p_module text, p_rule_key text, p_context jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_specific_rule(p_user_id uuid, p_module text, p_rule_key text, p_context jsonb) TO anon;
GRANT ALL ON FUNCTION public.check_specific_rule(p_user_id uuid, p_module text, p_rule_key text, p_context jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.check_specific_rule(p_user_id uuid, p_module text, p_rule_key text, p_context jsonb) TO service_role;


--
-- Name: FUNCTION compute_bwa_os_schedule_group(p_service_type_id uuid, p_estimated_income numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.compute_bwa_os_schedule_group(p_service_type_id uuid, p_estimated_income numeric) TO anon;
GRANT ALL ON FUNCTION public.compute_bwa_os_schedule_group(p_service_type_id uuid, p_estimated_income numeric) TO authenticated;
GRANT ALL ON FUNCTION public.compute_bwa_os_schedule_group(p_service_type_id uuid, p_estimated_income numeric) TO service_role;




--
-- Name: FUNCTION expense_control_waivers_no_overlap(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.expense_control_waivers_no_overlap() TO anon;
GRANT ALL ON FUNCTION public.expense_control_waivers_no_overlap() TO authenticated;
GRANT ALL ON FUNCTION public.expense_control_waivers_no_overlap() TO service_role;


--
-- Name: FUNCTION explain_permission_resolution(p_user_id uuid, p_module text, p_action text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.explain_permission_resolution(p_user_id uuid, p_module text, p_action text) TO anon;
GRANT ALL ON FUNCTION public.explain_permission_resolution(p_user_id uuid, p_module text, p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.explain_permission_resolution(p_user_id uuid, p_module text, p_action text) TO service_role;


--
-- Name: FUNCTION get_bwa_project_financials(p_project_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_bwa_project_financials(p_project_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_bwa_project_financials(p_project_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_bwa_project_financials(p_project_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_bwf_project_financials(p_project_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_bwf_project_financials(p_project_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_bwf_project_financials(p_project_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_bwf_project_financials(p_project_ids uuid[]) TO service_role;


--
-- Name: FUNCTION get_complete_user_context(input_email text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_complete_user_context(input_email text) TO anon;
GRANT ALL ON FUNCTION public.get_complete_user_context(input_email text) TO authenticated;
GRANT ALL ON FUNCTION public.get_complete_user_context(input_email text) TO service_role;


--
-- Name: FUNCTION get_module_view_roster(p_module text, p_action text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_module_view_roster(p_module text, p_action text) TO anon;
GRANT ALL ON FUNCTION public.get_module_view_roster(p_module text, p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.get_module_view_roster(p_module text, p_action text) TO service_role;


--
-- Name: FUNCTION get_modules_view_summary(p_modules text[], p_action text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_modules_view_summary(p_modules text[], p_action text) TO anon;
GRANT ALL ON FUNCTION public.get_modules_view_summary(p_modules text[], p_action text) TO authenticated;
GRANT ALL ON FUNCTION public.get_modules_view_summary(p_modules text[], p_action text) TO service_role;


--
-- Name: FUNCTION get_pms_auth_sessions(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_pms_auth_sessions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_pms_auth_sessions() TO anon;
GRANT ALL ON FUNCTION public.get_pms_auth_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.get_pms_auth_sessions() TO service_role;


--
-- Name: FUNCTION get_table_columns_audit(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_table_columns_audit() TO anon;
GRANT ALL ON FUNCTION public.get_table_columns_audit() TO authenticated;
GRANT ALL ON FUNCTION public.get_table_columns_audit() TO service_role;


--
-- Name: TABLE man_hour_dates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.man_hour_dates TO anon;
GRANT ALL ON TABLE public.man_hour_dates TO authenticated;
GRANT ALL ON TABLE public.man_hour_dates TO service_role;


--
-- Name: FUNCTION get_unfinished_man_hour_dates(p_staff_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_unfinished_man_hour_dates(p_staff_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_effective_permissions(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_effective_permissions(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_effective_permissions(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_effective_permissions(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) TO anon;
GRANT ALL ON FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.merge_customers(p_customer_a uuid, p_customer_b uuid, p_merged jsonb) TO service_role;


--
-- Name: FUNCTION merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) TO anon;
GRANT ALL ON FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.merge_suppliers(p_supplier_a uuid, p_supplier_b uuid, p_merged jsonb) TO service_role;


--
-- Name: FUNCTION purge_stale_pms_auth_sessions(p_max_age_days integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer) TO anon;
GRANT ALL ON FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.purge_stale_pms_auth_sessions(p_max_age_days integer) TO service_role;


--
-- Name: FUNCTION qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb) TO anon;
GRANT ALL ON FUNCTION public.qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qms_apply_cost_source(p_quotation_id uuid, p_expected_customer_version integer, p_expected_cost_revision integer, p_requirement_scope_key text, p_component_type text, p_input jsonb) TO service_role;


--
-- Name: FUNCTION qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb) TO anon;
GRANT ALL ON FUNCTION public.qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qms_attach_quote_cost_packet_file(p_quotation_id uuid, p_import_id uuid, p_quote_item_key uuid, p_component_type text, p_source_folder_path text, p_signature_suggestion jsonb) TO service_role;


--
-- Name: FUNCTION qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb) TO anon;
GRANT ALL ON FUNCTION public.qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qms_commit_quote_cost_binding(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_supplier_revision_id uuid, p_source_role text, p_override_reason text, p_mappings jsonb) TO service_role;


--
-- Name: FUNCTION qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb) TO anon;
GRANT ALL ON FUNCTION public.qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qms_commit_quote_cost_bindings(p_quotation_id uuid, p_expected_quote_version integer, p_expected_cost_revision integer, p_suppliers jsonb) TO service_role;


--
-- Name: FUNCTION qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer) TO anon;
GRANT ALL ON FUNCTION public.qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_cost_reference_summary(p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_window_months integer) TO service_role;


--
-- Name: FUNCTION qms_dashboard_summary(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_dashboard_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_dashboard_summary() TO authenticated;
GRANT ALL ON FUNCTION public.qms_dashboard_summary() TO service_role;


--
-- Name: FUNCTION qms_ensure_item_identities(p_quotation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_ensure_item_identities(p_quotation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qms_ensure_item_identities(p_quotation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qms_ensure_item_identities(p_quotation_id uuid) TO service_role;


--
-- Name: FUNCTION qms_expected_components_valid(p text[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_expected_components_valid(p text[]) TO anon;
GRANT ALL ON FUNCTION public.qms_expected_components_valid(p text[]) TO authenticated;
GRANT ALL ON FUNCTION public.qms_expected_components_valid(p text[]) TO service_role;


--
-- Name: FUNCTION qms_large_tender_quotes(p_search text, p_page integer, p_page_size integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_large_tender_quotes(p_search text, p_page integer, p_page_size integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_large_tender_quotes(p_search text, p_page integer, p_page_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_large_tender_quotes(p_search text, p_page integer, p_page_size integer) TO service_role;


--
-- Name: FUNCTION qms_permission_actor_role(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_permission_actor_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_permission_actor_role() TO authenticated;
GRANT ALL ON FUNCTION public.qms_permission_actor_role() TO service_role;


--
-- Name: FUNCTION qms_pitching_list(p_search text, p_stage text, p_project_manager text, p_team text, p_service_type text, p_district text, p_financial_year text, p_project_scale text, p_key_only boolean, p_sort_key text, p_sort_dir text, p_page integer, p_page_size integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_pitching_list(p_search text, p_stage text, p_project_manager text, p_team text, p_service_type text, p_district text, p_financial_year text, p_project_scale text, p_key_only boolean, p_sort_key text, p_sort_dir text, p_page integer, p_page_size integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_pitching_list(p_search text, p_stage text, p_project_manager text, p_team text, p_service_type text, p_district text, p_financial_year text, p_project_scale text, p_key_only boolean, p_sort_key text, p_sort_dir text, p_page integer, p_page_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_pitching_list(p_search text, p_stage text, p_project_manager text, p_team text, p_service_type text, p_district text, p_financial_year text, p_project_scale text, p_key_only boolean, p_sort_key text, p_sort_dir text, p_page integer, p_page_size integer) TO service_role;


--
-- Name: FUNCTION qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer) TO anon;
GRANT ALL ON FUNCTION public.qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_preview_cost_estimate(p_quotation_id uuid, p_standard_variant_id uuid, p_component_type text, p_normalized_unit_id uuid, p_scope_signature text, p_quantity numeric, p_window_months integer) TO service_role;


--
-- Name: FUNCTION qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer) TO anon;
GRANT ALL ON FUNCTION public.qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_publish_quote_cost_version(p_quotation_id uuid, p_cost_version_id uuid, p_expected_cost_revision integer) TO service_role;


--
-- Name: FUNCTION qms_quote_cost_audits_block_mutation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_quote_cost_audits_block_mutation() TO anon;
GRANT ALL ON FUNCTION public.qms_quote_cost_audits_block_mutation() TO authenticated;
GRANT ALL ON FUNCTION public.qms_quote_cost_audits_block_mutation() TO service_role;


--
-- Name: FUNCTION qms_quote_cost_orphan_scopes_on_retire(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_quote_cost_orphan_scopes_on_retire() TO anon;
GRANT ALL ON FUNCTION public.qms_quote_cost_orphan_scopes_on_retire() TO authenticated;
GRANT ALL ON FUNCTION public.qms_quote_cost_orphan_scopes_on_retire() TO service_role;


--
-- Name: FUNCTION qms_quote_cost_overview(p_quotation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_quote_cost_overview(p_quotation_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qms_quote_cost_overview(p_quotation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qms_quote_cost_overview(p_quotation_id uuid) TO service_role;


--
-- Name: FUNCTION qms_quote_detail(p_quotation_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_quote_detail(p_quotation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_quote_detail(p_quotation_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qms_quote_detail(p_quotation_id uuid) TO service_role;


--
-- Name: FUNCTION qms_quote_evaluations_immutable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_quote_evaluations_immutable() TO anon;
GRANT ALL ON FUNCTION public.qms_quote_evaluations_immutable() TO authenticated;
GRANT ALL ON FUNCTION public.qms_quote_evaluations_immutable() TO service_role;


--
-- Name: FUNCTION qms_reject_box_access_log_mutation(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_reject_box_access_log_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_reject_box_access_log_mutation() TO service_role;


--
-- Name: FUNCTION qms_save_page_permissions(p_revision integer, p_entries jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_save_page_permissions(p_revision integer, p_entries jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_save_page_permissions(p_revision integer, p_entries jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qms_save_page_permissions(p_revision integer, p_entries jsonb) TO service_role;


--
-- Name: FUNCTION qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb) TO anon;
GRANT ALL ON FUNCTION public.qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.qms_save_quotation(p_quotation_id uuid, p_expected_version integer, p_snapshot jsonb, p_header jsonb, p_sections jsonb, p_terms jsonb, p_industry jsonb) TO service_role;


--
-- Name: FUNCTION qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.qms_save_quote_evaluation(p_quotation_id uuid, p_expected_quote_version integer, p_rule_version text, p_source_set jsonb, p_result jsonb) TO service_role;


--
-- Name: FUNCTION qms_supplier_detail(p_supplier_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_supplier_detail(p_supplier_id uuid) TO anon;
GRANT ALL ON FUNCTION public.qms_supplier_detail(p_supplier_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.qms_supplier_detail(p_supplier_id uuid) TO service_role;


--
-- Name: FUNCTION qms_supplier_list(p_search text, p_status text, p_level text, p_tags text[], p_page integer, p_page_size integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_supplier_list(p_search text, p_status text, p_level text, p_tags text[], p_page integer, p_page_size integer) TO anon;
GRANT ALL ON FUNCTION public.qms_supplier_list(p_search text, p_status text, p_level text, p_tags text[], p_page integer, p_page_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_supplier_list(p_search text, p_status text, p_level text, p_tags text[], p_page integer, p_page_size integer) TO service_role;


--
-- Name: FUNCTION qms_supplier_quote_imports_flatten_alias(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_supplier_quote_imports_flatten_alias() TO anon;
GRANT ALL ON FUNCTION public.qms_supplier_quote_imports_flatten_alias() TO authenticated;
GRANT ALL ON FUNCTION public.qms_supplier_quote_imports_flatten_alias() TO service_role;


--
-- Name: FUNCTION qms_supplier_quote_revisions_forbid_alias(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_supplier_quote_revisions_forbid_alias() TO anon;
GRANT ALL ON FUNCTION public.qms_supplier_quote_revisions_forbid_alias() TO authenticated;
GRANT ALL ON FUNCTION public.qms_supplier_quote_revisions_forbid_alias() TO service_role;


--
-- Name: FUNCTION qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer) TO anon;
GRANT ALL ON FUNCTION public.qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer) TO authenticated;
GRANT ALL ON FUNCTION public.qms_sync_quote_cost_from_bindings(p_quotation_id uuid, p_expected_cost_revision integer) TO service_role;


--
-- Name: FUNCTION recalculate_all_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recalculate_all_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.recalculate_all_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_all_customer_stats() TO service_role;


--
-- Name: FUNCTION recalculate_all_project_bv(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recalculate_all_project_bv() TO anon;
GRANT ALL ON FUNCTION public.recalculate_all_project_bv() TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_all_project_bv() TO service_role;


--
-- Name: FUNCTION recalculate_customer_stats(p_customer_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recalculate_customer_stats(p_customer_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalculate_customer_stats(p_customer_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_customer_stats(p_customer_id uuid) TO service_role;


--
-- Name: FUNCTION recalculate_project_bv(p_project_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recalculate_project_bv(p_project_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalculate_project_bv(p_project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_project_bv(p_project_id uuid) TO service_role;


--
-- Name: FUNCTION staff_id_from_auth(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.staff_id_from_auth() FROM PUBLIC;
GRANT ALL ON FUNCTION public.staff_id_from_auth() TO service_role;


--
-- Name: FUNCTION sync_bwa_project_os_schedule_group_from_pitching(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_bwa_project_os_schedule_group_from_pitching() TO anon;
GRANT ALL ON FUNCTION public.sync_bwa_project_os_schedule_group_from_pitching() TO authenticated;
GRANT ALL ON FUNCTION public.sync_bwa_project_os_schedule_group_from_pitching() TO service_role;


--
-- Name: FUNCTION trg_log_expected_payment_date(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.trg_log_expected_payment_date() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trg_log_expected_payment_date() TO service_role;


--
-- Name: FUNCTION trg_recalc_project_bv_from_child(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_recalc_project_bv_from_child() TO anon;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_from_child() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_from_child() TO service_role;


--
-- Name: FUNCTION trg_recalc_project_bv_from_project(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_recalc_project_bv_from_project() TO anon;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_from_project() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_from_project() TO service_role;


--
-- Name: FUNCTION trg_recalc_project_bv_on_ratio(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_recalc_project_bv_on_ratio() TO anon;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_on_ratio() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_on_ratio() TO service_role;


--
-- Name: FUNCTION trg_recalc_project_bv_self(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_recalc_project_bv_self() TO anon;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_self() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recalc_project_bv_self() TO service_role;


--
-- Name: FUNCTION trigger_bwa_pitching_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_bwa_pitching_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.trigger_bwa_pitching_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_bwa_pitching_customer_stats() TO service_role;


--
-- Name: FUNCTION trigger_bwa_project_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_bwa_project_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.trigger_bwa_project_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_bwa_project_customer_stats() TO service_role;


--
-- Name: FUNCTION trigger_bwf_pitching_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_bwf_pitching_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.trigger_bwf_pitching_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_bwf_pitching_customer_stats() TO service_role;


--
-- Name: FUNCTION trigger_bwf_project_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_bwf_project_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.trigger_bwf_project_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_bwf_project_customer_stats() TO service_role;


--
-- Name: FUNCTION trigger_expense_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_expense_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.trigger_expense_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_expense_customer_stats() TO service_role;


--
-- Name: FUNCTION trigger_income_customer_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_income_customer_stats() TO anon;
GRANT ALL ON FUNCTION public.trigger_income_customer_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_income_customer_stats() TO service_role;


--
-- Name: FUNCTION update_bwf_product_master_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_bwf_product_master_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_bwf_product_master_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_bwf_product_master_updated_at() TO service_role;


--
-- Name: FUNCTION update_notifications_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_notifications_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_notifications_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_notifications_updated_at() TO service_role;


--
-- Name: TABLE ai_prompt_by_project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_prompt_by_project_types TO anon;
GRANT ALL ON TABLE public.ai_prompt_by_project_types TO authenticated;
GRANT ALL ON TABLE public.ai_prompt_by_project_types TO service_role;


--
-- Name: TABLE ai_quote_demo_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_quote_demo_items TO anon;
GRANT ALL ON TABLE public.ai_quote_demo_items TO authenticated;
GRANT ALL ON TABLE public.ai_quote_demo_items TO service_role;


--
-- Name: TABLE ai_quote_sub_item_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_quote_sub_item_details TO anon;
GRANT ALL ON TABLE public.ai_quote_sub_item_details TO authenticated;
GRANT ALL ON TABLE public.ai_quote_sub_item_details TO service_role;


--
-- Name: TABLE ai_quote_sub_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_quote_sub_items TO anon;
GRANT ALL ON TABLE public.ai_quote_sub_items TO authenticated;
GRANT ALL ON TABLE public.ai_quote_sub_items TO service_role;


--
-- Name: TABLE ai_quotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ai_quotes TO anon;
GRANT ALL ON TABLE public.ai_quotes TO authenticated;
GRANT ALL ON TABLE public.ai_quotes TO service_role;


--
-- Name: TABLE ap_report_remarks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ap_report_remarks TO anon;
GRANT ALL ON TABLE public.ap_report_remarks TO authenticated;
GRANT ALL ON TABLE public.ap_report_remarks TO service_role;


--
-- Name: TABLE asana_oauth_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.asana_oauth_tokens TO service_role;


--
-- Name: TABLE blocked_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.blocked_views TO anon;
GRANT ALL ON TABLE public.blocked_views TO authenticated;
GRANT ALL ON TABLE public.blocked_views TO service_role;


--
-- Name: TABLE building_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.building_comments TO anon;
GRANT ALL ON TABLE public.building_comments TO authenticated;
GRANT ALL ON TABLE public.building_comments TO service_role;


--
-- Name: TABLE building_contacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.building_contacts TO anon;
GRANT ALL ON TABLE public.building_contacts TO authenticated;
GRANT ALL ON TABLE public.building_contacts TO service_role;


--
-- Name: TABLE building_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.building_files TO anon;
GRANT ALL ON TABLE public.building_files TO authenticated;
GRANT ALL ON TABLE public.building_files TO service_role;


--
-- Name: TABLE buildings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buildings TO anon;
GRANT ALL ON TABLE public.buildings TO authenticated;
GRANT ALL ON TABLE public.buildings TO service_role;


--
-- Name: TABLE bwa_pitching_project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwa_pitching_project_types TO anon;
GRANT ALL ON TABLE public.bwa_pitching_project_types TO authenticated;
GRANT ALL ON TABLE public.bwa_pitching_project_types TO service_role;


--
-- Name: TABLE bwa_pitching_service_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwa_pitching_service_types TO anon;
GRANT ALL ON TABLE public.bwa_pitching_service_types TO authenticated;
GRANT ALL ON TABLE public.bwa_pitching_service_types TO service_role;


--
-- Name: TABLE bwa_pitchings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwa_pitchings TO anon;
GRANT ALL ON TABLE public.bwa_pitchings TO authenticated;
GRANT ALL ON TABLE public.bwa_pitchings TO service_role;


--
-- Name: TABLE bwa_project_project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwa_project_project_types TO anon;
GRANT ALL ON TABLE public.bwa_project_project_types TO authenticated;
GRANT ALL ON TABLE public.bwa_project_project_types TO service_role;


--
-- Name: TABLE bwa_project_service_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwa_project_service_types TO anon;
GRANT ALL ON TABLE public.bwa_project_service_types TO authenticated;
GRANT ALL ON TABLE public.bwa_project_service_types TO service_role;


--
-- Name: TABLE bwa_projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwa_projects TO anon;
GRANT ALL ON TABLE public.bwa_projects TO authenticated;
GRANT ALL ON TABLE public.bwa_projects TO service_role;


--
-- Name: TABLE bwf_major_quotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_major_quotes TO anon;
GRANT ALL ON TABLE public.bwf_major_quotes TO authenticated;
GRANT ALL ON TABLE public.bwf_major_quotes TO service_role;


--
-- Name: TABLE bwf_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_orders TO anon;
GRANT ALL ON TABLE public.bwf_orders TO authenticated;
GRANT ALL ON TABLE public.bwf_orders TO service_role;


--
-- Name: TABLE bwf_pitching_bwf_service_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_pitching_bwf_service_types TO anon;
GRANT ALL ON TABLE public.bwf_pitching_bwf_service_types TO authenticated;
GRANT ALL ON TABLE public.bwf_pitching_bwf_service_types TO service_role;


--
-- Name: TABLE bwf_pitching_major_quotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_pitching_major_quotes TO anon;
GRANT ALL ON TABLE public.bwf_pitching_major_quotes TO authenticated;
GRANT ALL ON TABLE public.bwf_pitching_major_quotes TO service_role;


--
-- Name: TABLE bwf_pitching_service_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_pitching_service_items TO anon;
GRANT ALL ON TABLE public.bwf_pitching_service_items TO authenticated;
GRANT ALL ON TABLE public.bwf_pitching_service_items TO service_role;


--
-- Name: TABLE bwf_pitchings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_pitchings TO anon;
GRANT ALL ON TABLE public.bwf_pitchings TO authenticated;
GRANT ALL ON TABLE public.bwf_pitchings TO service_role;


--
-- Name: TABLE bwf_product_master; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_product_master TO anon;
GRANT ALL ON TABLE public.bwf_product_master TO authenticated;
GRANT ALL ON TABLE public.bwf_product_master TO service_role;


--
-- Name: TABLE bwf_product_product_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_product_product_types TO anon;
GRANT ALL ON TABLE public.bwf_product_product_types TO authenticated;
GRANT ALL ON TABLE public.bwf_product_product_types TO service_role;


--
-- Name: TABLE bwf_products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_products TO anon;
GRANT ALL ON TABLE public.bwf_products TO authenticated;
GRANT ALL ON TABLE public.bwf_products TO service_role;


--
-- Name: TABLE bwf_project_bwf_service_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_project_bwf_service_types TO anon;
GRANT ALL ON TABLE public.bwf_project_bwf_service_types TO authenticated;
GRANT ALL ON TABLE public.bwf_project_bwf_service_types TO service_role;


--
-- Name: TABLE bwf_project_factories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_project_factories TO anon;
GRANT ALL ON TABLE public.bwf_project_factories TO authenticated;
GRANT ALL ON TABLE public.bwf_project_factories TO service_role;


--
-- Name: TABLE bwf_project_major_quotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_project_major_quotes TO anon;
GRANT ALL ON TABLE public.bwf_project_major_quotes TO authenticated;
GRANT ALL ON TABLE public.bwf_project_major_quotes TO service_role;


--
-- Name: TABLE bwf_project_service_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_project_service_items TO anon;
GRANT ALL ON TABLE public.bwf_project_service_items TO authenticated;
GRANT ALL ON TABLE public.bwf_project_service_items TO service_role;


--
-- Name: TABLE bwf_project_suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_project_suppliers TO anon;
GRANT ALL ON TABLE public.bwf_project_suppliers TO authenticated;
GRANT ALL ON TABLE public.bwf_project_suppliers TO service_role;


--
-- Name: TABLE bwf_projects; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bwf_projects TO anon;
GRANT ALL ON TABLE public.bwf_projects TO authenticated;
GRANT ALL ON TABLE public.bwf_projects TO service_role;


--
-- Name: TABLE client_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_types TO anon;
GRANT ALL ON TABLE public.client_types TO authenticated;
GRANT ALL ON TABLE public.client_types TO service_role;


--
-- Name: TABLE cost_centres; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cost_centres TO anon;
GRANT ALL ON TABLE public.cost_centres TO authenticated;
GRANT ALL ON TABLE public.cost_centres TO service_role;


--
-- Name: TABLE cr_event_detail_staff; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cr_event_detail_staff TO anon;
GRANT ALL ON TABLE public.cr_event_detail_staff TO authenticated;
GRANT ALL ON TABLE public.cr_event_detail_staff TO service_role;


--
-- Name: TABLE cr_event_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cr_event_details TO anon;
GRANT ALL ON TABLE public.cr_event_details TO authenticated;
GRANT ALL ON TABLE public.cr_event_details TO service_role;


--
-- Name: TABLE cr_gift_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cr_gift_items TO anon;
GRANT ALL ON TABLE public.cr_gift_items TO authenticated;
GRANT ALL ON TABLE public.cr_gift_items TO service_role;


--
-- Name: TABLE customer_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_comments TO anon;
GRANT ALL ON TABLE public.customer_comments TO authenticated;
GRANT ALL ON TABLE public.customer_comments TO service_role;


--
-- Name: TABLE customer_cr_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_cr_events TO anon;
GRANT ALL ON TABLE public.customer_cr_events TO authenticated;
GRANT ALL ON TABLE public.customer_cr_events TO service_role;


--
-- Name: TABLE customer_document_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_document_types TO anon;
GRANT ALL ON TABLE public.customer_document_types TO authenticated;
GRANT ALL ON TABLE public.customer_document_types TO service_role;


--
-- Name: TABLE customer_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_documents TO anon;
GRANT ALL ON TABLE public.customer_documents TO authenticated;
GRANT ALL ON TABLE public.customer_documents TO service_role;


--
-- Name: TABLE customer_relations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_relations TO anon;
GRANT ALL ON TABLE public.customer_relations TO authenticated;
GRANT ALL ON TABLE public.customer_relations TO service_role;


--
-- Name: TABLE customer_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_tags TO anon;
GRANT ALL ON TABLE public.customer_tags TO authenticated;
GRANT ALL ON TABLE public.customer_tags TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE daily_task_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_task_logs TO anon;
GRANT ALL ON TABLE public.daily_task_logs TO authenticated;
GRANT ALL ON TABLE public.daily_task_logs TO service_role;


--
-- Name: TABLE dashboard_sentences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dashboard_sentences TO anon;
GRANT ALL ON TABLE public.dashboard_sentences TO authenticated;
GRANT ALL ON TABLE public.dashboard_sentences TO service_role;


--
-- Name: TABLE default_quote_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.default_quote_details TO anon;
GRANT ALL ON TABLE public.default_quote_details TO authenticated;
GRANT ALL ON TABLE public.default_quote_details TO service_role;


--
-- Name: TABLE default_quote_mains; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.default_quote_mains TO anon;
GRANT ALL ON TABLE public.default_quote_mains TO authenticated;
GRANT ALL ON TABLE public.default_quote_mains TO service_role;


--
-- Name: TABLE default_quote_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.default_quote_sections TO anon;
GRANT ALL ON TABLE public.default_quote_sections TO authenticated;
GRANT ALL ON TABLE public.default_quote_sections TO service_role;


--
-- Name: TABLE design_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.design_jobs TO anon;
GRANT ALL ON TABLE public.design_jobs TO authenticated;
GRANT ALL ON TABLE public.design_jobs TO service_role;


--
-- Name: TABLE districts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.districts TO anon;
GRANT ALL ON TABLE public.districts TO authenticated;
GRANT ALL ON TABLE public.districts TO service_role;


--
-- Name: TABLE expense_control_waivers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_control_waivers TO anon;
GRANT ALL ON TABLE public.expense_control_waivers TO authenticated;
GRANT ALL ON TABLE public.expense_control_waivers TO service_role;


--
-- Name: TABLE expense_product_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expense_product_types TO anon;
GRANT ALL ON TABLE public.expense_product_types TO authenticated;
GRANT ALL ON TABLE public.expense_product_types TO service_role;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


--
-- Name: TABLE factories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.factories TO anon;
GRANT ALL ON TABLE public.factories TO authenticated;
GRANT ALL ON TABLE public.factories TO service_role;


--
-- Name: TABLE factory_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.factory_files TO anon;
GRANT ALL ON TABLE public.factory_files TO authenticated;
GRANT ALL ON TABLE public.factory_files TO service_role;


--
-- Name: TABLE financial_years; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financial_years TO anon;
GRANT ALL ON TABLE public.financial_years TO authenticated;
GRANT ALL ON TABLE public.financial_years TO service_role;


--
-- Name: TABLE income_expiry_reasons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.income_expiry_reasons TO anon;
GRANT ALL ON TABLE public.income_expiry_reasons TO authenticated;
GRANT ALL ON TABLE public.income_expiry_reasons TO service_role;


--
-- Name: TABLE income_invoices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.income_invoices TO anon;
GRANT ALL ON TABLE public.income_invoices TO authenticated;
GRANT ALL ON TABLE public.income_invoices TO service_role;


--
-- Name: TABLE incomes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.incomes TO anon;
GRANT ALL ON TABLE public.incomes TO authenticated;
GRANT ALL ON TABLE public.incomes TO service_role;


--
-- Name: TABLE internal_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.internal_comments TO anon;
GRANT ALL ON TABLE public.internal_comments TO authenticated;
GRANT ALL ON TABLE public.internal_comments TO service_role;


--
-- Name: TABLE invoice_sub_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.invoice_sub_items TO anon;
GRANT ALL ON TABLE public.invoice_sub_items TO authenticated;
GRANT ALL ON TABLE public.invoice_sub_items TO service_role;


--
-- Name: TABLE login_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.login_logs TO anon;
GRANT ALL ON TABLE public.login_logs TO authenticated;
GRANT ALL ON TABLE public.login_logs TO service_role;


--
-- Name: TABLE man_hour_pinned; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.man_hour_pinned TO anon;
GRANT ALL ON TABLE public.man_hour_pinned TO authenticated;
GRANT ALL ON TABLE public.man_hour_pinned TO service_role;


--
-- Name: TABLE man_hour_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.man_hour_tasks TO anon;
GRANT ALL ON TABLE public.man_hour_tasks TO authenticated;
GRANT ALL ON TABLE public.man_hour_tasks TO service_role;


--
-- Name: TABLE news; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.news TO anon;
GRANT ALL ON TABLE public.news TO authenticated;
GRANT ALL ON TABLE public.news TO service_role;


--
-- Name: TABLE news_comment_liked_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.news_comment_liked_members TO anon;
GRANT ALL ON TABLE public.news_comment_liked_members TO authenticated;
GRANT ALL ON TABLE public.news_comment_liked_members TO service_role;


--
-- Name: TABLE news_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.news_comments TO anon;
GRANT ALL ON TABLE public.news_comments TO authenticated;
GRANT ALL ON TABLE public.news_comments TO service_role;


--
-- Name: TABLE news_liked_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.news_liked_members TO anon;
GRANT ALL ON TABLE public.news_liked_members TO authenticated;
GRANT ALL ON TABLE public.news_liked_members TO service_role;


--
-- Name: TABLE news_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.news_types TO anon;
GRANT ALL ON TABLE public.news_types TO authenticated;
GRANT ALL ON TABLE public.news_types TO service_role;


--
-- Name: TABLE nos_ai_quote_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_ai_quote_types TO anon;
GRANT ALL ON TABLE public.nos_ai_quote_types TO authenticated;
GRANT ALL ON TABLE public.nos_ai_quote_types TO service_role;


--
-- Name: TABLE nos_ai_tool_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_ai_tool_types TO anon;
GRANT ALL ON TABLE public.nos_ai_tool_types TO authenticated;
GRANT ALL ON TABLE public.nos_ai_tool_types TO service_role;


--
-- Name: TABLE nos_ai_tools; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_ai_tools TO anon;
GRANT ALL ON TABLE public.nos_ai_tools TO authenticated;
GRANT ALL ON TABLE public.nos_ai_tools TO service_role;


--
-- Name: TABLE nos_brands; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_brands TO anon;
GRANT ALL ON TABLE public.nos_brands TO authenticated;
GRANT ALL ON TABLE public.nos_brands TO service_role;


--
-- Name: TABLE nos_bv_values; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_bv_values TO anon;
GRANT ALL ON TABLE public.nos_bv_values TO authenticated;
GRANT ALL ON TABLE public.nos_bv_values TO service_role;


--
-- Name: TABLE nos_contracts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_contracts TO anon;
GRANT ALL ON TABLE public.nos_contracts TO authenticated;
GRANT ALL ON TABLE public.nos_contracts TO service_role;


--
-- Name: TABLE nos_cr_delivery_methods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_cr_delivery_methods TO anon;
GRANT ALL ON TABLE public.nos_cr_delivery_methods TO authenticated;
GRANT ALL ON TABLE public.nos_cr_delivery_methods TO service_role;


--
-- Name: TABLE nos_cr_event_themes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_cr_event_themes TO anon;
GRANT ALL ON TABLE public.nos_cr_event_themes TO authenticated;
GRANT ALL ON TABLE public.nos_cr_event_themes TO service_role;


--
-- Name: TABLE nos_cr_event_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_cr_event_types TO anon;
GRANT ALL ON TABLE public.nos_cr_event_types TO authenticated;
GRANT ALL ON TABLE public.nos_cr_event_types TO service_role;


--
-- Name: TABLE nos_customer_purpose; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_customer_purpose TO anon;
GRANT ALL ON TABLE public.nos_customer_purpose TO authenticated;
GRANT ALL ON TABLE public.nos_customer_purpose TO service_role;


--
-- Name: TABLE nos_customer_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_customer_tags TO anon;
GRANT ALL ON TABLE public.nos_customer_tags TO authenticated;
GRANT ALL ON TABLE public.nos_customer_tags TO service_role;


--
-- Name: TABLE nos_customer_tags_collection; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_customer_tags_collection TO anon;
GRANT ALL ON TABLE public.nos_customer_tags_collection TO authenticated;
GRANT ALL ON TABLE public.nos_customer_tags_collection TO service_role;


--
-- Name: TABLE nos_defect_causes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_defect_causes TO anon;
GRANT ALL ON TABLE public.nos_defect_causes TO authenticated;
GRANT ALL ON TABLE public.nos_defect_causes TO service_role;


--
-- Name: TABLE nos_doc_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_doc_types TO anon;
GRANT ALL ON TABLE public.nos_doc_types TO authenticated;
GRANT ALL ON TABLE public.nos_doc_types TO service_role;


--
-- Name: TABLE nos_item_quote_project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_item_quote_project_types TO anon;
GRANT ALL ON TABLE public.nos_item_quote_project_types TO authenticated;
GRANT ALL ON TABLE public.nos_item_quote_project_types TO service_role;


--
-- Name: TABLE nos_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_items TO anon;
GRANT ALL ON TABLE public.nos_items TO authenticated;
GRANT ALL ON TABLE public.nos_items TO service_role;


--
-- Name: TABLE nos_payment_methods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_payment_methods TO anon;
GRANT ALL ON TABLE public.nos_payment_methods TO authenticated;
GRANT ALL ON TABLE public.nos_payment_methods TO service_role;


--
-- Name: TABLE nos_quote_project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_quote_project_types TO anon;
GRANT ALL ON TABLE public.nos_quote_project_types TO authenticated;
GRANT ALL ON TABLE public.nos_quote_project_types TO service_role;


--
-- Name: TABLE nos_regions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_regions TO anon;
GRANT ALL ON TABLE public.nos_regions TO authenticated;
GRANT ALL ON TABLE public.nos_regions TO service_role;


--
-- Name: TABLE nos_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_sections TO anon;
GRANT ALL ON TABLE public.nos_sections TO authenticated;
GRANT ALL ON TABLE public.nos_sections TO service_role;


--
-- Name: TABLE nos_service_type_2; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_service_type_2 TO anon;
GRANT ALL ON TABLE public.nos_service_type_2 TO authenticated;
GRANT ALL ON TABLE public.nos_service_type_2 TO service_role;


--
-- Name: TABLE nos_site_status_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_site_status_items TO anon;
GRANT ALL ON TABLE public.nos_site_status_items TO authenticated;
GRANT ALL ON TABLE public.nos_site_status_items TO service_role;


--
-- Name: TABLE nos_supplier_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_supplier_tags TO anon;
GRANT ALL ON TABLE public.nos_supplier_tags TO authenticated;
GRANT ALL ON TABLE public.nos_supplier_tags TO service_role;


--
-- Name: TABLE nos_task_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_task_types TO anon;
GRANT ALL ON TABLE public.nos_task_types TO authenticated;
GRANT ALL ON TABLE public.nos_task_types TO service_role;


--
-- Name: TABLE nos_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_tasks TO anon;
GRANT ALL ON TABLE public.nos_tasks TO authenticated;
GRANT ALL ON TABLE public.nos_tasks TO service_role;


--
-- Name: TABLE nos_template_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_template_items TO anon;
GRANT ALL ON TABLE public.nos_template_items TO authenticated;
GRANT ALL ON TABLE public.nos_template_items TO service_role;


--
-- Name: TABLE nos_template_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_template_sections TO anon;
GRANT ALL ON TABLE public.nos_template_sections TO authenticated;
GRANT ALL ON TABLE public.nos_template_sections TO service_role;


--
-- Name: TABLE nos_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_templates TO anon;
GRANT ALL ON TABLE public.nos_templates TO authenticated;
GRANT ALL ON TABLE public.nos_templates TO service_role;


--
-- Name: TABLE nos_tender_reject_presets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_tender_reject_presets TO anon;
GRANT ALL ON TABLE public.nos_tender_reject_presets TO authenticated;
GRANT ALL ON TABLE public.nos_tender_reject_presets TO service_role;


--
-- Name: TABLE nos_units; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_units TO anon;
GRANT ALL ON TABLE public.nos_units TO authenticated;
GRANT ALL ON TABLE public.nos_units TO service_role;


--
-- Name: TABLE nos_website_functions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_website_functions TO anon;
GRANT ALL ON TABLE public.nos_website_functions TO authenticated;
GRANT ALL ON TABLE public.nos_website_functions TO service_role;


--
-- Name: TABLE nos_work_locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.nos_work_locations TO anon;
GRANT ALL ON TABLE public.nos_work_locations TO authenticated;
GRANT ALL ON TABLE public.nos_work_locations TO service_role;


--
-- Name: TABLE notification_seen; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_seen TO anon;
GRANT ALL ON TABLE public.notification_seen TO authenticated;
GRANT ALL ON TABLE public.notification_seen TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE outstanding_remarks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.outstanding_remarks TO anon;
GRANT ALL ON TABLE public.outstanding_remarks TO authenticated;
GRANT ALL ON TABLE public.outstanding_remarks TO service_role;


--
-- Name: TABLE permission_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.permission_assignments TO anon;
GRANT ALL ON TABLE public.permission_assignments TO authenticated;
GRANT ALL ON TABLE public.permission_assignments TO service_role;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.permissions TO anon;
GRANT ALL ON TABLE public.permissions TO authenticated;
GRANT ALL ON TABLE public.permissions TO service_role;


--
-- Name: TABLE pitching_bv; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pitching_bv TO anon;
GRANT ALL ON TABLE public.pitching_bv TO authenticated;
GRANT ALL ON TABLE public.pitching_bv TO service_role;


--
-- Name: TABLE pitching_close_reasons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pitching_close_reasons TO anon;
GRANT ALL ON TABLE public.pitching_close_reasons TO authenticated;
GRANT ALL ON TABLE public.pitching_close_reasons TO service_role;


--
-- Name: TABLE po_sub_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.po_sub_items TO anon;
GRANT ALL ON TABLE public.po_sub_items TO authenticated;
GRANT ALL ON TABLE public.po_sub_items TO service_role;


--
-- Name: TABLE product_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_types TO anon;
GRANT ALL ON TABLE public.product_types TO authenticated;
GRANT ALL ON TABLE public.product_types TO service_role;


--
-- Name: TABLE project_bv; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_bv TO anon;
GRANT ALL ON TABLE public.project_bv TO authenticated;
GRANT ALL ON TABLE public.project_bv TO service_role;


--
-- Name: TABLE project_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_documents TO anon;
GRANT ALL ON TABLE public.project_documents TO authenticated;
GRANT ALL ON TABLE public.project_documents TO service_role;


--
-- Name: TABLE project_initial_expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_initial_expenses TO anon;
GRANT ALL ON TABLE public.project_initial_expenses TO authenticated;
GRANT ALL ON TABLE public.project_initial_expenses TO service_role;


--
-- Name: TABLE project_schedule_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_schedule_tasks TO anon;
GRANT ALL ON TABLE public.project_schedule_tasks TO authenticated;
GRANT ALL ON TABLE public.project_schedule_tasks TO service_role;


--
-- Name: TABLE project_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_schedules TO anon;
GRANT ALL ON TABLE public.project_schedules TO authenticated;
GRANT ALL ON TABLE public.project_schedules TO service_role;


--
-- Name: TABLE project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_types TO anon;
GRANT ALL ON TABLE public.project_types TO authenticated;
GRANT ALL ON TABLE public.project_types TO service_role;


--
-- Name: TABLE project_weekly_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.project_weekly_reports TO anon;
GRANT ALL ON TABLE public.project_weekly_reports TO authenticated;
GRANT ALL ON TABLE public.project_weekly_reports TO service_role;


--
-- Name: TABLE purchase_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;


--
-- Name: TABLE q_term_section_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.q_term_section_details TO anon;
GRANT ALL ON TABLE public.q_term_section_details TO authenticated;
GRANT ALL ON TABLE public.q_term_section_details TO service_role;


--
-- Name: TABLE q_term_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.q_term_sections TO anon;
GRANT ALL ON TABLE public.q_term_sections TO authenticated;
GRANT ALL ON TABLE public.q_term_sections TO service_role;


--
-- Name: TABLE qms_box_access_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_box_access_log TO service_role;
GRANT SELECT ON TABLE public.qms_box_access_log TO authenticated;


--
-- Name: SEQUENCE qms_box_access_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.qms_box_access_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.qms_box_access_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.qms_box_access_log_id_seq TO service_role;


--
-- Name: TABLE qms_cost_coverages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_cost_coverages TO service_role;
GRANT SELECT ON TABLE public.qms_cost_coverages TO authenticated;


--
-- Name: TABLE qms_supplier_quote_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_supplier_quote_items TO service_role;
GRANT SELECT ON TABLE public.qms_supplier_quote_items TO authenticated;


--
-- Name: TABLE qms_supplier_quote_revisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_supplier_quote_revisions TO service_role;
GRANT SELECT ON TABLE public.qms_supplier_quote_revisions TO authenticated;


--
-- Name: TABLE qms_cost_reference_samples; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_cost_reference_samples TO service_role;


--
-- Name: TABLE qms_cost_source_snapshots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_cost_source_snapshots TO service_role;
GRANT SELECT ON TABLE public.qms_cost_source_snapshots TO authenticated;


--
-- Name: TABLE qms_drawing_analyses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_drawing_analyses TO service_role;
GRANT SELECT ON TABLE public.qms_drawing_analyses TO authenticated;


--
-- Name: TABLE qms_estimate_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_estimate_runs TO service_role;
GRANT SELECT ON TABLE public.qms_estimate_runs TO authenticated;


--
-- Name: TABLE qms_historical_quote_import_revisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_historical_quote_import_revisions TO service_role;
GRANT SELECT ON TABLE public.qms_historical_quote_import_revisions TO authenticated;


--
-- Name: TABLE qms_historical_quote_imports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_historical_quote_imports TO service_role;
GRANT SELECT ON TABLE public.qms_historical_quote_imports TO authenticated;


--
-- Name: TABLE qms_item_professional_description_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_item_professional_description_audit TO service_role;
GRANT SELECT ON TABLE public.qms_item_professional_description_audit TO authenticated;


--
-- Name: SEQUENCE qms_item_professional_description_audit_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.qms_item_professional_description_audit_id_seq TO anon;
GRANT ALL ON SEQUENCE public.qms_item_professional_description_audit_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.qms_item_professional_description_audit_id_seq TO service_role;


--
-- Name: TABLE qms_item_professional_descriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_item_professional_descriptions TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_item_professional_descriptions TO authenticated;


--
-- Name: TABLE qms_item_variant_aliases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_item_variant_aliases TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_item_variant_aliases TO authenticated;


--
-- Name: TABLE qms_item_variants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_item_variants TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_item_variants TO authenticated;


--
-- Name: TABLE qms_page_permission_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_page_permission_audit TO service_role;
GRANT SELECT ON TABLE public.qms_page_permission_audit TO authenticated;


--
-- Name: TABLE qms_page_permission_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_page_permission_settings TO service_role;
GRANT SELECT ON TABLE public.qms_page_permission_settings TO authenticated;


--
-- Name: TABLE qms_quotation_cost_revisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_cost_revisions TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_cost_revisions TO authenticated;


--
-- Name: TABLE qms_quotation_industries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_industries TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_industries TO authenticated;


--
-- Name: TABLE qms_quotation_item_cost_bindings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_item_cost_bindings TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_item_cost_bindings TO authenticated;


--
-- Name: TABLE qms_quotation_item_identities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_item_identities TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_item_identities TO authenticated;


--
-- Name: TABLE qms_quotation_remarks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_remarks TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_remarks TO authenticated;


--
-- Name: TABLE qms_quotation_revisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_revisions TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_revisions TO authenticated;


--
-- Name: TABLE qms_quotation_section_ordinals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_section_ordinals TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_section_ordinals TO authenticated;


--
-- Name: TABLE qms_quotation_section_prices; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_section_prices TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_section_prices TO authenticated;


--
-- Name: TABLE qms_quotation_site_conditions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_site_conditions TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_site_conditions TO authenticated;


--
-- Name: TABLE qms_quotation_supplier_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quotation_supplier_links TO service_role;
GRANT SELECT ON TABLE public.qms_quotation_supplier_links TO authenticated;


--
-- Name: TABLE qms_quote_cost_audits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_audits TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_audits TO authenticated;


--
-- Name: TABLE qms_quote_cost_lines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_lines TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_lines TO authenticated;


--
-- Name: TABLE qms_quote_cost_packet_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_packet_files TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_packet_files TO authenticated;


--
-- Name: TABLE qms_quote_cost_packets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_packets TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_packets TO authenticated;


--
-- Name: TABLE qms_quote_cost_scope_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_scope_files TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_scope_files TO authenticated;


--
-- Name: TABLE qms_quote_cost_scope_sources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_scope_sources TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_scope_sources TO authenticated;


--
-- Name: TABLE qms_quote_cost_scopes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_scopes TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_scopes TO authenticated;


--
-- Name: TABLE qms_quote_cost_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_cost_versions TO service_role;
GRANT SELECT ON TABLE public.qms_quote_cost_versions TO authenticated;


--
-- Name: TABLE qms_quote_evaluations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_evaluations TO service_role;
GRANT SELECT ON TABLE public.qms_quote_evaluations TO authenticated;


--
-- Name: TABLE qms_quote_exclusion_options; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_exclusion_options TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_quote_exclusion_options TO authenticated;


--
-- Name: TABLE qms_quote_project_type_labels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_project_type_labels TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_quote_project_type_labels TO authenticated;


--
-- Name: TABLE qms_quote_share_annotations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_share_annotations TO service_role;


--
-- Name: TABLE qms_quote_share_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_share_links TO service_role;


--
-- Name: TABLE qms_quote_site_media; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_site_media TO service_role;
GRANT SELECT ON TABLE public.qms_quote_site_media TO authenticated;


--
-- Name: TABLE qms_quote_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_quote_templates TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_quote_templates TO authenticated;


--
-- Name: TABLE qms_supplier_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_supplier_profiles TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.qms_supplier_profiles TO authenticated;


--
-- Name: TABLE qms_supplier_quote_import_revisions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_supplier_quote_import_revisions TO service_role;
GRANT SELECT ON TABLE public.qms_supplier_quote_import_revisions TO authenticated;


--
-- Name: TABLE qms_supplier_quote_imports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_supplier_quote_imports TO service_role;
GRANT SELECT ON TABLE public.qms_supplier_quote_imports TO authenticated;


--
-- Name: TABLE qms_supplier_quote_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.qms_supplier_quote_sections TO service_role;
GRANT SELECT ON TABLE public.qms_supplier_quote_sections TO authenticated;


--
-- Name: TABLE quotation_expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quotation_expenses TO anon;
GRANT ALL ON TABLE public.quotation_expenses TO authenticated;
GRANT ALL ON TABLE public.quotation_expenses TO service_role;


--
-- Name: TABLE quotation_section_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quotation_section_items TO anon;
GRANT ALL ON TABLE public.quotation_section_items TO authenticated;
GRANT ALL ON TABLE public.quotation_section_items TO service_role;


--
-- Name: TABLE quotation_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quotation_sections TO anon;
GRANT ALL ON TABLE public.quotation_sections TO authenticated;
GRANT ALL ON TABLE public.quotation_sections TO service_role;


--
-- Name: TABLE quotations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quotations TO anon;
GRANT ALL ON TABLE public.quotations TO authenticated;
GRANT ALL ON TABLE public.quotations TO service_role;


--
-- Name: TABLE receipt_sub_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.receipt_sub_items TO anon;
GRANT ALL ON TABLE public.receipt_sub_items TO authenticated;
GRANT ALL ON TABLE public.receipt_sub_items TO service_role;


--
-- Name: TABLE receipts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.receipts TO anon;
GRANT ALL ON TABLE public.receipts TO authenticated;
GRANT ALL ON TABLE public.receipts TO service_role;


--
-- Name: TABLE recurring_incomes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.recurring_incomes TO anon;
GRANT ALL ON TABLE public.recurring_incomes TO authenticated;
GRANT ALL ON TABLE public.recurring_incomes TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE service_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.service_items TO anon;
GRANT ALL ON TABLE public.service_items TO authenticated;
GRANT ALL ON TABLE public.service_items TO service_role;


--
-- Name: TABLE service_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.service_types TO anon;
GRANT ALL ON TABLE public.service_types TO authenticated;
GRANT ALL ON TABLE public.service_types TO service_role;


--
-- Name: TABLE site_status_answers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_status_answers TO anon;
GRANT ALL ON TABLE public.site_status_answers TO authenticated;
GRANT ALL ON TABLE public.site_status_answers TO service_role;


--
-- Name: TABLE site_status_item_quantities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_status_item_quantities TO anon;
GRANT ALL ON TABLE public.site_status_item_quantities TO authenticated;
GRANT ALL ON TABLE public.site_status_item_quantities TO service_role;


--
-- Name: TABLE site_status_question_options; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_status_question_options TO anon;
GRANT ALL ON TABLE public.site_status_question_options TO authenticated;
GRANT ALL ON TABLE public.site_status_question_options TO service_role;


--
-- Name: TABLE site_status_question_project_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_status_question_project_types TO anon;
GRANT ALL ON TABLE public.site_status_question_project_types TO authenticated;
GRANT ALL ON TABLE public.site_status_question_project_types TO service_role;


--
-- Name: TABLE site_status_questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_status_questions TO anon;
GRANT ALL ON TABLE public.site_status_questions TO authenticated;
GRANT ALL ON TABLE public.site_status_questions TO service_role;


--
-- Name: TABLE site_status_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_status_sections TO anon;
GRANT ALL ON TABLE public.site_status_sections TO authenticated;
GRANT ALL ON TABLE public.site_status_sections TO service_role;


--
-- Name: TABLE site_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_statuses TO anon;
GRANT ALL ON TABLE public.site_statuses TO authenticated;
GRANT ALL ON TABLE public.site_statuses TO service_role;


--
-- Name: TABLE site_statuses_legacy_backup; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.site_statuses_legacy_backup TO anon;
GRANT ALL ON TABLE public.site_statuses_legacy_backup TO authenticated;
GRANT ALL ON TABLE public.site_statuses_legacy_backup TO service_role;


--
-- Name: TABLE source_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.source_types TO anon;
GRANT ALL ON TABLE public.source_types TO authenticated;
GRANT ALL ON TABLE public.source_types TO service_role;


--
-- Name: TABLE specific_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.specific_rules TO anon;
GRANT ALL ON TABLE public.specific_rules TO authenticated;
GRANT ALL ON TABLE public.specific_rules TO service_role;


--
-- Name: TABLE staff; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.staff TO anon;
GRANT ALL ON TABLE public.staff TO authenticated;
GRANT ALL ON TABLE public.staff TO service_role;


--
-- Name: TABLE staff_bv_deductions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.staff_bv_deductions TO anon;
GRANT ALL ON TABLE public.staff_bv_deductions TO authenticated;
GRANT ALL ON TABLE public.staff_bv_deductions TO service_role;


--
-- Name: TABLE staff_supplier_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.staff_supplier_comments TO anon;
GRANT ALL ON TABLE public.staff_supplier_comments TO authenticated;
GRANT ALL ON TABLE public.staff_supplier_comments TO service_role;


--
-- Name: TABLE supplier_feedback; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_feedback TO anon;
GRANT ALL ON TABLE public.supplier_feedback TO authenticated;
GRANT ALL ON TABLE public.supplier_feedback TO service_role;


--
-- Name: TABLE supplier_file_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_file_types TO anon;
GRANT ALL ON TABLE public.supplier_file_types TO authenticated;
GRANT ALL ON TABLE public.supplier_file_types TO service_role;


--
-- Name: TABLE supplier_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_files TO anon;
GRANT ALL ON TABLE public.supplier_files TO authenticated;
GRANT ALL ON TABLE public.supplier_files TO service_role;


--
-- Name: TABLE supplier_level_pass_out_dates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_level_pass_out_dates TO anon;
GRANT ALL ON TABLE public.supplier_level_pass_out_dates TO authenticated;
GRANT ALL ON TABLE public.supplier_level_pass_out_dates TO service_role;


--
-- Name: TABLE supplier_level_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_level_roles TO anon;
GRANT ALL ON TABLE public.supplier_level_roles TO authenticated;
GRANT ALL ON TABLE public.supplier_level_roles TO service_role;


--
-- Name: TABLE supplier_login_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_login_codes TO anon;
GRANT ALL ON TABLE public.supplier_login_codes TO authenticated;
GRANT ALL ON TABLE public.supplier_login_codes TO service_role;


--
-- Name: TABLE supplier_pricings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_pricings TO anon;
GRANT ALL ON TABLE public.supplier_pricings TO authenticated;
GRANT ALL ON TABLE public.supplier_pricings TO service_role;


--
-- Name: TABLE supplier_recent_statuses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_recent_statuses TO anon;
GRANT ALL ON TABLE public.supplier_recent_statuses TO authenticated;
GRANT ALL ON TABLE public.supplier_recent_statuses TO service_role;


--
-- Name: TABLE supplier_register_forms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_register_forms TO anon;
GRANT ALL ON TABLE public.supplier_register_forms TO authenticated;
GRANT ALL ON TABLE public.supplier_register_forms TO service_role;


--
-- Name: TABLE supplier_rule_displays; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_rule_displays TO anon;
GRANT ALL ON TABLE public.supplier_rule_displays TO authenticated;
GRANT ALL ON TABLE public.supplier_rule_displays TO service_role;


--
-- Name: TABLE supplier_supplier_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_supplier_tags TO anon;
GRANT ALL ON TABLE public.supplier_supplier_tags TO authenticated;
GRANT ALL ON TABLE public.supplier_supplier_tags TO service_role;


--
-- Name: TABLE supplier_supplier_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_supplier_types TO anon;
GRANT ALL ON TABLE public.supplier_supplier_types TO authenticated;
GRANT ALL ON TABLE public.supplier_supplier_types TO service_role;


--
-- Name: TABLE supplier_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.supplier_types TO anon;
GRANT ALL ON TABLE public.supplier_types TO authenticated;
GRANT ALL ON TABLE public.supplier_types TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE target_sales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.target_sales TO anon;
GRANT ALL ON TABLE public.target_sales TO authenticated;
GRANT ALL ON TABLE public.target_sales TO service_role;


--
-- Name: TABLE team_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.team_types TO anon;
GRANT ALL ON TABLE public.team_types TO authenticated;
GRANT ALL ON TABLE public.team_types TO service_role;


--
-- Name: TABLE tender_bids; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_bids TO anon;
GRANT ALL ON TABLE public.tender_bids TO authenticated;
GRANT ALL ON TABLE public.tender_bids TO service_role;


--
-- Name: TABLE tender_message_bids; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_message_bids TO anon;
GRANT ALL ON TABLE public.tender_message_bids TO authenticated;
GRANT ALL ON TABLE public.tender_message_bids TO service_role;


--
-- Name: TABLE tender_message_receivers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_message_receivers TO anon;
GRANT ALL ON TABLE public.tender_message_receivers TO authenticated;
GRANT ALL ON TABLE public.tender_message_receivers TO service_role;


--
-- Name: TABLE tender_message_seen; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_message_seen TO anon;
GRANT ALL ON TABLE public.tender_message_seen TO authenticated;
GRANT ALL ON TABLE public.tender_message_seen TO service_role;


--
-- Name: TABLE tender_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_messages TO anon;
GRANT ALL ON TABLE public.tender_messages TO authenticated;
GRANT ALL ON TABLE public.tender_messages TO service_role;


--
-- Name: TABLE tender_rejected_suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_rejected_suppliers TO anon;
GRANT ALL ON TABLE public.tender_rejected_suppliers TO authenticated;
GRANT ALL ON TABLE public.tender_rejected_suppliers TO service_role;


--
-- Name: TABLE tender_responds; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_responds TO anon;
GRANT ALL ON TABLE public.tender_responds TO authenticated;
GRANT ALL ON TABLE public.tender_responds TO service_role;


--
-- Name: TABLE tender_seen; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_seen TO anon;
GRANT ALL ON TABLE public.tender_seen TO authenticated;
GRANT ALL ON TABLE public.tender_seen TO service_role;


--
-- Name: TABLE tender_selective_suppliers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tender_selective_suppliers TO anon;
GRANT ALL ON TABLE public.tender_selective_suppliers TO authenticated;
GRANT ALL ON TABLE public.tender_selective_suppliers TO service_role;


--
-- Name: TABLE tenders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tenders TO anon;
GRANT ALL ON TABLE public.tenders TO authenticated;
GRANT ALL ON TABLE public.tenders TO service_role;


--
-- Name: TABLE term_template_section_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.term_template_section_details TO anon;
GRANT ALL ON TABLE public.term_template_section_details TO authenticated;
GRANT ALL ON TABLE public.term_template_section_details TO service_role;


--
-- Name: TABLE term_template_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.term_template_sections TO anon;
GRANT ALL ON TABLE public.term_template_sections TO authenticated;
GRANT ALL ON TABLE public.term_template_sections TO service_role;


--
-- Name: TABLE term_template_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.term_template_types TO anon;
GRANT ALL ON TABLE public.term_template_types TO authenticated;
GRANT ALL ON TABLE public.term_template_types TO service_role;


--
-- Name: TABLE three_d_collection_liked_staff; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.three_d_collection_liked_staff TO anon;
GRANT ALL ON TABLE public.three_d_collection_liked_staff TO authenticated;
GRANT ALL ON TABLE public.three_d_collection_liked_staff TO service_role;


--
-- Name: TABLE three_d_collections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.three_d_collections TO anon;
GRANT ALL ON TABLE public.three_d_collections TO authenticated;
GRANT ALL ON TABLE public.three_d_collections TO service_role;


--
-- Name: TABLE three_d_renders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.three_d_renders TO anon;
GRANT ALL ON TABLE public.three_d_renders TO authenticated;
GRANT ALL ON TABLE public.three_d_renders TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


