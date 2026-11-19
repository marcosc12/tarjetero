"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProfileCard, type Tarjeta, type TarjetaLink } from "@/components/profile-card";
import {
  SUPABASE_KEY,
  SUPABASE_URL,
  type AdminSession,
  type SupabaseBrowserClient,
} from "@/lib/supabase-browser";

type LinkType = TarjetaLink["tipo"];
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
  links: TarjetaLink[];
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
  links: defaultLinks.map((link) => ({ ...link })),
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
          ["whatsapp", "instagram", "maps", "web", "phone"].includes(link.tipo),
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

export function AdminPanel() {
  const [client, setClient] = useState<SupabaseBrowserClient | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
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
  const [selectedSlug, setSelectedSlug] = useState("");
  const qrCanvas = useRef<HTMLCanvasElement>(null);

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
    if (!savedLink || !qrReady || !qrCanvas.current || !window.QRCode) return;
    window.QRCode.toCanvas(qrCanvas.current, savedLink, {
      width: 160,
      margin: 1,
      color: { dark: "#20372a", light: "#ffffff" },
    })
      .then(() => setQrDataUrl(qrCanvas.current?.toDataURL("image/png") ?? ""))
      .catch((error: Error) => setFormMessage(`No se pudo generar el QR: ${error.message}`));
  }, [savedLink, qrReady]);

  function resetForm() {
    setForm(emptyForm());
    setEditing(null);
    setSelectedSlug("");
    setSavedLink("");
    setQrDataUrl("");
    setCopyMessage("");
    setFormMessage("");
  }

  function updateField<Key extends keyof Omit<FormValues, "links">>(
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

  function editCard(card: Tarjeta) {
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
      links: cardLinks(card),
    });
    setEditing(card);
    setSelectedSlug(card.slug);
    setSavedLink("");
    setQrDataUrl("");
    setFormMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectCard(slug: string) {
    setSelectedSlug(slug);
    const selected = cards.find((card) => card.slug === slug);
    if (selected) editCard(selected);
    else resetForm();
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
      <Script
        src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"
        strategy="afterInteractive"
        onReady={() => setQrReady(true)}
      />
      <main className="min-h-screen bg-[#f4f6f3] px-4 py-8 text-[#202b23] sm:px-7">
        <div className="mx-auto max-w-6xl">
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
              </div>

              <div className="grid items-start gap-5 lg:grid-cols-[1.08fr_.92fr]">
                <section className={panelClass}>
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
                    </div>

                    <fieldset>
                      <legend className="mb-3 text-sm font-semibold text-[#344437]">Colores de la tarjeta</legend>
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

                    <fieldset className="grid gap-3">
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
                      <canvas ref={qrCanvas} aria-label="Código QR de la tarjeta" className="h-40 w-40 rounded-lg border-8 border-white shadow-[0_4px_18px_rgba(0,0,0,0.1)]" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">Enlace guardado</h3>
                        <a href={savedLink} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs leading-5 text-[#526254] underline underline-offset-2">{savedLink}</a>
                        <p className="mt-2 text-xs text-[#788078]">{copyMessage}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void navigator.clipboard.writeText(savedLink).then(() => setCopyMessage("Enlace copiado al portapapeles.")).catch(() => setCopyMessage("No se pudo copiar; selecciona el enlace."))} className="min-h-9 rounded-xl border border-[#dfe5dd] px-3 text-xs font-semibold text-[#344437]">Copiar enlace</button>
                          <a href={savedLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-xl bg-[#20372a] px-3 text-xs font-semibold text-white hover:bg-[#2b4937]">Abrir tarjeta</a>
                          <a href={qrDataUrl || undefined} download={`${form.slug}-qr.png`} aria-disabled={!qrDataUrl} className="inline-flex min-h-9 items-center rounded-xl border border-[#dfe5dd] px-3 text-xs font-semibold text-[#344437] aria-disabled:pointer-events-none aria-disabled:opacity-50">Descargar QR</a>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className={panelClass}>
                  <h2 className="mb-4 text-lg font-semibold tracking-[-0.035em]">Vista previa en vivo</h2>
                  <div className="rounded-[1.6rem] p-4 sm:p-6" style={{ backgroundColor: form.color_fondo }}>
                    <ProfileCard tarjeta={previewCard} />
                  </div>
                </section>
              </div>

              <section className={`${panelClass} mt-5`}>
                <h2 className="text-lg font-semibold tracking-[-0.035em]">Tarjetas registradas</h2>
                <div className="mt-4 grid gap-2.5">
                  {cards.map((card) => (
                    <article key={card.slug} className="flex flex-col justify-between gap-3 rounded-xl border border-[#edf0eb] p-3 sm:flex-row sm:items-center sm:px-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{card.nombre || card.slug}</h3>
                        <p className={`mt-1 text-xs ${card.activo ? "text-[#47704e]" : "text-[#a15a5f]"}`}>{card.slug} · {card.activo ? "Activa" : "Suspendida"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => editCard(card)} className="min-h-9 rounded-lg border border-[#dfe5dd] bg-white px-3 text-xs font-medium text-[#344437] hover:bg-[#f8faf7]">Editar</button>
                        <button type="button" disabled={busy} onClick={() => void toggleActive(card)} className="min-h-9 rounded-lg bg-[#20372a] px-3 text-xs font-semibold text-white hover:bg-[#2b4937] disabled:opacity-60">{card.activo ? "Suspender" : "Activar"}</button>
                      </div>
                    </article>
                  ))}
                </div>
                {listMessage && <p role="status" className="mt-3 text-sm text-[#526254]">{listMessage}</p>}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
