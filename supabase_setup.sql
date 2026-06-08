-- ══════════════════════════════════════════
-- Kerry Care — Setup en Supabase
-- Pegar en: Supabase → SQL Editor → New query
-- ══════════════════════════════════════════

-- 1. Crear schema propio (no toca tus datos existentes en "public")
CREATE SCHEMA IF NOT EXISTS kerrycare;

-- 2. Crear tabla de citas dentro del schema kerrycare
CREATE TABLE kerrycare.citas (
  id                   BIGSERIAL PRIMARY KEY,
  nombre               TEXT NOT NULL,
  telefono             TEXT NOT NULL,
  servicio             TEXT NOT NULL,
  fecha                DATE NOT NULL,
  hora                 TIME NOT NULL,
  mensaje              TEXT DEFAULT '',
  recordatorio_enviado BOOLEAN DEFAULT FALSE,
  creado_en            TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Desactivar RLS — acceso controlado desde el servidor con service_role key
ALTER TABLE kerrycare.citas DISABLE ROW LEVEL SECURITY;

-- 4. Índice para que el cron encuentre rápido las citas de mañana
CREATE INDEX idx_kerrycare_citas_fecha
  ON kerrycare.citas(fecha, recordatorio_enviado);

-- 5. Permisos para que el cliente de Supabase pueda leer/escribir
GRANT USAGE ON SCHEMA kerrycare TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA kerrycare TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA kerrycare TO anon, authenticated, service_role;
