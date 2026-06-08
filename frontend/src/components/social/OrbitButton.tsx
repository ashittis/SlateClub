"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Props {
  userId: string;
}

type OrbitStatus = "self" | "none" | "outgoing" | "incoming" | "orbiting";
interface StatusResp {
  status: OrbitStatus;
  requestId?: string;
}

/*
  OrbitButton — friend request/accept control. Sends an orbit request, shows
  "Requested" while pending, "Accept" when the other person already requested,
  and "Orbiting" once mutual (click to remove).
*/
export default function OrbitButton({ userId }: Props) {
  const qc = useQueryClient();

  const { data } = useQuery<StatusResp>({
    queryKey: ["orbit-status", userId],
    queryFn: () => apiFetch(`/api/orbits/status/${userId}`),
    staleTime: 0,
  });
  const status = data?.status ?? "none";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["orbit-status", userId] });
    qc.invalidateQueries({ queryKey: ["orbit-requests"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const request = useMutation({
    mutationFn: () =>
      apiFetch(`/api/orbits/request`, { method: "POST", body: JSON.stringify({ userId }) }),
    onSuccess: refresh,
  });
  const accept = useMutation({
    mutationFn: () =>
      apiFetch(`/api/orbits/requests/${data?.requestId}/accept`, { method: "POST" }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/orbits/${userId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  if (status === "self") return null;

  const gradient = {
    background: "var(--cta-gradient)",
    boxShadow: "var(--cta-glow)",
    color: "#fff",
  } as const;
  const subtle = {
    background: "var(--bg-elevated)",
    color: "var(--text-muted)",
    border: "1px solid rgba(255,255,255,0.1)",
  } as const;

  const base = "rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60";

  if (status === "orbiting") {
    return (
      <button className={base} style={subtle} onClick={() => remove.mutate()} disabled={remove.isPending}>
        ✓ Orbiting
      </button>
    );
  }
  if (status === "incoming") {
    return (
      <button className={base} style={gradient} onClick={() => accept.mutate()} disabled={accept.isPending}>
        Accept orbit
      </button>
    );
  }
  if (status === "outgoing") {
    return (
      <button className={base} style={subtle} disabled>
        Requested
      </button>
    );
  }
  return (
    <button className={base} style={gradient} onClick={() => request.mutate()} disabled={request.isPending}>
      + Add to Orbit
    </button>
  );
}
