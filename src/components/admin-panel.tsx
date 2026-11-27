"use client";

import Image from "next/image";
import Script from "next/script";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ProfileCard,
  type MenuProduct,
  type MenuPromotion,
  type Tarjeta,
  type TarjetaLink,
} from "@/components/profile-card";
import {
  SUPABASE_KEY,
  SUPABASE_URL,
  type AdminSession,
  type MenuProductRecord,
  type MenuPromotionRecord,
  type SupabaseBrowserClient,
} from "@/lib/supabase-browser";

type LinkType = TarjetaLink["tipo"];
type AdminView = "list" | "editor";
type AdminSection = "cards" | "menu";
type MenuItemSelection = { type: "product" | "promotion"; key: string };
type MenuItemSnapshot =
  | { type: "product"; item: MenuProduct; isNew: boolean }
  | { type: "promotion"; item: MenuPromotion; isNew: boolean };
const PRODUCTS_PER_PAGE = 5;
const BASE_MENU_CATEGORIES = ["Desayunos", "Plato fuerte", "Cena", "Bebidas", "Postres"];
type FormValues = {
  slug: string;
  nombre: string;
  eslogan: string;
  inicial: string;
  avatar_url: string;
  color_fondo: string;
  color_tarjeta: string;
  color_boton: string;
  color_texto: string;
  mostrar_menu: boolean;
  links: TarjetaLink[];
  products: MenuProduct[];
  promotions: MenuPromotion[];
};

const defaultLinks: TarjetaLink[] = [
  { id: "whatsapp", tipo: "whatsapp", titulo: "WhatsApp", subtitulo: "Escríbenos", url: "" },
  { id: "instagram", tipo: "instagram", titulo: "Instagram", subtitulo: "Síguenos", url: "" },
  { id: "maps", tipo: "maps", titulo: "Cómo llegar", subtitulo: "Visítanos", url: "" },
];

const emptyForm = (): FormValues => ({
  slug: "",
  nombre: "",
  eslogan: "",
  inicial: "",
  avatar_url: "",
  color_fondo: "#f7f8f6",
  color_tarjeta: "#ffffff",
  color_boton: "#202a24",
  color_texto: "#202b23",
  mostrar_menu: true,
  links: defaultLinks.map((link) => ({ ...link })),
  products: [],
  promotions: [],
});

const inputClass =
  "min-h-11 w-full rounded-xl border border-[#dfe5dd] bg-white px-3 text-sm font-normal text-[#202b23] outline-none placeholder:text-[#a0a9a0] focus:border-[#78927d] focus:ring-2 focus:ring-[#78927d]/15 disabled:bg-[#f4f6f3]";
const labelClass = "grid gap-1.5 text-xs font-semibold text-[#526254]";
const panelClass =
  "rounded-[1.4rem] border border-[#e8ece6] bg-white p-5 shadow-[0_12px_40px_rgba(31,41,33,0.05)] sm:p-6";

function cardLinks(card: Tarjeta): TarjetaLink[] {
  if (Array.isArray(card.links)) {
    return card.links
      .filter(
        (link): link is TarjetaLink =>
          Boolean(link) &&
          typeof link.id === "string" &&
          typeof link.url === "string" &&
          ["whatsapp", "instagram", "maps", "web", "phone", "reviews"].includes(link.tipo),
      )
      .map((link) => ({ ...link }));
  }

  const legacy: TarjetaLink[] = [
    { id: "whatsapp", tipo: "whatsapp", titulo: "WhatsApp", subtitulo: card.whatsapp_sub || "", url: card.whatsapp || "" },
    { id: "instagram", tipo: "instagram", titulo: "Instagram", subtitulo: card.instagram_sub || "", url: card.instagram || "" },
    { id: "maps", tipo: "maps", titulo: "Cómo llegar", subtitulo: card.ubicacion_sub || "", url: card.ubicacion_url || "" },
  ];
  return legacy.some((link) => link.url) ? legacy : defaultLinks.map((link) => ({ ...link }));
}

function newLink(): TarjetaLink {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    tipo: "web",
    titulo: "Nuevo enlace",
    subtitulo: "",
    url: "",
  };
}

function newItemId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function newProduct(): MenuProduct {
  return {
    key: newItemId(),
    imageUrl: "",
    name: "",
    price: "",
    description: "",
    category: "",
    active: true,
    order: 0,
    onPromotion: false,
    promotionPrice: "",
    promotionLabel: "",
  };
}

function newPromotion(): MenuPromotion {
  return {
    key: newItemId(),
    title: "",
    discount: "",
    description: "",
    previousPrice: "",
    price: "",
    imageUrl: "",
    validity: "",
    active: true,
  };
}

function productFromRecord(record: MenuProductRecord): MenuProduct {
  return {
    id: String(record.id),
    key: String(record.id),
    imageUrl: record.imagen_url ?? "",
    name: record.producto ?? "",
    price: String(record.precio ?? ""),
    description: record.descripcion ?? "",
    category: record.categoria ?? "",
    active: record.activo,
    order: record.orden,
    onPromotion: record.en_promocion === true,
    promotionPrice: record.precio_promocion == null ? "" : String(record.precio_promocion),
    promotionLabel: record.etiqueta_promocion ?? "",
  };
}

function promotionFromRecord(record: MenuPromotionRecord): MenuPromotion {
  return {
    id: String(record.id),
    key: String(record.id),
    title: record.titulo ?? "",
    discount: String(record.descuento ?? ""),
    description: record.descripcion ?? "",
    previousPrice: record.precio_anterior == null ? "" : String(record.precio_anterior),
    price: record.precio == null ? "" : String(record.precio),
    imageUrl: record.imagen_url ?? "",
    validity: record.vigencia ?? "",
    active: record.activo,
  };
}

function normalizeCategory(category: string) {
  return category.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function isPersistentImageUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.pathname.includes("/storage/v1/object/sign/") &&
      !url.searchParams.has("token")
    );
  } catch {
    return false;
  }
}

export function AdminPanel() {
  const [client, setClient] = useState<SupabaseBrowserClient | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [view, setView] = useState<AdminView>("list");
  const [section, setSection] = useState<AdminSection>("cards");
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [cards, setCards] = useState<Tarjeta[]>([]);
  const [editing, setEditing] = useState<Tarjeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [listMessage, setListMessage] = useState("");
  const [savedLink, setSavedLink] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [qrStatus, setQrStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [qrError, setQrError] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [originalProductIds, setOriginalProductIds] = useState<string[]>([]);
  const [originalPromotionIds, setOriginalPromotionIds] = useState<string[]>([]);
  const [menuLoadedSlug, setMenuLoadedSlug] = useState("");
  const [uploadingMenuImageKey, setUploadingMenuImageKey] = useState<string | null>(null);
  const [menuProductPage, setMenuProductPage] = useState(1);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItemSelection | null>(null);
  const [menuItemSnapshot, setMenuItemSnapshot] = useState<MenuItemSnapshot | null>(null);
  const qrCanvas = useRef<HTMLCanvasElement>(null);
  const menuProductsSection = useRef<HTMLFieldSetElement>(null);
  const menuItemEditorRef = useRef<HTMLDivElement>(null);
  const menuLoadRequest = useRef(0);

  const previewCard = useMemo<Tarjeta>(
    () => ({
      ...form,
      slug: form.slug || "vista-previa",
      activo: true,
      whatsapp: null,
      whatsapp_sub: null,
      instagram: null,
      instagram_sub: null,
      ubicacion_url: null,
      ubicacion_sub: null,
    }),
    [form],
  );
  const menuProductPageCount = Math.max(1, Math.ceil(form.products.length / PRODUCTS_PER_PAGE));
  const currentMenuProductPage = Math.min(menuProductPage, menuProductPageCount);
  const visibleMenuProducts = form.products.slice(
    (currentMenuProductPage - 1) * PRODUCTS_PER_PAGE,
    currentMenuProductPage * PRODUCTS_PER_PAGE,
  );
  const menuProductCategories = useMemo(() => {
    const categories = new Map(
      BASE_MENU_CATEGORIES.map((category) => [normalizeCategory(category), category]),
    );
    form.products.forEach((product) => {
      const category = product.category.trim().replace(/\s+/g, " ");
      const normalized = normalizeCategory(category);
      if (normalized && !categories.has(normalized)) categories.set(normalized, category);
    });
    return Array.from(categories.values());
  }, [form.products]);
  const editingProduct = editingMenuItem?.type === "product"
    ? form.products.find((product) => product.key === editingMenuItem.key) ?? null
    : null;
  const editingPromotion = editingMenuItem?.type === "promotion"
    ? form.promotions.find((promotion) => promotion.key === editingMenuItem.key) ?? null
    : null;

  useEffect(() => {
    if (!editingMenuItem) return;
    menuItemEditorRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [editingMenuItem]);

  function changeMenuProductPage(nextPage: number) {
    setMenuProductPage(nextPage);
    menuProductsSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addMenuProduct() {
    const product = newProduct();
    setForm((current) => ({ ...current, products: [...current.products, product] }));
    setMenuProductPage(Math.floor(form.products.length / PRODUCTS_PER_PAGE) + 1);
    setMenuItemSnapshot({ type: "product", item: product, isNew: true });
    setEditingMenuItem({ type: "product", key: product.key });
  }

  function addMenuPromotion() {
    const promotion = newPromotion();
    setForm((current) => ({ ...current, promotions: [...current.promotions, promotion] }));
    setMenuItemSnapshot({ type: "promotion", item: promotion, isNew: true });
    setEditingMenuItem({ type: "promotion", key: promotion.key });
  }

  function editMenuProduct(product: MenuProduct) {
    setMenuItemSnapshot({ type: "product", item: { ...product }, isNew: false });
    setEditingMenuItem({ type: "product", key: product.key });
  }

  function editMenuPromotion(promotion: MenuPromotion) {
    setMenuItemSnapshot({ type: "promotion", item: { ...promotion }, isNew: false });
    setEditingMenuItem({ type: "promotion", key: promotion.key });
  }

  function cancelMenuItemEdit() {
    if (
      editingMenuItem &&
      menuItemSnapshot?.type === editingMenuItem.type &&
      menuItemSnapshot.item.key === editingMenuItem.key
    ) {
      if (menuItemSnapshot.isNew) {
        if (menuItemSnapshot.type === "product") {
          setForm((current) => ({
            ...current,
            products: current.products.filter((item) => item.key !== editingMenuItem.key),
          }));
        } else {
          setForm((current) => ({
            ...current,
            promotions: current.promotions.filter((item) => item.key !== editingMenuItem.key),
          }));
        }
      } else if (menuItemSnapshot.type === "product") {
        setForm((current) => ({
          ...current,
          products: current.products.map((item) =>
            item.key === editingMenuItem.key ? menuItemSnapshot.item : item,
          ),
        }));
      } else {
        setForm((current) => ({
          ...current,
          promotions: current.promotions.map((item) =>
            item.key === editingMenuItem.key ? menuItemSnapshot.item : item,
          ),
        }));
      }
    }
    setEditingMenuItem(null);
    setMenuItemSnapshot(null);
  }

  const loadCards = useCallback(async (supabase: SupabaseBrowserClient) => {
    setListMessage("Cargando tarjetas...");
    const { data, error } = await supabase
      .from("tarjetas")
      .select("*")
      .order("slug", { ascending: true });
    if (error) {
      setListMessage(`No se pudieron cargar las tarjetas: ${error.message}`);
      return;
    }
    setCards(data);
    setListMessage(data.length ? "" : "Todavía no hay tarjetas registradas.");
  }, []);

  const updateSession = useCallback(
    async (nextSession: AdminSession) => {
      if (!nextSession) {
        setAuthorized(false);
        setCards([]);
        setView("list");
        setSection("cards");
        return;
      }
      setLoginMessage("");
      setAuthorized(true);
      if (client) await loadCards(client);
    },
    [client, loadCards],
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (active) void updateSession(nextSession);
      }, 0);
    });

    client.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (error) throw error;
        if (active) return updateSession(sessionData.session);
        return undefined;
      })
      .catch((error: Error) => {
        if (active) setLoginMessage(`No se pudo comprobar la sesión: ${error.message}`);
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, updateSession]);

  useEffect(() => {
    if (!savedLink) return;

    let active = true;
    const canvas = qrCanvas.current;
    Promise.resolve()
      .then(async () => {
        const url = new URL(savedLink);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error("El enlace de la tarjeta debe usar HTTP o HTTPS.");
        }
        if (!canvas) throw new Error("No se encontró el área para mostrar el código QR.");

        const options = {
          width: 160,
          margin: 4,
          color: { dark: "#20372a", light: "#ffffff" },
        };
        await QRCode.toCanvas(canvas, url.href, options);
        const svg = await QRCode.toString(url.href, { ...options, type: "svg" });
        if (!active) return;
        setQrDataUrl(canvas.toDataURL("image/png"));
        setQrSvg(svg);
        setQrStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        setQrError(error instanceof Error ? error.message : String(error));
        setQrStatus("error");
      });

    return () => {
      active = false;
    };
  }, [savedLink]);

  function downloadQrSvg() {
    if (!qrSvg) return;
    const url = URL.createObjectURL(new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${form.slug}-qr.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadQrPng() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${form.slug}-qr.png`;
    link.click();
  }

  function resetForm() {
    menuLoadRequest.current += 1;
    setForm(emptyForm());
    setEditing(null);
    setSection("cards");
    setView("editor");
    setSelectedSlug("");
    setSavedLink("");
    setQrDataUrl("");
    setQrSvg("");
    setQrStatus("idle");
    setQrError("");
    setCopyMessage("");
    setFormMessage("");
    setOriginalProductIds([]);
    setOriginalPromotionIds([]);
    setMenuLoadedSlug("");
    setMenuProductPage(1);
    setEditingMenuItem(null);
    setMenuItemSnapshot(null);
  }

  function updateField<Key extends keyof Omit<FormValues, "links" | "products" | "promotions">>(
    name: Key,
    value: FormValues[Key],
  ) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateLink(id: string, field: keyof TarjetaLink, value: string) {
    setForm((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === id ? { ...link, [field]: value } as TarjetaLink : link,
      ),
    }));
  }

  function updateProduct(id: string, field: keyof MenuProduct, value: string | boolean) {
    setForm((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.key === id ? { ...product, [field]: value } : product,
      ),
    }));
  }

  function updatePromotion(
    id: string,
    field: keyof MenuPromotion,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      promotions: current.promotions.map((promotion) =>
        promotion.key === id ? { ...promotion, [field]: value } : promotion,
      ),
    }));
  }

  function editCard(card: Tarjeta, loadMenuPreview = true) {
    const requestId = ++menuLoadRequest.current;
    setForm({
      slug: card.slug,
      nombre: card.nombre ?? "",
      eslogan: card.eslogan ?? "",
      inicial: card.inicial ?? "",
      avatar_url: card.avatar_url ?? "",
      color_fondo: card.color_fondo || "#f7f8f6",
      color_tarjeta: card.color_tarjeta || "#ffffff",
      color_boton: card.color_boton || "#202a24",
      color_texto: card.color_texto || "#202b23",
      mostrar_menu: card.mostrar_menu ?? true,
      links: cardLinks(card),
      products: [],
      promotions: [],
    });
    setEditing(card);
    setEditingMenuItem(null);
    setMenuItemSnapshot(null);
    setMenuProductPage(1);
    setSection("cards");
    setView("editor");
    setSelectedSlug(card.slug);
    setSavedLink("");
    setQrDataUrl("");
    setQrSvg("");
    setQrStatus("idle");
    setQrError("");
    setFormMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (loadMenuPreview) void loadMenuPreviewData(card.slug, requestId);
  }

  async function loadMenuPreviewData(slug: string, requestId: number) {
    if (!client) return;
    try {
      const [productsResult, promotionsResult] = await Promise.all([
        client.from("menu_productos").select("*").eq("tarjeta_slug", slug).eq("activo", true).order("orden", { ascending: true }),
        client.from("menu_promociones").select("*").eq("tarjeta_slug", slug).eq("activo", true).order("created_at", { ascending: true }),
      ]);
      if (requestId !== menuLoadRequest.current) return;
      if (productsResult.error || promotionsResult.error || !productsResult.data || !promotionsResult.data) {
        const detail = productsResult.error?.message || promotionsResult.error?.message || "Respuesta incompleta al cargar el menú.";
        setFormMessage(`No se pudo cargar el menú para la vista previa: ${detail}`);
        return;
      }
      setForm((current) => ({
        ...current,
        products: productsResult.data.map(productFromRecord),
        promotions: promotionsResult.data.map(promotionFromRecord),
      }));
    } catch (error) {
      if (requestId !== menuLoadRequest.current) return;
      setFormMessage(`No se pudo cargar el menú para la vista previa: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
  }

  async function refreshMenu(slug: string, requestId?: number) {
    if (!client) return { error: "El cliente de Supabase no está disponible." };
    let productsResult;
    let promotionsResult;
    try {
      [productsResult, promotionsResult] = await Promise.all([
        client.from("menu_productos").select("*").eq("tarjeta_slug", slug).order("orden", { ascending: true }),
        client.from("menu_promociones").select("*").eq("tarjeta_slug", slug).order("created_at", { ascending: true }),
      ]);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Error desconocido consultando el menú.",
      };
    }
    if (productsResult.error || promotionsResult.error || !productsResult.data || !promotionsResult.data) {
      const failures = [
        productsResult.error ? `productos: ${productsResult.error.message}` : "",
        promotionsResult.error ? `promociones: ${promotionsResult.error.message}` : "",
      ].filter(Boolean);
      return { error: failures.join("; ") || "Supabase devolvió una respuesta incompleta." };
    }
    if (requestId !== undefined && requestId !== menuLoadRequest.current) {
      return { error: "" };
    }

    const products = productsResult.data.map(productFromRecord);
    const promotions = promotionsResult.data.map(promotionFromRecord);
    setForm((current) => ({ ...current, products, promotions }));
    setMenuProductPage(1);
    setOriginalProductIds(products.flatMap((product) => product.id ? [product.id] : []));
    setOriginalPromotionIds(promotions.flatMap((promotion) => promotion.id ? [promotion.id] : []));
    setMenuLoadedSlug(slug);
    setEditingMenuItem(null);
    return { error: "" };
  }

  async function editMenu(card: Tarjeta) {
    editCard(card, false);
    const requestId = menuLoadRequest.current;
    setSection("menu");
    setMenuLoadedSlug("");
    setBusy(true);
    setFormMessage("Cargando productos y promociones...");
    const result = await refreshMenu(card.slug, requestId);
    if (requestId !== menuLoadRequest.current) return;
    setBusy(false);
    if (result.error) {
      setFormMessage(`No se pudo cargar el menú (${result.error}). Verifica las tablas y sus políticas de acceso.`);
      setForm((current) => ({ ...current, products: [], promotions: [] }));
      setOriginalProductIds([]);
      setOriginalPromotionIds([]);
      setMenuLoadedSlug("");
      return;
    }
    setFormMessage("");
  }

  function selectCard(slug: string) {
    setSelectedSlug(slug);
    const selected = cards.find((card) => card.slug === slug);
    if (selected) editCard(selected);
    else resetForm();
  }

  function showCards() {
    menuLoadRequest.current += 1;
    setBusy(false);
    setSection("cards");
    setView("list");
    setFormMessage("");
  }

  function showMenuList() {
    menuLoadRequest.current += 1;
    setBusy(false);
    setEditingMenuItem(null);
    setSection("menu");
    setView("list");
    setFormMessage("");
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setLoginMessage("Verificando acceso...");
    const { data, error } = await client.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    setBusy(false);
    if (error) {
      setLoginMessage(`No se pudo iniciar sesión: ${error.message}`);
      return;
    }
    await updateSession(data.session);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !authorized) return;
    setBusy(true);
    setFormMessage("Guardando tarjeta...");
    setSavedLink("");
    setQrDataUrl("");
    setQrSvg("");
    setQrStatus("idle");
    setQrError("");

    const links = form.links
      .map((link) => ({ ...link, titulo: link.titulo.trim(), url: link.url.trim() }))
      .filter((link) => link.url);
    const firstLink = (tipo: LinkType) => links.find((link) => link.tipo === tipo);
    const whatsapp = firstLink("whatsapp");
    const instagram = firstLink("instagram");
    const maps = firstLink("maps");
    const payload: Partial<Tarjeta> = {
      slug: form.slug.trim(),
      nombre: form.nombre.trim(),
      eslogan: form.eslogan.trim() || null,
      inicial: form.inicial.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      color_fondo: form.color_fondo,
      color_tarjeta: form.color_tarjeta,
      color_boton: form.color_boton,
      color_texto: form.color_texto,
      mostrar_menu: form.mostrar_menu,
      links,
      whatsapp: whatsapp?.url || null,
      whatsapp_sub: whatsapp?.subtitulo || null,
      instagram: instagram?.url || null,
      instagram_sub: instagram?.subtitulo || null,
      ubicacion_url: maps?.url || null,
      ubicacion_sub: maps?.subtitulo || null,
      activo: editing?.activo ?? true,
    };

    const { data, error } = await client
      .from("tarjetas")
      .upsert(payload, { onConflict: "slug" })
      .select()
      .single();
    setBusy(false);
    if (error) {
      const schemaHint =
        error.code === "42703" || error.code === "PGRST204"
          ? " Ejecuta supabase/extend-tarjetas.sql en Supabase SQL Editor y vuelve a intentar."
          : "";
      setFormMessage(`No se pudo guardar la tarjeta: ${error.message}${schemaHint}`);
      return;
    }

    setEditing(data);
    setSelectedSlug(data.slug);
    const link = `${window.location.origin}/?c=${encodeURIComponent(data.slug)}`;
    setQrStatus("loading");
    setSavedLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage("Enlace copiado al portapapeles.");
    } catch {
      setCopyMessage("No se pudo copiar automáticamente. Copia el enlace mostrado.");
    }
    setFormMessage("Tarjeta guardada correctamente.");
    await loadCards(client);
  }

  async function uploadMenuImage(itemType: "product" | "promotion", itemKey: string, file?: File) {
    if (!client || !file || !editing) return;
    if (!file.type.startsWith("image/")) {
      setFormMessage("Selecciona un archivo de imagen válido.");
      return;
    }

    const uploadKey = `${itemType}:${itemKey}`;
    setUploadingMenuImageKey(uploadKey);
    setFormMessage(itemType === "product" ? "Subiendo imagen del producto..." : "Subiendo imagen de la promoción...");
    const extension = file.type.split("/")[1]?.toLowerCase().replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "img";
    const path = `${editing.slug}/${newItemId()}.${extension}`;
    let data: { path: string } | null;
    let error: { message: string } | null;
    try {
      ({ data, error } = await client.storage.from("menu-imagenes").upload(path, file, {
        upsert: false,
        contentType: file.type,
      }));
    } catch (uploadError) {
      setUploadingMenuImageKey(null);
      setFormMessage(`No se pudo subir la imagen: ${uploadError instanceof Error ? uploadError.message : "error desconocido"}`);
      return;
    }
    setUploadingMenuImageKey(null);
    if (error || !data) {
      setFormMessage(`No se pudo subir la imagen: ${error?.message || "Supabase no devolvió la ruta del archivo."}`);
      return;
    }
    const { data: publicUrl } = client.storage.from("menu-imagenes").getPublicUrl(data.path);
    const imageUrl = publicUrl.publicUrl.trim();
    if (!isPersistentImageUrl(imageUrl)) {
      setFormMessage("Supabase no devolvió una URL pública persistente para la imagen.");
      return;
    }
    if (itemType === "product") {
      updateProduct(itemKey, "imageUrl", imageUrl);
    } else {
      updatePromotion(itemKey, "imageUrl", imageUrl);
    }
    setFormMessage("Imagen subida correctamente.");
  }

  async function saveMenuItem() {
    if (!client || !authorized || !editing || !editingMenuItem) return;

    const selection = editingMenuItem;
    setBusy(true);
    if (selection.type === "product") {
      const product = form.products.find((item) => item.key === selection.key);
      if (!product) {
        setBusy(false);
        setFormMessage("No se encontró el producto seleccionado.");
        return;
      }
      if (!product.name.trim() || !product.price.trim() || !Number.isFinite(Number(product.price))) {
        setBusy(false);
        setFormMessage("El producto debe tener nombre y un precio numérico válido.");
        return;
      }

      const values = {
        tarjeta_slug: editing.slug,
        producto: product.name.trim(),
        precio: Number(product.price),
        descripcion: product.description.trim() || null,
        categoria: product.category.trim() || null,
        imagen_url: product.imageUrl.trim() || null,
        activo: product.active,
        orden: Math.max(0, form.products.findIndex((item) => item.key === product.key)),
        en_promocion: product.onPromotion,
        precio_promocion: product.onPromotion && product.promotionPrice.trim()
          ? Number(product.promotionPrice)
          : null,
        etiqueta_promocion: product.onPromotion ? product.promotionLabel.trim() || null : null,
      };

      try {
        const { data, error } = product.id
          ? await client.from("menu_productos").update(values).eq("id", product.id).eq("tarjeta_slug", editing.slug).select("*").single()
          : await client.from("menu_productos").insert(values).select("*").single();
        if (error || !data) {
          setFormMessage(`No se pudo guardar el producto: ${error?.message || "Supabase no devolvió el registro guardado."}`);
          setBusy(false);
          return;
        }
        const savedProduct = productFromRecord(data);
        setForm((current) => ({
          ...current,
          products: current.products.map((item) => item.key === selection.key ? savedProduct : item),
        }));
        setOriginalProductIds((ids) => ids.includes(savedProduct.id!) ? ids : [...ids, savedProduct.id!]);
        setEditingMenuItem(null);
        setMenuItemSnapshot(null);
        setFormMessage("Producto guardado correctamente.");
      } catch (error) {
        setFormMessage(`No se pudo guardar el producto: ${error instanceof Error ? error.message : "error desconocido"}`);
      }
      setBusy(false);
      return;
    }

    const promotion = form.promotions.find((item) => item.key === selection.key);
    if (!promotion) {
      setBusy(false);
      setFormMessage("No se encontró la promoción seleccionada.");
      return;
    }
    if (
      !promotion.title.trim() ||
      !promotion.discount.trim() ||
      (promotion.previousPrice.trim() && (!Number.isFinite(Number(promotion.previousPrice)) || Number(promotion.previousPrice) < 0)) ||
      (promotion.price.trim() && (!Number.isFinite(Number(promotion.price)) || Number(promotion.price) < 0))
    ) {
      setBusy(false);
      setFormMessage("La promoción debe tener título y descuento; los precios, si se indican, deben ser numéricos y no negativos.");
      return;
    }
    if (promotion.imageUrl.trim() && !isPersistentImageUrl(promotion.imageUrl)) {
      setBusy(false);
      setFormMessage("La imagen debe tener una URL HTTP(S) persistente. Vuelve a subirla antes de guardar la promoción.");
      return;
    }

    const promotionValues = {
      tarjeta_slug: editing.slug,
      titulo: promotion.title.trim(),
      descuento: promotion.discount.trim(),
      descripcion: promotion.description.trim() || null,
      precio_anterior: promotion.previousPrice.trim() ? Number(promotion.previousPrice) : null,
      precio: promotion.price.trim() ? Number(promotion.price) : null,
      imagen_url: promotion.imageUrl.trim() || null,
      vigencia: promotion.validity.trim() || null,
      activo: promotion.active,
    };
    try {
      const { data, error } = promotion.id
        ? await client.from("menu_promociones").update(promotionValues).eq("id", promotion.id).eq("tarjeta_slug", editing.slug).select("*").single()
        : await client.from("menu_promociones").insert(promotionValues).select("*").single();
      if (error || !data) {
        setFormMessage(`No se pudo guardar la promoción: ${error?.message || "Supabase no devolvió el registro guardado."}`);
        setBusy(false);
        return;
      }
      const savedPromotion = promotionFromRecord(data);
      setForm((current) => ({
        ...current,
        promotions: current.promotions.map((item) => item.key === selection.key ? savedPromotion : item),
      }));
      setOriginalPromotionIds((ids) => ids.includes(savedPromotion.id!) ? ids : [...ids, savedPromotion.id!]);
      setEditingMenuItem(null);
      setMenuItemSnapshot(null);
      setFormMessage("Promoción guardada correctamente.");
    } catch (error) {
      setFormMessage(`No se pudo guardar la promoción: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
    setBusy(false);
  }

  async function handleMenuSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !authorized || !editing) return;

    const products = form.products.filter(
      (product) =>
        product.name.trim() ||
        product.price.trim() ||
        product.imageUrl.trim() ||
        product.description.trim() ||
        product.onPromotion ||
        product.promotionPrice.trim() ||
        product.promotionLabel.trim(),
    );
    const promotions = form.promotions.filter(
      (promotion) =>
        promotion.title.trim() ||
        promotion.discount.trim() ||
        promotion.description.trim() ||
        promotion.previousPrice.trim() ||
        promotion.price.trim() ||
        promotion.imageUrl.trim() ||
        promotion.validity.trim(),
    );
    const invalidProduct = products.find((product) =>
      !product.name.trim() || product.price.trim() === "" || !Number.isFinite(Number(product.price)),
    );
    if (invalidProduct) {
      setFormMessage("Cada producto debe tener nombre y un precio numérico válido.");
      return;
    }
    const invalidPromotionImage = promotions.find(
      (promotion) => promotion.imageUrl.trim() !== "" && !isPersistentImageUrl(promotion.imageUrl),
    );
    if (invalidPromotionImage) {
      setFormMessage("La imagen de cada promoción debe tener una URL HTTP(S) persistente. Vuelve a subirla antes de guardar.");
      return;
    }
    const invalidPromotion = promotions.find(
      (promotion) =>
        !promotion.title.trim() ||
        !promotion.discount.trim() ||
        (promotion.previousPrice.trim() !== "" &&
          (!Number.isFinite(Number(promotion.previousPrice)) || Number(promotion.previousPrice) < 0)) ||
        (promotion.price.trim() !== "" &&
          (!Number.isFinite(Number(promotion.price)) || Number(promotion.price) < 0)),
    );
    if (invalidPromotion) {
      setFormMessage("Cada promoción debe tener título y descuento; los precios, si se indican, deben ser numéricos y no negativos.");
      return;
    }

    setBusy(true);
    setFormMessage("Guardando productos y promociones...");
    const requests: Array<{ table: string; request: Promise<{ error: { message: string } | null }> }> = [];
    const savedProductIds = products.flatMap((product) => product.id ? [product.id] : []);
    const savedPromotionIds = promotions.flatMap((promotion) => promotion.id ? [promotion.id] : []);

    products.forEach((product, index) => {
      const values = {
        tarjeta_slug: editing.slug,
        producto: product.name.trim(),
        precio: Number(product.price),
        descripcion: product.description.trim() || null,
        categoria: product.category.trim() || null,
        imagen_url: product.imageUrl.trim() || null,
        activo: product.active,
        orden: index,
        en_promocion: product.onPromotion,
        precio_promocion: product.onPromotion && product.promotionPrice.trim() !== ""
          ? Number(product.promotionPrice)
          : null,
        etiqueta_promocion: product.onPromotion ? product.promotionLabel.trim() || null : null,
      };
      requests.push({
        table: "menu_productos",
        request: product.id
          ? client.from("menu_productos").update(values).eq("id", product.id).eq("tarjeta_slug", editing.slug)
          : client.from("menu_productos").insert(values),
      });
    });
    originalProductIds
      .filter((id) => !savedProductIds.includes(id))
      .forEach((id) => requests.push({
        table: "menu_productos",
        request: client.from("menu_productos").delete().eq("id", id).eq("tarjeta_slug", editing.slug),
      }));

    promotions.forEach((promotion) => {
      const values = {
        tarjeta_slug: editing.slug,
        titulo: promotion.title.trim(),
        descuento: promotion.discount.trim(),
        descripcion: promotion.description.trim() || null,
        precio_anterior: promotion.previousPrice.trim() === "" ? null : Number(promotion.previousPrice),
        precio: promotion.price.trim() === "" ? null : Number(promotion.price),
        imagen_url: promotion.imageUrl.trim() || null,
        vigencia: promotion.validity.trim() || null,
        activo: promotion.active,
      };
      requests.push({
        table: "menu_promociones",
        request: promotion.id
          ? client.from("menu_promociones").update(values).eq("id", promotion.id).eq("tarjeta_slug", editing.slug)
          : client.from("menu_promociones").insert(values),
      });
    });
    originalPromotionIds
      .filter((id) => !savedPromotionIds.includes(id))
      .forEach((id) => requests.push({
        table: "menu_promociones",
        request: client.from("menu_promociones").delete().eq("id", id).eq("tarjeta_slug", editing.slug),
      }));

    let results;
    try {
      results = await Promise.all(requests.map(async ({ table, request }) => ({ table, result: await request })));
    } catch (error) {
      setBusy(false);
      setFormMessage(`No se pudieron guardar los cambios del menú: ${error instanceof Error ? error.message : "error desconocido"}. Verifica los datos en Supabase antes de volver a guardar.`);
      return;
    }
    setBusy(false);
    const failures = results.filter(({ result }) => result.error);
    if (failures.length) {
      const details = failures.map(({ table, result }) => `${table}: ${result.error?.message}`).join("; ");
      setFormMessage(`No se pudieron guardar todos los cambios (${details}). Algunos cambios pueden haberse guardado; vuelve a cargar el menú para verificar.`);
      return;
    }

    const refreshResult = await refreshMenu(editing.slug);
    if (refreshResult.error) {
      setFormMessage(`Los cambios se guardaron, pero no se pudo recargar el menú: ${refreshResult.error}`);
      return;
    }
    setFormMessage("Cambios del menú guardados correctamente.");
  }

  async function toggleActive(card: Tarjeta) {
    if (!client) return;
    setBusy(true);
    const { error } = await client
      .from("tarjetas")
      .update({ activo: !card.activo })
      .eq("slug", card.slug);
    setBusy(false);
    if (error) {
      setListMessage(`No se pudo actualizar "${card.slug}": ${error.message}`);
      return;
    }
    setListMessage(`Tarjeta "${card.slug}" ${card.activo ? "suspendida" : "activada"}.`);
    await loadCards(client);
    if (editing?.slug === card.slug) {
      setEditing({ ...editing, activo: !card.activo });
    }
  }

  async function handleLogout() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) setLoginMessage(`No se pudo cerrar sesión: ${error.message}`);
  }

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"
        strategy="afterInteractive"
        onReady={() => {
          if (!SUPABASE_URL || !SUPABASE_KEY) {
            setLoginMessage("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.");
            return;
          }
          const browserClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
          if (browserClient) setClient(browserClient);
          else setLoginMessage("No se pudo cargar Supabase. Recarga la página e inténtalo de nuevo.");
        }}
        onError={() => setLoginMessage("No se pudo cargar Supabase. Recarga la página e inténtalo de nuevo.")}
      />
      <main className="min-h-screen bg-[#f4f6f3] px-4 py-8 text-[#202b23] sm:px-7">
        <div className="mx-auto max-w-[96rem]">
          <header className="mb-7 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.05em]">Administrar tarjetas</h1>
              <p className="mt-1 text-sm text-[#788078]">Crea tarjetas y personaliza todos sus enlaces y colores.</p>
            </div>
            {authorized && (
              <button type="button" onClick={handleLogout} className="rounded-xl border border-[#dfe5dd] bg-white px-4 py-2.5 text-sm font-medium text-[#344437] hover:bg-[#f8faf7]">
                Cerrar sesión
              </button>
            )}
          </header>

          {!authorized ? (
            <section className={`${panelClass} mx-auto max-w-md sm:p-8`}>
              <h2 className="text-lg font-semibold tracking-[-0.035em]">Iniciar sesión</h2>
              <p className="mt-2 text-sm leading-6 text-[#788078]">Usa una cuenta de Supabase autorizada para administrar tarjetas.</p>
              <form className="mt-5 grid gap-4" onSubmit={handleLogin}>
                <label className={labelClass}>Correo electrónico<input name="email" type="email" autoComplete="username" required className={inputClass} /></label>
                <label className={labelClass}>Contraseña<input name="password" type="password" autoComplete="current-password" required className={inputClass} /></label>
                <button type="submit" disabled={busy || !client} className="min-h-11 rounded-xl bg-[#20372a] px-4 text-sm font-semibold text-white hover:bg-[#2b4937] disabled:cursor-wait disabled:opacity-60">
                  {busy ? "Verificando..." : "Entrar al panel"}
                </button>
              </form>
              {loginMessage && <p role="status" className="mt-4 text-sm text-[#a33e4b]">{loginMessage}</p>}
            </section>
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
              <aside className={`${panelClass} flex flex-col gap-5 lg:sticky lg:top-6`}>
                <nav aria-label="Navegación de edición">
                  <h2 className="text-sm font-semibold text-[#344437]">Edición</h2>
                  <div className="mt-3 grid gap-2">
                    <button type="button" onClick={showCards} aria-current={section === "cards" ? "page" : undefined} className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-[#edf1eb] ${section === "cards" ? "bg-[#f4f6f3] text-[#344437]" : "text-[#526254]"}`}>
                      Edición de tarjetas
                    </button>
                    <button type="button" onClick={showMenuList} aria-current={section === "menu" ? "page" : undefined} className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-[#edf1eb] ${section === "menu" ? "bg-[#f4f6f3] text-[#344437]" : "text-[#526254]"}`}>
                      Edición de menú
                    </button>
                  </div>
                </nav>
                <div className="mt-auto rounded-xl border border-[#e8ece6] bg-[#f8faf7] p-3">
                  <p className="text-xs font-semibold text-[#344437]">Vista previa en vivo</p>
                  <p className="mt-1 text-xs leading-5 text-[#788078]">
                    Los cambios en los campos, colores y enlaces se reflejan al instante.
                  </p>
                </div>
              </aside>
              <div className="min-w-0">
              {view === "editor" ? (
                section === "menu" ? (
                  <div id="menu-editor" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
                    <section className={panelClass}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold tracking-[-0.035em]">Menú de {form.nombre || editing?.slug}</h2>
                          <p className="mt-1 text-sm text-[#788078]">Edita productos y promociones de este local.</p>
                        </div>
                        <button type="button" onClick={showMenuList} className="min-h-10 rounded-xl border border-[#dfe5dd] px-4 text-sm font-medium text-[#344437] hover:bg-[#f8faf7]">
                          Volver a menús
                        </button>
                      </div>
                      <form className="mt-6 grid gap-7" onSubmit={handleMenuSave}>
                        <fieldset ref={menuProductsSection} className="grid scroll-mt-5 gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <legend className="text-sm font-semibold text-[#344437]">Productos</legend>
                            <button type="button" onClick={addMenuProduct} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-xs font-semibold text-[#344437] hover:bg-[#f8faf7]">
                              + Agregar producto
                            </button>
                          </div>
                          {form.products.length > 0 ? (
                            <div className="overflow-hidden rounded-xl border border-[#e8ece6]">
                              <table className="w-full table-fixed text-left text-xs">
                                <thead className="bg-[#f8faf7] text-[#526254]">
                                  <tr>
                                    <th scope="col" className="w-[6%] px-0.5 py-3 font-semibold sm:px-2">#</th>
                                    <th scope="col" className="w-[11%] px-1 py-3 font-semibold sm:px-2">Imagen</th>
                                    <th scope="col" className="w-[16%] px-1 py-3 font-semibold sm:px-2">Producto</th>
                                    <th scope="col" className="w-[14%] px-1 py-3 font-semibold sm:px-2">Categoría</th>
                                    <th scope="col" className="w-[12%] px-1 py-3 font-semibold sm:px-2">Precio</th>
                                    <th scope="col" className="w-[22%] px-1 py-3 font-semibold sm:px-2">Descripción</th>
                                    <th scope="col" className="w-[19%] px-1 py-3 font-semibold sm:px-2">Editar</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#edf0eb]">
                                  {visibleMenuProducts.map((product, index) => (
                                    <tr key={product.key} className={editingMenuItem?.key === product.key ? "bg-[#f5f8f3]" : "bg-white"}>
                                      <td className="px-0.5 py-3 text-[#788078] sm:px-2">{(currentMenuProductPage - 1) * PRODUCTS_PER_PAGE + index + 1}</td>
                                      <td className="px-1 py-3 sm:px-2">
                                        {product.imageUrl ? (
                                          <Image src={product.imageUrl} alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded-lg object-cover sm:h-8 sm:w-8" />
                                        ) : <span className="text-[#9ba49b]">—</span>}
                                      </td>
                                      <td title={product.name || "Sin nombre"} className="truncate px-1 py-3 font-semibold text-[#344437] sm:px-2">{product.name || "Sin nombre"}</td>
                                      <td title={product.category || undefined} className="truncate px-1 py-3 text-[#344437] sm:px-2">{product.category || "—"}</td>
                                      <td className="truncate px-1 py-3 text-[#344437] sm:px-2">{product.price ? `$${product.price}` : "—"}</td>
                                      <td title={product.description || undefined} className="truncate px-1 py-3 text-[#788078] sm:px-2">{product.description || "—"}</td>
                                      <td className="px-1 py-3 sm:px-2">
                                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center">
                                          <button type="button" onClick={() => editMenuProduct(product)} className="min-h-9 rounded-lg border border-[#dfe5dd] px-2 font-semibold text-[#344437] hover:bg-[#f8faf7]">
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            aria-label={`Eliminar producto ${product.name || product.id || ""}`}
                                            onClick={() => {
                                              setForm((current) => ({ ...current, products: current.products.filter((item) => item.key !== product.key) }));
                                              setMenuProductPage(Math.min(
                                                currentMenuProductPage,
                                                Math.max(1, Math.ceil((form.products.length - 1) / PRODUCTS_PER_PAGE)),
                                              ));
                                              if (editingMenuItem?.key === product.key) {
                                                setEditingMenuItem(null);
                                                setMenuItemSnapshot(null);
                                              }
                                            }}
                                            className="grid h-9 w-9 place-items-center rounded-lg border border-[#f0dfe1] text-sm text-[#a15a5f] hover:bg-[#fbf6f7]"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : <p className="text-xs text-[#788078]">Agrega productos para mostrarlos en la tarjeta.</p>}
                          {form.products.length > PRODUCTS_PER_PAGE && (
                            <nav aria-label="Paginación de productos del editor" className="mt-1 flex items-center justify-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => changeMenuProductPage(currentMenuProductPage - 1)}
                                disabled={currentMenuProductPage === 1}
                                className="min-h-9 rounded-lg border border-[#dfe5dd] px-3 font-medium text-[#526254] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ← Anterior
                              </button>
                              <span aria-live="polite" className="px-1 font-medium text-[#526254]">
                                Página {currentMenuProductPage} de {menuProductPageCount}
                              </span>
                              <button
                                type="button"
                                onClick={() => changeMenuProductPage(currentMenuProductPage + 1)}
                                disabled={currentMenuProductPage === menuProductPageCount}
                                className="min-h-9 rounded-lg px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                                style={{ backgroundColor: form.color_boton }}
                              >
                                Siguiente →
                              </button>
                            </nav>
                          )}
                        </fieldset>

                        <fieldset className="grid gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <legend className="text-sm font-semibold text-[#344437]">Descuentos o promociones</legend>
                            <button type="button" onClick={addMenuPromotion} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-xs font-semibold text-[#344437] hover:bg-[#f8faf7]">
                              + Agregar promoción
                            </button>
                          </div>
                          {form.promotions.length > 0 ? (
                            <div className="overflow-hidden rounded-xl border border-[#e8ece6]">
                              <table className="w-full table-fixed text-left text-xs">
                                <thead className="bg-[#f8faf7] text-[#526254]">
                                  <tr>
                                    <th scope="col" className="w-[7%] px-0.5 py-3 font-semibold sm:px-2">#</th>
                                    <th scope="col" className="w-[13%] px-1.5 py-3 font-semibold sm:px-2">Imagen</th>
                                    <th scope="col" className="w-[22%] px-1.5 py-3 font-semibold sm:px-2">Título</th>
                                    <th scope="col" className="w-[13%] px-1.5 py-3 font-semibold sm:px-2">Descuento</th>
                                    <th scope="col" className="w-[13%] px-1.5 py-3 font-semibold sm:px-2">Precio</th>
                                    <th scope="col" className="w-[12%] px-1.5 py-3 font-semibold sm:px-2">Vigencia</th>
                                    <th scope="col" className="w-[20%] px-1.5 py-3 font-semibold sm:px-2">Editar</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#edf0eb]">
                                  {form.promotions.map((promotion, index) => (
                                    <tr key={promotion.key} className={editingMenuItem?.key === promotion.key ? "bg-[#f5f8f3]" : "bg-white"}>
                                      <td className="px-0.5 py-3 text-[#788078] sm:px-2">{index + 1}</td>
                                      <td className="px-1.5 py-3 sm:px-2">
                                        {promotion.imageUrl ? <Image src={promotion.imageUrl} alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded-lg object-cover sm:h-8 sm:w-8" /> : <span className="text-[#9ba49b]">—</span>}
                                      </td>
                                      <td title={promotion.title || "Sin título"} className="truncate px-1.5 py-3 font-semibold text-[#344437] sm:px-2">{promotion.title || "Sin título"}</td>
                                      <td className="truncate px-1.5 py-3 text-[#344437] sm:px-2">{promotion.discount || "—"}</td>
                                      <td className="truncate px-1.5 py-3 text-[#344437] sm:px-2">{promotion.price ? `$${promotion.price}` : "—"}</td>
                                      <td title={promotion.validity || undefined} className="truncate px-1.5 py-3 text-[#788078] sm:px-2">{promotion.validity || "—"}</td>
                                      <td className="px-1.5 py-3 sm:px-2">
                                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center">
                                          <button type="button" onClick={() => editMenuPromotion(promotion)} className="min-h-9 rounded-lg border border-[#dfe5dd] px-2 font-semibold text-[#344437] hover:bg-[#f8faf7]">
                                            Editar
                                          </button>
                                          <button type="button" aria-label={`Eliminar promoción ${promotion.title || ""}`} onClick={() => { setForm((current) => ({ ...current, promotions: current.promotions.filter((item) => item.key !== promotion.key) })); if (editingMenuItem?.key === promotion.key) { setEditingMenuItem(null); setMenuItemSnapshot(null); } }} className="grid h-9 w-9 place-items-center rounded-lg border border-[#f0dfe1] text-sm text-[#a15a5f] hover:bg-[#fbf6f7]">
                                            ×
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : <p className="text-xs text-[#788078]">Agrega descuentos o promociones para mostrarlos en la tarjeta.</p>}
                        </fieldset>

                        <button type="submit" disabled={busy || !editing || menuLoadedSlug !== editing?.slug || uploadingMenuImageKey !== null} className="min-h-11 justify-self-start rounded-xl bg-[#20372a] px-5 text-sm font-semibold text-white hover:bg-[#2b4937] disabled:cursor-wait disabled:opacity-60">
                          {busy ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </form>
                      {formMessage && <p role="status" className="mt-3 text-sm text-[#526254]">{formMessage}</p>}
                    </section>
                    <section className={`${panelClass} self-start lg:sticky lg:top-6`}>
                      <h2 className="mb-4 text-lg font-semibold tracking-[-0.035em]">Vista previa en vivo</h2>
                      <div className="rounded-[1.6rem] p-4 sm:p-6" style={{ backgroundColor: form.color_fondo }}>
                        <ProfileCard tarjeta={previewCard} previewMode menuView />
                      </div>
                    </section>
                  </div>
                ) : (
                <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className={`${labelClass} max-w-sm`}>
                  Seleccionar tarjeta existente
                  <select value={selectedSlug} onChange={(event) => selectCard(event.target.value)} className={inputClass}>
                    <option value="">Crear una tarjeta nueva...</option>
                    {cards.map((card) => <option key={card.slug} value={card.slug}>{card.nombre || card.slug} · {card.slug}</option>)}
                  </select>
                </label>
                <button type="button" onClick={resetForm} className="min-h-11 rounded-xl border border-[#dfe5dd] bg-white px-5 text-sm font-medium text-[#344437] hover:bg-[#f8faf7]">
                  Nueva tarjeta
                </button>
                {editing && (
                  <button type="button" onClick={() => void editMenu(editing)} className="min-h-11 rounded-xl border border-[#dfe5dd] bg-white px-5 text-sm font-semibold text-[#344437] hover:bg-[#f8faf7]">
                    Editar menú →
                  </button>
                )}
              </div>

              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
                <section id="card-details" className={panelClass}>
                  <h2 className="text-lg font-semibold tracking-[-0.035em]">{editing ? `Editar: ${editing.slug}` : "Crear tarjeta"}</h2>
                  <form className="mt-5 grid gap-6" onSubmit={handleSave}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={labelClass}>
                        Slug
                        <input name="slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value.toLowerCase().trim().replace(/\s+/g, "-"))} placeholder="cafe-esquina" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required disabled={Boolean(editing)} className={inputClass} />
                      </label>
                      <label className={labelClass}>
                        Inicial
                        <input name="inicial" value={form.inicial} onChange={(event) => updateField("inicial", event.target.value.slice(0, 2))} maxLength={2} placeholder="C" className={inputClass} />
                      </label>
                      <label className={`${labelClass} sm:col-span-2`}>Nombre<input name="nombre" value={form.nombre} onChange={(event) => updateField("nombre", event.target.value)} required className={inputClass} /></label>
                      <label className={`${labelClass} sm:col-span-2`}>Descripción / eslogan<textarea name="eslogan" value={form.eslogan} onChange={(event) => updateField("eslogan", event.target.value)} rows={2} className={inputClass} /></label>
                      <label className={`${labelClass} sm:col-span-2`}>URL de imagen del avatar (opcional)<input name="avatar_url" type="url" value={form.avatar_url} onChange={(event) => updateField("avatar_url", event.target.value)} placeholder="https://..." className={inputClass} /></label>
                      <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-[#e8ece6] bg-[#fbfcfa] px-3 sm:col-span-2">
                        <span className="grid gap-1">
                          <span className="text-xs font-semibold text-[#526254]">Mostrar botón de Menú</span>
                          <span className="text-[11px] font-normal text-[#788078]">Muestra el acceso público cuando haya productos o promociones activos.</span>
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label="Mostrar botón de Menú"
                          checked={form.mostrar_menu}
                          onChange={(event) => updateField("mostrar_menu", event.target.checked)}
                          className="h-5 w-9 shrink-0 cursor-pointer accent-[#47704e]"
                        />
                      </label>
                    </div>

                    <fieldset>
                      <legend className="mb-3 text-sm font-semibold text-[#344437]">Estilo y color</legend>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {([
                          ["color_fondo", "Fondo"],
                          ["color_tarjeta", "Tarjeta"],
                          ["color_boton", "Botones"],
                          ["color_texto", "Texto"],
                        ] as const).map(([field, label]) => (
                          <label key={field} className={labelClass}>
                            {label}
                            <span className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dfe5dd] px-2">
                              <input aria-label={`Color ${label.toLowerCase()}`} type="color" value={form[field]} onChange={(event) => updateField(field, event.target.value)} className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" />
                              <span className="font-mono text-[11px] font-normal uppercase">{form[field]}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset id="card-links" className="grid gap-3 scroll-mt-6">
                      <div className="flex items-center justify-between gap-3">
                        <legend className="text-sm font-semibold text-[#344437]">Enlaces</legend>
                        <button type="button" onClick={() => setForm((current) => ({ ...current, links: [...current.links, newLink()] }))} className="rounded-lg border border-[#dfe5dd] px-3 py-2 text-xs font-semibold text-[#344437] hover:bg-[#f8faf7]">
                          + Agregar enlace
                        </button>
                      </div>
                      {form.links.map((link, index) => (
                        <div key={link.id} className="grid gap-3 rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3 sm:grid-cols-2">
                          <label className={labelClass}>
                            Tipo
                            <select value={link.tipo} onChange={(event) => updateLink(link.id, "tipo", event.target.value as LinkType)} className={inputClass}>
                              <option value="whatsapp">WhatsApp</option>
                              <option value="instagram">Instagram</option>
                              <option value="maps">Cómo llegar</option>
                              <option value="web">Sitio web / enlace</option>
                              <option value="phone">Teléfono</option>
                              <option value="reviews">Reseñas</option>
                            </select>
                          </label>
                          <label className={labelClass}>Título<input value={link.titulo} onChange={(event) => updateLink(link.id, "titulo", event.target.value)} placeholder="Mi enlace" className={inputClass} /></label>
                          <label className={labelClass}>URL, usuario o teléfono<input value={link.url} onChange={(event) => updateLink(link.id, "url", event.target.value)} placeholder={link.tipo === "whatsapp" ? "521234567890" : "https://..."} className={inputClass} /></label>
                          <label className={labelClass}>
                            Subtítulo
                            <span className="flex gap-2">
                              <input value={link.subtitulo} onChange={(event) => updateLink(link.id, "subtitulo", event.target.value)} placeholder="Texto breve" className={inputClass} />
                              <button type="button" aria-label={`Eliminar enlace ${index + 1}`} onClick={() => setForm((current) => ({ ...current, links: current.links.filter((item) => item.id !== link.id) }))} className="shrink-0 rounded-xl border border-[#f0dfe1] px-3 text-sm text-[#a15a5f] hover:bg-[#fbf6f7]">×</button>
                            </span>
                          </label>
                        </div>
                      ))}
                      {form.links.length === 0 && <p className="text-xs text-[#788078]">Agrega enlaces para que aparezcan en la tarjeta pública.</p>}
                    </fieldset>

                    <div className="flex flex-wrap gap-2.5">
                      <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#20372a] px-5 text-sm font-semibold text-white hover:bg-[#2b4937] disabled:cursor-wait disabled:opacity-60">
                        {busy ? "Guardando..." : editing ? "Guardar cambios" : "Crear tarjeta"}
                      </button>
                    </div>
                  </form>
                  {formMessage && <p role="status" className="mt-3 text-sm text-[#526254]">{formMessage}</p>}
                  {savedLink && (
                    <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#e8ece6] pt-5">
                      <div className="grid justify-items-center gap-2">
                        <canvas ref={qrCanvas} aria-label="Código QR de la tarjeta" className="h-40 w-40 rounded-lg border-8 border-white bg-white shadow-[0_4px_18px_rgba(0,0,0,0.1)]" />
                        {qrStatus === "loading" && <p role="status" className="text-xs text-[#788078]">Generando código QR...</p>}
                        {qrStatus === "error" && (
                          <p role="alert" className="max-w-40 text-center text-xs text-[#a15a5f]">
                            No se pudo generar el QR{qrError ? `: ${qrError}` : "."}
                          </p>
                        )}
                        {qrStatus === "ready" && <p role="status" className="text-xs text-[#526254]">Código QR listo.</p>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">Enlace guardado</h3>
                        <a href={savedLink} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs leading-5 text-[#526254] underline underline-offset-2">{savedLink}</a>
                        <p className="mt-2 text-xs text-[#788078]">{copyMessage}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void navigator.clipboard.writeText(savedLink).then(() => setCopyMessage("Enlace copiado al portapapeles.")).catch(() => setCopyMessage("No se pudo copiar; selecciona el enlace."))} className="min-h-9 rounded-xl border border-[#dfe5dd] px-3 text-xs font-semibold text-[#344437]">Copiar enlace</button>
                          <a href={savedLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-xl bg-[#20372a] px-3 text-xs font-semibold text-white hover:bg-[#2b4937]">Abrir tarjeta</a>
                          <button type="button" onClick={() => downloadQrSvg()} disabled={qrStatus !== "ready" || !qrSvg} className="min-h-9 rounded-xl border border-[#dfe5dd] px-3 text-xs font-semibold text-[#344437] disabled:cursor-not-allowed disabled:opacity-50">Descargar QR (SVG)</button>
                          <button type="button" onClick={downloadQrPng} disabled={qrStatus !== "ready" || !qrDataUrl} className="min-h-9 rounded-xl border border-[#dfe5dd] px-3 text-xs font-semibold text-[#344437] disabled:cursor-not-allowed disabled:opacity-50">Descargar QR (PNG)</button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className={`${panelClass} self-start lg:sticky lg:top-6`}>
                  <h2 className="mb-4 text-lg font-semibold tracking-[-0.035em]">Vista previa en vivo</h2>
                  <div className="rounded-[1.6rem] p-4 sm:p-6" style={{ backgroundColor: form.color_fondo }}>
                    <ProfileCard tarjeta={previewCard} />
                  </div>
                </section>
              </div>
                </>
                )
              ) : (
                <section className={panelClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.035em]">{section === "menu" ? "Edición de menú" : "Edición de tarjetas"}</h2>
                      <p className="mt-1 text-sm text-[#788078]">Selecciona el link de un local para abrir su editor.</p>
                    </div>
                    {section === "cards" && (
                      <button type="button" onClick={resetForm} className="min-h-11 rounded-xl bg-[#20372a] px-5 text-sm font-semibold text-white hover:bg-[#2b4937]">
                        Nueva tarjeta
                      </button>
                    )}
                  </div>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[38rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#e8ece6] text-xs font-semibold uppercase tracking-wide text-[#788078]">
                          <th scope="col" className="px-3 py-3">LINK</th>
                          <th scope="col" className="px-3 py-3">NOMBRE DE LOCAL</th>
                          <th scope="col" className="px-3 py-3 text-center">ESTADO</th>
                          <th scope="col" className="px-3 py-3 text-right">ACCIÓN</th>
                        </tr>
                      </thead>
                      <tbody>
                  {cards.map((card) => (
                    <tr key={card.slug} className="border-b border-[#edf0eb] last:border-0">
                      <td className="px-3 py-3">
                        <a
                          href={`/?c=${encodeURIComponent(card.slug)}`}
                          onClick={(event) => {
                            event.preventDefault();
                            if (section === "menu") editMenu(card);
                            else editCard(card);
                          }}
                          className="font-medium text-[#344437] underline decoration-[#9aaa9a] underline-offset-4 hover:text-[#20372a]"
                        >
                          /?c={card.slug}
                        </a>
                      </td>
                      <td className="px-3 py-3 font-medium text-[#344437]">{card.nombre || card.slug}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={card.activo}
                          aria-label={`${card.activo ? "Suspender" : "Activar"} ${card.nombre || card.slug}`}
                          disabled={busy}
                          onClick={() => void toggleActive(card)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-60 ${card.activo ? "bg-[#47704e]" : "bg-[#c6cec5]"}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${card.activo ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button type="button" onClick={() => section === "menu" ? editMenu(card) : editCard(card)} className="min-h-9 rounded-lg border border-[#dfe5dd] bg-white px-3 text-xs font-medium text-[#344437] hover:bg-[#f8faf7]">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                      </tbody>
                    </table>
                  </div>
                  {listMessage && <p role="status" className="mt-3 text-sm text-[#526254]">{listMessage}</p>}
                </section>
              )}
              </div>
            </div>
          )}
        </div>
      </main>
      {editingMenuItem && (editingProduct || editingPromotion) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy &&
              uploadingMenuImageKey === null
            ) {
              cancelMenuItemEdit();
            }
          }}
        >
          <div
            ref={menuItemEditorRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-item-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="menu-item-modal-title" className="text-lg font-semibold tracking-[-0.035em] text-[#344437]">
                {editingProduct
                  ? menuItemSnapshot?.isNew ? "Agregar producto" : "Editar producto"
                  : menuItemSnapshot?.isNew ? "Agregar promoción" : "Editar promoción"}
              </h2>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={busy || uploadingMenuImageKey !== null}
                onClick={cancelMenuItemEdit}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#dfe5dd] text-lg text-[#526254] hover:bg-[#f8faf7] disabled:opacity-60"
              >
                ×
              </button>
            </div>
            {editingProduct ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  Imagen
                  <span className="grid gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      aria-label={`Subir imagen de ${editingProduct.name || "producto"}`}
                      disabled={uploadingMenuImageKey === `product:${editingProduct.key}`}
                      onChange={(event) => {
                        void uploadMenuImage("product", editingProduct.key, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                      className="block w-full text-xs text-[#526254] file:mr-2 file:min-h-9 file:rounded-lg file:border-0 file:bg-[#edf1eb] file:px-3 file:text-xs file:font-semibold file:text-[#344437] disabled:opacity-60"
                    />
                    {uploadingMenuImageKey === `product:${editingProduct.key}` && (
                      <span className="text-[11px] font-normal text-[#788078]">Subiendo imagen...</span>
                    )}
                    {editingProduct.imageUrl && (
                      <Image
                        src={editingProduct.imageUrl}
                        alt={`Vista previa de ${editingProduct.name || "producto"}`}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    )}
                  </span>
                </label>
                <label className={labelClass}>
                  Producto
                  <input value={editingProduct.name} onChange={(event) => updateProduct(editingProduct.key, "name", event.target.value)} placeholder="Nombre del producto" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Precio
                  <input type="number" min="0" step="0.01" value={editingProduct.price} onChange={(event) => updateProduct(editingProduct.key, "price", event.target.value)} placeholder="0.00" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Categoría / Sección (opcional)
                  <input value={editingProduct.category} onChange={(event) => updateProduct(editingProduct.key, "category", event.target.value)} placeholder="Ej. Desayunos" className={inputClass} />
                </label>
                <div className="grid gap-2 sm:col-span-2">
                  <span className="text-xs font-semibold text-[#526254]">Categorías existentes y sugeridas</span>
                  <div role="group" aria-label="Seleccionar categoría" className="flex flex-wrap gap-2">
                    {menuProductCategories.map((category) => (
                      <button
                        key={normalizeCategory(category)}
                        type="button"
                        aria-pressed={normalizeCategory(editingProduct.category) === normalizeCategory(category)}
                        onClick={() => updateProduct(editingProduct.key, "category", category)}
                        className={`min-h-9 rounded-full border px-3 text-xs font-medium transition ${
                          normalizeCategory(editingProduct.category) === normalizeCategory(category)
                            ? "border-[#47704e] bg-[#edf4eb] text-[#344437]"
                            : "border-[#dfe5dd] text-[#526254] hover:bg-[#f8faf7]"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
                <label className={`${labelClass} sm:col-span-2`}>
                  Descripción / Ingredientes (opcional)
                  <textarea value={editingProduct.description} onChange={(event) => updateProduct(editingProduct.key, "description", event.target.value)} placeholder="Ej. Huevo, jamón, tocino, queso y maíz" rows={3} className={inputClass} />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[#526254]">
                  <input type="checkbox" checked={editingProduct.active} onChange={(event) => updateProduct(editingProduct.key, "active", event.target.checked)} className="h-4 w-4 accent-[#47704e]" />
                  Activo
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[#526254]">
                  <input type="checkbox" checked={editingProduct.onPromotion} onChange={(event) => updateProduct(editingProduct.key, "onPromotion", event.target.checked)} className="h-4 w-4 accent-[#47704e]" />
                  En promoción
                </label>
                {editingProduct.onPromotion && (
                  <>
                    <label className={labelClass}>
                      Precio promocional
                      <input type="number" min="0" step="0.01" value={editingProduct.promotionPrice} onChange={(event) => updateProduct(editingProduct.key, "promotionPrice", event.target.value)} placeholder="0.00" className={inputClass} />
                    </label>
                    <label className={labelClass}>
                      Etiqueta de promoción
                      <input value={editingProduct.promotionLabel} onChange={(event) => updateProduct(editingProduct.key, "promotionLabel", event.target.value)} placeholder="Ej. Oferta" className={inputClass} />
                    </label>
                  </>
                )}
              </div>
            ) : editingPromotion ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Título
                  <input value={editingPromotion.title} onChange={(event) => updatePromotion(editingPromotion.key, "title", event.target.value)} placeholder="Promoción especial" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Descuento (%)
                  <input value={editingPromotion.discount} onChange={(event) => updatePromotion(editingPromotion.key, "discount", event.target.value)} placeholder="20 o 58" className={inputClass} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Descripción
                  <textarea value={editingPromotion.description} onChange={(event) => updatePromotion(editingPromotion.key, "description", event.target.value)} placeholder="Detalles de la promoción (opcional)" rows={2} className={inputClass} />
                </label>
                <label className={labelClass}>
                  Precio anterior
                  <input type="number" min="0" step="0.01" value={editingPromotion.previousPrice} onChange={(event) => updatePromotion(editingPromotion.key, "previousPrice", event.target.value)} placeholder="280 (opcional)" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Precio oferta / actual
                  <input type="number" min="0" step="0.01" value={editingPromotion.price} onChange={(event) => updatePromotion(editingPromotion.key, "price", event.target.value)} placeholder="200 (opcional)" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Vigencia / fecha
                  <input value={editingPromotion.validity} onChange={(event) => updatePromotion(editingPromotion.key, "validity", event.target.value)} placeholder="Válido hasta el viernes (opcional)" className={inputClass} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Imagen
                  <span className="grid gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      aria-label={`Subir imagen de ${editingPromotion.title || "promoción"}`}
                      disabled={uploadingMenuImageKey === `promotion:${editingPromotion.key}`}
                      onChange={(event) => {
                        void uploadMenuImage("promotion", editingPromotion.key, event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                      className="block w-full text-xs text-[#526254] file:mr-2 file:min-h-9 file:rounded-lg file:border-0 file:bg-[#edf1eb] file:px-3 file:text-xs file:font-semibold file:text-[#344437] disabled:opacity-60"
                    />
                    {uploadingMenuImageKey === `promotion:${editingPromotion.key}` && (
                      <span className="text-[11px] font-normal text-[#788078]">Subiendo imagen...</span>
                    )}
                    {editingPromotion.imageUrl && (
                      <Image
                        src={editingPromotion.imageUrl}
                        alt={`Vista previa de ${editingPromotion.title || "promoción"}`}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    )}
                  </span>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[#526254]">
                  <input type="checkbox" checked={editingPromotion.active} onChange={(event) => updatePromotion(editingPromotion.key, "active", event.target.checked)} className="h-4 w-4 accent-[#47704e]" />
                  Activa
                </label>
              </div>
            ) : null}
            {formMessage && <p role="status" className="mt-4 text-sm text-[#526254]">{formMessage}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelMenuItemEdit}
                disabled={busy || uploadingMenuImageKey !== null}
                className="min-h-10 rounded-xl border border-[#dfe5dd] px-4 text-sm font-medium text-[#344437] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveMenuItem()}
                disabled={busy || uploadingMenuImageKey !== null}
                className="min-h-10 rounded-xl bg-[#20372a] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
