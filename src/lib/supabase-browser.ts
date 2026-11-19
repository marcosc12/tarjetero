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
export type AdminSession = {
  user: {
    id: string;
  };
} | null;

export type SupabaseBrowserClient = {
  from: (table: "tarjetas") => {
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
