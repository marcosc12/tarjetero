import type { Tarjeta } from "@/components/profile-card";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

type SupabaseError = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};
type SupabaseResponse<T> = { data: T; error: SupabaseError | null };
export type MenuProductRecord = {
  id: string | number;
  tarjeta_slug: string;
  producto: string;
  precio: string | number;
  descripcion: string | null;
  categoria: string | null;
  imagen_url: string | null;
  activo: boolean;
  orden: number;
  en_promocion: boolean;
  precio_promocion: string | number | null;
  etiqueta_promocion: string | null;
  created_at?: string;
};
export type MenuPromotionRecord = {
  id: string | number;
  tarjeta_slug: string;
  titulo: string;
  descuento: string | number;
  descripcion: string | null;
  precio_anterior: string | number | null;
  precio: string | number | null;
  imagen_url: string | null;
  vigencia: string | null;
  activo: boolean;
  created_at?: string;
};
type MenuQuery<T> = {
  eq: (column: string, value: string | number | boolean) => MenuQuery<T>;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => Promise<SupabaseResponse<T[]>>;
};
type MenuMutation<T> = Promise<SupabaseResponse<unknown>> & {
  select: (columns?: string) => {
    single: () => Promise<SupabaseResponse<T>>;
  };
};
type MenuTableClient<T> = {
  select: (columns?: string) => MenuQuery<T>;
  insert: (values: Partial<T>) => MenuMutation<T>;
  update: (values: Partial<T>) => {
    eq: (column: string, value: string | number) => {
      eq: (column: string, value: string | number) => MenuMutation<T>;
    };
  };
  delete: () => {
    eq: (column: string, value: string | number) => {
      eq: (column: string, value: string | number) => Promise<SupabaseResponse<unknown>>;
    };
  };
};
type TarjetasTableClient = {
  select: (columns?: string) => {
    eq: (column: "slug", value: string) => {
      maybeSingle: () => Promise<SupabaseResponse<Tarjeta | null>>;
    };
    order: (
      column: "slug",
      options: { ascending: boolean },
    ) => Promise<SupabaseResponse<Tarjeta[]>>;
  };
  upsert: (
    values: Partial<Tarjeta>,
    options: { onConflict: "slug" },
  ) => {
    select: () => {
      single: () => Promise<SupabaseResponse<Tarjeta>>;
    };
  };
  update: (values: Partial<Tarjeta>) => {
    eq: (column: "slug", value: string) => Promise<SupabaseResponse<unknown>>;
  };
};
type StorageBucket = {
  upload: (
    path: string,
    file: File,
    options: { upsert: boolean; contentType: string },
  ) => Promise<{ data: { path: string } | null; error: SupabaseError | null }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
};
export type AdminSession = {
  user: {
    id: string;
  };
} | null;

export type SupabaseBrowserClient = {
  from: {
    (table: "tarjetas"): TarjetasTableClient;
    (table: "menu_productos"): MenuTableClient<MenuProductRecord>;
    (table: "menu_promociones"): MenuTableClient<MenuPromotionRecord>;
  };
  storage: { from: (bucket: "menu-imagenes") => StorageBucket };
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data: { session: AdminSession };
      error: SupabaseError | null;
    }>;
    getSession: () => Promise<{
      data: { session: AdminSession };
      error: SupabaseError | null;
    }>;
    onAuthStateChange: (
      callback: (_event: string, session: AdminSession) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } };
    signOut: () => Promise<{ error: SupabaseError | null }>;
  };
};

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string) => SupabaseBrowserClient;
    };
    QRCode?: {
      toCanvas: (
        canvas: HTMLCanvasElement,
        text: string,
        options: {
          width: number;
          margin: number;
          color: { dark: string; light: string };
        },
      ) => Promise<void>;
    };
  }
}
