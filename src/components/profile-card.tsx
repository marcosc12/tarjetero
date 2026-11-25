import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const PRODUCTS_PER_PAGE = 5;

function normalizeCategory(category: string) {
  return category.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export type Tarjeta = {
  slug: string;
  nombre: string | null;
  eslogan: string | null;
  inicial: string | null;
  avatar_url?: string | null;
  color_fondo?: string | null;
  color_tarjeta?: string | null;
  color_boton?: string | null;
  color_texto?: string | null;
  mostrar_menu?: boolean | null;
  links?: TarjetaLink[] | null;
  products?: MenuProduct[] | null;
  promotions?: MenuPromotion[] | null;
  whatsapp: string | null;
  whatsapp_sub: string | null;
  instagram: string | null;
  instagram_sub: string | null;
  ubicacion_url: string | null;
  ubicacion_sub: string | null;
  activo: boolean;
};

export type MenuProduct = {
  id?: string;
  key: string;
  imageUrl: string;
  name: string;
  price: string;
  description: string;
  category: string;
  active: boolean;
  order: number;
  onPromotion: boolean;
  promotionPrice: string;
  promotionLabel: string;
};

export type MenuPromotion = {
  id?: string;
  key: string;
  title: string;
  discount: string;
  description: string;
  previousPrice: string;
  price: string;
  imageUrl: string;
  validity: string;
  active: boolean;
};

export type TarjetaLink = {
  id: string;
  tipo: "whatsapp" | "instagram" | "maps" | "web" | "phone";
  titulo: string;
  subtitulo: string;
  url: string;
};

type CarouselItem =
  | { kind: "promotion"; item: MenuPromotion }
  | { kind: "product"; item: MenuProduct };

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatDiscount(value: string) {
  const discount = value.trim();
  return /^\d+(?:[.,]\d+)?$/.test(discount) ? `${discount}% OFF` : discount || "Descuento";
}

function actionUrl(value: string | null, kind: TarjetaLink["tipo"]) {
  const cleanValue = value?.trim() ?? "";
  if (!cleanValue) return "";
  const absoluteUrl = safeHttpUrl(cleanValue);

  if (kind === "whatsapp") {
    if (absoluteUrl) return absoluteUrl;
    const number = cleanValue.replace(/\D/g, "");
    return number ? `https://wa.me/${number}` : "";
  }
  if (kind === "instagram") {
    return absoluteUrl || `https://www.instagram.com/${cleanValue.replace(/^@/, "")}`;
  }
  if (kind === "maps") {
    return absoluteUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanValue)}`;
  }
  if (kind === "phone") {
    const phone = cleanValue.replace(/[^\d+]/g, "");
    return phone ? `tel:${phone}` : "";
  }
  return absoluteUrl || `https://${cleanValue}`;
}

function ActionIcon({ kind }: { kind: TarjetaLink["tipo"] }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-5 w-5 shrink-0",
  };

  if (kind === "whatsapp") {
    return (
      <svg {...common}>
        <path d="M20 11.6a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4.1A8 8 0 1 1 20 11.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 8.5c.3-.5.6-.5.9-.5.2 0 .4 0 .6.5l.7 1.4c.1.3.1.5-.1.7l-.5.6c.6 1.1 1.5 2 2.7 2.6l.6-.6c.2-.2.4-.2.7-.1l1.4.7c.5.2.5.4.5.6 0 .3 0 .6-.5.9-.5.4-1.4.7-2.5.4-1.2-.3-2.7-1.2-4-2.6-1.4-1.4-2.2-2.9-2.4-4.1-.2-1 .1-1.8.5-2.5Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "instagram") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17.6" cy="6.6" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "web" || kind === "phone") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.8 12h16.4M12 3.5a13 13 0 0 1 0 17M12 3.5a13 13 0 0 0 0 17" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M19 10.2c0 5-7 10.3-7 10.3S5 15.2 5 10.2a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CardAction({
  kind,
  title,
  subtitle,
  value,
  buttonColor,
}: {
  kind: TarjetaLink["tipo"];
  title: string;
  subtitle: string | null;
  value: string | null;
  buttonColor: string;
}) {
  const href = actionUrl(value, kind);
  const style: CSSProperties = { backgroundColor: buttonColor };
  const content: ReactNode = (
    <>
      <ActionIcon kind={kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs font-normal text-white/75">
            {subtitle}
          </span>
        )}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="ml-auto h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
      >
        <path d="M4.5 10h11m0 0-4.5-4.5M15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
  const className =
    "card-action group flex min-h-14 items-center justify-center gap-3 rounded-2xl px-5 text-left text-sm font-semibold text-white shadow-[0_8px_18px_rgba(20,30,20,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(20,30,20,0.18)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3";

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
    >
      {content}
    </a>
  ) : (
    <div className={`${className} cursor-not-allowed opacity-60`} style={style} aria-disabled="true">
      {content}
    </div>
  );
}

export function ProfileCard({
  tarjeta,
  previewMode = false,
  menuView = false,
}: {
  tarjeta: Tarjeta;
  previewMode?: boolean;
  menuView?: boolean;
}) {
  const buttonColor = tarjeta.color_boton || "#202a24";
  const textColor = tarjeta.color_texto || "#202b23";
  const initial = (tarjeta.inicial?.trim() || tarjeta.nombre?.trim().charAt(0) || "N")
    .charAt(0)
    .toLocaleUpperCase("es");
  const avatarUrl = tarjeta.avatar_url ? safeHttpUrl(tarjeta.avatar_url) : "";
  const legacyLinks: TarjetaLink[] = [
    { id: "whatsapp", tipo: "whatsapp", titulo: "WhatsApp", subtitulo: tarjeta.whatsapp_sub || "", url: tarjeta.whatsapp || "" },
    { id: "instagram", tipo: "instagram", titulo: "Instagram", subtitulo: tarjeta.instagram_sub || "", url: tarjeta.instagram || "" },
    { id: "ubicacion", tipo: "maps", titulo: "Cómo llegar", subtitulo: tarjeta.ubicacion_sub || "", url: tarjeta.ubicacion_url || "" },
  ];
  const links = tarjeta.links ?? legacyLinks;
  const products = tarjeta.products ?? [];
  const promotions = tarjeta.promotions ?? [];
  const [productPageState, setProductPageState] = useState({ slug: tarjeta.slug, page: 1 });
  const [indicePromo, setIndicePromo] = useState(0);
  const [promoTimerReset, setPromoTimerReset] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<CarouselItem | null>(null);
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const hasActiveMenu = products.some((product) => product.active) || promotions.some((promotion) => promotion.active);
  const showMenuButton = tarjeta.mostrar_menu !== false && hasActiveMenu;
  const menuHref = `/?c=${encodeURIComponent(tarjeta.slug)}&view=menu`;
  const visibleProducts = products.filter((product) => previewMode || product.active);
  const productPageCount = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE));
  const currentProductPage = productPageState.slug === tarjeta.slug
    ? Math.min(productPageState.page, productPageCount)
    : 1;
  const paginatedProducts = visibleProducts.slice(
    (currentProductPage - 1) * PRODUCTS_PER_PAGE,
    currentProductPage * PRODUCTS_PER_PAGE,
  );
  const groupedProducts = Array.from(
    paginatedProducts.reduce((groups, product) => {
      const category = product.category.trim().replace(/\s+/g, " ");
      const key = normalizeCategory(category);
      if (key) {
        const group = groups.get(key);
        if (group) group.products.push(product);
        else groups.set(key, { name: category, products: [product] });
      }
      return groups;
    }, new Map<string, { name: string; products: MenuProduct[] }>()),
  );
  const featuredProducts = products.filter(
    (product) =>
      product.active &&
      product.onPromotion &&
      product.promotionPrice.trim() !== "" &&
      Number.isFinite(Number(product.promotionPrice)) &&
      Number(product.promotionPrice) >= 0,
  );
  const carouselPromotions = promotions.filter((promotion) => previewMode || promotion.active);
  const carouselItems: CarouselItem[] = [
    ...carouselPromotions.map((promotion) => ({ kind: "promotion" as const, item: promotion })),
    ...featuredProducts.map((product) => ({ kind: "product" as const, item: product })),
  ];
  const totalPromos = carouselItems.length;
  const currentPromoIndex = indicePromo % Math.max(1, totalPromos);
  const currentPromo = carouselItems[currentPromoIndex];

  useEffect(() => {
    if (totalPromos < 2) return;
    const timer = window.setInterval(() => {
      setIndicePromo((index) => (index + 1) % totalPromos);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [indicePromo, promoTimerReset, totalPromos]);

  useEffect(() => {
    if (!lightboxItem) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxItem(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxItem]);

  function changeProductPage(nextPage: number) {
    setProductPageState({ slug: tarjeta.slug, page: nextPage });
    productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changePromo(direction: -1 | 1) {
    if (totalPromos < 2) return;
    setIndicePromo((index) => (index + direction + totalPromos) % totalPromos);
    setPromoTimerReset((key) => key + 1);
  }

  function renderProduct(product: MenuProduct) {
    return (
      <article key={product.key} className="flex items-center gap-3 rounded-2xl bg-black/[0.035] p-3">
        {product.imageUrl && safeHttpUrl(product.imageUrl) ? (
          <Image src={safeHttpUrl(product.imageUrl)} alt={product.name || "Producto"} width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-black/[0.06] text-xs opacity-60">Imagen</div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{product.name || "Producto"}</h3>
          {product.description.trim() && <p className="mt-1 text-xs leading-5 opacity-75">{product.description}</p>}
          {product.price && <p className="mt-1 text-sm font-bold text-neutral-900">${product.price}</p>}
        </div>
      </article>
    );
  }

  return (
    <>
    <section
        className="public-profile-card w-full overflow-hidden rounded-[2rem] border border-white/75 p-7 text-center shadow-[0_24px_80px_rgba(31,41,33,0.12)] backdrop-blur-sm sm:p-9"
        style={{
          backgroundColor: tarjeta.color_tarjeta || "#ffffff",
          color: textColor,
        }}
      >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`Avatar de ${tarjeta.nombre || "negocio"}`}
          width={96}
          height={96}
          unoptimized
          className="profile-avatar mx-auto object-cover"
        />
      ) : (
        <div
          aria-label={`Inicial de ${tarjeta.nombre || "negocio"}`}
          className="profile-avatar mx-auto grid place-items-center text-3xl font-semibold text-white"
          style={{ backgroundColor: buttonColor }}
        >
          {initial}
        </div>
      )}
      <h1 className="profile-card-title mt-5 text-[1.7rem] font-semibold tracking-[-0.055em]" style={{ color: textColor }}>
        {tarjeta.nombre || "Nombre del negocio"}
      </h1>
      {tarjeta.eslogan && (
        <p className="profile-card-tagline mx-auto mt-2 max-w-xs text-sm leading-6" style={{ color: textColor, opacity: 0.72 }}>
          {tarjeta.eslogan}
        </p>
      )}
      {menuView ? (
        <a
          href={`/?c=${encodeURIComponent(tarjeta.slug)}`}
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(20,30,20,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(20,30,20,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3"
          style={{ backgroundColor: buttonColor }}
        >
          ← Volver
        </a>
      ) : tarjeta.activo === true ? (
        <div className="mt-7 space-y-3">
          {links.filter((link) => link.url.trim()).map((link) => (
            <CardAction
              key={link.id}
              kind={link.tipo}
              title={link.titulo || "Enlace"}
              subtitle={link.subtitulo || null}
              value={link.url}
              buttonColor={buttonColor}
            />
          ))}
          {links.every((link) => !link.url.trim()) && (
            <p className="rounded-2xl bg-[#f5f6f4] px-5 py-4 text-sm text-[#737d74]">
              Esta tarjeta aún no tiene enlaces disponibles.
            </p>
          )}
        </div>
      ) : (
        <div className="card-suspended mt-7 rounded-2xl border border-[#f0e5e8] bg-[#fbf6f7] px-5 py-4 text-sm leading-6 text-[#806b70]">
          Servicio temporalmente suspendido. Contacta al administrador para reactivarlo.
        </div>
      )}
      {!menuView && showMenuButton && (
        <a
          href={menuHref}
          className="card-action group mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-5 text-left text-sm font-semibold text-white shadow-[0_8px_18px_rgba(20,30,20,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(20,30,20,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3"
          style={{ backgroundColor: buttonColor }}
        >
          <span className="min-w-0 flex-1">Ver Menú</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 opacity-70">
            <path d="M4.5 10h11m0 0-4.5-4.5M15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
      {menuView && carouselItems.length > 0 && (
        <section
          aria-label="Promociones y productos en descuento"
          className="mt-8 text-left"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold" style={{ color: textColor }}>Promociones y ofertas</h2>
            <span className="text-xs font-medium opacity-70" aria-live="polite">
              {currentPromoIndex + 1} / {totalPromos}
            </span>
          </div>
          <div className="relative min-w-0">
            {currentPromo && (
              <div className="relative w-full">
                <article
                  key={`${currentPromo.kind}-${currentPromo.item.key}`}
                  aria-live="polite"
                  role="button"
                  tabIndex={0}
                  onClick={() => setLightboxItem(currentPromo)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setLightboxItem(currentPromo);
                    }
                  }}
                  className="relative h-[210px] w-full cursor-pointer overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(20,30,20,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: currentPromo.item.imageUrl && safeHttpUrl(currentPromo.item.imageUrl) ? "#202a24" : buttonColor }}
                >
                {currentPromo.item.imageUrl && safeHttpUrl(currentPromo.item.imageUrl) && (
                  <Image
                    src={safeHttpUrl(currentPromo.item.imageUrl)}
                    alt={currentPromo.kind === "promotion"
                      ? currentPromo.item.title || "Imagen de promoción"
                      : currentPromo.item.name || "Producto en promoción"}
                    width={1280}
                    height={720}
                    unoptimized
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
                {currentPromo.kind === "promotion" && (
                  <span className="absolute right-3 top-3 z-10 inline-flex -rotate-3 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-lg sm:right-4 sm:top-4 sm:text-sm">
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M3.3 2.5h8.1l6.1 6.1a1.8 1.8 0 0 1 0 2.5l-4.4 4.4a1.8 1.8 0 0 1-2.5 0L4.5 9.4V2.5h-1.2Zm3.2 3a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z" />
                    </svg>
                    {formatDiscount(currentPromo.item.discount)}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 z-10 overflow-hidden px-12 pb-3 pt-10 text-left text-white sm:px-16 sm:pb-4 sm:pt-12">
                  <div className="min-w-0 break-words">
                    {currentPromo.kind === "promotion" ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="line-clamp-1 min-w-0 flex-1 break-words text-sm font-bold sm:text-lg">
                            {currentPromo.item.title || "Promoción"}
                          </h3>
                        </div>
                        {currentPromo.item.description.trim() && (
                          <p className="mt-1 line-clamp-2 break-words text-[11px] leading-4 text-white/90 sm:text-xs">
                            {currentPromo.item.description}
                          </p>
                        )}
                        {currentPromo.item.price.trim() && (
                          <p className="mt-1 inline-flex rounded-lg bg-red-600 px-3 py-1 text-xl font-extrabold leading-tight text-white shadow-lg sm:text-2xl">
                            ${currentPromo.item.price}
                          </p>
                        )}
                        {currentPromo.item.validity.trim() && (
                          <p className="mt-1 break-words text-[10px] font-medium text-white/90 sm:text-xs">
                            📅 {currentPromo.item.validity}
                          </p>
                        )}
                        <span className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur-sm">
                          Activa
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="line-clamp-1 min-w-0 flex-1 break-words text-sm font-bold sm:text-lg">
                            {currentPromo.item.name || "Producto"}
                          </h3>
                          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                            🔥 {currentPromo.item.promotionLabel.trim() || "Oferta especial"}
                          </span>
                        </div>
                        {currentPromo.item.description.trim() && (
                          <p className="mt-1 line-clamp-2 break-words text-[11px] leading-4 text-white/90 sm:text-xs">
                            {currentPromo.item.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                          <span className="text-xs text-white/75 line-through">${currentPromo.item.price}</span>
                          <span className="rounded-lg bg-red-600 px-3 py-1 text-xl font-extrabold leading-tight text-white shadow-lg sm:text-2xl">${currentPromo.item.promotionPrice}</span>
                        </div>
                        <span className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide backdrop-blur-sm">
                          Activa
                        </span>
                      </>
                    )}
                  </div>
                </div>
                </article>
                <button
                  type="button"
                  aria-label="Promoción u oferta anterior"
                  onClick={() => changePromo(-1)}
                  className="pointer-events-auto absolute left-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-black/35 text-xl font-semibold text-white shadow-md backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  aria-label="Siguiente promoción u oferta"
                  onClick={() => changePromo(1)}
                  className="pointer-events-auto absolute right-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-black/35 text-xl font-semibold text-white shadow-md backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
          <nav aria-label="Indicadores de promociones y ofertas" className="mt-4 flex justify-center gap-2">
              {carouselItems.map((entry, index) => (
                <button
                  key={`${entry.kind}-${entry.item.key}`}
                  type="button"
                  aria-label={`Mostrar ${entry.kind === "promotion" ? entry.item.title || "promoción" : entry.item.name || "producto en oferta"} (${index + 1} de ${totalPromos})`}
                  aria-current={index === currentPromoIndex ? "true" : undefined}
                  onClick={() => {
                    setIndicePromo(index);
                    setPromoTimerReset((key) => key + 1);
                  }}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${index === currentPromoIndex ? "w-6" : "w-2.5 opacity-45 hover:opacity-75"}`}
                  style={{ backgroundColor: buttonColor }}
                />
              ))}
          </nav>
        </section>
      )}
      {menuView && visibleProducts.length > 0 && (
        <div ref={productsSectionRef} className="mt-7 scroll-mt-5 text-left">
          <h2 className="mb-3 text-base font-semibold" style={{ color: textColor }}>Productos</h2>
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto overscroll-contain pr-1">
            {paginatedProducts.filter((product) => !product.category.trim()).map(renderProduct)}
            {groupedProducts.map(([key, group]) => (
              <section key={key} aria-label={group.name} className="mt-2 grid gap-3">
                <h3 className="border-b border-current/10 pb-2 text-sm font-semibold" style={{ color: textColor }}>
                  {group.name}
                </h3>
                {group.products.map(renderProduct)}
              </section>
            ))}
          </div>
          {visibleProducts.length > PRODUCTS_PER_PAGE && (
            <nav aria-label="Paginación de productos" className="mt-4 flex items-center justify-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => changeProductPage(currentProductPage - 1)}
                disabled={currentProductPage === 1}
                className="min-h-9 rounded-lg border border-current/15 px-3 font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span aria-live="polite" className="px-1 font-medium">
                Página {currentProductPage} de {productPageCount}
              </span>
              <button
                type="button"
                onClick={() => changeProductPage(currentProductPage + 1)}
                disabled={currentProductPage === productPageCount}
                className="min-h-9 rounded-lg px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: buttonColor }}
              >
                Siguiente →
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
    {lightboxItem && typeof document !== "undefined" && createPortal(
      <div
        role="presentation"
        onClick={() => setLightboxItem(null)}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="promotion-lightbox-title"
          onClick={(event) => event.stopPropagation()}
          className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 text-left text-[#202b23] shadow-2xl sm:p-7"
        >
          <button
            type="button"
            aria-label="Cerrar vista ampliada"
            autoFocus
            onClick={() => setLightboxItem(null)}
            className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/5 text-2xl leading-none hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            ×
          </button>
          <div className="grid gap-5 pt-8 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:items-start sm:pt-2">
            <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-2xl bg-[#f4f5f2] sm:min-h-72">
              {lightboxItem.kind === "promotion" && safeHttpUrl(lightboxItem.item.imageUrl) ? (
                <Image
                  src={safeHttpUrl(lightboxItem.item.imageUrl)}
                  alt={lightboxItem.item.title || "Imagen de promoción"}
                  width={800}
                  height={600}
                  unoptimized
                  className="max-h-[55vh] w-full object-contain"
                />
              ) : lightboxItem.kind === "product" && safeHttpUrl(lightboxItem.item.imageUrl) ? (
                <Image
                  src={safeHttpUrl(lightboxItem.item.imageUrl)}
                  alt={lightboxItem.item.name || "Producto en promoción"}
                  width={800}
                  height={600}
                  unoptimized
                  className="max-h-[55vh] w-full object-contain"
                />
              ) : (
                <span className="text-sm text-[#788078]">Sin imagen</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 id="promotion-lightbox-title" className="break-words pr-8 text-xl font-bold">
                {lightboxItem.kind === "promotion"
                  ? lightboxItem.item.title || "Promoción"
                  : lightboxItem.item.name || "Producto"}
              </h2>
              {lightboxItem.kind === "promotion" ? (
                <>
                  <p className="mt-2 inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-sm font-semibold">
                    {lightboxItem.item.discount || "Descuento"}
                  </p>
                  {lightboxItem.item.price.trim() && (
                    <p className="mt-3 text-2xl font-bold" style={{ color: buttonColor }}>
                      ${lightboxItem.item.price}
                    </p>
                  )}
                  {lightboxItem.item.validity.trim() && (
                    <p className="mt-2 break-words text-sm text-[#526254]">📅 {lightboxItem.item.validity}</p>
                  )}
                  {lightboxItem.item.description.trim() && (
                    <p className="mt-3 break-words text-sm leading-6 text-[#526254]">
                      {lightboxItem.item.description}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-sm font-semibold">
                    🔥 {lightboxItem.item.promotionLabel.trim() || "Oferta especial"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-2">
                    <span className="text-sm text-[#788078] line-through">${lightboxItem.item.price}</span>
                    <span className="text-2xl font-bold" style={{ color: buttonColor }}>
                      ${lightboxItem.item.promotionPrice}
                    </span>
                  </div>
                  {lightboxItem.item.description.trim() && (
                    <p className="mt-3 break-words text-sm leading-6 text-[#526254]">
                      {lightboxItem.item.description}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>,
      document.body,
    )}
    </>
  );
}

export function ProfileFooter() {
  return (
    <footer className="profile-card-footer pt-6 text-center">
      <span className="text-xs font-medium tracking-wide text-[#758075]">
        Tarjeta Digital <span className="px-1 text-[#a0a9a0]">•</span>
        <span className="text-[#758075]">Tu QR, listo</span>
      </span>
    </footer>
  );
}
