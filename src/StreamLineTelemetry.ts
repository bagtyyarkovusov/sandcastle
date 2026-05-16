import { Effect } from "effect";
import { Display } from "./Display.js";

/**
 * Log an unrecognized stream line at debug level through the Display service.
 * Called by the Orchestrator when a provider's parseStreamLine returns []
 * for a non-empty line.
 */
export const logUnrecognizedLine = (
  providerName: string,
  line: string,
): Effect.Effect<void, never, Display> =>
  Effect.gen(function* () {
    const display = yield* Display;
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      yield* display.debug(`[${providerName}] Unrecognized line: ${trimmed}`);
    }
  });
