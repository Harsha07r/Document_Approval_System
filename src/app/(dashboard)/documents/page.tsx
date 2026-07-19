import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";

import { DocumentsClient } from "./documents-client";

export default async function DocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <DocumentsClient currentUser={user} />;
}
