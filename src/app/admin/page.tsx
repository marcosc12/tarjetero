import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin-panel";

export const metadata: Metadata = {
  title: "Administrar tarjetas | Tarjetas Digitales",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
