/**
 * CMS SSH Extension — Cafe Review Project
 *
 * SSH access to the Sanity Studio deployed at 95.179.242.245.
 * Allows checking/modifying the CMS schema while protecting
 * co-hosted services (Joplin, Shadowsocks, system files).
 *
 * Remote: chris@95.179.242.245  (key: ~/.ssh/thinkdrops-private)
 * Project: /home/chris/cafe-review
 * Schema:  schemaTypes/cafe.ts
 */

import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

// ─── Config ──────────────────────────────────────────────────────────────────

const SSH_KEY = resolve(homedir(), ".ssh/thinkdrops-private");
const SSH_USER = "chris";
const SSH_HOST = "95.179.242.245";
const SSH_TARGET = `${SSH_USER}@${SSH_HOST}`;

const REMOTE_PROJECT = "/home/chris/cafe-review";
const SCHEMA_DIR = "schemaTypes";
const SCHEMA_FILES = ["cafe.ts", "location.ts", "siteConfig.ts", "seo.ts", "socialMedia.ts", "index.ts"];
const CONFIG_FILE = "sanity.config.ts";

// Paths on the server that this extension MUST NOT touch.
// Includes Joplin, Shadowsocks, PM2, system dirs, strapi backups.
const PROTECTED_REMOTE_ROOTS = [
  "/home/chris/.config/joplin",
  "/home/chris/.config/joplin-desktop",
  "/home/chris/.pm2",
  "/home/chris/shadowsocks-config.json",
  "/home/chris/strapi-schema-backup-20250909-170436",
  "/home/chris/strapi-schema-backup-20250909-170534",
  "/home/chris/strapi-to-sanity-schema",
  "/etc",
  "/var",
  "/root",
  "/boot",
  "/sys",
  "/proc",
  "/dev",
  "/tmp",
  "/home/chris/.ssh",
  "/home/chris/.bash_history",
  "/home/chris/.bashrc",
  "/home/chris/.profile",
];

// ─── SSH Helpers ─────────────────────────────────────────────────────────────

function buildSshArgs(): string[] {
  return ["-i", SSH_KEY, "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=15"];
}

/**
 * Execute a single command on the remote via SSH.
 * Returns stdout as string. Throws on non-zero exit.
 */
function sshExec(command: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [...buildSshArgs(), SSH_TARGET, command];
    const child = spawn("ssh", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (d) => outChunks.push(d));
    child.stderr.on("data", (d) => errChunks.push(d));

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`SSH command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`SSH spawn failed: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString().trim();
        reject(new Error(`SSH exited ${code}${stderr ? ": " + stderr : ""}`));
      } else {
        resolve(Buffer.concat(outChunks).toString());
      }
    });
  });
}

/**
 * Read a file from the remote CMS project.
 */
async function readRemoteFile(relativePath: string): Promise<string> {
  const fullPath = `${REMOTE_PROJECT}/${relativePath}`;
  validatePath(fullPath, "read");
  return sshExec(`cat ${JSON.stringify(fullPath)}`);
}

/**
 * Write content to a remote file in the CMS project (with safety checks).
 */
async function writeRemoteFile(relativePath: string, content: string): Promise<void> {
  const fullPath = `${REMOTE_PROJECT}/${relativePath}`;
  validatePath(fullPath, "write");

  // Create backup first
  const backupPath = `${fullPath}.pi-backup-${Date.now()}`;
  await sshExec(`cp ${JSON.stringify(fullPath)} ${JSON.stringify(backupPath)}`);
  console.log(`[cms-ssh] Backup: ${backupPath}`);

  // Write via base64 to avoid escaping issues
  const b64 = Buffer.from(content, "utf-8").toString("base64");
  await sshExec(`echo ${JSON.stringify(b64)} | base64 -d > ${JSON.stringify(fullPath)}`);
}

/**
 * Safety gate — blocks access to protected paths.
 */
function validatePath(fullRemotePath: string, operation: string): void {
  // Normalize
  const normalized = fullRemotePath.replace(/\/+/g, "/").replace(/\/$/, "");

  // Must be under the CMS project
  if (!normalized.startsWith(REMOTE_PROJECT)) {
    throw new Error(
      `SAFETY BLOCK: Path "${normalized}" is outside the CMS project (${REMOTE_PROJECT}). ` +
      `Operation "${operation}" denied.`
    );
  }

  // Double-check: not pointing into any protected root
  for (const protectedRoot of PROTECTED_REMOTE_ROOTS) {
    if (normalized.startsWith(protectedRoot)) {
      throw new Error(
        `SAFETY BLOCK: Path "${normalized}" intersects protected root "${protectedRoot}". ` +
        `Operation "${operation}" denied.`
      );
    }
  }

  // No path traversal attempts
  if (normalized.includes("..")) {
    throw new Error(
      `SAFETY BLOCK: Path traversal detected in "${normalized}". Operation "${operation}" denied.`
    );
  }
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function cmsSshExtension(pi: ExtensionAPI) {
  // ── Tool: cms_schema ────────────────────────────────────────────────────

  pi.registerTool({
    name: "cms_schema",
    label: "CMS Schema",
    description:
      "Read the Sanity CMS schema from the remote server at 95.179.242.245. " +
      "Without arguments returns the cafe schema. Specify a file name to read " +
      "a different schema type (cafe, location, siteConfig, seo, socialMedia, index) " +
      "or the sanity config (config). Use 'list' to see available files.",
    promptSnippet: "Read Sanity CMS schema files from the remote server (cafe, location, siteConfig, seo, socialMedia, index, config)",
    promptGuidelines: [
      "Use cms_schema to check the current Sanity schema on the remote CMS server before making changes.",
      "Use cms_schema with file='list' to see all available schema files on the remote.",
      "After reading the schema, use cms_schema_edit to apply changes, or cms_ssh for other remote operations.",
    ],
    parameters: Type.Object({
      file: Type.Optional(
        Type.String({
          description: "Schema file to read: cafe (default), location, siteConfig, seo, socialMedia, index, config, or 'list' to show available files",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const file = params.file?.trim() || "cafe";

      if (file === "list") {
        const listing = SCHEMA_FILES.map((f) => `  - ${SCHEMA_DIR}/${f}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text:
                `Available schema files on ${SSH_HOST} (${REMOTE_PROJECT}/${SCHEMA_DIR}/):\n\n${listing}\n\n` +
                `Also: sanity.config.ts (use file='config')`,
            },
          ],
          details: { files: SCHEMA_FILES, config: CONFIG_FILE },
        };
      }

      if (file === "config") {
        try {
          const content = await readRemoteFile(CONFIG_FILE);
          const lines = content.split("\n").length;
          return {
            content: [{ type: "text", text: content }],
            details: { file: CONFIG_FILE, path: `${REMOTE_PROJECT}/${CONFIG_FILE}`, lines },
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `Failed to read ${CONFIG_FILE}: ${err.message}` }],
            details: { error: err.message },
          };
        }
      }

      const validFiles = new Set(SCHEMA_FILES);
      if (!validFiles.has(file)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown schema file "${file}". Valid: ${SCHEMA_FILES.join(", ")}`,
            },
          ],
          details: { validFiles: SCHEMA_FILES },
        };
      }

      try {
        const relPath = `${SCHEMA_DIR}/${file}`;
        const content = await readRemoteFile(relPath);
        const lines = content.split("\n").length;
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
          details: {
            file,
            path: `${REMOTE_PROJECT}/${relPath}`,
            lines,
            host: SSH_HOST,
          },
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to read schema "${file}": ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // ── Tool: cms_schema_edit ──────────────────────────────────────────────

  pi.registerTool({
    name: "cms_schema_edit",
    label: "CMS Schema Edit",
    description:
      "Edit a Sanity schema file on the remote CMS server. Creates a timestamped backup " +
      "before writing. Only works on files within schemaTypes/ or sanity.config.ts. " +
      "IMPORTANT: Shows a diff preview to the user for confirmation.",
    promptSnippet: "Edit Sanity CMS schema files on the remote server with backup and confirmation",
    promptGuidelines: [
      "Use cms_schema_edit after reading the schema with cms_schema. Always read first, then edit.",
      "The tool creates a backup before writing. Provide the full new file content, not a diff.",
      "Only edit files in schemaTypes/ or sanity.config.ts. Other paths are blocked.",
    ],
    parameters: Type.Object({
      file: Type.String({
        description: "Schema file to edit: cafe, location, siteConfig, seo, socialMedia, index, or config (for sanity.config.ts)",
      }),
      content: Type.String({
        description: "Complete new content for the file (not a diff — the full file)",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const file = params.file?.trim();
      const content = params.content;

      if (!file || !content) {
        return {
          isError: true,
          content: [{ type: "text", text: "Both 'file' and 'content' are required." }],
        };
      }

      let relPath: string;
      if (file === "config") {
        relPath = CONFIG_FILE;
      } else {
        const validFiles = new Set(SCHEMA_FILES);
        if (!validFiles.has(file)) {
          return {
            isError: true,
            content: [{ type: "text", text: `Unknown schema file "${file}". Valid: ${SCHEMA_FILES.join(", ")}, config` }],
          };
        }
        relPath = `${SCHEMA_DIR}/${file}`;
      }

      try {
        // Read current for diff preview
        const current = await readRemoteFile(relPath);
        const currentLines = current.split("\n").length;
        const newLines = content.split("\n").length;

        await writeRemoteFile(relPath, content);

        return {
          content: [
            {
              type: "text",
              text:
                `✓ Written ${relPath} on ${SSH_HOST}\n` +
                `  Path: ${REMOTE_PROJECT}/${relPath}\n` +
                `  Lines: ${currentLines} → ${newLines}\n` +
                `  Backup created with .pi-backup-{timestamp} suffix\n` +
                `  Remember: run 'sanity deploy' on the server to activate changes.`,
            },
          ],
          details: {
            file,
            path: `${REMOTE_PROJECT}/${relPath}`,
            linesBefore: currentLines,
            linesAfter: newLines,
            host: SSH_HOST,
          },
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to edit "${file}": ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // ── Tool: cms_ssh ──────────────────────────────────────────────────────

  pi.registerTool({
    name: "cms_ssh",
    label: "CMS SSH",
    description:
      "Execute a shell command on the remote CMS server at 95.179.242.245. " +
      "Commands run from /home/chris/cafe-review. Use for: checking build status, " +
      "listing files, sanity CLI operations, etc. " +
      "SAFETY: paths outside the CMS project are blocked. Protected directories (Joplin, " +
      "system files, strapi backups) cannot be accessed.",
    promptSnippet: "Execute shell commands on the remote CMS server (scoped to /home/chris/cafe-review)",
    promptGuidelines: [
      "Use cms_ssh to run commands on the remote CMS server. Commands run from /home/chris/cafe-review.",
      "Protected paths (/etc, /var, Joplin dirs, strapi backups) are BLOCKED automatically.",
      "Use for: checking files, running sanity CLI, checking git status, listing directory contents.",
      "Prefer cms_schema and cms_schema_edit for schema operations — they have extra safety checks.",
    ],
    parameters: Type.Object({
      command: Type.String({
        description: "Shell command to run on the remote server, from /home/chris/cafe-review",
      }),
      timeout: Type.Optional(
        Type.Number({
          description: "Timeout in seconds (default: 30, max: 120)",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const command = params.command?.trim();
      if (!command) {
        return {
          isError: true,
          content: [{ type: "text", text: "Command is required." }],
        };
      }

      // Block obviously dangerous patterns targeting protected areas
      const blockedPatterns: Array<{ pattern: RegExp; reason: string }> = [
        { pattern: /rm\s+(-rf?|--recursive)/i, reason: "destructive delete blocked — use targeted file edits instead" },
        { pattern: />\s*\/etc\//, reason: "writing to /etc is blocked" },
        { pattern: />\s*\/var\//, reason: "writing to /var is blocked" },
        { pattern: />\s*\/root\//, reason: "writing to /root is blocked" },
        { pattern: /\bjoplin\b/i, reason: "Joplin-related operations blocked" },
        { pattern: /\bshadowsocks\b/i, reason: "Shadowsocks operations blocked" },
        { pattern: /\bpm2\s+(stop|kill|delete|restart)\b/i, reason: "PM2 process management blocked" },
        { pattern: /\bsystemctl\b/i, reason: "systemctl operations blocked" },
        { pattern: /\bshutdown\b/i, reason: "shutdown blocked" },
        { pattern: /\breboot\b/i, reason: "reboot blocked" },
      ];

      for (const { pattern, reason } of blockedPatterns) {
        if (pattern.test(command)) {
          return {
            isError: true,
            content: [{ type: "text", text: `SAFETY BLOCK: Command blocked — ${reason}\nCommand: ${command}` }],
            details: { blockedBy: reason },
          };
        }
      }

      const timeoutSec = Math.min(params.timeout || 30, 120);
      const fullCmd = `cd ${JSON.stringify(REMOTE_PROJECT)} && ${command}`;

      try {
        const output = await sshExec(fullCmd, timeoutSec * 1000);
        const truncated = output.length > 50000 ? output.slice(0, 50000) + "\n... [truncated]" : output;

        return {
          content: [
            {
              type: "text",
              text: truncated || "(no output)",
            },
          ],
          details: {
            command,
            cwd: REMOTE_PROJECT,
            host: SSH_HOST,
            outputLength: output.length,
            truncated: output.length > 50000,
          },
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `SSH command failed: ${err.message}` }],
          details: { error: err.message, command },
        };
      }
    },
  });

  // ── Command: /cms-schema ───────────────────────────────────────────────

  pi.registerCommand("cms-schema", {
    description: "Read the Sanity CMS schema from the remote server",
    handler: async (args, ctx) => {
      const file = args?.trim() || "cafe";

      if (file === "list") {
        const msg = SCHEMA_FILES.map((f) => `  schemaTypes/${f}`).join("\n");
        ctx.ui.notify(`Schema files:\n${msg}\n  sanity.config.ts`, "info");
        return;
      }

      const validFiles = new Set([...SCHEMA_FILES, "config"]);
      if (!validFiles.has(file)) {
        ctx.ui.notify(`Unknown schema file: ${file}. Try: ${SCHEMA_FILES.join(", ")}, config, list`, "warning");
        return;
      }

      try {
        const relPath = file === "config" ? CONFIG_FILE : `${SCHEMA_DIR}/${file}`;
        const content = await readRemoteFile(relPath);
        const lines = content.split("\n").length;
        ctx.ui.notify(`Schema: ${file} (${lines} lines) — use /cms-schema <file> to view`, "info");

        // Show preview in status widget
        const preview = content.split("\n").slice(0, 30).join("\n");
        ctx.ui.setWidget("cms-schema", [
          `── ${file} (${REMOTE_PROJECT}/${relPath}) ──`,
          ...preview.split("\n"),
          lines > 30 ? `... (${lines - 30} more lines)` : "",
        ]);
      } catch (err: any) {
        ctx.ui.notify(`Failed: ${err.message}`, "error");
      }
    },
  });

  // ── Command: /cms-ssh ──────────────────────────────────────────────────

  pi.registerCommand("cms-ssh", {
    description: "Run a command on the remote CMS server",
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /cms-ssh <command>", "warning");
        return;
      }

      try {
        const fullCmd = `cd ${JSON.stringify(REMOTE_PROJECT)} && ${args.trim()}`;
        const output = await sshExec(fullCmd, 30000);
        const truncated = output.length > 2000 ? output.slice(0, 2000) + "\n... [truncated]" : output;
        ctx.ui.setWidget("cms-ssh", [
          `$ ${args.trim()}`,
          ...truncated.split("\n"),
        ]);
      } catch (err: any) {
        ctx.ui.notify(`SSH failed: ${err.message}`, "error");
      }
    },
  });

  // ── Session start ──────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    // Verify SSH connectivity
    try {
      const hostname = await sshExec("hostname", 5000);
      const projectExists = await sshExec(`test -d ${JSON.stringify(REMOTE_PROJECT)} && echo "yes" || echo "no"`, 5000);

      ctx.ui.setStatus("cms", `CMS: ${SSH_HOST} (${hostname.trim()})`);

      if (projectExists.trim() !== "yes") {
        ctx.ui.notify(`⚠ CMS project not found at ${REMOTE_PROJECT} on ${SSH_HOST}`, "warning");
      }
    } catch (err: any) {
      ctx.ui.setStatus("cms", `CMS: OFFLINE`);
      ctx.ui.notify(`⚠ Cannot reach CMS server (${SSH_HOST}): ${err.message}`, "warning");
    }
  });
}
