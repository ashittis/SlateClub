"use client";

import { create } from "zustand";

interface FeedState {
  sessionMood: string | null;
  sessionMoodExpiry: number | null;
  setSessionMood: (mood: string | null) => void;
  clearExpiredMood: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  sessionMood: null,
  sessionMoodExpiry: null,

  setSessionMood: (mood) => {
    if (mood) {
      set({
        sessionMood: mood,
        sessionMoodExpiry: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      });
    } else {
      set({ sessionMood: null, sessionMoodExpiry: null });
    }
  },

  clearExpiredMood: () => {
    const { sessionMoodExpiry } = get();
    if (sessionMoodExpiry && Date.now() > sessionMoodExpiry) {
      set({ sessionMood: null, sessionMoodExpiry: null });
    }
  },
}));
