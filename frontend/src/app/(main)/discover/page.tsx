import { redirect } from "next/navigation";

// Discover was absorbed into Home — the "something like ___" essence answer,
// theatres/OTT, and hidden gems all live on /home now. Redirect old links.
export default function DiscoverPage() {
  redirect("/home");
}
