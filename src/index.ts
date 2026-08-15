/**
 * learn-as-you-go-dsh — a native DSH (DeepSeek Harness) bundle plugin.
 *
 * The product idea (from the Learn-As-You-Go project): keep the technical
 * output, put the plain-language Chinese meaning directly below it. This is a
 * fresh, DSH-native implementation — no shared core, no pi compatibility, no
 * host-capability contracts. It consumes DSH services directly:
 *
 * - `ctx.systemPrompt.section` — the policy mounts as an ordinary ordered
 *   prompt section, re-evaluated at every prompt assembly (hot updates);
 * - `ctx.settings` — the `learn-as-you-go` namespace (schema-driven settings
 *   UI panel), entry config as the composition base, live applies;
 * - `ctx.commands` — `/learn-as-you-go on|off|status|level 1|2`.
 *
 * The section never sets `complete`, so a complete-persona preset (a section
 * with `complete: true`, e.g. via `dsh-persona`) replaces the whole prompt —
 * the host's own mechanism, no capability abstraction needed.
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import type {} from "@deepseek-ai/dsh-system-prompt";
import type {} from "@deepseek-ai/dsh-commands";

import { isReaderLevel, parseReaderLevel, policyTextForLevel } from "./policy.js";
import type { ReaderLevel } from "./policy.js";

/** Cordis plugin name used by loader diagnostics. */
export const name = "learn-as-you-go-dsh";

/** Required services: prompt section registry, command registry, settings. */
export const inject = ["systemPrompt", "commands", "settings"];

/** Plugin config; also the settings-namespace schema. */
export interface LearnConfig {
  enabled: boolean;
  level: ReaderLevel;
}

export const Config = z.object({
  enabled: z.boolean().default(false),
  level: z
    .union([z.const(1), z.const(2)])
    .default(2),
});

/** Fixed prompt-section identity. */
const SECTION_NAME = "learn-as-you-go:policy";
const SECTION_ORDER = 50;

/** Settings namespace for this plugin (lowercase kebab-case). */
const SETTINGS_NAMESPACE = settingsNamespace("learn-as-you-go");

/** Command display labels (DSH-side copy). */
const LEVEL_LABELS: Record<ReaderLevel, string> = {
  1: "1 · 入门",
  2: "2 · 标准",
};

export function apply(ctx: Context, config: LearnConfig) {
  // Startup banner: the harness attaches no Cordis logger exporter by default,
  // so log the load line to console for startup visibility.
  console.log(
    `[learn-as-you-go-dsh] plugin loaded: section ${SECTION_NAME} (order ${SECTION_ORDER}) registered, settings namespace ${SETTINGS_NAMESPACE}, /learn-as-you-go on|off|status|level 1|2`,
  );

  // Authoritative state: the settings scope while mounted, the entry config
  // otherwise (installSettingsSection re-points the source on attach/detach).
  const entry: LearnConfig = { enabled: config.enabled, level: config.level };
  let source: () => LearnConfig = () => entry;

  installSettingsSection(ctx, SETTINGS_NAMESPACE, Config, entry, {
    setSource: (current) => {
      source = current;
    },
    onChange: () => {
      // The section text provider re-evaluates per assembly, so no
      // re-registration is needed for hot updates.
    },
  });

  // Prompt section: evaluated per assembly. Disabled resolves to an empty
  // text, which renderPrompt drops.
  ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: SECTION_ORDER,
    text: () => {
      const state = source();
      return state.enabled ? policyTextForLevel(state.level) : "";
    },
  });

  ctx.commands.register({
    name: "learn-as-you-go",
    description: "plain-language Chinese explanations for technical output (Learn-As-You-Go)",
    input: { hint: "on|off|status|level 1|2" },
    handler: async (invocation) => {
      const input = invocation.rawInput.trim();
      const current = source();

      if (input === "on" || input === "off") {
        const enabled = input === "on";
        await ctx.settings.update(SETTINGS_NAMESPACE, { enabled });
        return {
          kind: "success",
          text: `Learn-As-You-Go: ${enabled ? "ON" : "OFF"}, level ${current.level} (${LEVEL_LABELS[current.level]})`,
        };
      }

      if (input === "status") {
        const stateLine = `Learn-As-You-Go: ${current.enabled ? "ON" : "OFF"}, level ${current.level} (${LEVEL_LABELS[current.level]})`;
        const mountLine = current.enabled
          ? `prompt section mounted (${SECTION_NAME})`
          : "prompt section not mounted (disabled)";
        return { kind: "success", text: `${stateLine}\n${mountLine}` };
      }

      if (input.startsWith("level ")) {
        const level = parseReaderLevel(input.slice("level ".length));
        if (level === null || !isReaderLevel(level)) {
          return {
            kind: "error",
            text: `Unknown level: "${input.slice("level ".length)}". Use: level 1 | level 2`,
          };
        }
        await ctx.settings.update(SETTINGS_NAMESPACE, { level });
        return {
          kind: "success",
          text: `Learn-As-You-Go: level ${level} (${LEVEL_LABELS[level]})`,
        };
      }

      return {
        kind: "error",
        text: `Unknown arg: "${invocation.rawInput.trim()}". Use: on | off | status | level 1 | level 2`,
      };
    },
  });
}
