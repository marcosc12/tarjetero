ALTER TABLE public.tarjetas
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS color_fondo TEXT NOT NULL DEFAULT '#f7f8f6',
  ADD COLUMN IF NOT EXISTS color_tarjeta TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS color_boton TEXT NOT NULL DEFAULT '#202a24',
  ADD COLUMN IF NOT EXISTS color_texto TEXT NOT NULL DEFAULT '#202b23',
  ADD COLUMN IF NOT EXISTS links JSONB;

COMMENT ON COLUMN public.tarjetas.eslogan IS
  'Descripción breve que aparece bajo el nombre de la tarjeta.';
COMMENT ON COLUMN public.tarjetas.links IS
  'Lista opcional de enlaces JSONB: id, tipo, titulo, subtitulo y url. Los campos WhatsApp, Instagram y ubicación existentes se conservan para compatibilidad.';
