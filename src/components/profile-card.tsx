import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

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
  links?: TarjetaLink[] | null;
  whatsapp: string | null;
  whatsapp_sub: string | null;
  instagram: string | null;
  instagram_sub: string | null;
  ubicacion_url: string | null;
  ubicacion_sub: string | null;
  activo: boolean;
};

export type TarjetaLink = {
  id: string;
  tipo: "whatsapp" | "instagram" | "maps" | "web" | "phone";
  titulo: string;
  subtitulo: string;
  url: string;
};

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
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

export function ProfileCard({ tarjeta }: { tarjeta: Tarjeta }) {
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

  return (
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
      {tarjeta.activo === true ? (
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
