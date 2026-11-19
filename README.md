# Tarjetas Digitales

Aplicación React con Next.js: las tarjetas públicas consultan Supabase en tiempo real y el panel `/admin` crea, edita y suspende registros sin una nueva implementación.

## Ejecutar localmente

```bash
npm install
npm run dev
```

- Tarjeta pública predeterminada: `http://localhost:3000/` (slug `cafe-esquina`).
- Tarjeta por slug: `http://localhost:3000/?c=cafe-esquina`.
- Panel React: `http://localhost:3000/admin`.
- Las URL anteriores `/<slug>` redirigen a `/?c=<slug>`.

## Configuración de Supabase

Crea `.env.local` en la raíz:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mhmjvjyoiwmjkhxajmqf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REEMPLAZA_CON_TU_PUBLISHABLE_KEY
```

La Publishable Key está diseñada para uso en el navegador; nunca uses la `service_role` key aquí. Reinicia `npm run dev` después de crear o cambiar `.env.local`.

En Supabase SQL Editor, ejecuta el contenido de `supabase/policies.sql`. El script activa RLS, reemplaza las políticas existentes de `public.tarjetas` y deja lectura pública y escritura solo para sesiones autenticadas. El panel requiere iniciar sesión con un usuario de Supabase, pero no requiere `app_metadata.role`.

**Importante:** esta configuración permite modificar tarjetas a cualquier usuario que pueda iniciar sesión en este proyecto Supabase. Desactiva el registro público de usuarios en Supabase Auth y crea/invita únicamente las cuentas de confianza. No habilites escrituras para `anon`.

## Vercel

En **Project Settings → Environment Variables**, agrega para Production, Preview y Development:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://mhmjvjyoiwmjkhxajmqf.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = tu Publishable Key de Supabase

Vuelve a desplegar una vez para que Next.js incluya las variables `NEXT_PUBLIC_` en el bundle. Los cambios posteriores a los registros de tarjetas se aplican directamente desde Supabase, sin otro despliegue.
"# tarjetero" 
