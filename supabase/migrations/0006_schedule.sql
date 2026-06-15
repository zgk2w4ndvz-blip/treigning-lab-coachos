-- ============================================================================
-- 0006_schedule.sql — Schedule Sessions table
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE schedule_session_type AS ENUM (
    'training', 'consultation', 'check_in',
    'competition_prep', 'follow_up', 'group_session'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_modality AS ENUM ('in_person', 'virtual', 'phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS schedule_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  title          text NOT NULL,
  session_type   schedule_session_type NOT NULL DEFAULT 'training',
  scheduled_at   timestamptz NOT NULL,
  duration_min   integer NOT NULL DEFAULT 60 CHECK (duration_min >= 5 AND duration_min <= 480),
  location       text,
  modality       session_modality,
  notes          text,
  status         session_status NOT NULL DEFAULT 'scheduled',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS schedule_sessions_coach_id_idx ON schedule_sessions (coach_id);
CREATE INDEX IF NOT EXISTS schedule_sessions_scheduled_at_idx ON schedule_sessions (scheduled_at);
CREATE INDEX IF NOT EXISTS schedule_sessions_client_id_idx ON schedule_sessions (client_id);

-- updated_at trigger
CREATE OR REPLACE TRIGGER schedule_sessions_updated_at
  BEFORE UPDATE ON schedule_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE schedule_sessions ENABLE ROW LEVEL SECURITY;

-- Coaches can read/write their own sessions
CREATE POLICY "Coach manages own schedule sessions"
  ON schedule_sessions
  FOR ALL
  USING (coach_id = current_profile_id())
  WITH CHECK (coach_id = current_profile_id());

-- Linked clients can read sessions they are part of
CREATE POLICY "Client reads own schedule sessions"
  ON schedule_sessions
  FOR SELECT
  USING (
    client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = schedule_sessions.client_id
        AND clients.profile_id = current_profile_id()
    )
  );
