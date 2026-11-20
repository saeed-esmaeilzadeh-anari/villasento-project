"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropertyView } from "@/views/PropertyView";
import type { PropertyDetailT } from "@/lib/api";

/** QueryClientProvider shell for SSR-rendered views (the hash-SPA root provider is not mounted on clean routes) */
export function PropertyDetailClient({ id, initialData }: { id: string; initialData?: PropertyDetailT }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <PropertyView idOverride={id} initialData={initialData} suppressJsonLd />
    </QueryClientProvider>
  );
}
