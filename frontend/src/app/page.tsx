"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    } else if (!user.onboarded) {
      router.replace("/onboarding/languages");
    } else {
      router.replace("/home");
    }
  }, [user, loading, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border"
        style={{
          borderColor: "var(--soot)",
          borderTopColor: "var(--blood)",
        }}
      />
    </div>
  );
}
