export type ParsedStreamEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "result"; result: string }
  | { type: "tool_call"; name: string; args: string }
  | { type: "session_id"; sessionId: string };

import type { BindMountSandboxHandle } from "./SandboxProvider.js";
import type { SessionStore } from "./SessionStore.js";
import {
  hostSessionStore,
  sandboxSessionStore,
  transferSession,
} from "./SessionStore.js";
import { join, posix } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const shellEscape = (s: string): string => "'" + s.replace(/'/g, "'\\''") + "'";

/** Maps allowlisted tool names to the input field containing the display arg */
const TOOL_ARG_FIELDS: Record<string, string> = {
  Bash: "command",
  WebSearch: "query",
  WebFetch: "url",
  Agent: "description",
};

/**
 * Extract an error message from a parsed JSON error event.
 * Handles { error: "string" }, { error: { message: "string" } }, and { message: "string" }.
 */
const extractErrorMessage = (obj: any): string | undefined => {
  const err = obj.error;
  if (typeof err === "string") return err;
  if (
    typeof err === "object" &&
    err !== null &&
    typeof err.message === "string"
  ) {
    return err.message;
  }
  if (typeof obj.message === "string") return obj.message;
  return undefined;
};

const parseStreamJsonLine = (line: string): ParsedStreamEvent[] => {
  if (!line.startsWith("{")) return [];
  try {
    const obj = JSON.parse(line);
    if (obj.type === "assistant" && Array.isArray(obj.message?.content)) {
      const events: ParsedStreamEvent[] = [];
      const texts: string[] = [];
      for (const block of obj.message.content as {
        type: string;
        text?: string;
        name?: string;
        input?: Record<string, unknown>;
      }[]) {
        if (block.type === "text" && typeof block.text === "string") {
          texts.push(block.text);
        } else if (
          block.type === "tool_use" &&
          typeof block.name === "string" &&
          block.input !== undefined
        ) {
          const argField = TOOL_ARG_FIELDS[block.name];
          if (argField === undefined) continue; // not allowlisted
          const argValue = block.input[argField];
          if (typeof argValue !== "string") continue; // missing/wrong arg field
          if (texts.length > 0) {
            events.push({ type: "text", text: texts.join("") });
            texts.length = 0;
          }
          events.push({
            type: "tool_call",
            name: block.name,
            args: argValue,
          });
        }
      }
      if (texts.length > 0) {
        events.push({ type: "text", text: texts.join("") });
      }
      return events;
    }
    if (obj.type === "result" && typeof obj.result === "string") {
      return [{ type: "result", result: obj.result }];
    }
    if (
      obj.type === "system" &&
      obj.subtype === "init" &&
      typeof obj.session_id === "string"
    ) {
      return [{ type: "session_id", sessionId: obj.session_id }];
    }
  } catch {
    // Not valid JSON — skip
  }
  return [];
};

/** Options passed to buildPrintCommand and buildInteractiveArgs. */
export interface AgentCommandOptions {
  readonly prompt: string;
  readonly dangerouslySkipPermissions: boolean;
  /** When set, the agent should resume the given session ID instead of starting fresh. */
  readonly resumeSession?: string;
}

/** Return type of buildPrintCommand — command string plus optional stdin content.
 *  When `stdin` is set, the sandbox pipes it to the child process's stdin
 *  instead of inlining the prompt in argv, avoiding the Linux 128 KB per-arg limit. */
export interface PrintCommand {
  readonly command: string;
  readonly stdin?: string;
}

/** Per-iteration token usage snapshot extracted from the agent session. */
export interface IterationUsage {
  readonly inputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly outputTokens: number;
}

export interface AgentProvider {
  readonly name: string;
  /** Environment variables injected by this agent provider. Merged at launch time with env resolver and sandbox provider env. */
  readonly env: Record<string, string>;
  /** When true, session capture is enabled for this provider. Default: true for Claude Code, false for others. */
  readonly captureSessions: boolean;
  /** Provider-owned session storage factories. When undefined, session capture is skipped. */
  readonly sessionStorage?: {
    hostStore(cwd: string): SessionStore;
    sandboxStore(
      cwd: string,
      handle: Pick<
        BindMountSandboxHandle,
        "copyFileIn" | "copyFileOut" | "exec"
      >,
    ): SessionStore;
    transfer(from: SessionStore, to: SessionStore, id: string): Promise<void>;
  };
  buildPrintCommand(options: AgentCommandOptions): PrintCommand;
  buildInteractiveArgs?(options: AgentCommandOptions): string[];
  parseStreamLine(line: string): ParsedStreamEvent[];
  /** Parse token usage from the captured session JSONL content. Only implemented by Claude Code. */
  parseSessionUsage?(content: string): IterationUsage | undefined;
}

export const DEFAULT_MODEL = "claude-opus-4-6";

// ---------------------------------------------------------------------------
// Pi agent provider
// ---------------------------------------------------------------------------

const parsePiStreamLine = (line: string): ParsedStreamEvent[] => {
  if (!line.startsWith("{")) return [];
  try {
    const obj = JSON.parse(line);
    if (obj.type === "message_update" && obj.assistantMessageEvent) {
      const evt = obj.assistantMessageEvent as {
        type: string;
        delta?: string;
      };
      if (evt.type === "text_delta" && typeof evt.delta === "string") {
        return [{ type: "text", text: evt.delta }];
      }
      return [];
    }
    if (obj.type === "tool_execution_start") {
      const toolName = obj.toolName;
      if (typeof toolName !== "string") return [];
      const argField = TOOL_ARG_FIELDS[toolName];
      if (argField === undefined) return [];
      const args = obj.args as Record<string, unknown> | undefined;
      if (!args) return [];
      const argValue = args[argField];
      if (typeof argValue !== "string") return [];
      return [{ type: "tool_call", name: toolName, args: argValue }];
    }
    // Pi emits agent_error / error events on stdout (not stderr) for auth
    // failures, rate limits, and API errors. Capture them as result events so
    // the Orchestrator's stderr-empty fallback can surface them to the user.
    if (obj.type === "agent_error" || obj.type === "error") {
      const msg = extractErrorMessage(obj);
      return msg ? [{ type: "result", result: msg }] : [];
    }
    if (obj.type === "agent_end" && Array.isArray(obj.messages)) {
      const messages = obj.messages as {
        role: string;
        content: { type: string; text?: string }[];
      }[];
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg?.role === "assistant") {
          const texts: string[] = [];
          for (const block of msg.content) {
            if (block.type === "text" && typeof block.text === "string") {
              texts.push(block.text);
            }
          }
          if (texts.length > 0) {
            return [{ type: "result", result: texts.join("") }];
          }
          break;
        }
      }
      return [];
    }
  } catch {
    // Not valid JSON — skip
  }
  return [];
};

/** Options for the pi agent provider. */
export interface PiOptions {
  /** Environment variables injected by this agent provider. */
  readonly env?: Record<string, string>;
}

export const pi = (model: string, options?: PiOptions): AgentProvider => ({
  name: "pi",
  env: options?.env ?? {},
  captureSessions: false,

  buildPrintCommand({ prompt }: AgentCommandOptions): PrintCommand {
    return {
      command: `pi -p --mode json --no-session --model ${shellEscape(model)}`,
      stdin: prompt,
    };
  },

  buildInteractiveArgs({ prompt }: AgentCommandOptions): string[] {
    const args = ["pi", "--model", model];
    if (prompt) args.push(prompt);
    return args;
  },

  parseStreamLine(line: string): ParsedStreamEvent[] {
    return parsePiStreamLine(line);
  },
});

// ---------------------------------------------------------------------------
// Codex agent provider
// ---------------------------------------------------------------------------

const parseCodexStreamLine = (line: string): ParsedStreamEvent[] => {
  if (!line.startsWith("{")) return [];
  try {
    const obj = JSON.parse(line);

    // item.completed with agent_message → text + result
    if (
      obj.type === "item.completed" &&
      obj.item?.type === "agent_message" &&
      typeof obj.item.text === "string"
    ) {
      const text = obj.item.text;
      return [
        { type: "text", text },
        { type: "result", result: text },
      ];
    }

    // item.started with command_execution → tool call
    if (
      obj.type === "item.started" &&
      obj.item?.type === "command_execution" &&
      typeof obj.item.command === "string"
    ) {
      return [{ type: "tool_call", name: "Bash", args: obj.item.command }];
    }

    // Codex emits error events on stdout (not stderr) for auth failures,
    // rate limits, and API errors. Capture them as result events so the
    // Orchestrator's stderr-empty fallback can surface them to the user.
    if (obj.type === "error") {
      const msg = extractErrorMessage(obj);
      return msg ? [{ type: "result", result: msg }] : [];
    }

    // turn.completed → skip
  } catch {
    // Not valid JSON — skip
  }
  return [];
};

/** Options for the codex agent provider. */
export interface CodexOptions {
  readonly effort?: "low" | "medium" | "high" | "xhigh";
  /** Environment variables injected by this agent provider. */
  readonly env?: Record<string, string>;
}

export const codex = (
  model: string,
  options?: CodexOptions,
): AgentProvider => ({
  name: "codex",
  env: options?.env ?? {},
  captureSessions: false,

  buildPrintCommand({ prompt }: AgentCommandOptions): PrintCommand {
    const effortFlag = options?.effort
      ? ` -c ${shellEscape(`model_reasoning_effort="${options.effort}"`)}`
      : "";
    return {
      command: `codex exec --json --dangerously-bypass-approvals-and-sandbox -m ${shellEscape(model)}${effortFlag}`,
      stdin: prompt,
    };
  },

  buildInteractiveArgs({ prompt }: AgentCommandOptions): string[] {
    const args = ["codex", "--model", model];
    if (prompt) args.push(prompt);
    return args;
  },

  parseStreamLine(line: string): ParsedStreamEvent[] {
    return parseCodexStreamLine(line);
  },
});

// ---------------------------------------------------------------------------
// OpenCode agent provider
// ---------------------------------------------------------------------------

/** Options for the opencode agent provider. */
export interface OpenCodeOptions {
  /** Provider-specific reasoning effort variant (e.g. "high", "max", "low", "minimal"). */
  readonly variant?: string;
  /** Environment variables injected by this agent provider. */
  readonly env?: Record<string, string>;
}

export const opencode = (
  model: string,
  options?: OpenCodeOptions,
): AgentProvider => ({
  name: "opencode",
  env: options?.env ?? {},
  captureSessions: false,

  buildPrintCommand({ prompt }: AgentCommandOptions): PrintCommand {
    const variantFlag = options?.variant
      ? ` --variant ${shellEscape(options.variant)}`
      : "";
    return {
      command: `opencode run --model ${shellEscape(model)}${variantFlag} ${shellEscape(prompt)}`,
    };
  },

  buildInteractiveArgs({ prompt }: AgentCommandOptions): string[] {
    const args = ["opencode", "--model", model];
    if (prompt) args.push("-p", prompt);
    return args;
  },

  parseStreamLine(_line: string): ParsedStreamEvent[] {
    return [];
  },
});

// ---------------------------------------------------------------------------
// Claude Code agent provider
// ---------------------------------------------------------------------------

export interface ClaudeCodeOptions {
  readonly effort?: "low" | "medium" | "high" | "max";
  /** Environment variables injected by this agent provider. */
  readonly env?: Record<string, string>;
  /** When false, session capture is disabled. Default: true. */
  readonly captureSessions?: boolean;
  /** Override default session directories. */
  readonly sessionPaths?: {
    hostProjectsDir?: string;
    sandboxProjectsDir?: string;
  };
}

export const claudeCode = (
  model: string,
  options?: ClaudeCodeOptions,
): AgentProvider => ({
  name: "claude-code",
  env: options?.env ?? {},
  captureSessions: options?.captureSessions ?? true,

  sessionStorage: {
    hostStore: (cwd: string): SessionStore =>
      hostSessionStore(
        cwd,
        options?.sessionPaths?.hostProjectsDir ??
          join(process.env.HOME ?? "~", ".claude", "projects"),
      ),
    sandboxStore: (
      cwd: string,
      handle: Pick<
        BindMountSandboxHandle,
        "copyFileIn" | "copyFileOut" | "exec"
      >,
    ): SessionStore =>
      sandboxSessionStore(
        cwd,
        handle,
        options?.sessionPaths?.sandboxProjectsDir ??
          posix.join("/home/agent", ".claude", "projects"),
      ),
    transfer: transferSession,
  },

  buildPrintCommand({
    prompt,
    dangerouslySkipPermissions,
    resumeSession,
  }: AgentCommandOptions): PrintCommand {
    const skipPerms = dangerouslySkipPermissions
      ? " --dangerously-skip-permissions"
      : "";
    const effortFlag = options?.effort ? ` --effort ${options.effort}` : "";
    const resumeFlag = resumeSession
      ? ` --resume ${shellEscape(resumeSession)}`
      : "";
    return {
      command: `claude --print --verbose${skipPerms} --output-format stream-json --model ${shellEscape(model)}${effortFlag}${resumeFlag} -p -`,
      stdin: prompt,
    };
  },

  buildInteractiveArgs({
    prompt,
    dangerouslySkipPermissions,
  }: AgentCommandOptions): string[] {
    const args = ["claude"];
    if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
    args.push("--model", model);
    if (options?.effort) args.push("--effort", options.effort);
    if (prompt) args.push(prompt);
    return args;
  },

  parseStreamLine(line: string): ParsedStreamEvent[] {
    return parseStreamJsonLine(line);
  },

  parseSessionUsage(content: string): IterationUsage | undefined {
    const lines = content.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (!line.startsWith("{")) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === "assistant" && obj.message?.usage) {
          const u = obj.message.usage;
          if (
            typeof u.input_tokens === "number" &&
            typeof u.cache_creation_input_tokens === "number" &&
            typeof u.cache_read_input_tokens === "number" &&
            typeof u.output_tokens === "number"
          ) {
            return {
              inputTokens: u.input_tokens,
              cacheCreationInputTokens: u.cache_creation_input_tokens,
              cacheReadInputTokens: u.cache_read_input_tokens,
              outputTokens: u.output_tokens,
            };
          }
        }
      } catch {
        // Not valid JSON — skip
      }
    }
    return undefined;
  },
});

// ---------------------------------------------------------------------------
// Kimi Code agent provider
// ---------------------------------------------------------------------------

/** Kimi tool name → display argument field. */
const KIMI_TOOL_ARGS: Record<string, string> = {
  Shell: "command",
  FetchURL: "url",
  SearchWeb: "query",
  ReadFile: "path",
};

const parseKimiStreamLine = (line: string): ParsedStreamEvent[] => {
  if (!line.startsWith("{")) {
    const m = line.match(/^To resume this session: kimi -r (\S+)/);
    if (m) return [{ type: "session_id", sessionId: m[1]! }];
    return [];
  }

  let obj: any;
  try {
    obj = JSON.parse(line);
  } catch {
    return [];
  }

  // Wire protocol: ContentPart events streamed in real-time
  // (when --input-format stream-json is used)
  if (obj.type === "ContentPart" && obj.payload) {
    const p = obj.payload;
    if (
      p.type === "think" &&
      typeof p.think === "string" &&
      p.think.length > 0
    ) {
      return [{ type: "thinking", text: p.think }];
    }
    if (p.type === "text" && typeof p.text === "string" && p.text.length > 0) {
      return [{ type: "text", text: p.text }];
    }
    return [];
  }

  // Wire protocol: ToolCall events
  if (obj.type === "ToolCall" && obj.payload) {
    const tc = obj.payload;
    if (
      tc.type === "function" &&
      typeof tc.function?.name === "string" &&
      tc.function?.arguments !== undefined
    ) {
      const name: string = tc.function.name;
      const argField = KIMI_TOOL_ARGS[name];
      if (argField) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(tc.function.arguments);
        } catch {
          return [];
        }
        if (typeof parsed === "object" && parsed !== null) {
          const args = (parsed as Record<string, unknown>)[argField];
          if (typeof args === "string") {
            return [{ type: "tool_call", name, args }];
          }
        }
      }
    }
    return [];
  }

  // Legacy print mode: assistant message with content and/or tool calls
  if (obj.role === "assistant") {
    const events: ParsedStreamEvent[] = [];

    // Content can be a plain string or an array of content blocks.
    // With --thinking, think blocks contain the model's reasoning.
    if (Array.isArray(obj.content)) {
      for (const block of obj.content) {
        if (
          block.type === "think" &&
          typeof block.think === "string" &&
          block.think.length > 0
        ) {
          events.push({ type: "thinking", text: block.think });
        } else if (
          block.type === "text" &&
          typeof block.text === "string" &&
          block.text.length > 0
        ) {
          events.push({ type: "text", text: block.text });
        }
      }
    } else if (typeof obj.content === "string" && obj.content.length > 0) {
      events.push({ type: "text", text: obj.content });
    }

    // Tool calls — arguments are a JSON-encoded string
    if (Array.isArray(obj.tool_calls)) {
      for (const tc of obj.tool_calls) {
        if (
          tc.type === "function" &&
          typeof tc.function?.name === "string" &&
          tc.function?.arguments !== undefined
        ) {
          const name: string = tc.function.name;
          const argField = KIMI_TOOL_ARGS[name];
          if (!argField) continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(tc.function.arguments);
          } catch {
            continue;
          }
          if (typeof parsed !== "object" || parsed === null) continue;
          const args = (parsed as Record<string, unknown>)[argField];
          if (typeof args !== "string") continue;

          events.push({ type: "tool_call", name, args });
        }
      }
    }

    return events;
  }

  return [];
};

/** MD5 hash of the working directory, matching Kimi's session storage layout. */
const kimiSessionHash = (cwd: string): string =>
  createHash("md5").update(cwd).digest("hex");

/** Options for the kimi agent provider. */
export interface KimiCodeOptions {
  /** Environment variables injected by this agent provider. */
  readonly env?: Record<string, string>;
  /** Enable thinking mode (model will emit reasoning in stream). Default: true. */
  readonly thinking?: boolean;
  /** When false, session capture is disabled. Default: true. */
  readonly captureSessions?: boolean;
}

export const kimiCode = (
  model: string,
  options?: KimiCodeOptions,
): AgentProvider => ({
  name: "kimi-code",
  env: options?.env ?? {},
  captureSessions: options?.captureSessions ?? true,

  sessionStorage: {
    hostStore: (cwd: string): SessionStore => {
      const hash = kimiSessionHash(cwd);
      const sessionsDir = join(process.env.HOME ?? "~", ".kimi", "sessions");
      return {
        cwd,
        sessionFilePath: (id: string): string =>
          join(sessionsDir, hash, id, "context.jsonl"),
        readSession: async (id: string): Promise<string> =>
          readFile(join(sessionsDir, hash, id, "context.jsonl"), "utf-8"),
        writeSession: async (id: string, content: string): Promise<void> => {
          await mkdir(join(sessionsDir, hash, id), { recursive: true });
          await writeFile(
            join(sessionsDir, hash, id, "context.jsonl"),
            content,
          );
        },
      };
    },
    sandboxStore: (
      cwd: string,
      handle: Pick<
        BindMountSandboxHandle,
        "copyFileIn" | "copyFileOut" | "exec"
      >,
    ): SessionStore => {
      const hash = kimiSessionHash(cwd);
      const sessionsDir = posix.join("/home/agent", ".kimi", "sessions");
      const projectDir = posix.join(sessionsDir, hash);
      return {
        cwd,
        sessionFilePath: (id: string): string =>
          posix.join(projectDir, id, "context.jsonl"),
        readSession: async (id: string): Promise<string> => {
          const sandboxPath = posix.join(projectDir, id, "context.jsonl");
          const tmpPath = join(
            tmpdir(),
            `sandcastle-kimi-${id}-${Date.now()}.jsonl`,
          );
          await handle.copyFileOut(sandboxPath, tmpPath);
          try {
            return await readFile(tmpPath, "utf-8");
          } finally {
            await rm(tmpPath, { force: true }).catch(() => {});
          }
        },
        writeSession: async (id: string, content: string): Promise<void> => {
          const sandboxPath = posix.join(projectDir, id, "context.jsonl");
          const tmpPath = join(
            tmpdir(),
            `sandcastle-kimi-${id}-${Date.now()}.jsonl`,
          );
          await writeFile(tmpPath, content);
          try {
            await handle.exec(
              `mkdir -p ${JSON.stringify(posix.join(projectDir, id))}`,
            );
            await handle.copyFileIn(tmpPath, sandboxPath);
          } finally {
            await rm(tmpPath, { force: true }).catch(() => {});
          }
        },
      };
    },
    transfer: async (
      from: SessionStore,
      to: SessionStore,
      id: string,
    ): Promise<void> => {
      const content = await from.readSession(id);
      await to.writeSession(id, content);
    },
  },

  buildPrintCommand({
    prompt,
    resumeSession,
  }: AgentCommandOptions): PrintCommand {
    const thinking = options?.thinking !== false; // default on
    const thinkingFlag = thinking ? " --thinking" : " --no-thinking";
    const resumeFlag = resumeSession ? ` -r ${shellEscape(resumeSession)}` : "";
    return {
      command: `kimi --print --input-format stream-json --output-format stream-json${thinkingFlag} --model ${shellEscape(model)}${resumeFlag}`,
      stdin: JSON.stringify({ role: "user", content: prompt }) + "\n",
    };
  },

  buildInteractiveArgs({ prompt }: AgentCommandOptions): string[] {
    const thinking = options?.thinking !== false;
    const args = thinking
      ? ["kimi", "--thinking", "--model", model]
      : ["kimi", "--no-thinking", "--model", model];
    if (prompt) args.push(prompt);
    return args;
  },

  parseStreamLine(line: string): ParsedStreamEvent[] {
    return parseKimiStreamLine(line);
  },
});
