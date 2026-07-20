#!/usr/bin/env node
// Reads Bitbucket credentials from .review-pr/config.local.json in the current
// project and prints shell `export` lines to stdout. Intended to be consumed via
// `eval "$(node <skill>/scripts/bb-auth.mjs)"` so the secret is placed into the
// shell environment WITHOUT ever being printed to the terminal / agent transcript.
//
// Emits a single BB_AUTH holding a ready-to-use Authorization header value:
//   - a workspace/repo access token  -> "Bearer <token>"
//   - username + app password        -> "Basic <base64(user:app_password)>"
// Token wins when both are present. All human-facing messages go to stderr;
// stdout carries only the export lines, and never the raw secret.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONFIG_REL_PATH = '.review-pr/config.local.json';
const PLACEHOLDERS = new Set([
  'YOUR_APP_PASSWORD_HERE',
  'YOUR_ACCESS_TOKEN_HERE',
  'your-bitbucket-username',
]);

function fail(message) {
  process.stderr.write(`bb-auth: ${message}\n`);
  process.exit(1);
}

const path = resolve(process.cwd(), CONFIG_REL_PATH);
if (!existsSync(path)) {
  fail(`ยังไม่มี ${CONFIG_REL_PATH} — สร้างจาก template ก่อน (ดู references/config.md)`);
}

let raw;
try {
  raw = JSON.parse(readFileSync(path, 'utf-8'));
} catch (err) {
  fail(`${CONFIG_REL_PATH} ไม่ใช่ JSON ที่ถูกต้อง: ${err.message}`);
}

const bb = raw.bitbucket ?? {};
const clean = (v) => (typeof v === 'string' && v.trim() && !PLACEHOLDERS.has(v.trim()) ? v.trim() : null);

const token = clean(bb.token);
const username = clean(bb.username);
const appPassword = clean(bb.appPassword);

let authValue;
if (token) {
  authValue = `Bearer ${token}`;
} else if (username && appPassword) {
  authValue = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
} else {
  fail(
    `${CONFIG_REL_PATH} ยังไม่ได้กรอก bitbucket credential — ` +
      `ใส่ "token" หรือ ("username" + "appPassword") ให้ครบ`
  );
}

// POSIX-safe single-quote escaping: close, insert an escaped quote, reopen.
const shSingleQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

process.stdout.write(`export BB_AUTH=${shSingleQuote(authValue)}\n`);
