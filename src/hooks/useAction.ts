"use client";

import { useState } from "react";

export interface ActionStatus {
  text: string;
  error?: boolean;
}

/** Runs an async action with a busy flag and a one-line status message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ActionStatus | null>(null);

  async function run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      if (success) setStatus({ text: success });
      return true;
    } catch (error) {
      setStatus({
        text: error instanceof Error && error.message ? error.message : "Something went wrong.",
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, status, setStatus, run };
}
