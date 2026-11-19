import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarjetas Digitales | Tu negocio, siempre a un toque",
  description:
    "Tarjetas digitales y códigos QR profesionales para negocios locales. Comparte tus enlaces y conecta con tus clientes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
