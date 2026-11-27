"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  ProfileCard,
  ProfileFooter,
  type MenuProduct,
  type MenuPromotion,
  type Tarjeta,
} from "@/components/profile-card";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase-browser";
import type { MenuProductRecord, MenuPromotionRecord } from "@/lib/supabase-browser";

export function PublicCardPage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState("");
  const [menuView, setMenuView] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);

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
    let timedOut = false;
    const searchParams = new URLSearchParams(window.location.search);
    const slug = searchParams.get("c") || "cafe-esquina";
    const showMenu = searchParams.get("view") === "menu";
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
      timedOut = true;
      fail("La consulta tardó más de 10 segundos. Revisa la conexión a Supabase.");
    }, 10000);

    client
      .from("tarjetas")
      .select(
        "slug,nombre,eslogan,inicial,avatar_url,color_fondo,color_tarjeta,color_boton,color_texto,mostrar_menu,links,whatsapp,whatsapp_sub,instagram,instagram_sub,ubicacion_url,ubicacion_sub,activo",
      )
      .eq("slug", slug)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!active || timedOut) return;
        if (error) {
          if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
          const errorInfo = [
            error.code ? `Código: ${error.code}` : "",
            error.message ? `Mensaje: ${error.message}` : "",
            error.details ? `Detalle: ${error.details}` : "",
            error.hint ? `Sugerencia: ${error.hint}` : "",
          ].filter(Boolean);
          fail(errorInfo.join(" · ") || "Supabase devolvió un error sin descripción.");
          return;
        }
        if (!data) {
          if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
          setTarjeta(null);
          setStatus("not-found");
          return;
        }

        setMenuView(showMenu);
        setTarjeta({
          ...data,
          products: [],
          promotions: [],
          hasActiveMenu: false,
        });
        setStatus("ready");

        if (showMenu) {
          setMenuLoading(true);
          const [productsResult, promotionsResult] = await Promise.all([
            client
              .from("menu_productos")
              .select(
                "id,producto,precio,descripcion,categoria,imagen_url,orden,en_promocion,precio_promocion,etiqueta_promocion",
              )
              .eq("tarjeta_slug", slug)
              .eq("activo", true)
              .order("orden", { ascending: true }),
            client
              .from("menu_promociones")
              .select(
                "id,titulo,descuento,descripcion,precio_anterior,precio,imagen_url,vigencia",
              )
              .eq("tarjeta_slug", slug)
              .eq("activo", true)
              .order("created_at", { ascending: true }),
          ]);
          if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
          if (!active || timedOut) return;
          if (productsResult.error || promotionsResult.error || !productsResult.data || !promotionsResult.data) {
            const menuError = productsResult.error?.message || promotionsResult.error?.message || "Respuesta incompleta al cargar el menú.";
            fail(`No se pudo cargar el menú: ${menuError}`);
            return;
          }

          const products: MenuProduct[] = productsResult.data.map((product: MenuProductRecord) => ({
            id: String(product.id),
            key: String(product.id),
            imageUrl: product.imagen_url ?? "",
            name: product.producto,
            price: String(product.precio ?? ""),
            description: product.descripcion ?? "",
            category: product.categoria ?? "",
            active: true,
            order: product.orden,
            onPromotion: product.en_promocion === true,
            promotionPrice: product.precio_promocion == null ? "" : String(product.precio_promocion),
            promotionLabel: product.etiqueta_promocion ?? "",
          }));
          const promotions: MenuPromotion[] = promotionsResult.data.map((promotion: MenuPromotionRecord) => ({
            id: String(promotion.id),
            key: String(promotion.id),
            title: promotion.titulo,
            discount: String(promotion.descuento ?? ""),
            description: promotion.descripcion ?? "",
            previousPrice: promotion.precio_anterior == null ? "" : String(promotion.precio_anterior),
            price: promotion.precio == null ? "" : String(promotion.precio),
            imageUrl: promotion.imagen_url ?? "",
            validity: promotion.vigencia ?? "",
            active: true,
          }));
          setTarjeta((current) =>
            current
              ? {
                  ...current,
                  products,
                  promotions,
                  hasActiveMenu: products.length > 0 || promotions.length > 0,
                }
              : current,
          );
          setMenuLoading(false);
        } else if (data.mostrar_menu !== false) {
          const [productsResult, promotionsResult] = await Promise.all([
            client
              .from("menu_productos")
              .select("id")
              .eq("tarjeta_slug", slug)
              .eq("activo", true)
              .limit(1),
            client
              .from("menu_promociones")
              .select("id")
              .eq("tarjeta_slug", slug)
              .eq("activo", true)
              .limit(1),
          ]);
          if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
          if (!active || timedOut) return;
          if (productsResult.error || promotionsResult.error || !productsResult.data || !promotionsResult.data) {
            const menuError = productsResult.error?.message || promotionsResult.error?.message || "Respuesta incompleta al comprobar el menú.";
            fail(`No se pudo cargar el menú: ${menuError}`);
            return;
          }
          setTarjeta((current) =>
            current
              ? {
                  ...current,
                  hasActiveMenu: productsResult.data.length > 0 || promotionsResult.data.length > 0,
                }
              : current,
          );
        } else if (requestTimeout !== undefined) {
          window.clearTimeout(requestTimeout);
        }
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
              <ProfileCard tarjeta={tarjeta} menuView={menuView} menuLoading={menuLoading} />
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
