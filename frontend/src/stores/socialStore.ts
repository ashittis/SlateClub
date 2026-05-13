"use client";

import { create } from "zustand";
import { apiFetch } from "../lib/api";
import type { MicroFeedbackType } from "../types/social";

interface SocialState {
  // Follow
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;

  // Reviews
  submitReview: (movieId: string, body: string, spoiler?: boolean) => Promise<void>;
  markHelpful: (reviewId: string) => Promise<void>;

  // Micro-feedback
  submitMicroFeedback: (movieId: string, type: MicroFeedbackType) => Promise<void>;

  // Calibration
  submitCalibration: (type: string, value: Record<string, unknown>) => Promise<void>;
}

export const useSocialStore = create<SocialState>(() => ({
  followUser: async (userId) => {
    await apiFetch("/api/follows", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  unfollowUser: async (userId) => {
    await apiFetch(`/api/follows/${userId}`, { method: "DELETE" });
  },

  submitReview: async (movieId, body, spoiler = false) => {
    await apiFetch("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ movieId, body, spoiler }),
    });
  },

  markHelpful: async (reviewId) => {
    await apiFetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" });
  },

  submitMicroFeedback: async (movieId, type) => {
    await apiFetch("/api/feedback/micro", {
      method: "POST",
      body: JSON.stringify({ movieId, type }),
    });
  },

  submitCalibration: async (type, value) => {
    await apiFetch("/api/feedback/calibration", {
      method: "POST",
      body: JSON.stringify({ type, value }),
    });
  },
}));
