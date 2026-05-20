#!/usr/bin/env node
// Deploy do dist/ direto no Cloudflare Pages enquanto a integração GitHub App
// estiver quebrada. Lê CLOUDFLARE_API_TOKEN do .env, força production na branch
// `master`, e injeta commit hash + mensagem do git atual.

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");
const distPath = join(projectRoot, "dist");

const PROJECT_NAME = "mandato-desk-2026";
const ACCOUNT_ID = "647fac68b3bd9e5364f71732e98e65c1";
const BRANCH = "master";

function loadEnv(file) {
  if (!existsSync(file)) {
    throw new Error(`.env não encontrado em ${file}`);
  }
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function git(cmd, fallback = "") {
  try {
    return execSync(`git ${cmd}`, { cwd: projectRoot }).toString().trim();
  } catch {
    return fallback;
  }
}

if (!existsSync(distPath)) {
  console.error("❌ dist/ não existe. Rode `npm run build` primeiro (ou use `npm run deploy`).");
  process.exit(1);
}

const env = loadEnv(envPath);
const token = env.CLOUDFLARE_API_TOKEN;

if (!token) {
  console.error("❌ CLOUDFLARE_API_TOKEN não está no .env.");
  process.exit(1);
}

if (!token.startsWith("cfut_")) {
  console.warn(`⚠️  Token não começa com 'cfut_' — formato atual do Cloudflare. Tentando mesmo assim…`);
}

const commitHash = git("rev-parse HEAD", "");
const shortHash = git("rev-parse --short HEAD", "dev");
const rawCommitMsg = git("log -1 --format=%s", "Deploy manual via wrangler");
// Sanitiza: cmd.exe interpreta () como agrupamento e quebra o spawn.
// Troca ( ) por - e remove aspas que poderiam fechar o quoting.
const commitMsg = rawCommitMsg.replace(/[()]/g, "-").replace(/["`]/g, "");

console.log(`🚀 Deploy → ${PROJECT_NAME} (production, branch ${BRANCH})`);
console.log(`   Commit: ${shortHash} — ${commitMsg}`);
console.log("");

const args = [
  "wrangler",
  "pages",
  "deploy",
  "dist",
  `--project-name=${PROJECT_NAME}`,
  `--branch=${BRANCH}`,
  "--commit-dirty=true",
];
if (commitHash) args.push(`--commit-hash=${commitHash}`);
if (commitMsg) args.push(`--commit-message=${commitMsg}`);

// No Windows precisa shell:true pra resolver npx.cmd; com shell:true os args com
// espaços/colchetes precisam ir quotados.
const isWin = process.platform === "win32";
const quotedArgs = args.map((a) => (isWin && /[\s\[\]&|<>^]/.test(a) ? `"${a}"` : a));

const result = spawnSync("npx", quotedArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
  },
  shell: true,
});

process.exit(result.status ?? 1);
