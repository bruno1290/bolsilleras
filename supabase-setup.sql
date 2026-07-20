-- ============================================
-- BOLSILLERAS — Schema para Supabase
-- Correr esto en el SQL Editor de Supabase
-- ============================================

-- Tabla de jugadores
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  pin TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de pichangas
CREATE TABLE pichangas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  score_blanco INTEGER DEFAULT 0,
  score_color INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de inscripciones
CREATE TABLE signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pichanga_id UUID NOT NULL REFERENCES pichangas(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team TEXT CHECK (team IS NULL OR team IN ('blanco', 'color')),
  goals INTEGER DEFAULT 0,
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pichanga_id, player_id)
);

-- Habilitar RLS con políticas permisivas (app de amigos)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pichangas ENABLE ROW LEVEL SECURITY;
ALTER TABLE signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON pichangas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON signups FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para actualizaciones en vivo
ALTER PUBLICATION supabase_realtime ADD TABLE signups;
ALTER PUBLICATION supabase_realtime ADD TABLE pichangas;
