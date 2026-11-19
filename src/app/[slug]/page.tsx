import { redirect } from "next/navigation";

export default async function LegacyCardUrl({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?c=${encodeURIComponent(slug)}`);
}
