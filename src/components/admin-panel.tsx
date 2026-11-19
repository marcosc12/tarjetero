"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProfileCard, type Tarjeta } from "@/components/profile-card";
import {
  SUPABASE_KEY,
  SUPABASE_URL,
  type AdminSession,
  type SupabaseBrowserClient,
} from "@/lib/supabase-browser";

type FormValues = {
  [Key in keyof Omit<Tarjeta, "activo">]: string;
};

const emptyForm = (): FormValues => ({
  slug: "",
  nombre: "",
  eslogan: "",
  inicial: "",
  whatsapp: "",
  whatsapp_sub: "",
  instagram: "",
  instagram_sub: "",
  ubicacion_url: "",
  ubicacion_sub: "",
});

const fields: Array<{ name: keyof FormValues; label: string; placeholder?: string }> = [
  { name: "slug", label: "Slug", placeholder: "cafe-esquina" },
  { name: "inicial", label: "Inicial", placeholder: "C" },
  { name: "nombre", label: "Nombre del negocio" },
  { name: "eslogan", label: "Eslogan" },
  { name: "whatsapp", label: "WhatsApp (número)", placeholder: "521234567890" },
  { name: "whatsapp_sub", label: "Subtítulo de WhatsApp", placeholder: "Escríbenos" },
  { name: "instagram", label: "Instagram (usuario o URL)", placeholder: "@negocio o URL completa" },
  { name: "instagram_sub", label: "Subtítulo de Instagram", placeholder: "Síguenos" },
  { name: "ubicacion_url", label: "Ubicación (URL o dirección)", placeholder: "URL de Maps o dirección" },
  { name: "ubicacion_sub", label: "Subtítulo de ubicación", placeholder: "Cómo llegar" },
];

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
  const qrCanvas = useRef<HTMLCanvasElement>(null);

  const previewCard = useMemo<Tarjeta>(
    () => ({ ...form, slug: form.slug || "vista-previa", activo: true }),
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
    setSavedLink("");
    setQrDataUrl("");
    setCopyMessage("");
    setFormMessage("");
  }

  function updateField(name: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function editCard(card: Tarjeta) {
    setForm({
      slug: card.slug,
      nombre: card.nombre ?? "",
      eslogan: card.eslogan ?? "",
      inicial: card.inicial ?? "",
      whatsapp: card.whatsapp ?? "",
      whatsapp_sub: card.whatsapp_sub ?? "",
      instagram: card.instagram ?? "",
      instagram_sub: card.instagram_sub ?? "",
      ubicacion_url: card.ubicacion_url ?? "",
      ubicacion_sub: card.ubicacion_sub ?? "",
    });
    setEditing(card);
    setSavedLink("");
    setQrDataUrl("");
    setFormMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const { data, error } = await client
      .from("tarjetas")
      .upsert(
        { ...form, activo: editing?.activo ?? true },
        { onConflict: "slug" },
      )
      .select()
      .single();
    setBusy(false);
    if (error) {
      setFormMessage(`No se pudo guardar la tarjeta: ${error.message}`);
      return;
    }

    setEditing(data);
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
              <p className="mt-1 text-sm text-[#788078]">
                Gestiona enlaces y estados sin volver a desplegar.
              </p>
            </div>
            {authorized && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-[#dfe5dd] bg-white px-4 py-2.5 text-sm font-medium text-[#344437] hover:bg-[#f8faf7]"
              >
                Cerrar sesión
              </button>
            )}
          </header>

          {!authorized ? (
            <section className="mx-auto max-w-md rounded-[1.4rem] border border-[#e8ece6] bg-white p-6 shadow-[0_12px_40px_rgba(31,41,33,0.05)] sm:p-8">
              <h2 className="text-lg font-semibold tracking-[-0.035em]">Iniciar sesión</h2>
              <p className="mt-2 text-sm leading-6 text-[#788078]">
                Inicia sesión con una cuenta de Supabase autorizada para editar tarjetas.
              </p>
              <form className="mt-5 grid gap-4" onSubmit={handleLogin}>
                <label className="grid gap-1.5 text-xs font-semibold text-[#526254]">
                  Correo electrónico
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    className="min-h-11 rounded-xl border border-[#dfe5dd] px-3 text-sm text-[#202b23] outline-none focus:border-[#78927d] focus:ring-2 focus:ring-[#78927d]/15"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#526254]">
                  Contraseña
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="min-h-11 rounded-xl border border-[#dfe5dd] px-3 text-sm text-[#202b23] outline-none focus:border-[#78927d] focus:ring-2 focus:ring-[#78927d]/15"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !client}
                  className="mt-1 min-h-11 rounded-xl bg-[#20372a] px-4 text-sm font-semibold text-white hover:bg-[#2b4937] disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Verificando..." : "Entrar al panel"}
                </button>
              </form>
              {loginMessage && <p role="status" className="mt-4 text-sm text-[#a33e4b]">{loginMessage}</p>}
            </section>
          ) : (
            <>
              <div className="grid items-start gap-5 lg:grid-cols-[1fr_.82fr]">
                <section className="rounded-[1.4rem] border border-[#e8ece6] bg-white p-5 shadow-[0_12px_40px_rgba(31,41,33,0.05)] sm:p-6">
                  <h2 className="text-lg font-semibold tracking-[-0.035em]">
                    {editing ? `Editar tarjeta: ${editing.slug}` : "Crear tarjeta"}
                  </h2>
                  <form className="mt-5" onSubmit={handleSave}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {fields.map(({ name, label, placeholder }) => (
                        <label
                          key={name}
                          className={`grid gap-1.5 text-xs font-semibold text-[#526254] ${
                            ["nombre", "eslogan", "ubicacion_url", "ubicacion_sub"].includes(name)
                              ? "sm:col-span-2"
                              : ""
                          }`}
                        >
                          {label}
                          <input
                            name={name}
                            value={form[name]}
                            onChange={(event) => updateField(name, event.target.value)}
                            placeholder={placeholder}
                            maxLength={name === "inicial" ? 2 : undefined}
                            pattern={name === "slug" ? "[a-z0-9]+(?:-[a-z0-9]+)*" : undefined}
                            required={["slug", "inicial", "nombre"].includes(name)}
                            disabled={name === "slug" && Boolean(editing)}
                            className="min-h-11 w-full rounded-xl border border-[#dfe5dd] px-3 text-sm font-normal text-[#202b23] outline-none placeholder:text-[#a0a9a0] focus:border-[#78927d] focus:ring-2 focus:ring-[#78927d]/15 disabled:bg-[#f4f6f3]"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <button
                        type="submit"
                        disabled={busy}
                        className="min-h-11 rounded-xl bg-[#20372a] px-5 text-sm font-semibold text-white hover:bg-[#2b4937] disabled:cursor-wait disabled:opacity-60"
                      >
                        {busy ? "Guardando..." : editing ? "Guardar cambios" : "Guardar tarjeta"}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="min-h-11 rounded-xl border border-[#dfe5dd] bg-white px-5 text-sm font-medium text-[#344437] hover:bg-[#f8faf7]"
                      >
                        Nueva tarjeta
                      </button>
                    </div>
                  </form>
                  {formMessage && <p role="status" className="mt-3 text-sm text-[#526254]">{formMessage}</p>}
                  {savedLink && (
                    <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[#e8ece6] pt-5">
                      <canvas
                        ref={qrCanvas}
                        aria-label="Código QR de la tarjeta"
                        className="h-40 w-40 rounded-lg border-8 border-white shadow-[0_4px_18px_rgba(0,0,0,0.1)]"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">Código QR</h3>
                        <a
                          href={savedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all text-xs leading-5 text-[#526254] underline underline-offset-2"
                        >
                          {savedLink}
                        </a>
                        <p className="mt-2 text-xs text-[#788078]">{copyMessage}</p>
                        <a
                          href={qrDataUrl || undefined}
                          download={`${form.slug}-qr.png`}
                          aria-disabled={!qrDataUrl}
                          className="mt-3 inline-flex min-h-9 items-center rounded-xl bg-[#20372a] px-3 text-xs font-semibold text-white hover:bg-[#2b4937] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                        >
                          Descargar PNG
                        </a>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-[1.4rem] border border-[#e8ece6] bg-white p-5 shadow-[0_12px_40px_rgba(31,41,33,0.05)] sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold tracking-[-0.035em]">Vista previa</h2>
                  <div className="rounded-[1.6rem] bg-[#f3f5f1] p-5 sm:p-7">
                    <ProfileCard tarjeta={previewCard} />
                  </div>
                </section>
              </div>

              <section className="mt-5 rounded-[1.4rem] border border-[#e8ece6] bg-white p-5 shadow-[0_12px_40px_rgba(31,41,33,0.05)] sm:p-6">
                <h2 className="text-lg font-semibold tracking-[-0.035em]">Tarjetas registradas</h2>
                <div className="mt-4 grid gap-2.5">
                  {cards.map((card) => (
                    <article
                      key={card.slug}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-[#edf0eb] p-3 sm:flex-row sm:items-center sm:px-4"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{card.nombre || card.slug}</h3>
                        <p className={`mt-1 text-xs ${card.activo ? "text-[#47704e]" : "text-[#a15a5f]"}`}>
                          {card.slug} · {card.activo ? "Activa" : "Suspendida"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editCard(card)}
                          className="min-h-9 rounded-lg border border-[#dfe5dd] bg-white px-3 text-xs font-medium text-[#344437] hover:bg-[#f8faf7]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleActive(card)}
                          className="min-h-9 rounded-lg bg-[#20372a] px-3 text-xs font-semibold text-white hover:bg-[#2b4937] disabled:opacity-60"
                        >
                          {card.activo ? "Suspender" : "Activar"}
                        </button>
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
