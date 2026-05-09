import { describe, expect, it } from "vitest";
import { claudeCode, codex, kimiCode, opencode, pi } from "./AgentProvider.js";
import type { AgentCommandOptions } from "./AgentProvider.js";

/** Shorthand: build options with dangerouslySkipPermissions: true (mirrors existing sandbox callers). */
const opts = (prompt: string): AgentCommandOptions => ({
  prompt,
  dangerouslySkipPermissions: true,
});

describe("claudeCode factory", () => {
  it("returns a provider with name 'claude-code'", () => {
    const provider = claudeCode("claude-opus-4-6");
    expect(provider.name).toBe("claude-code");
  });

  it("does not expose envManifest or dockerfileTemplate", () => {
    const provider = claudeCode("claude-opus-4-6");
    expect(provider).not.toHaveProperty("envManifest");
    expect(provider).not.toHaveProperty("dockerfileTemplate");
  });

  it("buildPrintCommand includes the model", () => {
    const provider = claudeCode("claude-sonnet-4-6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("claude-sonnet-4-6");
    expect(command).toContain("--output-format stream-json");
    expect(command).toContain("--print");
  });

  it("buildPrintCommand delivers prompt via stdin, not argv", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command, stdin } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("-p -");
    expect(command).not.toContain("'do something'");
    expect(stdin).toBe("do something");
  });

  it("buildPrintCommand shell-escapes the model", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("--model 'claude-opus-4-6'");
  });

  it("parseStreamLine extracts text from assistant message", () => {
    const provider = claudeCode("claude-opus-4-6");
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello world" }] },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("parseStreamLine extracts result from result message", () => {
    const provider = claudeCode("claude-opus-4-6");
    const line = JSON.stringify({
      type: "result",
      result: "Final answer <promise>COMPLETE</promise>",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      {
        type: "result",
        result: "Final answer <promise>COMPLETE</promise>",
      },
    ]);
  });

  it("parseStreamLine returns empty array for non-JSON lines", () => {
    const provider = claudeCode("claude-opus-4-6");
    expect(provider.parseStreamLine("not json")).toEqual([]);
    expect(provider.parseStreamLine("")).toEqual([]);
  });

  it("parseStreamLine extracts tool_use block (Bash → command arg)", () => {
    const provider = claudeCode("claude-opus-4-6");
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Bash", input: { command: "npm test" } },
        ],
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "Bash", args: "npm test" },
    ]);
  });

  it("parseStreamLine bakes model into each provider instance independently", () => {
    const provider1 = claudeCode("model-a");
    const provider2 = claudeCode("model-b");
    expect(provider1.buildPrintCommand(opts("test")).command).toContain(
      "model-a",
    );
    expect(provider2.buildPrintCommand(opts("test")).command).toContain(
      "model-b",
    );
    expect(provider1.buildPrintCommand(opts("test")).command).not.toContain(
      "model-b",
    );
  });

  it("buildPrintCommand includes --effort when specified", () => {
    const provider = claudeCode("claude-opus-4-6", { effort: "high" });
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("--effort high");
  });

  it("buildPrintCommand omits --effort when not specified", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("--effort");
  });

  it("buildPrintCommand omits --effort when options is empty", () => {
    const provider = claudeCode("claude-opus-4-6", {});
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("--effort");
  });

  it("supports all effort levels", () => {
    for (const effort of ["low", "medium", "high", "max"] as const) {
      const provider = claudeCode("claude-opus-4-6", { effort });
      expect(provider.buildPrintCommand(opts("test")).command).toContain(
        `--effort ${effort}`,
      );
    }
  });

  it("accepts an env option and exposes it on the provider", () => {
    const provider = claudeCode("claude-opus-4-6", {
      env: { ANTHROPIC_API_KEY: "sk-test" },
    });
    expect(provider.env).toEqual({ ANTHROPIC_API_KEY: "sk-test" });
  });

  it("defaults env to empty object when not provided", () => {
    const provider = claudeCode("claude-opus-4-6");
    expect(provider.env).toEqual({});
  });

  // --- dangerouslySkipPermissions conditional tests ---

  it("buildPrintCommand includes --dangerously-skip-permissions when true", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
    });
    expect(command).toContain("--dangerously-skip-permissions");
  });

  it("parseStreamLine emits session_id from Claude Code init line", () => {
    const provider = claudeCode("claude-opus-4-6");
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "abc-123-def",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "session_id", sessionId: "abc-123-def" },
    ]);
  });

  it("parseStreamLine ignores system events without subtype init", () => {
    const provider = claudeCode("claude-opus-4-6");
    const line = JSON.stringify({
      type: "system",
      subtype: "other",
      session_id: "abc-123-def",
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine ignores system init without session_id", () => {
    const provider = claudeCode("claude-opus-4-6");
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("buildPrintCommand includes --resume when resumeSession is set", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
      resumeSession: "abc-123",
    });
    expect(command).toContain("--resume 'abc-123'");
  });

  it("buildPrintCommand omits --resume when resumeSession is not set", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
    });
    expect(command).not.toContain("--resume");
  });

  it("buildPrintCommand omits --dangerously-skip-permissions when false", () => {
    const provider = claudeCode("claude-opus-4-6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: false,
    });
    expect(command).not.toContain("--dangerously-skip-permissions");
  });

  it("buildInteractiveArgs includes --dangerously-skip-permissions when true", () => {
    const provider = claudeCode("claude-opus-4-6");
    const args = provider.buildInteractiveArgs!({
      prompt: "test",
      dangerouslySkipPermissions: true,
    });
    expect(args).toContain("--dangerously-skip-permissions");
  });

  it("buildInteractiveArgs omits --dangerously-skip-permissions when false", () => {
    const provider = claudeCode("claude-opus-4-6");
    const args = provider.buildInteractiveArgs!({
      prompt: "test",
      dangerouslySkipPermissions: false,
    });
    expect(args).not.toContain("--dangerously-skip-permissions");
  });
});

// ---------------------------------------------------------------------------
// pi factory
// ---------------------------------------------------------------------------

describe("pi factory", () => {
  it("returns a provider with name 'pi'", () => {
    const provider = pi("claude-sonnet-4-6");
    expect(provider.name).toBe("pi");
  });

  it("does not expose envManifest or dockerfileTemplate", () => {
    const provider = pi("claude-sonnet-4-6");
    expect(provider).not.toHaveProperty("envManifest");
    expect(provider).not.toHaveProperty("dockerfileTemplate");
  });

  it("buildPrintCommand includes the model and pi flags", () => {
    const provider = pi("claude-sonnet-4-6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("claude-sonnet-4-6");
    expect(command).toContain("--mode json");
    expect(command).toContain("--no-session");
    expect(command).toContain("-p");
  });

  it("buildPrintCommand delivers prompt via stdin, not argv", () => {
    const provider = pi("claude-sonnet-4-6");
    const { command, stdin } = provider.buildPrintCommand(opts("it's a test"));
    expect(command).not.toContain("it's a test");
    expect(stdin).toBe("it's a test");
  });

  it("buildPrintCommand shell-escapes the model", () => {
    const provider = pi("claude-sonnet-4-6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("--model 'claude-sonnet-4-6'");
  });

  it("parseStreamLine extracts text from message_update event", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: "Hello world" },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("parseStreamLine extracts tool call from tool_execution_start event", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "tool_execution_start",
      toolName: "Bash",
      args: { command: "npm test" },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "Bash", args: "npm test" },
    ]);
  });

  it("parseStreamLine skips non-allowlisted tools", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "tool_execution_start",
      toolName: "UnknownTool",
      args: { foo: "bar" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine extracts result from agent_end event", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "agent_end",
      messages: [
        { role: "user", content: [{ type: "text", text: "Do the thing" }] },
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Final answer <promise>COMPLETE</promise>",
            },
          ],
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      {
        type: "result",
        result: "Final answer <promise>COMPLETE</promise>",
      },
    ]);
  });

  it("parseStreamLine does not emit session_id for system init lines", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "abc-123",
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine returns empty array for non-JSON lines", () => {
    const provider = pi("claude-sonnet-4-6");
    expect(provider.parseStreamLine("not json")).toEqual([]);
    expect(provider.parseStreamLine("")).toEqual([]);
  });

  it("parseStreamLine returns empty array for unrecognized event types", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({ type: "unknown_event", data: "foo" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine returns empty array for malformed JSON", () => {
    const provider = pi("claude-sonnet-4-6");
    expect(provider.parseStreamLine("{bad json")).toEqual([]);
  });

  it("parseStreamLine handles message_update with missing content", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({ type: "message_update" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine handles tool_execution_start with missing fields", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "tool_execution_start",
      toolName: "Bash",
      // no args field
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("bakes model into each provider instance independently", () => {
    const provider1 = pi("model-a");
    const provider2 = pi("model-b");
    expect(provider1.buildPrintCommand(opts("test")).command).toContain(
      "model-a",
    );
    expect(provider2.buildPrintCommand(opts("test")).command).toContain(
      "model-b",
    );
    expect(provider1.buildPrintCommand(opts("test")).command).not.toContain(
      "model-b",
    );
  });

  it("parseStreamLine captures agent_error event with string error as result", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "agent_error",
      error: "Authentication failed: invalid API key",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      {
        type: "result",
        result: "Authentication failed: invalid API key",
      },
    ]);
  });

  it("parseStreamLine captures agent_error event with object error as result", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "agent_error",
      error: { message: "Rate limit exceeded", code: "rate_limit" },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      {
        type: "result",
        result: "Rate limit exceeded",
      },
    ]);
  });

  it("parseStreamLine captures error event with string message as result", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "error",
      message: "Internal server error",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      {
        type: "result",
        result: "Internal server error",
      },
    ]);
  });

  it("parseStreamLine captures error event with string error field as result", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "error",
      error: "Connection refused",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      {
        type: "result",
        result: "Connection refused",
      },
    ]);
  });

  it("parseStreamLine returns empty array for agent_error with no extractable message", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "agent_error",
      // no error field
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine returns empty array for error event with no extractable message", () => {
    const provider = pi("claude-sonnet-4-6");
    const line = JSON.stringify({
      type: "error",
      // no message or error field
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("accepts an env option and exposes it on the provider", () => {
    const provider = pi("claude-sonnet-4-6", { env: { PI_KEY: "abc" } });
    expect(provider.env).toEqual({ PI_KEY: "abc" });
  });

  it("defaults env to empty object when not provided", () => {
    const provider = pi("claude-sonnet-4-6");
    expect(provider.env).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// codex factory
// ---------------------------------------------------------------------------

describe("codex factory", () => {
  it("returns a provider with name 'codex'", () => {
    const provider = codex("gpt-5.4-mini");
    expect(provider.name).toBe("codex");
  });

  it("does not expose envManifest or dockerfileTemplate", () => {
    const provider = codex("gpt-5.4-mini");
    expect(provider).not.toHaveProperty("envManifest");
    expect(provider).not.toHaveProperty("dockerfileTemplate");
  });

  it("buildPrintCommand includes the model and --json flag", () => {
    const provider = codex("gpt-5.4-mini");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("gpt-5.4-mini");
    expect(command).toContain("--json");
  });

  it("buildPrintCommand delivers prompt via stdin, not argv", () => {
    const provider = codex("gpt-5.4-mini");
    const { command, stdin } = provider.buildPrintCommand(opts("it's a test"));
    expect(command).not.toContain("it's a test");
    expect(stdin).toBe("it's a test");
  });

  it("buildPrintCommand shell-escapes the model", () => {
    const provider = codex("gpt-5.4-mini");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("-m 'gpt-5.4-mini'");
  });

  it("buildPrintCommand includes model reasoning effort config when specified", () => {
    const provider = codex("gpt-5.4-mini", { effort: "high" });
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain(`-c 'model_reasoning_effort="high"'`);
  });

  it("buildPrintCommand omits model reasoning effort config when not specified", () => {
    const provider = codex("gpt-5.4-mini");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("model_reasoning_effort");
  });

  it("supports all codex effort levels", () => {
    for (const effort of ["low", "medium", "high", "xhigh"] as const) {
      const provider = codex("gpt-5.4-mini", { effort });
      expect(provider.buildPrintCommand(opts("test")).command).toContain(
        `model_reasoning_effort="${effort}"`,
      );
    }
  });
  it("parseStreamLine extracts text and result from item.completed agent_message", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "Hello world" },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Hello world" },
      { type: "result", result: "Hello world" },
    ]);
  });

  it("parseStreamLine extracts tool call from item.started command_execution", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.started",
      item: { type: "command_execution", command: "npm test" },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "Bash", args: "npm test" },
    ]);
  });

  it("parseStreamLine skips turn.completed events", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({ type: "turn.completed" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine returns empty array for non-JSON lines", () => {
    const provider = codex("gpt-5.4-mini");
    expect(provider.parseStreamLine("not json")).toEqual([]);
    expect(provider.parseStreamLine("")).toEqual([]);
  });

  it("parseStreamLine returns empty array for unrecognized event types", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({ type: "unknown_event", data: "foo" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine returns empty array for malformed JSON", () => {
    const provider = codex("gpt-5.4-mini");
    expect(provider.parseStreamLine("{bad json")).toEqual([]);
  });

  it("parseStreamLine handles item.completed with missing text", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine does not extract from item.content (array form), only item.text", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        content: [{ type: "text", text: "from content array" }],
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine handles item.started with missing command", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.started",
      item: { type: "command_execution" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine handles item.completed with non-agent_message type", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.completed",
      item: { type: "other_type", content: "foo" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine handles item.started with non-command_execution type", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "item.started",
      item: { type: "other_type", command: "foo" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("bakes model into each provider instance independently", () => {
    const provider1 = codex("model-a");
    const provider2 = codex("model-b");
    expect(provider1.buildPrintCommand(opts("test")).command).toContain(
      "model-a",
    );
    expect(provider2.buildPrintCommand(opts("test")).command).toContain(
      "model-b",
    );
    expect(provider1.buildPrintCommand(opts("test")).command).not.toContain(
      "model-b",
    );
  });

  // --- error event parsing tests ---

  it("parseStreamLine captures error event with nested error object as result", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "error",
      error: { type: "server_error", message: "Internal server error" },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "result", result: "Internal server error" },
    ]);
  });

  it("parseStreamLine captures error event with string error as result", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "error",
      error: "Authentication failed: invalid API key",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "result", result: "Authentication failed: invalid API key" },
    ]);
  });

  it("parseStreamLine captures error event with top-level message as result", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "error",
      message: "Rate limit exceeded",
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "result", result: "Rate limit exceeded" },
    ]);
  });

  it("parseStreamLine returns empty array for error event with no extractable message", () => {
    const provider = codex("gpt-5.4-mini");
    const line = JSON.stringify({
      type: "error",
      code: "unknown",
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("accepts an env option and exposes it on the provider", () => {
    const provider = codex("gpt-5.4-mini", { env: { OPENAI_KEY: "xyz" } });
    expect(provider.env).toEqual({ OPENAI_KEY: "xyz" });
  });

  it("defaults env to empty object when not provided", () => {
    const provider = codex("gpt-5.4-mini");
    expect(provider.env).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// opencode factory
// ---------------------------------------------------------------------------

describe("opencode factory", () => {
  it("returns a provider with name 'opencode'", () => {
    const provider = opencode("opencode/big-pickle");
    expect(provider.name).toBe("opencode");
  });

  it("does not expose envManifest or dockerfileTemplate", () => {
    const provider = opencode("opencode/big-pickle");
    expect(provider).not.toHaveProperty("envManifest");
    expect(provider).not.toHaveProperty("dockerfileTemplate");
  });

  it("buildPrintCommand includes the model and prompt in command (no stdin)", () => {
    const provider = opencode("opencode/big-pickle");
    const { command, stdin } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("opencode run");
    expect(command).toContain("opencode/big-pickle");
    expect(command).toContain("'do something'");
    expect(stdin).toBeUndefined();
  });

  it("buildPrintCommand does not include --format json", () => {
    const provider = opencode("opencode/big-pickle");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("--format json");
    expect(command).not.toContain("--format");
  });

  it("buildPrintCommand shell-escapes the prompt", () => {
    const provider = opencode("opencode/big-pickle");
    const { command } = provider.buildPrintCommand(opts("it's a test"));
    expect(command).toContain("'it'\\''s a test'");
  });

  it("buildPrintCommand shell-escapes the model", () => {
    const provider = opencode("opencode/big-pickle");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("--model 'opencode/big-pickle'");
  });

  it("buildPrintCommand includes --variant when specified", () => {
    const provider = opencode("opencode/big-pickle", { variant: "high" });
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("--variant 'high'");
  });

  it("buildPrintCommand omits --variant when not specified", () => {
    const provider = opencode("opencode/big-pickle");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("--variant");
  });

  it("buildPrintCommand omits --variant when options is empty", () => {
    const provider = opencode("opencode/big-pickle", {});
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("--variant");
  });

  it("passes through arbitrary variant values to the CLI flag", () => {
    for (const variant of ["low", "high", "max", "minimal", "custom-value"]) {
      const provider = opencode("opencode/big-pickle", { variant });
      expect(provider.buildPrintCommand(opts("test")).command).toContain(
        "--variant",
      );
    }
  });

  it("buildPrintCommand shell-escapes the variant value", () => {
    const provider = opencode("opencode/big-pickle", {
      variant: "it's tricky",
    });
    const { command } = provider.buildPrintCommand(opts("test"));
    expect(command).toContain("--variant 'it'\\''s tricky'");
  });

  it("parseStreamLine returns empty array for all input (raw passthrough)", () => {
    const provider = opencode("opencode/big-pickle");
    expect(provider.parseStreamLine("some output text")).toEqual([]);
    expect(provider.parseStreamLine("")).toEqual([]);
    expect(
      provider.parseStreamLine(JSON.stringify({ type: "text", text: "hi" })),
    ).toEqual([]);
  });

  it("parseStreamLine returns empty array for non-JSON lines", () => {
    const provider = opencode("opencode/big-pickle");
    expect(provider.parseStreamLine("not json")).toEqual([]);
  });

  it("parseStreamLine returns empty array for malformed JSON", () => {
    const provider = opencode("opencode/big-pickle");
    expect(provider.parseStreamLine("{bad json")).toEqual([]);
  });

  it("bakes model into each provider instance independently", () => {
    const provider1 = opencode("model-a");
    const provider2 = opencode("model-b");
    expect(provider1.buildPrintCommand(opts("test")).command).toContain(
      "model-a",
    );
    expect(provider2.buildPrintCommand(opts("test")).command).toContain(
      "model-b",
    );
    expect(provider1.buildPrintCommand(opts("test")).command).not.toContain(
      "model-b",
    );
  });

  it("accepts an env option and exposes it on the provider", () => {
    const provider = opencode("opencode/big-pickle", {
      env: { OPENCODE_API_KEY: "sk-test" },
    });
    expect(provider.env).toEqual({ OPENCODE_API_KEY: "sk-test" });
  });

  it("defaults env to empty object when not provided", () => {
    const provider = opencode("opencode/big-pickle");
    expect(provider.env).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// kimiCode factory
// ---------------------------------------------------------------------------

describe("kimiCode factory", () => {
  it("returns a provider with name 'kimi-code'", () => {
    const provider = kimiCode("kimi-k2.6");
    expect(provider.name).toBe("kimi-code");
  });

  it("does not expose envManifest or dockerfileTemplate", () => {
    const provider = kimiCode("kimi-k2.6");
    expect(provider).not.toHaveProperty("envManifest");
    expect(provider).not.toHaveProperty("dockerfileTemplate");
  });

  it("buildPrintCommand includes the model, --input-format, and --output-format stream-json", () => {
    const provider = kimiCode("kimi-k2.6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("kimi-k2.6");
    expect(command).toContain("--input-format stream-json");
    expect(command).toContain("--output-format stream-json");
    expect(command).toContain("--print");
  });

  it("buildPrintCommand delivers prompt as JSONL via stdin, not argv", () => {
    const provider = kimiCode("kimi-k2.6");
    const { command, stdin } = provider.buildPrintCommand(opts("it's a test"));
    expect(command).not.toContain("it's a test");
    expect(stdin).toBe(
      JSON.stringify({ role: "user", content: "it's a test" }) + "\n",
    );
  });

  it("buildPrintCommand does NOT use -p flag for stdin (Kimi reads stdin directly)", () => {
    const provider = kimiCode("kimi-k2.6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).not.toContain("-p -");
  });

  it("buildPrintCommand shell-escapes the model", () => {
    const provider = kimiCode("kimi-k2.6");
    const { command } = provider.buildPrintCommand(opts("do something"));
    expect(command).toContain("--model 'kimi-k2.6'");
  });

  it("bakes model into each provider instance independently", () => {
    const provider1 = kimiCode("model-a");
    const provider2 = kimiCode("model-b");
    expect(provider1.buildPrintCommand(opts("test")).command).toContain(
      "model-a",
    );
    expect(provider2.buildPrintCommand(opts("test")).command).toContain(
      "model-b",
    );
    expect(provider1.buildPrintCommand(opts("test")).command).not.toContain(
      "model-b",
    );
  });

  // --- parseStreamLine: text content ---

  it("parseStreamLine extracts text from assistant message", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({ role: "assistant", content: "Hello world" });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("parseStreamLine skips empty assistant content string", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({ role: "assistant", content: "" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  // --- parseStreamLine: tool calls ---

  it("parseStreamLine extracts Shell tool call with command arg", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_1",
          function: {
            name: "Shell",
            arguments: JSON.stringify({ command: "npm test" }),
          },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "Shell", args: "npm test" },
    ]);
  });

  it("parseStreamLine extracts FetchURL tool call with url arg", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_2",
          function: {
            name: "FetchURL",
            arguments: JSON.stringify({ url: "https://example.com" }),
          },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "FetchURL", args: "https://example.com" },
    ]);
  });

  it("parseStreamLine extracts SearchWeb tool call with query arg", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_3",
          function: {
            name: "SearchWeb",
            arguments: JSON.stringify({ query: "latest docs" }),
          },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "SearchWeb", args: "latest docs" },
    ]);
  });

  it("parseStreamLine extracts ReadFile tool call with path arg", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_4",
          function: {
            name: "ReadFile",
            arguments: JSON.stringify({ path: "/tmp/test.txt" }),
          },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "ReadFile", args: "/tmp/test.txt" },
    ]);
  });

  it("parseStreamLine emits text AND tool calls when both present", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: "Let me check...",
      tool_calls: [
        {
          type: "function",
          id: "tc_5",
          function: {
            name: "Shell",
            arguments: JSON.stringify({ command: "ls" }),
          },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Let me check..." },
      { type: "tool_call", name: "Shell", args: "ls" },
    ]);
  });

  it("parseStreamLine skips non-allowlisted Kimi tools", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_6",
          function: {
            name: "UnknownTool",
            arguments: JSON.stringify({ foo: "bar" }),
          },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  // --- parseStreamLine: session ID ---

  it("parseStreamLine extracts session_id from resume hint line", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = "To resume this session: kimi -r sess_abc123";
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "session_id", sessionId: "sess_abc123" },
    ]);
  });

  it("parseStreamLine ignores other non-JSON lines", () => {
    const provider = kimiCode("kimi-k2.6");
    expect(provider.parseStreamLine("Some random output")).toEqual([]);
  });

  // --- parseStreamLine: edge cases ---

  it("parseStreamLine skips role=tool messages (tool results)", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "tool",
      content: "file contents here",
      tool_call_id: "tc_1",
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine returns empty array for non-JSON lines", () => {
    const provider = kimiCode("kimi-k2.6");
    expect(provider.parseStreamLine("not json")).toEqual([]);
    expect(provider.parseStreamLine("")).toEqual([]);
  });

  it("parseStreamLine returns empty array for malformed JSON", () => {
    const provider = kimiCode("kimi-k2.6");
    expect(provider.parseStreamLine("{bad json")).toEqual([]);
  });

  it("parseStreamLine handles tool_calls with missing function name", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_1",
          function: { arguments: JSON.stringify({ command: "ls" }) },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine handles tool_calls with invalid JSON arguments", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_1",
          function: { name: "Shell", arguments: "{bad json" },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine handles null arguments", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [],
      tool_calls: [
        {
          type: "function",
          id: "tc_1",
          function: { name: "Shell", arguments: null },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("accepts an env option and exposes it on the provider", () => {
    const provider = kimiCode("kimi-k2.6", {
      env: { KIMI_API_KEY: "sk-test" },
    });
    expect(provider.env).toEqual({ KIMI_API_KEY: "sk-test" });
  });

  it("defaults env to empty object when not provided", () => {
    const provider = kimiCode("kimi-k2.6");
    expect(provider.env).toEqual({});
  });

  it("buildPrintCommand includes --thinking by default", () => {
    const provider = kimiCode("kimi-k2.6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
    });
    expect(command).toContain("--thinking");
    expect(command).not.toContain("--no-thinking");
  });

  it("buildPrintCommand includes --no-thinking when thinking: false", () => {
    const provider = kimiCode("kimi-k2.6", { thinking: false });
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
    });
    expect(command).toContain("--no-thinking");
    expect(command).not.toContain(" --thinking");
  });

  it("parseStreamLine extracts thinking from think content block", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [
        {
          type: "think",
          think: "Let me think about this step by step.",
          encrypted: null,
        },
        { type: "text", text: "The answer is 42." },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "thinking", text: "Let me think about this step by step." },
      { type: "text", text: "The answer is 42." },
    ]);
  });

  it("parseStreamLine handles thinking-only content (no text block)", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [
        {
          type: "think",
          think: "I need to run a command to check.",
          encrypted: null,
        },
      ],
      tool_calls: [
        {
          type: "function",
          id: "call_1",
          function: { name: "Shell", arguments: '{"command": "ls"}' },
        },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "thinking", text: "I need to run a command to check." },
      { type: "tool_call", name: "Shell", args: "ls" },
    ]);
  });

  it("parseStreamLine handles think block with empty or null think field", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      role: "assistant",
      content: [
        { type: "think", think: "", encrypted: null },
        { type: "text", text: "Done." },
      ],
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Done." },
    ]);
  });

  // --- Wire protocol: ContentPart events ---

  it("parseStreamLine extracts thinking from Wire ContentPart think event", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ContentPart",
      payload: { type: "think", think: "I should check the file first." },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "thinking", text: "I should check the file first." },
    ]);
  });

  it("parseStreamLine extracts text from Wire ContentPart text event", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ContentPart",
      payload: { type: "text", text: "Let me run that command." },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "text", text: "Let me run that command." },
    ]);
  });

  it("parseStreamLine skips Wire ContentPart with empty think text", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ContentPart",
      payload: { type: "think", think: "" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ContentPart with empty text", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ContentPart",
      payload: { type: "text", text: "" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ContentPart with unknown payload type", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ContentPart",
      payload: { type: "image", url: "https://example.com/img.png" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ContentPart with missing payload", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({ type: "ContentPart" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  // --- Wire protocol: ToolCall events ---

  it("parseStreamLine extracts Shell tool call from Wire ToolCall event", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_1",
        function: {
          name: "Shell",
          arguments: JSON.stringify({ command: "npm install" }),
        },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "Shell", args: "npm install" },
    ]);
  });

  it("parseStreamLine extracts FetchURL tool call from Wire ToolCall event", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_2",
        function: {
          name: "FetchURL",
          arguments: JSON.stringify({ url: "https://example.com" }),
        },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "FetchURL", args: "https://example.com" },
    ]);
  });

  it("parseStreamLine extracts SearchWeb tool call from Wire ToolCall event", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_3",
        function: {
          name: "SearchWeb",
          arguments: JSON.stringify({ query: "latest docs" }),
        },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "SearchWeb", args: "latest docs" },
    ]);
  });

  it("parseStreamLine extracts ReadFile tool call from Wire ToolCall event", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_4",
        function: {
          name: "ReadFile",
          arguments: JSON.stringify({ path: "/tmp/test.txt" }),
        },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([
      { type: "tool_call", name: "ReadFile", args: "/tmp/test.txt" },
    ]);
  });

  it("parseStreamLine skips Wire ToolCall with non-allowlisted tool name", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_5",
        function: {
          name: "UnknownTool",
          arguments: JSON.stringify({ foo: "bar" }),
        },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ToolCall with invalid JSON arguments", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_6",
        function: { name: "Shell", arguments: "{bad json" },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ToolCall with missing function name", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: {
        type: "function",
        id: "call_7",
        function: { arguments: JSON.stringify({ command: "ls" }) },
      },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ToolCall with missing payload", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({ type: "ToolCall" });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });

  it("parseStreamLine skips Wire ToolCall with non-function payload type", () => {
    const provider = kimiCode("kimi-k2.6");
    const line = JSON.stringify({
      type: "ToolCall",
      payload: { type: "other", name: "Shell", arguments: "{}" },
    });
    expect(provider.parseStreamLine(line)).toEqual([]);
  });
});

describe("resumeSession on non-Claude providers", () => {
  it("pi ignores resumeSession in buildPrintCommand", () => {
    const provider = pi("claude-sonnet-4-6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
      resumeSession: "abc-123",
    });
    expect(command).not.toContain("--resume");
    expect(command).not.toContain("abc-123");
  });

  it("codex ignores resumeSession in buildPrintCommand", () => {
    const provider = codex("gpt-5.4-mini");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
      resumeSession: "abc-123",
    });
    expect(command).not.toContain("--resume");
    expect(command).not.toContain("abc-123");
  });

  it("opencode ignores resumeSession in buildPrintCommand", () => {
    const provider = opencode("opencode/big-pickle");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
      resumeSession: "abc-123",
    });
    expect(command).not.toContain("--resume");
    expect(command).not.toContain("abc-123");
  });

  it("kimiCode ignores resumeSession in buildPrintCommand", () => {
    const provider = kimiCode("kimi-k2.6");
    const { command } = provider.buildPrintCommand({
      prompt: "test",
      dangerouslySkipPermissions: true,
      resumeSession: "abc-123",
    });
    expect(command).not.toContain("--resume");
    expect(command).not.toContain("abc-123");
  });
});

describe("parseSessionUsage (Claude Code)", () => {
  const provider = claudeCode("claude-opus-4-6");

  it("extracts usage from the last assistant message in a JSONL string", () => {
    const content = [
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-opus-4-6",
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 200,
            cache_read_input_tokens: 300,
            output_tokens: 50,
          },
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-opus-4-6",
          usage: {
            input_tokens: 3,
            cache_creation_input_tokens: 9294,
            cache_read_input_tokens: 8526,
            output_tokens: 458,
          },
        },
      }),
    ].join("\n");

    expect(provider.parseSessionUsage!(content)).toEqual({
      inputTokens: 3,
      cacheCreationInputTokens: 9294,
      cacheReadInputTokens: 8526,
      outputTokens: 458,
    });
  });

  it("returns undefined for empty content", () => {
    expect(provider.parseSessionUsage!("")).toBeUndefined();
  });

  it("returns undefined for content with no assistant messages", () => {
    const content = [
      JSON.stringify({ type: "system", subtype: "init", session_id: "abc" }),
      JSON.stringify({ type: "result", result: "done" }),
    ].join("\n");
    expect(provider.parseSessionUsage!(content)).toBeUndefined();
  });

  it("returns undefined when assistant message has no usage block", () => {
    const content = JSON.stringify({
      type: "assistant",
      message: {
        model: "claude-opus-4-6",
        content: [{ type: "text", text: "hi" }],
      },
    });
    expect(provider.parseSessionUsage!(content)).toBeUndefined();
  });

  it("returns undefined for malformed JSON lines", () => {
    const content = "not json\n{bad json\n";
    expect(provider.parseSessionUsage!(content)).toBeUndefined();
  });

  it("skips malformed lines and finds valid assistant message", () => {
    const content = [
      "not json",
      JSON.stringify({
        type: "assistant",
        message: {
          model: "claude-opus-4-6",
          usage: {
            input_tokens: 10,
            cache_creation_input_tokens: 20,
            cache_read_input_tokens: 30,
            output_tokens: 40,
          },
        },
      }),
    ].join("\n");

    expect(provider.parseSessionUsage!(content)).toEqual({
      inputTokens: 10,
      cacheCreationInputTokens: 20,
      cacheReadInputTokens: 30,
      outputTokens: 40,
    });
  });

  it("is not defined on pi provider", () => {
    expect(pi("model").parseSessionUsage).toBeUndefined();
  });

  it("is not defined on codex provider", () => {
    expect(codex("model").parseSessionUsage).toBeUndefined();
  });

  it("is not defined on opencode provider", () => {
    expect(opencode("model").parseSessionUsage).toBeUndefined();
  });

  it("is not defined on kimiCode provider", () => {
    expect(kimiCode("model").parseSessionUsage).toBeUndefined();
  });
});

describe("captureSessions flag", () => {
  it("claudeCode defaults captureSessions to true", () => {
    expect(claudeCode("claude-opus-4-6").captureSessions).toBe(true);
  });

  it("claudeCode allows opting out of captureSessions", () => {
    expect(
      claudeCode("claude-opus-4-6", { captureSessions: false }).captureSessions,
    ).toBe(false);
  });

  it("pi has captureSessions false", () => {
    expect(pi("pi-model").captureSessions).toBe(false);
  });

  it("codex has captureSessions false", () => {
    expect(codex("codex-model").captureSessions).toBe(false);
  });

  it("opencode has captureSessions false", () => {
    expect(opencode("opencode-model").captureSessions).toBe(false);
  });

  it("kimiCode has captureSessions false", () => {
    expect(kimiCode("kimi-model").captureSessions).toBe(false);
  });
});
