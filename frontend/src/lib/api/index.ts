/**
 * Typed API domain modules — the only way components talk to the backend.
 *
 * Each module owns its endpoint strings and a query-key factory, so renaming a
 * route touches one file instead of every call site. Import from the specific
 * module (`@/lib/api/search`) rather than this barrel where you can.
 */
export { apiFetch, tmdbImage } from "./client";
export * from "./types";
export { searchApi, searchKeys } from "./search";
export { notificationsApi, notificationKeys } from "./notifications";
export { messagesApi, messageKeys } from "./messages";
export { filmsApi, filmKeys, filmHref, tmdbIdFromSlug } from "./films";
export { diaryApi, diaryKeys, formatViewingDate, todayISO } from "./diary";
export { onboardingApi, onboardingKeys } from "./onboarding";
