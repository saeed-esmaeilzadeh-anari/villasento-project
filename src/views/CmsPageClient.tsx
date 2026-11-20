"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CmsPageView, type CmsPageT } from "@/views/CmsPageView";

export function CmsPageClient({ slug, initialData }: { slug: string; initialData?: CmsPageT | null }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <CmsPageView slugOverride={slug} initialData={initialData} />
    </QueryClientProvider>
  );
}
