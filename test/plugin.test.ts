// Integration tests: the plugin mounted into a real Cordis context with the
// real DSH services it consumes (SystemPrompt, SettingsProvider, CommandRuntime).
// No mocks — this is the closest thing to the harness without booting it.

import assert from "node:assert/strict";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { SystemPrompt } from "@deepseek-ai/dsh-system-prompt";
import {
  SettingsProvider,
  settingsNamespace,
} from "@deepseek-ai/dsh-settings";
import type { SettingsNamespace } from "@deepseek-ai/dsh-settings";
import { CommandRuntime } from "@deepseek-ai/dsh-commands";

import { apply, Config, inject, name } from "../src/index.ts";
import { POLICY_TEXT_L1, POLICY_TEXT_L2 } from "../src/policy.ts";

const NS = settingsNamespace("learn-as-you-go");
const SECTION_NAME = "learn-as-you-go:policy";

/** In-memory settings provider: real resolution/write path, no file I/O. */
class MemorySettingsProvider extends SettingsProvider {
  readonly writable = true;
  private doc: Record<string, unknown> = {};

  protected async load(): Promise<Record<string, unknown>> {
    return this.doc;
  }

  protected async persist(
    ns: SettingsNamespace,
    section: Record<string, unknown>,
  ): Promise<void> {
    this.doc = { ...this.doc, [ns]: section };
  }
}

interface Harness {
  ctx: Context;
  dispose: () => Promise<void>;
}

async function mount(config: { enabled: boolean; level: 1 | 2 }): Promise<Harness> {
  const ctx = new Context();
  const fibers = [
    ctx.plugin(SystemPrompt, { persona: "Test persona." }),
    ctx.plugin(MemorySettingsProvider),
    ctx.plugin(CommandRuntime),
    ctx.plugin({ name, apply, inject, Config }, config),
  ];
  await Promise.all(fibers);
  return {
    ctx,
    dispose: async () => {
      await Promise.all(fibers.map((fiber) => fiber.dispose()));
    },
  };
}

/** The Learn-As-You-Go section's resolved text in the latest assembly. */
async function policySectionText(ctx: Context): Promise<string> {
  const assembly = await ctx.systemPrompt.assemble();
  const section = assembly.sections.find((s) => s.name === SECTION_NAME);
  assert.ok(section, `section ${SECTION_NAME} present in assembly`);
  return section.text;
}

function invocation(rawInput: string) {
  return {
    commandId: "test-cmd",
    agent: {},
    rawInput,
    signal: new AbortController().signal,
  } as never;
}

test("plugin/shape: name, inject and Config defaults", () => {
  assert.equal(name, "learn-as-you-go-dsh");
  assert.deepEqual(inject, ["systemPrompt", "commands", "settings"]);
  assert.deepEqual(Config({}), { enabled: false, level: 2 });
  assert.deepEqual(Config({ enabled: true }), { enabled: true, level: 2 });
  assert.deepEqual(Config({ level: 1 }), { enabled: false, level: 1 });
});

test("plugin/section: enabled L2 mounts exactly the L2 body", async () => {
  const h = await mount({ enabled: true, level: 2 });
  try {
    assert.equal(await policySectionText(h.ctx), POLICY_TEXT_L2);
  } finally {
    await h.dispose();
  }
});

test("plugin/section: enabled L1 mounts exactly the L1 body", async () => {
  const h = await mount({ enabled: true, level: 1 });
  try {
    assert.equal(await policySectionText(h.ctx), POLICY_TEXT_L1);
  } finally {
    await h.dispose();
  }
});

test("plugin/section: disabled resolves to empty text (dropped at render)", async () => {
  const h = await mount({ enabled: false, level: 2 });
  try {
    assert.equal(await policySectionText(h.ctx), "");
  } finally {
    await h.dispose();
  }
});

test("plugin/section: ordinary section — never complete, no persona slot", async () => {
  const h = await mount({ enabled: true, level: 2 });
  try {
    const assembly = await h.ctx.systemPrompt.assemble();
    const section = assembly.sections.find((s) => s.name === SECTION_NAME);
    assert.ok(section);
    assert.equal((section as { complete?: boolean }).complete, undefined);
    assert.notEqual(section.name, "deployment:persona");
  } finally {
    await h.dispose();
  }
});

test("plugin/settings: namespace resolves through schema + entry base", async () => {
  const h = await mount({ enabled: true, level: 1 });
  try {
    assert.deepEqual(h.ctx.settings.get(NS), { enabled: true, level: 1 });
  } finally {
    await h.dispose();
  }
});

test("plugin/hot-update: settings change re-evaluates the section text", async () => {
  const h = await mount({ enabled: true, level: 2 });
  try {
    assert.equal(await policySectionText(h.ctx), POLICY_TEXT_L2);

    await h.ctx.settings.update(NS, { level: 1 });
    assert.equal(await policySectionText(h.ctx), POLICY_TEXT_L1);

    await h.ctx.settings.update(NS, { enabled: false });
    assert.equal(await policySectionText(h.ctx), "");
  } finally {
    await h.dispose();
  }
});

test("plugin/command: registered with on|off|status|level hint", async () => {
  const h = await mount({ enabled: false, level: 2 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);
    assert.ok(command.description.length > 0);
    assert.deepEqual(command.input, { hint: "on|off|status|level 1|2" });
  } finally {
    await h.dispose();
  }
});

test("plugin/command-on: persists enabled through the settings scope", async () => {
  const h = await mount({ enabled: false, level: 2 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);
    const result = await command.handler(invocation("on"));
    assert.equal(result.kind, "success");
    assert.deepEqual(h.ctx.settings.get(NS), { enabled: true, level: 2 });
  } finally {
    await h.dispose();
  }
});

test("plugin/command-off: persists disabled through the settings scope", async () => {
  const h = await mount({ enabled: true, level: 2 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);
    const result = await command.handler(invocation("off"));
    assert.equal(result.kind, "success");
    assert.deepEqual(h.ctx.settings.get(NS), { enabled: false, level: 2 });
  } finally {
    await h.dispose();
  }
});

test("plugin/command-level: persists the reader level", async () => {
  const h = await mount({ enabled: true, level: 2 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);

    const result = await command.handler(invocation("level 1"));
    assert.equal(result.kind, "success");
    assert.deepEqual(h.ctx.settings.get(NS), { enabled: true, level: 1 });

    const bad = await command.handler(invocation("level 3"));
    assert.equal(bad.kind, "error");
    assert.deepEqual(h.ctx.settings.get(NS), { enabled: true, level: 1 }, "invalid level rejected, no write");
  } finally {
    await h.dispose();
  }
});

test("plugin/command-status: reports state and mount decision", async () => {
  const h = await mount({ enabled: true, level: 1 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);
    const result = await command.handler(invocation("status"));
    assert.equal(result.kind, "success");
    const text = (result as { text: string }).text;
    assert.match(text, /ON, level 1 \(1 · 入门\)/);
    assert.match(text, /prompt section mounted \(learn-as-you-go:policy\)/);
  } finally {
    await h.dispose();
  }
});

test("plugin/command-status: disabled reports not-mounted", async () => {
  const h = await mount({ enabled: false, level: 2 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);
    const result = await command.handler(invocation("status"));
    assert.equal(result.kind, "success");
    const text = (result as { text: string }).text;
    assert.match(text, /OFF, level 2 \(2 · 标准\)/);
    assert.match(text, /prompt section not mounted \(disabled\)/);
  } finally {
    await h.dispose();
  }
});

test("plugin/command-unknown: rejects with usage", async () => {
  const h = await mount({ enabled: false, level: 2 });
  try {
    const command = h.ctx.commands.find({} as never, "learn-as-you-go");
    assert.ok(command);
    const result = await command.handler(invocation("banana"));
    assert.equal(result.kind, "error");
  } finally {
    await h.dispose();
  }
});

test("plugin/load-log: startup banner reports plugin load", async () => {
  const original = console.log;
  const captured: string[] = [];
  console.log = (...args: unknown[]) => captured.push(args.map(String).join(" "));
  try {
    const h = await mount({ enabled: false, level: 2 });
    await h.dispose();
  } finally {
    console.log = original;
  }
  assert.ok(
    captured.some((line) => line.startsWith("[learn-as-you-go-dsh] plugin loaded")),
  );
});
