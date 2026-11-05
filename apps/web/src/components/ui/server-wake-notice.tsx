"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { API_URL } from "@/lib/api";

type WakeState = "checking" | "waking" | "ready" | "unreachable";

const SLOW_AFTER_MS = 2500;
const GIVE_UP_AFTER_MS = 90_000;

/**
 * The free API host sleeps after 15 idle minutes and takes up to a minute to wake.
 * This pings /health as soon as the login page opens, so the server starts waking
 * while the user types, and explains the wait instead of leaving them guessing.
 */
export function ServerWakeNotice() {
  const [state, setState] = useState<WakeState>("checking");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    const slowTimer = setTimeout(
      () => !cancelled && setState((s) => (s === "checking" ? "waking" : s)),
      SLOW_AFTER_MS,
    );

    async function ping() {
      while (!cancelled && Date.now() - startedAt < GIVE_UP_AFTER_MS) {
        try {
          const response = await fetch(`${API_URL}/health`, {
            cache: "no-store",
          });
          if (response.ok) {
            if (!cancelled) setState("ready");
            return;
          }
        } catch {
          // Still asleep or the network blinked; try again shortly.
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      if (!cancelled) setState("unreachable");
    }

    ping();
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  if (state === "checking" || state === "ready") return null;

  if (state === "unreachable") {
    return (
      <div
        role="alert"
        className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        The server is not responding. Please refresh the page in a moment.
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
      <p>
        Waking up the server. This demo runs on free hosting that sleeps when
        idle, so the first sign in can take up to a minute.
      </p>
    </div>
  );
}
