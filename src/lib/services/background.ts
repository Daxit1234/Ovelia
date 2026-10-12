import "server-only";
import { after } from "next/server";

/**
 * Runs non-critical work (emails, cache warmups) after the response is sent.
 * Outside a Next.js request (scripts, tests) the task simply runs detached.
 */
export function runAfter(task: () => Promise<unknown>): void {
  const safe = () => task().catch((error) => console.error("Background task failed", error));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
