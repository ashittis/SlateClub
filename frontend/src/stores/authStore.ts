"use client";

import { create } from "zustand";
import type { User } from "../types/user";
import { apiFetch } from "../lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { email: string; password: string; name: string; username: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const user = await apiFetch<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    set({ user });
  },

  signup: async (data) => {
    const user = await apiFetch<User>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set({ user });
  },

  logout: async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const user = await apiFetch<User>("/api/auth/me");
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
