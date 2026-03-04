export type LiveLifecycleState = "LIVE_ACTIVE" | "LIVE_SCHEDULED" | "LIVE_ENDED";

export function toLiveLifecycleState(value: string | null | undefined): LiveLifecycleState {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "live" || normalized === "active") return "LIVE_ACTIVE";
  if (normalized === "scheduled" || normalized === "pending") return "LIVE_SCHEDULED";
  return "LIVE_ENDED";
}

export function toDbLiveStatus(state: LiveLifecycleState): "live" | "scheduled" | "ended" {
  if (state === "LIVE_ACTIVE") return "live";
  if (state === "LIVE_SCHEDULED") return "scheduled";
  return "ended";
}
