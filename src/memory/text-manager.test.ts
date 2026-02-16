import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { getMemorySearchManager } from "./search-manager.js";

const roots: string[] = [];

async function makeWorkspace(): Promise<string> {
  const root = path.join(os.tmpdir(), `openclaw-text-memory-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0, roots.length).map(async (root) => {
      await fs.rm(root, { recursive: true, force: true });
    }),
  );
});

describe("TextMemoryManager", () => {
  it("searches memory markdown with pure text backend", async () => {
    const workspace = await makeWorkspace();
    await fs.writeFile(
      path.join(workspace, "MEMORY.md"),
      ["# Notes", "", "OpenClaw supports lightweight text memory backend.", "BM25 retrieval works."].join(
        "\n",
      ),
      "utf-8",
    );

    const cfg = {
      agents: {
        defaults: {
          workspace,
          memorySearch: {
            enabled: true,
            provider: "openai",
          },
        },
      },
      memory: {
        backend: "text",
      },
    } as OpenClawConfig;

    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.error).toBeUndefined();
    expect(result.manager).toBeTruthy();
    if (!result.manager) {
      throw new Error("manager missing");
    }

    const hits = await result.manager.search("lightweight backend");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toBe("MEMORY.md");
    expect(hits[0]?.score).toBeGreaterThan(0);

    const status = result.manager.status();
    expect(status.backend).toBe("text");
    expect(status.provider).toBe("text");

    await result.manager.close?.();
  });
});
