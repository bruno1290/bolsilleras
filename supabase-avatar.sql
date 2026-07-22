-- ============================================
-- BOLSILLERAS — Columnas nuevas
-- Correr UNA vez en el SQL Editor de Supabase.
-- ============================================

-- Personaje (avatar) de cada jugador, guardado como JSON
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar JSONB;

-- Hora de cada pichanga (texto, ej: "21:00 hrs")
ALTER TABLE pichangas ADD COLUMN IF NOT EXISTS hora TEXT;
