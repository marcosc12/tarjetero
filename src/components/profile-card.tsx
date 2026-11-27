import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

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
  hasActiveMenu?: boolean;
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
  tipo: "whatsapp" | "instagram" | "maps" | "web" | "phone" | "reviews";
  titulo: string;
  subtitulo: string;
  url: string;
};

type CarouselItem =
  | { kind: "promotion"; item: MenuPromotion }
  | { kind: "product"; item: MenuProduct };

type MenuOrderItem = {
  key: string;
  name: string;
  imageUrl: string;
  price: string;
  quantity: number;
  note: string;
};

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
  if (kind === "reviews") return absoluteUrl || `https://${cleanValue}`;
  return absoluteUrl || `https://${cleanValue}`;
}

function ActionIcon({ kind }: { kind: TarjetaLink["tipo"] }) {
  const common = {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    className: "h-6 w-6 shrink-0",
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
  if (kind === "reviews") {
    return (
      <svg {...common}>
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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
        <span className="block truncate text-lg font-bold sm:text-xl">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-sm font-normal text-white/85 sm:text-base">
            {subtitle}
          </span>
        )}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="ml-auto h-5 w-5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
      >
        <path d="M4.5 10h11m0 0-4.5-4.5M15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
  const className =
    "card-action group flex min-h-[60px] items-center justify-center gap-3 rounded-2xl px-5 py-4 text-left text-sm font-semibold text-white shadow-[0_8px_18px_rgba(20,30,20,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(20,30,20,0.18)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3";

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
  menuLoading = false,
}: {
  tarjeta: Tarjeta;
  previewMode?: boolean;
  menuView?: boolean;
  menuLoading?: boolean;
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
  const products = useMemo(() => tarjeta.products ?? [], [tarjeta.products]);
  const promotions = useMemo(() => tarjeta.promotions ?? [], [tarjeta.promotions]);
  const [productPageState, setProductPageState] = useState({ slug: tarjeta.slug, page: 1 });
  const [categoryFilterState, setCategoryFilterState] = useState({ slug: tarjeta.slug, category: "all" });
  const [indicePromo, setIndicePromo] = useState(0);
  const [promoTimerReset, setPromoTimerReset] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<CarouselItem | null>(null);
  const [orderItems, setOrderItems] = useState<MenuOrderItem[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderReady, setOrderReady] = useState(false);
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const hasActiveMenu =
    tarjeta.hasActiveMenu ??
    (products.some((product) => product.active) || promotions.some((promotion) => promotion.active));
  const showMenuButton = tarjeta.mostrar_menu !== false && hasActiveMenu;
  const menuHref = `/?c=${encodeURIComponent(tarjeta.slug)}&view=menu`;
  const visibleProducts = useMemo(
    () => products.filter((product) => previewMode || product.active),
    [products, previewMode],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        visibleProducts.reduce((categories, product) => {
          const name = product.category.trim().replace(/\s+/g, " ");
          const key = normalizeCategory(name);
          if (key && !categories.has(key)) categories.set(key, name);
          return categories;
        }, new Map<string, string>()),
        ([key, name]) => ({ key, name }),
      ),
    [visibleProducts],
  );
  const requestedCategory =
    categoryFilterState.slug === tarjeta.slug ? categoryFilterState.category : "all";
  const selectedCategory =
    requestedCategory === "all" || categoryOptions.some(({ key }) => key === requestedCategory)
      ? requestedCategory
      : "all";
  const filteredProducts = useMemo(
    () =>
      selectedCategory === "all"
        ? visibleProducts
        : visibleProducts.filter((product) => normalizeCategory(product.category) === selectedCategory),
    [selectedCategory, visibleProducts],
  );
  const productPageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const currentProductPage = productPageState.slug === tarjeta.slug
    ? Math.min(productPageState.page, productPageCount)
    : 1;
  const paginatedProducts = useMemo(
    () =>
      filteredProducts.slice(
        (currentProductPage - 1) * PRODUCTS_PER_PAGE,
        currentProductPage * PRODUCTS_PER_PAGE,
      ),
    [currentProductPage, filteredProducts],
  );
  const groupedProducts = useMemo(
    () =>
      Array.from(
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
      ),
    [paginatedProducts],
  );
  const featuredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.active &&
          product.onPromotion &&
          product.promotionPrice.trim() !== "" &&
          Number.isFinite(Number(product.promotionPrice)) &&
          Number(product.promotionPrice) >= 0,
      ),
    [products],
  );
  const carouselItems: CarouselItem[] = useMemo(
    () => [
      ...promotions
        .filter((promotion) => previewMode || promotion.active)
        .map((promotion) => ({ kind: "promotion" as const, item: promotion })),
      ...featuredProducts.map((product) => ({ kind: "product" as const, item: product })),
    ],
    [featuredProducts, promotions, previewMode],
  );
  const totalPromos = carouselItems.length;
  const currentPromoIndex = indicePromo % Math.max(1, totalPromos);
  const currentPromo = carouselItems[currentPromoIndex];
  const orderItemsByKey = useMemo(
    () => new Map<string, MenuOrderItem>(orderItems.map((item): [string, MenuOrderItem] => [item.key, item])),
    [orderItems],
  );
  const { orderCount, hasEstimatedTotal, estimatedTotal } = useMemo(
    () => ({
      orderCount: orderItems.reduce((total, item) => total + item.quantity, 0),
      hasEstimatedTotal:
        orderItems.length > 0 &&
        orderItems.every((item) => item.price.trim() !== "" && Number.isFinite(Number(item.price))),
      estimatedTotal: orderItems.reduce(
        (total, item) => total + Number(item.price) * item.quantity,
        0,
      ),
    }),
    [orderItems],
  );

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

  useEffect(() => {
    if (!orderOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOrderOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [orderOpen]);

  function changeProductPage(nextPage: number) {
    setProductPageState({ slug: tarjeta.slug, page: nextPage });
    productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changePromo(direction: -1 | 1) {
    if (totalPromos < 2) return;
    setIndicePromo((index) => (index + direction + totalPromos) % totalPromos);
    setPromoTimerReset((key) => key + 1);
  }

  function addOrderItem(product: MenuProduct) {
    setOrderReady(false);
    setOrderItems((current) => {
      const selected = current.find((item) => item.key === product.key);
      if (selected) {
        return current.map((item) =>
          item.key === product.key ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...current,
        {
          key: product.key,
          name: product.name,
          imageUrl: product.imageUrl,
          price: product.price,
          quantity: 1,
          note: "",
        },
      ];
    });
  }

  function updateOrderQuantity(key: string, change: number) {
    setOrderReady(false);
    setOrderItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, item.quantity + change) } : item,
      ),
    );
  }

  function updateOrderNote(key: string, note: string) {
    setOrderReady(false);
    setOrderItems((current) =>
      current.map((item) => (item.key === key ? { ...item, note } : item)),
    );
  }

  function removeOrderItem(key: string) {
    setOrderReady(false);
    setOrderItems((current) => current.filter((item) => item.key !== key));
  }

  function renderProduct(product: MenuProduct) {
    const imageUrl = product.imageUrl ? safeHttpUrl(product.imageUrl) : "";
    const orderItem = orderItemsByKey.get(product.key);

    return (
      <article key={product.key} className="overflow-hidden rounded-2xl bg-black/[0.035]">
        <div className="relative aspect-video w-full bg-black/[0.06]">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, 24rem"
              loading="lazy"
              unoptimized
              className="object-cover"
            />
          )}
        </div>
        <div className="grid gap-1 p-4">
          <h3 className="break-words text-lg font-semibold leading-snug">{product.name}</h3>
          {product.description.trim() && <p className="text-base leading-6 opacity-75">{product.description}</p>}
          {product.price && <p className="text-lg font-bold text-neutral-900">${product.price}</p>}
          {orderItem ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">En tu pedido</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Restar una unidad de ${product.name}`}
                  onClick={() => updateOrderQuantity(product.key, -1)}
                  disabled={orderItem.quantity <= 1}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-current/20 text-lg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span aria-live="polite" className="min-w-5 text-center font-semibold">
                  {orderItem.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Agregar una unidad de ${product.name}`}
                  onClick={() => addOrderItem(product)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-lg font-semibold text-white"
                  style={{ backgroundColor: buttonColor }}
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addOrderItem(product)}
              className="mt-2 min-h-10 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: buttonColor }}
            >
              Agregar al pedido
            </button>
          )}
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
        <p className="profile-card-tagline mx-auto mt-2 max-w-xs text-base leading-7" style={{ color: textColor, opacity: 0.72 }}>
          {tarjeta.eslogan}
        </p>
      )}
      {menuView ? (
        <a
          href={`/?c=${encodeURIComponent(tarjeta.slug)}`}
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-lg font-semibold text-white shadow-[0_8px_18px_rgba(20,30,20,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(20,30,20,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3"
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
          className="card-action group mt-3 flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-left text-sm font-semibold text-white shadow-[0_8px_18px_rgba(20,30,20,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(20,30,20,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3"
          style={{ backgroundColor: buttonColor }}
        >
          <span className="min-w-0 flex-1 text-lg font-bold sm:text-xl">Ver Menú</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-6 w-6 opacity-70">
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
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>Promociones y ofertas</h2>
            <span className="text-sm font-medium opacity-70" aria-live="polite">
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
                  className="relative h-[240px] w-full cursor-pointer overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(20,30,20,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
                  <span className="absolute right-3 top-3 z-10 inline-flex -rotate-3 items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-extrabold text-white shadow-lg sm:right-4 sm:top-4">
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
                          <h3 className="line-clamp-1 min-w-0 flex-1 break-words text-lg font-bold sm:text-xl">
                            {currentPromo.item.title || "Promoción"}
                          </h3>
                        </div>
                        {currentPromo.item.description.trim() && (
                          <p className="mt-1 line-clamp-2 break-words text-base leading-6 text-white/90 sm:text-lg">
                            {currentPromo.item.description}
                          </p>
                        )}
                        {currentPromo.item.price.trim() && (
                          <p className="mt-1 inline-flex rounded-lg bg-red-600 px-3 py-1 text-xl font-extrabold leading-tight text-white shadow-lg sm:text-2xl">
                            ${currentPromo.item.price}
                          </p>
                        )}
                        {currentPromo.item.validity.trim() && (
                          <p className="mt-1 break-words text-base font-medium text-white/90">
                            📅 {currentPromo.item.validity}
                          </p>
                        )}
                        <span className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide backdrop-blur-sm">
                          Activa
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="line-clamp-1 min-w-0 flex-1 break-words text-lg font-bold sm:text-xl">
                            {currentPromo.item.name || "Producto"}
                          </h3>
                          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-base font-semibold backdrop-blur-sm">
                            🔥 {currentPromo.item.promotionLabel.trim() || "Oferta especial"}
                          </span>
                        </div>
                        {currentPromo.item.description.trim() && (
                          <p className="mt-1 line-clamp-2 break-words text-base leading-6 text-white/90 sm:text-lg">
                            {currentPromo.item.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                          <span className="text-base text-white/75 line-through">${currentPromo.item.price}</span>
                          <span className="rounded-lg bg-red-600 px-3 py-1 text-xl font-extrabold leading-tight text-white shadow-lg sm:text-2xl">${currentPromo.item.promotionPrice}</span>
                        </div>
                        <span className="mt-1 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide backdrop-blur-sm">
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
                  className="pointer-events-auto absolute left-2 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-black/35 text-xl font-semibold text-white shadow-md backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  aria-label="Siguiente promoción u oferta"
                  onClick={() => changePromo(1)}
                  className="pointer-events-auto absolute right-2 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-black/35 text-xl font-semibold text-white shadow-md backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
          <nav aria-label="Filtrar productos por categoría" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[{ key: "all", name: "Todos" }, ...categoryOptions].map(({ key, name }) => {
              const isSelected = selectedCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setCategoryFilterState({ slug: tarjeta.slug, category: key });
                    setProductPageState({ slug: tarjeta.slug, page: 1 });
                  }}
                  className={`min-w-0 rounded-xl border px-2 py-2.5 text-sm font-semibold leading-tight break-words transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    isSelected
                      ? "border-transparent text-white"
                      : "border-current/15 bg-white/70"
                  }`}
                  style={isSelected ? { backgroundColor: buttonColor, color: "#ffffff" } : undefined}
                >
                  {name}
                </button>
              );
            })}
          </nav>
          <h2 className="mb-3 text-lg font-semibold" style={{ color: textColor }}>Productos</h2>
          <div className="grid gap-3">
            {paginatedProducts.filter((product) => !product.category.trim()).map(renderProduct)}
            {groupedProducts.map(([key, group]) => (
              <section key={key} aria-label={group.name} className="mt-2 grid gap-3">
                <h3 className="border-b border-current/10 pb-2 text-lg font-semibold" style={{ color: textColor }}>
                  {group.name}
                </h3>
                {group.products.map(renderProduct)}
              </section>
            ))}
          </div>
          {filteredProducts.length > PRODUCTS_PER_PAGE && (
            <nav aria-label="Paginación de productos" className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => changeProductPage(currentProductPage - 1)}
                disabled={currentProductPage === 1}
                className="min-h-11 rounded-lg border border-current/15 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40"
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
                className="min-h-11 rounded-lg px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: buttonColor }}
              >
                Siguiente →
              </button>
            </nav>
          )}
        </div>
      )}
      {menuView && menuLoading && visibleProducts.length === 0 && (
        <p role="status" className="mt-7 text-left text-sm opacity-70">
          Cargando productos...
        </p>
      )}
      {menuView && <div aria-hidden="true" className="h-16" />}
    </section>
    {menuView && typeof document !== "undefined" && createPortal(
      <button
        type="button"
        onClick={() => setOrderOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 mx-auto min-h-12 max-w-[22rem] rounded-2xl px-5 py-3 text-base font-semibold text-white shadow-[0_8px_24px_rgba(20,30,20,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ backgroundColor: buttonColor }}
      >
        Ver pedido ({orderCount})
      </button>,
      document.body,
    )}
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
                <span className="text-base text-[#788078]">Sin imagen</span>
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
                  <p className="mt-2 inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-base font-semibold">
                    {lightboxItem.item.discount || "Descuento"}
                  </p>
                  {lightboxItem.item.price.trim() && (
                    <p className="mt-3 text-2xl font-bold" style={{ color: buttonColor }}>
                      ${lightboxItem.item.price}
                    </p>
                  )}
                  {lightboxItem.item.validity.trim() && (
                    <p className="mt-2 break-words text-base text-[#526254]">📅 {lightboxItem.item.validity}</p>
                  )}
                  {lightboxItem.item.description.trim() && (
                    <p className="mt-3 break-words text-base leading-7 text-[#526254]">
                      {lightboxItem.item.description}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-2 inline-flex rounded-full bg-black/[0.06] px-3 py-1 text-base font-semibold">
                    🔥 {lightboxItem.item.promotionLabel.trim() || "Oferta especial"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-baseline gap-2">
                    <span className="text-base text-[#788078] line-through">${lightboxItem.item.price}</span>
                    <span className="text-2xl font-bold" style={{ color: buttonColor }}>
                      ${lightboxItem.item.promotionPrice}
                    </span>
                  </div>
                  {lightboxItem.item.description.trim() && (
                    <p className="mt-3 break-words text-base leading-7 text-[#526254]">
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
    {orderOpen && typeof document !== "undefined" && createPortal(
      <div
        role="presentation"
        onClick={() => setOrderOpen(false)}
        className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-order-title"
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white text-left text-[#202b23] shadow-2xl sm:rounded-3xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[#e8ece6] px-5 py-4 sm:px-6">
            <div>
              <h2 id="menu-order-title" className="text-xl font-semibold">Mi pedido</h2>
              <p className="mt-0.5 text-sm text-[#788078]">{orderCount} producto{orderCount === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar pedido"
              autoFocus
              onClick={() => setOrderOpen(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[0.05] text-2xl leading-none hover:bg-black/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              ×
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            {orderReady ? (
              <>
                <p role="status" className="rounded-2xl bg-[#f4f6f3] px-4 py-3 text-center text-sm font-medium text-[#526254]">
                  Tu pedido está listo para confirmar con el mesero.
                </p>
                {orderItems.map((item) => {
                  const imageUrl = item.imageUrl ? safeHttpUrl(item.imageUrl) : "";
                  const unitPrice = Number(item.price);
                  const itemTotal =
                    item.price.trim() !== "" && Number.isFinite(unitPrice)
                      ? `$${(unitPrice * item.quantity).toFixed(2)}`
                      : item.price
                        ? `$${item.price}`
                        : "Precio no disponible";
                  return (
                    <article key={item.key} className="flex gap-3 rounded-2xl border border-[#e8ece6] p-3">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          width={64}
                          height={64}
                          unoptimized
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div aria-hidden="true" className="h-16 w-16 shrink-0 rounded-xl bg-[#f0f2ef]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold">{item.name}</h3>
                        <p className="mt-1 text-sm text-[#526254]">
                          {item.quantity} × {item.price ? `$${item.price}` : "Precio no disponible"}
                          <span className="px-1.5">·</span>
                          {itemTotal}
                        </p>
                        {item.note.trim() && (
                          <p className="mt-1 break-words text-xs text-[#788078]">Nota: {item.note}</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </>
            ) : orderItems.length === 0 ? (
              <p className="rounded-2xl bg-[#f4f6f3] px-4 py-6 text-center text-sm text-[#788078]">
                Aún no agregas productos a tu pedido.
              </p>
            ) : (
              orderItems.map((item) => {
                const imageUrl = item.imageUrl ? safeHttpUrl(item.imageUrl) : "";
                const unitPrice = Number(item.price);
                const hasNumericPrice = item.price.trim() !== "" && Number.isFinite(unitPrice);
                const itemTotal = hasNumericPrice
                  ? `$${(unitPrice * item.quantity).toFixed(2)}`
                  : item.price
                    ? `$${item.price}`
                    : "Precio no disponible";
                return (
                  <article key={item.key} className="flex gap-3 rounded-2xl border border-[#e8ece6] p-3">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt=""
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div aria-hidden="true" className="h-16 w-16 shrink-0 rounded-xl bg-[#f0f2ef]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold">{item.name}</h3>
                          <p className="mt-1 text-sm text-[#526254]">
                            {item.price ? `$${item.price} c/u` : "Precio no disponible"}
                            <span className="px-1.5">·</span>
                            {itemTotal}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(item.key)}
                          className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-[#a15a5f] hover:bg-[#fbf6f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          Quitar
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Restar una unidad de ${item.name}`}
                          onClick={() => updateOrderQuantity(item.key, -1)}
                          disabled={item.quantity <= 1}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#dfe5dd] text-lg disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          −
                        </button>
                        <span aria-live="polite" className="min-w-6 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Agregar una unidad de ${item.name}`}
                          onClick={() => updateOrderQuantity(item.key, 1)}
                          className="grid h-9 w-9 place-items-center rounded-lg text-lg font-semibold text-white"
                          style={{ backgroundColor: buttonColor }}
                        >
                          +
                        </button>
                      </div>
                      <label className="mt-3 grid gap-1.5 text-xs font-semibold text-[#526254]">
                        Nota rápida (opcional)
                        <textarea
                          value={item.note}
                          onChange={(event) => updateOrderNote(item.key, event.target.value)}
                          maxLength={100}
                          rows={2}
                          placeholder="Ej. sin cebolla"
                          className="w-full resize-y rounded-xl border border-[#dfe5dd] px-3 py-2 text-base font-normal text-[#202b23] outline-none placeholder:text-[#a0a9a0] focus:border-[#78927d] focus:ring-2 focus:ring-[#78927d]/15"
                        />
                      </label>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <footer className="grid gap-3 border-t border-[#e8ece6] p-4 sm:p-5">
            {orderItems.length > 0 && (
              <div className="flex items-center justify-between gap-3 text-base font-semibold">
                <span>Total estimado</span>
                <span>
                  {hasEstimatedTotal ? `$${estimatedTotal.toFixed(2)}` : "No disponible"}
                </span>
              </div>
            )}
            {orderReady ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOrderReady(false)}
                  className="min-h-11 rounded-xl border border-[#dfe5dd] px-4 py-2 text-sm font-semibold"
                >
                  Editar pedido
                </button>
                <button
                  type="button"
                  onClick={() => setOrderOpen(false)}
                  className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: buttonColor }}
                >
                  Seguir viendo el menú
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOrderOpen(false)}
                  className="min-h-11 rounded-xl border border-[#dfe5dd] px-4 py-2 text-sm font-semibold"
                >
                  Seguir viendo el menú
                </button>
                <button
                  type="button"
                  onClick={() => setOrderReady(true)}
                  disabled={orderItems.length === 0}
                  className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: buttonColor }}
                >
                  Listo para confirmar con el mesero
                </button>
              </div>
            )}
          </footer>
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
