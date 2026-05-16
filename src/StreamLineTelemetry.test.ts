import { describe, expect, it } from "vitest";
import { Effect, Layer, Ref } from "effect";
import { Display, type DisplayEntry, SilentDisplay } from "./Display.js";
import { logUnrecognizedLine } from "./StreamLineTelemetry.js";

describe("StreamLineTelemetry", () => {
  describe("logUnrecognizedLine", () => {
    it("calls display.debug with a formatted message for non-empty lines", async () => {
      const ref = Ref.unsafeMake<ReadonlyArray<DisplayEntry>>([]);
      const layer = SilentDisplay.layer(ref);

      await Effect.runPromise(
        logUnrecognizedLine("kimi-code", '{"type":"unknown"}').pipe(
          Effect.provide(layer),
        ),
      );

      const entries = await Effect.runPromise(Ref.get(ref));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        _tag: "debug",
        message: '[kimi-code] Unrecognized line: {"type":"unknown"}',
      });
    });

    it("is a no-op for empty or whitespace-only lines", async () => {
      const ref = Ref.unsafeMake<ReadonlyArray<DisplayEntry>>([]);
      const layer = SilentDisplay.layer(ref);

      await Effect.runPromise(
        Effect.gen(function* () {
          yield* logUnrecognizedLine("kimi-code", "");
          yield* logUnrecognizedLine("kimi-code", "   ");
        }).pipe(Effect.provide(layer)),
      );

      const entries = await Effect.runPromise(Ref.get(ref));
      expect(entries).toHaveLength(0);
    });

    it("trims the line before logging", async () => {
      const ref = Ref.unsafeMake<ReadonlyArray<DisplayEntry>>([]);
      const layer = SilentDisplay.layer(ref);

      await Effect.runPromise(
        logUnrecognizedLine("claude-code", "  some line  ").pipe(
          Effect.provide(layer),
        ),
      );

      const entries = await Effect.runPromise(Ref.get(ref));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        _tag: "debug",
        message: "[claude-code] Unrecognized line: some line",
      });
    });
  });
});
