import type { CSSProperties, ReactNode } from "react";

export type Tarjeta = {
  slug: string;
  nombre: string | null;
  eslogan: string | null;
  inicial: string | null;
  whatsapp: string | null;
  whatsapp_sub: string | null;
  instagram: string | null;
  instagram_sub: string | null;
  ubicacion_url: string | null;
  ubicacion_sub: string | null;
  activo: boolean;
};

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function actionUrl(value: string | null, kind: "whatsapp" | "instagram" | "maps") {
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
  return absoluteUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanValue)}`;
}

function ActionIcon({ kind }: { kind: "whatsapp" | "instagram" | "maps" }) {
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
  kind: "whatsapp" | "instagram" | "maps";
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

export function ProfileCard({ tarjeta }: { tarjeta: Tarjeta }) {
  const buttonColor = "#202a24";
  const initial = (tarjeta.inicial?.trim() || tarjeta.nombre?.trim().charAt(0) || "N")
    .charAt(0)
    .toLocaleUpperCase("es");

  return (
    <section className="public-profile-card w-full overflow-hidden rounded-[2rem] border border-white/75 bg-white p-7 text-center shadow-[0_24px_80px_rgba(31,41,33,0.12)] backdrop-blur-sm sm:p-9">
      <div
        aria-label={`Inicial de ${tarjeta.nombre || "negocio"}`}
        className="profile-avatar mx-auto grid h-24 w-24 place-items-center rounded-full border-4 border-white text-3xl font-semibold text-white shadow-[0_5px_20px_rgba(20,30,20,0.15)]"
        style={{ backgroundColor: buttonColor }}
      >
        {initial}
      </div>
      <h1 className="profile-card-title mt-5 text-[1.7rem] font-semibold tracking-[-0.055em] text-[#202b23]">
        {tarjeta.nombre || "Nombre del negocio"}
      </h1>
      {tarjeta.eslogan && (
        <p className="profile-card-tagline mx-auto mt-2 max-w-xs text-sm leading-6 text-[#788078]">
          {tarjeta.eslogan}
        </p>
      )}
      {tarjeta.activo === true ? (
        <div className="mt-7 space-y-3">
          <CardAction
            kind="whatsapp"
            title="WhatsApp"
            subtitle={tarjeta.whatsapp_sub}
            value={tarjeta.whatsapp}
            buttonColor={buttonColor}
          />
          <CardAction
            kind="instagram"
            title="Instagram"
            subtitle={tarjeta.instagram_sub}
            value={tarjeta.instagram}
            buttonColor={buttonColor}
          />
          <CardAction
            kind="maps"
            title="Cómo llegar"
            subtitle={tarjeta.ubicacion_sub}
            value={tarjeta.ubicacion_url}
            buttonColor={buttonColor}
          />
        </div>
      ) : (
        <div className="card-suspended mt-7 rounded-2xl border border-[#f0e5e8] bg-[#fbf6f7] px-5 py-4 text-sm leading-6 text-[#806b70]">
          Servicio temporalmente suspendido. Contacta al administrador para reactivarlo.
        </div>
      )}
    </section>
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
