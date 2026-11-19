"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { ProfileCard, ProfileFooter, type Tarjeta } from "@/components/profile-card";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase-browser";

export function PublicCardPage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    if (status !== "loading") return;
    const timeout = window.setTimeout(() => {
      setErrorDetail("No se recibió respuesta en 15 segundos. Comprueba tu conexión con Supabase.");
      setStatus("error");
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!sdkReady) return;

    let active = true;
    const slug = new URLSearchParams(window.location.search).get("c") || "cafe-esquina";
    const fail = (message: string) => {
      if (!active) return;
      setErrorDetail(message);
      setStatus("error");
    };

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      fail(
        `Configuración de Supabase incompleta: NEXT_PUBLIC_SUPABASE_URL ${
          SUPABASE_URL ? "definida" : "no definida"
        }, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ${SUPABASE_KEY ? "definida" : "no definida"}.`,
      );
      return () => {
        active = false;
      };
    }

    const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
    if (!client) {
      fail("El SDK de Supabase no está disponible en el navegador.");
      return () => {
        active = false;
      };
    }

    const requestTimeout = window.setTimeout(() => {
      fail("La consulta tardó más de 10 segundos. Revisa la conexión a Supabase.");
    }, 10000);

    client
      .from("tarjetas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
        if (error) {
            const errorInfo = [
            error.code ? `Código: ${error.code}` : "",
            error.message ? `Mensaje: ${error.message}` : "",
            error.details ? `Detalle: ${error.details}` : "",
            error.hint ? `Sugerencia: ${error.hint}` : "",
          ].filter(Boolean);
          fail(errorInfo.join(" · ") || "Supabase devolvió un error sin descripción.");
          return;
        }
        setTarjeta(data);
        setStatus(data ? "ready" : "not-found");
      })
      .catch((error: unknown) => {
        if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
        const detail =
          error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        fail(detail || "Error desconocido durante la consulta a Supabase.");
      });

    return () => {
      active = false;
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
    };
  }, [sdkReady]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onError={() => {
          setErrorDetail("No se pudo descargar el SDK de Supabase desde jsDelivr.");
          setStatus("error");
        }}
      />
      <main
        className="public-card-page"
        style={{ backgroundColor: tarjeta?.color_fondo || undefined }}
      >
        <div className="public-card-shell profile-enter">
          {status === "ready" && tarjeta ? (
            <>
              <ProfileCard tarjeta={tarjeta} />
              <ProfileFooter />
            </>
          ) : status === "loading" ? (
            <section className="card-skeleton" aria-label="Cargando tarjeta" aria-busy="true">
              <span className="skeleton-avatar" />
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line skeleton-tagline" />
              <span className="skeleton-button" />
              <span className="skeleton-button" />
              <span className="skeleton-button" />
              <span className="sr-only">Cargando tarjeta...</span>
            </section>
          ) : (
            <section
              aria-live="polite"
              className="card-message"
            >
              <h1 className="text-xl font-semibold tracking-[-0.04em] text-[#202b23]">
                {status === "not-found" ? "Tarjeta no encontrada" : "No se pudo cargar la tarjeta"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#788078]">
                {status === "not-found"
                  ? "Revisa el enlace o vuelve a intentarlo más tarde."
                  : "La conexión tardó demasiado o no está disponible. Inténtalo de nuevo."}
              </p>
              {status === "error" && errorDetail && (
                <p className="mt-4 rounded-xl border border-[#f0e5e8] bg-[#fbf6f7] px-4 py-3 text-left text-xs leading-5 text-[#806b70]">
                  Diagnóstico: {errorDetail}
                </p>
              )}
              {status === "error" && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-6 min-h-11 rounded-xl bg-[#20372a] px-5 text-sm font-semibold text-white hover:bg-[#2b4937]"
                >
                  Reintentar
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
