-- ============================================
-- BOLSILLERAS — Columnas nuevas
-- Correr UNA vez en el SQL Editor de Supabase.
-- ============================================

-- Hora de cada pichanga (texto, ej: "21:00 hrs")
ALTER TABLE pichangas ADD COLUMN IF NOT EXISTS hora TEXT;

-- Cuánto le salió la pichanga a cada jugador (monto que pagó)
ALTER TABLE signups ADD COLUMN IF NOT EXISTS costo INTEGER;
