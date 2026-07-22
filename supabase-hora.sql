-- ============================================
-- BOLSILLERAS — Columna Hora de las pichangas
-- Correr UNA vez en el SQL Editor de Supabase.
-- ============================================

-- Hora de cada pichanga (texto, ej: "21:00 hrs")
ALTER TABLE pichangas ADD COLUMN IF NOT EXISTS hora TEXT;
