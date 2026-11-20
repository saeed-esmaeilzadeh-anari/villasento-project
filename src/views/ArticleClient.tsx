"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArticleView, type ArticleDetailT } from "@/views/ArticlesView";

export function ArticleClient({ slug, initialData }: { slug: string; initialData?: ArticleDetailT | null }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <ArticleView slug={slug} initialData={initialData} suppressJsonLd />
    </QueryClientProvider>
  );
}
