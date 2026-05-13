"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/*
  Legacy route. The 8-step flow folds favourite-films selection
  into /onboarding/origin. Anyone who lands here (bookmark,
  in-flight session) gets bounced.
*/
export default function MoviesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/onboarding/origin");
  }, [router]);
  return null;
}
