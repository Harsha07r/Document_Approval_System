import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";

import { DocumentDetailClient } from "./document-detail-client";

interface DocumentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return <DocumentDetailClient documentId={id} currentUser={user} />;
}
