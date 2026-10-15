#!/usr/bin/env node
// Simple, dependency-free installer for this repo's skills and mods.
//
// An install has a scope and a layout.
//   scope   global  -> under your home folder (every project sees it)
//           project -> under <project> (only that project sees it)
//   layout  link    -> files in <base>/.agents/<kind>s/<name>, linked at
//                      <base>/.claude/skills/<name>
//           copies  -> a separate copy in each of those two folders
//           claude  -> <base>/.claude/skills/<name> only
//           agents  -> <base>/.agents/<kind>s/<name> only (for other agents;
//                      Claude Code doesn't read it)
// Claude Code loads a skill from .claude/skills, and auto-loads a mod (a
// plugin with .claude-plugin/plugin.json) from there as <name>@skills-dir.
// Only git-tracked files are installed.
//
// A mod's plugin.json may carry install hints under metadata.agentKit:
//   requires    names of other items installed alongside it
//   statusLine  the statusLine command to set, {dir} being the folder Claude
//               Code loads the mod from; an existing statusLine of something
//               else is kept unless --status-line is given
//
// Usage:
//   agent-kit [--project [path]]           interactive picker (TTY only)
//   agent-kit list [--project [path]]
//   agent-kit add <skill|mod> <name> [--project [path]] [--to both|claude|agents] [--copy] [--status-line]
// --project without a path means the current directory. --to defaults to
// both (linked) for global and claude for a project; --copy makes "both" two
// copies instead of a link. Run as `node bin/agent-kit.mjs ...` from a clone,
// or `npx github:<owner>/agent-kit ...`.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Each kind: where it lives in the repo, whether items sit one level deeper
// under a category folder, the file that marks a folder as one, and how to
// read its version.
const KINDS = {
  skill: {
    dir: "skills",
    grouped: true,
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
    marker: path.join(".claude-plugin", "plugin.json"),
    version(itemDir) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(itemDir, ".claude-plugin", "plugin.json"), "utf8"),
      );
      return manifest.version ?? "?";
    },
  },
};

const LAYOUTS = {
  link: { label: ".claude linked to .agents", folders: ["agents", "claude"] },
  copies: { label: ".claude and .agents, copied", folders: ["agents", "claude"] },
  claude: { label: ".claude", folders: ["claude"] },
  agents: { label: ".agents", folders: ["agents"] },
};

function globalScope() {
  return { id: "global", label: "global", base: os.homedir() };
}

function projectScope(projectRoot) {
  return { id: "project", label: `project ${projectRoot}`, base: projectRoot };
}

function defaultLayout(scope) {
  // Links inside a project point at absolute paths on this machine, so they
  // can't be committed; plain copies in .claude can.
  return scope.id === "global" ? "link" : "claude";
}

// The two folders an item can live in within a scope.
function locations(item, scope) {
  return {
    agents: path.join(scope.base, ".agents", KINDS[item.kind].dir, item.name),
    claude: path.join(scope.base, ".claude", "skills", item.name),
  };
}

// ---------------------------------------------------------------------------
// Discovery

function subdirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

// Returns [{ kind, name, category, relDir, version }] for every item of a kind.
function listItems(kind) {
  const { dir, grouped, marker } = KINDS[kind];
  const base = path.join(repoRoot, dir);
  const candidates = grouped
    ? subdirs(base).flatMap((category) =>
        subdirs(path.join(base, category)).map((name) => ({
          kind,
          name,
          category,
          relDir: `${dir}/${category}/${name}`,
        })),
      )
    : subdirs(base).map((name) => ({ kind, name, category: null, relDir: `${dir}/${name}` }));
  return candidates
    .filter((item) => fs.existsSync(path.join(repoRoot, item.relDir, marker)))
    .map((item) => ({ ...item, version: KINDS[kind].version(path.join(repoRoot, item.relDir)) }));
}

function allItems() {
  return Object.keys(KINDS).flatMap((kind) => listItems(kind));
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

// Other items this one imports by relative path (e.g. `../code-review/...`),
// which therefore have to be installed next to it.
function dependencies(item, items) {
  const names = new Set(items.map((i) => i.name));
  const deps = new Set();
  for (const rel of trackedFiles(item.relDir)) {
    if (!/\.(mjs|cjs|js|ts|tsx)$/.test(rel)) continue;
    const text = fs.readFileSync(path.join(repoRoot, item.relDir, rel), "utf8");
    for (const match of text.matchAll(/["'](?:\.\.\/)+([a-z0-9-]+)\//g)) {
      if (match[1] !== item.name && names.has(match[1])) deps.add(match[1]);
    }
  }
  return [...deps].sort();
}

// The metadata.agentKit hints of a mod's plugin.json; none for a skill.
function installHints(item) {
  if (item.kind !== "mod") return {};
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, item.relDir, ".claude-plugin", "plugin.json"), "utf8"),
    );
    const hints = manifest.metadata?.agentKit;
    return hints && typeof hints === "object" ? hints : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Status

// -1 / 0 / 1 for dotted numeric versions; null when either isn't comparable.
function compareVersions(a, b) {
  const parse = (v) => (/^\d+(\.\d+)*$/.test(v) ? v.split(".").map(Number) : null);
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

function installedVersionAt(item, dir) {
  try {
    return KINDS[item.kind].version(dir);
  } catch {
    return "?"; // Not this kind, or broken.
  }
}

// { state, installedVersion, where } for an item in a scope. state is "new"
// (in neither folder), "installed" (up to date) or "update" (repo is newer
// than the oldest copy found). where lists the folders it was found in.
function statusIn(item, scope) {
  const where = Object.entries(locations(item, scope))
    .filter(([, dir]) => fs.existsSync(dir))
    .map(([folder, dir]) => ({ folder, version: installedVersionAt(item, dir) }));
  if (where.length === 0) return { state: "new", installedVersion: null, where: [] };

  const stale = where.find(({ version }) => {
    const cmp = compareVersions(item.version, version);
    return cmp === 1 || (cmp === null && version !== item.version);
  });
  const installedVersion = stale ? stale.version : where[0].version;
  return { state: stale ? "update" : "installed", installedVersion, where: where.map((w) => w.folder) };
}

function statusText(item, status) {
  if (status.state === "new") return "not installed";
  // Only one of the two folders means the item is reachable by some agents only.
  const suffix = status.where.length === 1 ? ` (.${status.where[0]})` : "";
  if (status.state === "update") {
    const from = status.installedVersion === "?" ? "unversioned" : status.installedVersion;
    return `update ${from} -> ${item.version}${suffix}`;
  }
  return `installed${suffix}`;
}

// ---------------------------------------------------------------------------
// Install

// Clears whatever sits at dir. A link is removed as a link, never followed,
// so the folder it points to is left alone.
function clear(dir) {
  const existing = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!existing) return;
  if (existing.isSymbolicLink()) fs.unlinkSync(dir);
  else fs.rmSync(dir, { recursive: true, force: true });
}

function copyInto(item, files, dir) {
  clear(dir);
  for (const rel of files) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, item.relDir, rel), dest);
  }
}

function linkInto(link, target, log) {
  clear(link);
  try {
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(target, link, "junction");
    log.push(`Linked ${link} -> ${target}`);
  } catch (err) {
    log.push(`Warning: could not create the link automatically (${err.code}).`);
    log.push(`Create it yourself:\n  mklink /D "${link}" "${target}"`);
  }
}

// The settings file a statusLine goes in: the user's own for global, and the
// project's local (uncommitted) one, since the command holds an absolute path.
function settingsFile(scope) {
  return path.join(scope.base, ".claude", scope.id === "global" ? "settings.json" : "settings.local.json");
}

// Points statusLine at the item's command. Another tool's statusLine is kept
// unless replace is set; one that already runs this item is updated in place.
function setStatusLine(item, scope, command, replace) {
  const file = settingsFile(scope);
  let settings = {};
  if (fs.existsSync(file)) {
    try {
      settings = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return [`Warning: could not read ${file}; set statusLine yourself:\n  "statusLine": ${JSON.stringify({ type: "command", command })}`];
    }
  }
  const current = settings.statusLine?.command;
  if (current === command) return [];
  if (current && !current.includes(item.name) && !replace) {
    return [
      `Warning: ${file} already has a statusLine (${current}); kept it.`,
      `Run again with --status-line to replace it with ${item.name}.`,
    ];
  }
  settings.statusLine = { ...settings.statusLine, type: "command", command };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
  return [`Set statusLine in ${file}`];
}

// Installs one item into a scope with a layout, then what its install hints
// ask for. Returns log lines (warnings start with "Warning:"); throws an Error
// with a user-facing message when the item can't be installed.
function installItem(item, scope, layout, options = {}) {
  const installing = options.installing ?? new Set();
  installing.add(item.name);
  // Everything installs flat into one folder per location, so a name must be
  // unique across categories and across kinds.
  const items = allItems();
  const clashes = items.filter((other) => other.name === item.name);
  if (clashes.length > 1) {
    throw new Error(
      `"${item.name}" exists more than once; rename one before installing:\n` +
        clashes.map((c) => `  ${c.relDir}`).join("\n"),
    );
  }

  const files = trackedFiles(item.relDir);
  if (files.length === 0) {
    throw new Error(`"${item.name}" has no committed files yet — commit it first.`);
  }

  const log = [];
  const loc = locations(item, scope);
  if (layout === "link") {
    copyInto(item, files, loc.agents);
    log.push(`Copied ${files.length} file(s) -> ${loc.agents}`);
    linkInto(loc.claude, loc.agents, log);
  } else {
    for (const folder of LAYOUTS[layout].folders) {
      copyInto(item, files, loc[folder]);
      log.push(`Copied ${files.length} file(s) -> ${loc[folder]}`);
    }
  }

  if (layout === "agents" && item.kind === "mod") {
    log.push("Warning: Claude Code only loads mods from .claude/skills, so this one won't load.");
  }
  for (const depName of dependencies(item, items)) {
    const depLoc = locations(items.find((i) => i.name === depName), scope);
    const missing = LAYOUTS[layout].folders.filter((folder) => !fs.existsSync(depLoc[folder]));
    if (missing.length) {
      const where = missing.map((folder) => `.${folder}`).join(" and ");
      log.push(`Warning: needs ${depName} installed next to it in ${where} (${scope.label}).`);
    }
  }

  const hints = installHints(item);
  for (const reqName of Array.isArray(hints.requires) ? hints.requires : []) {
    const req = items.find((i) => i.name === reqName);
    if (!req) {
      log.push(`Warning: needs ${reqName}, which this repo doesn't have.`);
    } else if (!installing.has(req.name) && statusIn(req, scope).state !== "installed") {
      log.push(`Installing ${req.name}, which ${item.name} uses:`);
      log.push(...installItem(req, scope, layout, { ...options, installing }));
    }
  }
  if (typeof hints.statusLine === "string" && LAYOUTS[layout].folders.includes("claude")) {
    const dir = loc.claude.split(path.sep).join("/");
    log.push(...setStatusLine(item, scope, hints.statusLine.replaceAll("{dir}", dir), options.replaceStatusLine));
  }
  return log;
}

// ---------------------------------------------------------------------------
// Non-interactive commands

function groupHeading(item) {
  return item.category ? `${item.kind}s / ${item.category}` : `${item.kind}s`;
}

function cmdList(scopes) {
  const items = allItems();
  const width = Math.max(0, ...items.map((i) => `${i.name}@${i.version}`.length));
  const cell = (i, s) => {
    const text = statusText(i, statusIn(i, s));
    return scopes.length > 1 ? `${s.id}: ${text}` : text;
  };
  const statusWidth = Math.max(0, ...items.flatMap((i) => scopes.map((s) => cell(i, s).length)));
  if (scopes.length > 1) console.log(`project: ${scopes[1].base}\n`);
  for (const kind of Object.keys(KINDS)) {
    const ofKind = items.filter((i) => i.kind === kind);
    if (ofKind.length === 0) console.log(`${kind}s:\n  (none)`);
    let heading;
    for (const item of ofKind) {
      if (groupHeading(item) !== heading) console.log(`${(heading = groupHeading(item))}:`);
      const statuses = scopes.map((s) => cell(item, s).padEnd(statusWidth)).join("  ").trimEnd();
      console.log(`  ${`${item.name}@${item.version}`.padEnd(width)}  ${statuses}`);
    }
  }
}

function cmdAdd(kind, name, scope, layout, options) {
  const item = listItems(kind).find((i) => i.name === name);
  if (!item) {
    const available = listItems(kind).map((i) => i.name).join("\n  ") || "(none)";
    console.error(`No ${kind} named "${name}" in ${KINDS[kind].dir}/. Available:\n  ${available}`);
    process.exit(1);
  }
  try {
    for (const line of installItem(item, scope, layout, options)) console.log(line);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Interactive picker

const useColor = !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = paint("1");
const dim = paint("2");
const green = paint("32");
const yellow = paint("33");
const cyan = paint("36");
const inverse = paint("7");

// A folder that looks like a project (and isn't this repo), so the picker can
// offer it as an install target without being told.
function detectProject(dir) {
  if (path.resolve(dir) === repoRoot) return null;
  const looksLikeProject = [".git", ".claude", ".agents"].some((f) => fs.existsSync(path.join(dir, f)));
  return looksLikeProject ? path.resolve(dir) : null;
}

function runPicker(initialProject) {
  const items = allItems();
  if (items.length === 0) {
    console.log("Nothing to install.");
    return;
  }
  const global = globalScope();
  let project = initialProject ? projectScope(initialProject) : null;
  const scopes = () => (project ? [global, project] : [global]);

  // list -> scope -> (path) -> folders -> (method, when both folders) -> install
  let mode = "list";
  let cursor = 0;
  let scroll = 0;
  const selected = new Set(); // relDir
  let pending = []; // items waiting for a scope and folders
  let chosenScope = null;
  const chosenFolders = new Set(); // "claude" | "agents"
  let optionCursor = 0;
  let pathInput = "";
  let messages = [];

  const nameWidth = Math.max(...items.map((i) => i.name.length));
  const versionWidth = Math.max(...items.map((i) => i.version.length));
  const statusWidth = 32;

  // Display rows: headings interleaved with items, in discovery order.
  const rows = [];
  let lastHeading;
  for (const kind of Object.keys(KINDS)) {
    const ofKind = items.filter((i) => i.kind === kind);
    if (ofKind.length === 0) rows.push({ heading: `${kind}s`, empty: true });
    for (const item of ofKind) {
      if (groupHeading(item) !== lastHeading) rows.push({ heading: (lastHeading = groupHeading(item)) });
      rows.push({ item });
    }
  }

  function scopeOptions() {
    const options = [{ scope: global, label: "Global", detail: `${global.base} — every project sees it` }];
    if (project) options.push({ scope: project, label: "Project", detail: `${project.base} — only this project` });
    options.push({ scope: null, label: project ? "Another project…" : "A project…", detail: "type its path" });
    return options;
  }

  // .agents/skills, .agents/mods, or both, depending on what's being installed.
  function relPath(folder) {
    if (folder === "claude") return path.join(".claude", "skills", "<name>");
    const kinds = [...new Set(pending.map((i) => i.kind))];
    return path.join(".agents", kinds.map((k) => KINDS[k].dir).join("|"), "<name>");
  }

  function folderOptions() {
    return [
      { folder: "claude", label: ".claude", detail: `${relPath("claude")} — read by Claude Code` },
      { folder: "agents", label: ".agents", detail: `${relPath("agents")} — read by other agents` },
    ];
  }

  function methodOptions() {
    return [
      { layout: "link", label: "Link", detail: `files in ${relPath("agents")}, ${relPath("claude")} links to it — update once` },
      { layout: "copies", label: "Copy", detail: "a separate copy in each folder" },
    ];
  }

  function renderStatus(item, scope) {
    const status = statusIn(item, scope);
    const text = statusText(item, status).padEnd(statusWidth);
    if (status.state === "installed") return green(text);
    if (status.state === "update") return yellow(text);
    return dim(text);
  }

  function renderMenu(title, question, options, hint) {
    const lines = [bold(title), "", question];
    options.forEach((o, i) => {
      // Pad by visible width; labels may carry color codes.
      const visible = o.label.replace(/\[[0-9;]*m/g, "").length;
      const line = `${o.label}${" ".repeat(Math.max(1, 19 - visible))}${dim(o.detail)}`;
      lines.push(i === optionCursor ? `${inverse(">")} ${line}` : `  ${line}`);
    });
    lines.push("", dim(hint));
    if (messages.length) lines.push("", ...messages);
    return lines;
  }

  function pendingTitle() {
    const names = pending.map((i) => i.name).join(", ");
    return `Install ${pending.length === 1 ? names : `${pending.length} items (${names})`}`;
  }

  function renderList() {
    const cursorRow = rows.findIndex((r) => r.item === items[cursor]);
    const header = [
      bold("agent-kit") + dim(" — pick skills and mods to install"),
      dim("↑/↓ move · space select · u select all updates · enter choose where to install · q quit"),
      "",
      " ".repeat(4 + nameWidth + 2 + versionWidth + 2) +
        scopes().map((s) => dim(s.id.padEnd(statusWidth))).join("  "),
    ];
    const footer = ["", ...messages];
    const height = Math.max(3, (process.stdout.rows || 24) - header.length - footer.length - 1);
    if (cursorRow < scroll) scroll = cursorRow;
    if (cursorRow >= scroll + height) scroll = cursorRow - height + 1;
    // Keep the heading above the first visible item when there's room.
    if (scroll > 0 && rows[scroll - 1]?.heading && cursorRow - scroll + 1 < height) scroll -= 1;

    const body = rows.slice(scroll, scroll + height).map((row) => {
      if (row.heading) return row.empty ? `${cyan(row.heading)} ${dim("(none)")}` : cyan(row.heading);
      const item = row.item;
      const box = selected.has(item.relDir) ? green("[x]") : "[ ]";
      const statuses = scopes().map((s) => renderStatus(item, s)).join("  ");
      const line = `${box} ${item.name.padEnd(nameWidth)}  ${dim(item.version.padEnd(versionWidth))}  ${statuses}`;
      return item === items[cursor] ? `${inverse(">")} ${line}` : `  ${line}`;
    });
    const count = selected.size
      ? bold(`${selected.size} selected`)
      : dim("nothing selected — enter installs the highlighted item");
    return [...header, ...body, ...footer, count];
  }

  function renderPath() {
    const lines = [
      bold("Install into which project?"),
      "",
      `Path: ${pathInput}${inverse(" ")}`,
      dim(`Relative paths start from ${process.cwd()}`),
      "",
      dim("enter confirm · esc back"),
    ];
    if (messages.length) lines.push("", ...messages);
    return lines;
  }

  function render() {
    let lines;
    if (mode === "list") lines = renderList();
    else if (mode === "scope") lines = renderMenu(pendingTitle(), "Where?", scopeOptions(), "↑/↓ choose · enter next · esc back");
    else if (mode === "folders") {
      const options = folderOptions().map((o) => ({
        ...o,
        label: `${chosenFolders.has(o.folder) ? green("[x]") : "[ ]"} ${o.label}`,
      }));
      lines = renderMenu(
        pendingTitle(),
        `Into which folders? ${dim(`(${chosenScope.label})`)}`,
        options,
        "↑/↓ move · space toggle · enter next · esc back",
      );
    } else if (mode === "method") {
      lines = renderMenu(
        pendingTitle(),
        `Both folders — link or copy? ${dim(`(${chosenScope.label})`)}`,
        methodOptions(),
        "↑/↓ choose · enter install · esc back",
      );
    } else lines = renderPath();
    process.stdout.write("\x1b[H\x1b[2J" + lines.join("\n"));
  }

  function chooseFoldersFor(scope) {
    chosenScope = scope;
    chosenFolders.clear();
    for (const folder of LAYOUTS[defaultLayout(scope)].folders) chosenFolders.add(folder);
    optionCursor = 0;
    messages = [];
    mode = "folders";
  }

  function install(layout) {
    messages = [];
    for (const item of pending) {
      try {
        const warnings = installItem(item, chosenScope, layout).filter((line) => line.startsWith("Warning:"));
        if (warnings.length) messages.push(...warnings.map((w) => yellow(`${item.name}: ${w}`)));
        else messages.push(green(`installed ${item.name}@${item.version} (${chosenScope.label}, ${LAYOUTS[layout].label})`));
      } catch (err) {
        messages.push(yellow(`${item.name}: ${err.message.split("\n")[0]}`));
      }
    }
    messages.push(dim("Start a new Claude Code session to pick up the changes."));
    selected.clear();
    pending = [];
    mode = "list";
  }

  function cleanup() {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\x1b[?25h\x1b[?1049l");
  }

  const isUp = (key) => key === "\x1b[A" || key === "k";
  const isDown = (key) => key === "\x1b[B" || key === "j";
  const isEnter = (key) => key === "\r" || key === "\n";

  function onListKey(key) {
    if (key === "q" || key === "\x1b") {
      cleanup();
      for (const line of messages) console.log(line);
      process.exit(0);
    }
    if (isUp(key)) cursor = (cursor - 1 + items.length) % items.length;
    else if (isDown(key)) cursor = (cursor + 1) % items.length;
    else if (key === " ") {
      const id = items[cursor].relDir;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
    } else if (key === "u") {
      const updates = items.filter((i) => scopes().some((s) => statusIn(i, s).state === "update"));
      const allOn = updates.length > 0 && updates.every((i) => selected.has(i.relDir));
      for (const i of updates) allOn ? selected.delete(i.relDir) : selected.add(i.relDir);
      messages = updates.length ? [] : [dim("Everything installed is up to date.")];
    } else if (isEnter(key)) {
      pending = selected.size ? items.filter((i) => selected.has(i.relDir)) : [items[cursor]];
      optionCursor = 0;
      messages = [];
      mode = "scope";
    }
  }

  function onMenuKey(key, options, onChoose, onBack) {
    if (key === "\x1b" || key === "q") onBack();
    else if (isUp(key)) optionCursor = (optionCursor - 1 + options.length) % options.length;
    else if (isDown(key)) optionCursor = (optionCursor + 1) % options.length;
    else if (isEnter(key)) onChoose(options[optionCursor]);
  }

  function onScopeKey(key) {
    onMenuKey(
      key,
      scopeOptions(),
      (choice) => {
        if (choice.scope) chooseFoldersFor(choice.scope);
        else {
          pathInput = "";
          messages = [];
          mode = "path";
        }
      },
      () => {
        messages = [];
        mode = "list";
      },
    );
  }

  function onFoldersKey(key) {
    if (key === " ") {
      const { folder } = folderOptions()[optionCursor];
      if (chosenFolders.has(folder)) chosenFolders.delete(folder);
      else chosenFolders.add(folder);
      messages = [];
      return;
    }
    onMenuKey(
      key,
      folderOptions(),
      () => {
        if (chosenFolders.size === 0) {
          messages = [yellow("Pick at least one folder with space.")];
        } else if (chosenFolders.size === 1) {
          // One folder: a plain copy, nothing to link.
          install([...chosenFolders][0]);
        } else {
          // Links in a project point at absolute paths on this machine, so
          // copying is the safer first choice there.
          optionCursor = chosenScope.id === "global" ? 0 : 1;
          messages = [];
          mode = "method";
        }
      },
      () => {
        messages = [];
        optionCursor = Math.max(0, scopeOptions().findIndex((o) => o.scope === chosenScope));
        mode = "scope";
      },
    );
  }

  function onMethodKey(key) {
    onMenuKey(
      key,
      methodOptions(),
      (choice) => install(choice.layout),
      () => {
        messages = [];
        optionCursor = 0;
        mode = "folders";
      },
    );
  }

  function onPathKey(key) {
    if (key === "\x1b") {
      messages = [];
      optionCursor = scopeOptions().length - 1;
      mode = "scope";
    } else if (isEnter(key)) {
      if (!pathInput.trim()) {
        messages = [yellow("Type a project path (use . for the current directory).")];
        return;
      }
      const dir = path.resolve(pathInput.trim());
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        messages = [yellow(`Not a folder: ${dir}`)];
        return;
      }
      project = projectScope(dir);
      chooseFoldersFor(project);
    } else if (key === "\x7f" || key === "\b") {
      pathInput = pathInput.slice(0, -1);
    } else if (!key.startsWith("\x1b")) {
      // Typed or pasted text; drop control characters and line breaks.
      pathInput += key.replace(/[\x00-\x1f]/g, "");
    }
  }

  process.stdout.write("\x1b[?1049h\x1b[?25l");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdout.on("resize", render);
  render();

  process.stdin.on("data", (key) => {
    if (key === "\x03") {
      cleanup();
      process.exit(130);
    }
    if (mode === "list") onListKey(key);
    else if (mode === "scope") onScopeKey(key);
    else if (mode === "folders") onFoldersKey(key);
    else if (mode === "method") onMethodKey(key);
    else onPathKey(key);
    render();
  });
}

// ---------------------------------------------------------------------------

// Pulls --project [path], --to <where>, --copy and --status-line out of argv.
function parseArgs(argv) {
  const positionals = [];
  let project = null;
  let to = null;
  let copy = false;
  let replaceStatusLine = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") {
      const next = argv[i + 1];
      project = path.resolve(next && !next.startsWith("-") ? argv[++i] : ".");
    } else if (argv[i] === "--to") {
      to = argv[++i];
    } else if (argv[i] === "--copy") {
      copy = true;
    } else if (argv[i] === "--status-line") {
      replaceStatusLine = true;
    } else {
      positionals.push(argv[i]);
    }
  }
  return { positionals, project, to, copy, replaceStatusLine };
}

function usage() {
  console.log(
    [
      "Usage:",
      "  agent-kit [--project [path]]                     interactive picker",
      "  agent-kit list [--project [path]]",
      "  agent-kit add <skill|mod> <name> [--project [path]] [--to both|claude|agents] [--copy] [--status-line]",
      "",
      "--project    work on <path> (default: current directory) instead of your home folder",
      "--to         both: .agents and .claude (default for global)",
      "             claude: .claude/skills only (default for a project)",
      "             agents: .agents only",
      "--copy       with --to both, make two copies instead of linking .claude to .agents",
      "--status-line  replace an existing statusLine with the one a mod sets (kept by default)",
    ].join("\n"),
  );
}

const { positionals, project, to, copy, replaceStatusLine } = parseArgs(process.argv.slice(2));
const [cmd, kind, name] = positionals;

if (project && !fs.existsSync(project)) {
  console.error(`Project folder not found: ${project}`);
  process.exit(1);
}
if (to && !["both", "claude", "agents"].includes(to)) {
  console.error(`--to must be both, claude or agents (got "${to}").`);
  process.exit(1);
}

const scopes = project ? [globalScope(), projectScope(project)] : [globalScope()];

if (!cmd) {
  if (process.stdin.isTTY && process.stdout.isTTY) runPicker(project ?? detectProject(process.cwd()));
  else cmdList(scopes);
} else if (cmd === "list") {
  cmdList(scopes);
} else if (cmd === "add" && KINDS[kind] && name) {
  const scope = scopes[scopes.length - 1];
  const where = to ?? (defaultLayout(scope) === "link" ? "both" : "claude");
  const layout = where === "both" ? (copy ? "copies" : "link") : where;
  cmdAdd(kind, name, scope, layout, { replaceStatusLine });
} else {
  usage();
  process.exit(1);
}
