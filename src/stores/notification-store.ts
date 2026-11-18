import { create } from "zustand";
import type { NotificationItem } from "@/types";

interface NotificationState {
  items: NotificationItem[];
  loaded: boolean;
  load: () => Promise<void>;
  markAllRead: () => void;
  markRead: (id: string) => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const res = await fetch("/api/notifications");
    if (!res.ok) return; // widget stays empty if unreachable
    const json = (await res.json()) as { items: NotificationItem[] };
    set({ items: json.items ?? [], loaded: true });
  },
  markAllRead: () => {
    const unread = get().items.filter((i) => !i.read);
    set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) }));
    for (const n of unread) {
      void fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    }
  },
  markRead: (id) => {
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
    }));
    void fetch(`/api/notifications/${id}/read`, { method: "POST" });
  },
  unreadCount: () => get().items.filter((i) => !i.read).length,
}));
