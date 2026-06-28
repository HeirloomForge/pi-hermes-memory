import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { MemoryStore } from "../../src/store/memory-store.js";
import {
  applyReviewOperations,
  parseReviewOperations,
} from "../../src/handlers/review-memory-ops.js";

describe("parseReviewOperations", () => {
  it("parses valid JSON operations", () => {
    const parsed = parseReviewOperations(JSON.stringify({
      operations: [
        { action: "add", target: "memory", content: "uses pnpm" },
      ],
    }));

    assert.deepStrictEqual(parsed, [
      { action: "add", target: "memory", content: "uses pnpm" },
    ]);
  });

  it("returns empty array for nothing-to-save text", () => {
    assert.deepStrictEqual(parseReviewOperations("Nothing to save."), []);
  });

  it("returns null for invalid JSON", () => {
    assert.strictEqual(parseReviewOperations("not json at all"), null);
  });

  it("extracts JSON from fenced blocks", () => {
    const parsed = parseReviewOperations("```json\n{\"operations\":[{\"action\":\"add\",\"target\":\"user\",\"content\":\"prefers dark mode\"}]}\n```");
    assert.deepStrictEqual(parsed, [
      { action: "add", target: "user", content: "prefers dark mode" },
    ]);
  });
});

describe("applyReviewOperations", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "review-ops-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("applies add operations to memory store", async () => {
    const store = new MemoryStore({
      memoryDir: tmpDir,
      memoryCharLimit: 5000,
      userCharLimit: 5000,
      autoConsolidate: true,
    });
    await store.loadFromDisk();

    const result = await applyReviewOperations(store, null, [
      { action: "add", target: "memory", content: "prefers biome over eslint" },
    ]);

    assert.strictEqual(result.appliedCount, 1);
    assert.strictEqual(result.skippedCount, 0);
    assert.ok(store.getMemoryEntries().some((entry) => entry.includes("prefers biome over eslint")));
  });

  it("skips project operations when project store is unavailable", async () => {
    const store = new MemoryStore({
      memoryDir: tmpDir,
      memoryCharLimit: 5000,
      userCharLimit: 5000,
      autoConsolidate: true,
    });
    await store.loadFromDisk();

    const result = await applyReviewOperations(store, null, [
      { action: "add", target: "project", content: "api uses /v2" },
    ]);

    assert.strictEqual(result.appliedCount, 0);
    assert.strictEqual(result.skippedCount, 1);
  });
});