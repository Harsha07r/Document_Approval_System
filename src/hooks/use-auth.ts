"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { SessionUser } from "@/types";

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => apiFetch<SessionUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
