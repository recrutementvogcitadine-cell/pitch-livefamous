import { redirect } from "next/navigation";

type PageParams = { id?: string } | Promise<{ id?: string }>;

export default async function LiveDetailsPage({ params }: { params: PageParams }) {
  const resolved = await params;
  const id = resolved?.id?.trim();

  if (!id) {
    redirect("/lives");
  }

  redirect(`/agora-test?channel=${encodeURIComponent(id)}&autojoin=spectator`);
}
