#!/usr/bin/env node
// Simple, dependency-free installer for this repo's skills.
// Copies a skill's git-tracked files into ~/.agents/skills/<name> and links
// it under ~/.claude/skills/<name>, mirroring the manual steps in CLAUDE.md.
//
// Usage (run from the repo root):
//   node bin/skills.mjs list
//   node bin/skills.mjs add <skill-name>
//   npx . add <skill-name>          (no npm publish needed)
//   npm link && skills add <skill-name>   (optional global `skills` command)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsSkillsDir = path.join(os.homedir(), ".agents", "skills");
const claudeSkillsDir = path.join(os.homedir(), ".claude", "skills");

function listSkillNames() {
  return fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(repoRoot, name, "SKILL.md")))
    .sort();
}

function trackedFiles(name) {
  const out = execFileSync("git", ["ls-files", "--", name], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return out.split(/\r?\n/).filter(Boolean);
}

function isInstalled(name) {
  const link = path.join(claudeSkillsDir, name);
  return fs.existsSync(link);
}

function cmdList() {
  for (const name of listSkillNames()) {
    console.log(`${isInstalled(name) ? "[installed]" : "[missing]  "} ${name}`);
  }
}

function cmdAdd(name) {
  const skillDir = path.join(repoRoot, name);
  if (!fs.existsSync(path.join(skillDir, "SKILL.md"))) {
    console.error(`No skill named "${name}" here. Available:\n  ${listSkillNames().join("\n  ")}`);
    process.exit(1);
  }

  const files = trackedFiles(name);
  if (files.length === 0) {
    console.error(`"${name}" has no committed files yet — commit it first.`);
    process.exit(1);
  }

  const destDir = path.join(agentsSkillsDir, name);
  fs.rmSync(destDir, { recursive: true, force: true });
  for (const rel of files) {
    const src = path.join(repoRoot, rel);
    const dest = path.join(agentsSkillsDir, rel);
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
    fs.symlinkSync(destDir, link, "junction");
    console.log(`Linked ${link} -> ${destDir}`);
  } catch (err) {
    console.warn(`Could not create the symlink automatically (${err.code}).`);
    console.warn(`Create it yourself:\n  mklink /D "${link}" "${destDir}"`);
  }
}

const [, , cmd, name] = process.argv;

if (cmd === "list") {
  cmdList();
} else if (cmd === "add" && name) {
  cmdAdd(name);
} else {
  console.log("Usage:\n  skills list\n  skills add <skill-name>");
  process.exit(cmd ? 1 : 0);
}
