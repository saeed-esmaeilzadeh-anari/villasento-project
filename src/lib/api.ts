"use client";

/** Tiny typed fetch wrapper — same-origin, JSON, unified error surface */

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body != null ? { "Content-Type": "application/json" } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error ??
      (res.status === 401 ? "برای این عملیات باید وارد حساب شوید" :
       res.status === 403 ? "شما به این عملیات دسترسی ندارید" :
       res.status === 429 ? "تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید" :
       "خطای ارتباط با سرور");
    throw new ApiClientError(msg, res.status);
  }
  return data as T;
}

export const api = {
  get: <T,>(url: string) => request<T>("GET", url),
  post: <T,>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T,>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  put: <T,>(url: string, body?: unknown) => request<T>("PUT", url, body),
  del: <T,>(url: string) => request<T>("DELETE", url),
};

/** Upload one image with progress callback (XMLHttpRequest for progress events) */
export function uploadImage(file: File, onProgress?: (pct: number) => void, folder = "listings"): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiClientError(data.error ?? "آپلود ناموفق بود", xhr.status));
      } catch {
        reject(new ApiClientError("پاسخ سرور نامعتبر است", xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiClientError("خطای شبکه هنگام آپلود", 0));
    xhr.send(form);
  });
}

// ── Shared types (mirror server payloads) ──
export type Me = {
  id: string; phone: string; fullName: string | null; email: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "AGENT" | "OWNER" | "CUSTOMER" | "HOST";
  isHostVerified: boolean; isBlocked: boolean;
  avatarUrl: string | null; nationalId: string | null;
  hasPassword: boolean;
} | null;

export type AmenityT = { id: string; key: string; name: string; icon: string };

export type PropertyCardT = {
  id: string; code: string; title: string;
  type: string; typeLabel: string;
  transactionType: string; ttLabel: string;
  city: string; province: string; area: string | null;
  landArea: number | null; buildArea: number | null;
  bedrooms: number; bathrooms: number; buildYear: number | null;
  documentStatus: string; docLabel: string;
  salePrice: number | null; rahnAmount: number | null; rentAmount: number | null;
  negotiable: boolean; isFeatured: boolean; viewCount: number;
  publishedAt: string | null; updatedAt: string | null; createdAt: string | null;
  image: string | null; imageCount: number;
  amenities: AmenityT[];
  lat: number | null; lng: number | null;
  ownerName: string | null; verified: boolean;
  contactPreference?: string;
  address?: string;
};

export type OwnerT = {
  kind: "AGENT" | "OWNER";
  id: string; name: string; phone: string; verified: boolean;
  agency: string | null; bio: string | null; photo: string | null; since: string;
};

export type PropertyDetailT = PropertyCardT & {
  description: string;
  floors: number;
  paymentTerms: string | null;
  amenitiesExtra: string[];
  videoUrl: string | null; tourUrl: string | null;
  status: string; rejectionReason: string | null; expiresAt: string | null;
  allAmenities: AmenityT[];
  images: string[];
  owner: OwnerT;
  similar: {
    id: string; code: string; title: string; type: string; transactionType: string;
    city: string; salePrice: number | null; rahnAmount: number | null; rentAmount: number | null;
    bedrooms: number; landArea: number | null; buildArea: number | null;
    image: string | null;
  }[];
  favorited: boolean;
  hostId: string; agentId: string | null;
};

export type SearchResponseT = {
  items: PropertyCardT[];
  total: number; page: number; pageSize: number; totalPages: number;
  pins: { id: string; lat: number | null; lng: number | null }[];
};

export type Lookups = {
  provinces: { id: string; name: string; cities: { id: string; name: string; areas?: { id: string; name: string }[] }[] }[];
  amenities: AmenityT[];
  types: { key: string; name: string }[];
  transactionTypes: { key: string; name: string }[];
  documentStatus: { key: string; name: string }[];
  listingStatus: { key: string; name: string }[];
  contactPrefs: { key: string; name: string }[];
};

export type VisitT = {
  id: string; code: string;
  property: { id: string; title: string; code: string; image: string | null };
  name: string; phone: string; note: string | null;
  preferredAt: string | null; status: string; statusLabel: string;
  assignedTo?: { id: string; name: string } | string | null;
  adminNote?: string | null;
  createdAt: string;
  events?: { type: string; toStatus: string | null; message: string | null; createdAt: string }[];
};
