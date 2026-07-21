/**
 * Project memory listing — /memory-projects lists the project memory
 * stores and their entry counts. READ-ONLY.
 *
 * The active project store is bound from process.cwd() at extension
 * load and cannot be switched in-place: tools, instructions, skills,
 * session storage, and memory would desync. To work in another
 * project's context, spawn a fresh process in that project's checkout.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { MemoryConfig } from "../types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveProjectsRoot } from "../paths.js";

export function registerMemoryProjectsCommand(pi: ExtensionAPI, config?: MemoryConfig): void {
  const projectsMemoryDir = config?.projectsMemoryDir ?? "projects-memory";
  pi.registerCommand("memory-projects", {
    description:
      "List project memory stores (read-only). Does NOT switch session context — spawn a worker in the project's checkout to switch context.",

    async handler(_args, ctx) {
      const projectsDir = resolveProjectsRoot(projectsMemoryDir);

      // Discover all project directories (subdirectories of projects-memory/ that have MEMORY.md)
      let projects: string[] = [];
      try {
        const entries = await fs.readdir(projectsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          try {
            await fs.access(path.join(projectsDir, entry.name, "MEMORY.md"));
            projects.push(entry.name);
          } catch { /* no MEMORY.md — skip */ }
        }
      } catch {
        // Directory doesn't exist — no projects
      }

      if (projects.length === 0) {
        ctx.ui.notify(
          "\n  📁 No project memories found.\n\n  Project memory is automatically created when you use the memory tool with\n  target 'project' while working in a project directory.\n",
          "info",
        );
        return;
      }

      const lines: string[] = [];
      lines.push("");
      lines.push("  ╔══════════════════════════════════════════════╗");
      lines.push("  ║        📁 Project Memory — Stores           ║");
      lines.push("  ╚══════════════════════════════════════════════╝");
      lines.push("");
      lines.push("  Available project memories:");
      lines.push("");

      for (const proj of projects.sort()) {
        // Read entry count
        let entryCount = 0;
        try {
          const raw = await fs.readFile(path.join(projectsDir, proj, "MEMORY.md"), "utf-8");
          entryCount = raw.split("\n§\n").filter(Boolean).length;
        } catch { /* ignore */ }

        lines.push(`  📁 ${proj} (${entryCount} ${entryCount === 1 ? "entry" : "entries"})`);
      }

      lines.push("");
      lines.push("  Use the memory tool with target 'project' to manage");
      lines.push("  project-scoped memory. Project is auto-detected from");
      lines.push(`  your current directory: ${process.cwd()}`);

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
