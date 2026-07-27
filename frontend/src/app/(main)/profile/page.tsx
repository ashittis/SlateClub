"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";
import type { Movie } from "@/types/movie";
import type { PublicProfile } from "@/types/user";
import type { SlateCard as SlateCardType } from "@/types/slates";
import TasteIdentityCard from "@/components/taste/TasteIdentityCard";
import TribeLabel from "@/components/taste/TribeLabel";
import ProfileHero from "@/components/profile/ProfileHero";
import FavoriteFilms from "@/components/profile/FavoriteFilms";
import RecentActivityRow from "@/components/profile/RecentActivityRow";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ProfileSidebar from "@/components/profile/ProfileSidebar";

interface WatchedMovie extends Movie {
  watchedAt?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuthStore();

  const { data: profile } = useQuery<PublicProfile>({
    queryKey: ["profile", "me"],
    queryFn: () => apiFetch<PublicProfile>("/api/users/me/profile"),
    enabled: !!user,
  });

  const { data: watchedList } = useQuery<WatchedMovie[]>({
    queryKey: ["profile", "watched"],
    queryFn: () => apiFetch<WatchedMovie[]>("/api/users/me/watched"),
    enabled: !!user,
  });

  const { data: dnfList } = useQuery<Movie[]>({
    queryKey: ["profile", "dnf"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/dnf"),
    enabled: !!user,
  });

  const { data: watchingList } = useQuery<Movie[]>({
    queryKey: ["profile", "watching"],
    queryFn: () => apiFetch<Movie[]>("/api/users/me/watching"),
    enabled: !!user,
  });

  const { data: slatesList } = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates", "mine"],
    queryFn: () => apiFetch("/api/slates/mine"),
    enabled: !!user,
  });

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="h-20 w-20 animate-pulse rounded-full bg-glass-8" />
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded bg-glass-8" />
            <div className="h-3 w-24 animate-pulse rounded bg-glass-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <p className="mb-4 text-glass-40">Please log in to view your profile.</p>
        <Link href="/login" className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-accent-green/90">
          Log in
        </Link>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const filmsThisYear = (watchedList ?? []).filter(
    (m) => m.watchedAt && new Date(m.watchedAt).getFullYear() === currentYear,
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <ProfileHero
        user={user}
        profile={profile ?? null}
        filmsThisYear={filmsThisYear}
        onSignOut={handleLogout}
      />

      <div className="mb-6"><TribeLabel /></div>

      {/* Wrapped entry — a Spotify-style yearly recap. */}
      <Link
        href="/wrapped"
        className="group mb-6 flex items-center justify-between overflow-hidden rounded-2xl px-5 py-4 transition-transform hover:scale-[1.01]"
        style={{
          background: "linear-gradient(110deg, #95122C 0%, #FF9408 100%)",
          boxShadow: "0 8px 30px rgba(255,148,8,0.25)",
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
            SlateClub Wrapped
          </p>
          <p className="text-lg font-bold text-white">
            Your {currentYear} in film
            {filmsThisYear > 0 ? ` · ${filmsThisYear} logged` : ""}
          </p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-6 w-6 shrink-0 text-white transition-transform group-hover:translate-x-1">
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* Two-column: library on the left, sidebar on the right (lg+). */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <FavoriteFilms />
          <RecentActivityRow userId={user.id} />
          <ProfileTabs
            profile={profile ?? null}
            watchingCount={watchingList?.length ?? 0}
            dnfCount={dnfList?.length ?? 0}
            listsCount={slatesList?.items.length ?? 0}
          />
        </div>

        <div className="space-y-8">
          <TasteIdentityCard />
          <ProfileSidebar />
        </div>
      </div>
    </div>
  );
}
