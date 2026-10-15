#!/usr/bin/env node
// Simple, dependency-free installer for this repo's skills and mods.
// Copies an item's git-tracked files into ~/.agents/<kind>s/<name> and links
// it under ~/.claude/skills/<name>, mirroring the manual steps in CLAUDE.md.
// Claude Code loads a skill from that folder, and auto-loads a mod (a plugin
// with .claude-plugin/plugin.json) from it as <name>@skills-dir.
//
// Usage (run from the repo root):
//   node bin/agent-kit.mjs list
//   node bin/agent-kit.mjs add skill <name>
//   node bin/agent-kit.mjs add mod <name>
//   npx . add skill <name>                  (no npm publish needed)
//   npm link && agent-kit add mod <name>    (optional global `agent-kit` command)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const claudeSkillsDir = path.join(os.homedir(), ".claude", "skills");

// Each kind: where it lives in the repo, whether items sit one level deeper
// under a category folder, where it's installed, the file that marks a folder
// as one, and how to read its version.
const KINDS = {
  skill: {
    dir: "skills",
    grouped: true,
    installDir: path.join(os.homedir(), ".agents", "skills"),
    marker: "SKILL.md",
    version(itemDir) {
      const text = fs.readFileSync(path.join(itemDir, "SKILL.md"), "utf8");
      const match = text.match(/^version:\s*(\S+)/m);
      return match ? match[1] : "?";
    },
  },
  mod: {
    dir: "mods",
    grouped: false,
    installDir: path.join(os.homedir(), ".agents", "mods"),
    marker: path.join(".claude-plugin", "plugin.json"),
    version(itemDir) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(itemDir, ".claude-plugin", "plugin.json"), "utf8"),
      );
      return manifest.version ?? "?";
    },
  },
};

function subdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

// Returns [{ name, category, relDir }] for every item of a kind in the repo.
function listItems(kind) {
  const { dir, grouped, marker } = KINDS[kind];
  const base = path.join(repoRoot, dir);
  const candidates = grouped
    ? subdirs(base).flatMap((category) =>
        subdirs(path.join(base, category)).map((name) => ({
          name,
          category,
          relDir: `${dir}/${category}/${name}`,
        })),
      )
    : subdirs(base).map((name) => ({ name, category: null, relDir: `${dir}/${name}` }));
  return candidates.filter((item) => fs.existsSync(path.join(repoRoot, item.relDir, marker)));
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

// Returns paths relative to the item's own folder.
function trackedFiles(relDir) {
  // Plain git checkout: ask git for the tracked file list. A checkout with no
  // .git (e.g. installed via `npx github:owner/repo`, which ships a tarball
  // without .git) already only contains what was committed, so just walk it.
  if (!fs.existsSync(path.join(repoRoot, ".git"))) {
    return walkFiles(path.join(repoRoot, relDir));
  }
  const out = execFileSync("git", ["ls-files", "--", relDir], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((f) => f.slice(relDir.length + 1));
}

function cmdList() {
  for (const kind of Object.keys(KINDS)) {
    const items = listItems(kind);
    if (items.length === 0) console.log(`${kind}s:\n  (none)`);
    let heading;
    for (const item of items) {
      const nextHeading = item.category ? `${kind}s / ${item.category}:` : `${kind}s:`;
      if (nextHeading !== heading) console.log((heading = nextHeading));
      const installed = fs.existsSync(path.join(claudeSkillsDir, item.name));
      const status = installed ? "[installed]" : "[missing]  ";
      const version = KINDS[kind].version(path.join(repoRoot, item.relDir));
      console.log(`  ${status} ${item.name}@${version}`);
    }
  }
}

function cmdAdd(kind, name) {
  const { dir, installDir } = KINDS[kind];
  const matches = listItems(kind).filter((item) => item.name === name);
  if (matches.length === 0) {
    const available = listItems(kind).map((item) => item.name).join("\n  ") || "(none)";
    console.error(`No ${kind} named "${name}" in ${dir}/. Available:\n  ${available}`);
    process.exit(1);
  }

  // Everything installs flat into ~/.claude/skills, so a name must be unique
  // across categories and across kinds.
  const clashes = Object.keys(KINDS)
    .flatMap((k) => listItems(k))
    .filter((item) => item.name === name);
  if (clashes.length > 1) {
    console.error(`"${name}" exists more than once; rename one before installing:`);
    for (const item of clashes) console.error(`  ${item.relDir}`);
    process.exit(1);
  }

  const { relDir } = matches[0];
  const files = trackedFiles(relDir);
  if (files.length === 0) {
    console.error(`"${name}" has no committed files yet — commit it first.`);
    process.exit(1);
  }

  const destDir = path.join(installDir, name);
  fs.rmSync(destDir, { recursive: true, force: true });
  for (const rel of files) {
    const src = path.join(repoRoot, relDir, rel);
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  console.log(`Copied ${files.length} file(s) -> ${destDir}`);

  const link = path.join(claudeSkillsDir, name);
  if (fs.existsSync(link)) {
    console.log(`${link} already exists, leaving it as-is.`);
    return;
  }
  try {
    fs.mkdirSync(claudeSkillsDir, { recursive: true });
    fs.symlinkSync(destDir, link, "junction");
    console.log(`Linked ${link} -> ${destDir}`);
  } catch (err) {
    console.warn(`Could not create the symlink automatically (${err.code}).`);
    console.warn(`Create it yourself:\n  mklink /D "${link}" "${destDir}"`);
  }
}

const [, , cmd, kind, name] = process.argv;

if (cmd === "list") {
  cmdList();
} else if (cmd === "add" && KINDS[kind] && name) {
  cmdAdd(kind, name);
} else {
  console.log("Usage:\n  agent-kit list\n  agent-kit add skill <name>\n  agent-kit add mod <name>");
  process.exit(cmd ? 1 : 0);
}
