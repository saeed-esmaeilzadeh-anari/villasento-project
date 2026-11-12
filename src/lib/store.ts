"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, type Me, type PropertyCardT } from "./api";

// ── Auth store ──
type AuthState = {
  me: Me;
  loading: boolean;
  authOpen: boolean;
  authReason: string | null;
  fetchMe: () => Promise<void>;
  setMe: (u: Me) => void;
  logout: () => Promise<void>;
  openAuth: (reason?: string) => void;
  closeAuth: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loading: true,
  authOpen: false,
  authReason: null,
  fetchMe: async () => {
    set({ loading: true });
    try {
      const me = await api.get<Me>("/api/auth/me");
      set({ me, loading: false });
    } catch {
      set({ me: null, loading: false });
    }
  },
  setMe: (u) => set({ me: u }),
  logout: async () => {
    await api.post("/api/auth/logout");
    set({ me: null });
  },
  openAuth: (reason) => set({ authOpen: true, authReason: reason ?? null }),
  closeAuth: () => set({ authOpen: false, authReason: null }),
}));

// ── Search draft (shared with SearchBox → /search) ──
export type SearchDraft = {
  tt: string; // SALE | RAHN | RAHN_RENT | RENT | ""
  typeId: string;
  q: string;
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
  areaId: string;
  set: (patch: Partial<Omit<SearchDraft, "set" | "reset">>) => void;
  reset: () => void;
};

const initialSearch = {
  tt: "",
  typeId: "",
  q: "",
  provinceId: "",
  provinceName: "",
  cityId: "",
  cityName: "",
  areaId: "",
};

export const useSearch = create<SearchDraft>((set) => ({
  ...initialSearch,
  set: (patch) => set(patch),
  reset: () => set({ ...initialSearch }),
}));

// ── Compare store (persisted, max 4) ──
type CompareState = {
  ids: string[];
  items: Record<string, { id: string; title: string; image: string | null }>;
  toggle: (p: { id: string; title: string; image: string | null }) => { added: boolean };
  remove: (id: string) => void;
  clear: () => void;
};

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      items: {},
      toggle: (p) => {
        const { ids, items } = get();
        if (ids.includes(p.id)) {
          const nextIds = ids.filter((x) => x !== p.id);
          const nextItems = { ...items };
          delete nextItems[p.id];
          set({ ids: nextIds, items: nextItems });
          return { added: false };
        }
        if (ids.length >= 4) return { added: false };
        set({ ids: [...ids, p.id], items: { ...items, [p.id]: p } });
        return { added: true };
      },
      remove: (id) => {
        const { ids, items } = get();
        const nextItems = { ...items };
        delete nextItems[id];
        set({ ids: ids.filter((x) => x !== id), items: nextItems });
      },
      clear: () => set({ ids: [], items: {} }),
    }),
    { name: "villasento-compare" }
  )
);

// ── Recently viewed (persisted; keeps last 20 ids) ──
type HistoryState = {
  ids: string[];
  push: (id: string) => void;
  clear: () => void;
};

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      ids: [],
      push: (id) => {
        const ids = [id, ...get().ids.filter((x) => x !== id)].slice(0, 20);
        set({ ids });
      },
      clear: () => set({ ids: [] }),
    }),
    { name: "villasento-history" }
  )
);

export type { PropertyCardT };
