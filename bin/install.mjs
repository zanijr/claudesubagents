#!/usr/bin/env node

// Agent Orchestrator — Interactive Installer
// Usage: npx agent-orchestrator-cc@latest

import { createInterface } from "node:readline";
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, symlinkSync, unlinkSync, lstatSync, readdirSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, "..");

// ── Colors ──────────────────────────────────────────────────────────────────
const isColor = process.stdout.isTTY;
const c = {
  bold:    (s) => isColor ? `\x1b[1m${s}\x1b[0m` : s,
  cyan:    (s) => isColor ? `\x1b[36m${s}\x1b[0m` : s,
  green:   (s) => isColor ? `\x1b[32m${s}\x1b[0m` : s,
  yellow:  (s) => isColor ? `\x1b[33m${s}\x1b[0m` : s,
  red:     (s) => isColor ? `\x1b[31m${s}\x1b[0m` : s,
  dim:     (s) => isColor ? `\x1b[2m${s}\x1b[0m` : s,
};

const ok   = (msg) => console.log(`  ${c.green("+")} ${msg}`);
const info = (msg) => console.log(`  ${c.cyan(">")} ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow("!")} ${msg}`);
const fail = (msg) => { console.log(`  ${c.red("x")} ${msg}`); process.exit(1); };

// ── Readline prompt helper ──────────────────────────────────────────────────
function ask(question, choices) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log("");
    console.log(`  ${c.bold(question)}`);
    if (choices) {
      choices.forEach((ch, i) => {
        console.log(`    ${c.cyan(`${i + 1})`)} ${ch.label}${ch.description ? c.dim(` — ${ch.description}`) : ""}`);
      });
      rl.question(`\n  Choice [1-${choices.length}]: `, (answer) => {
        rl.close();
        const idx = parseInt(answer, 10) - 1;
        if (idx >= 0 && idx < choices.length) {
          resolve(choices[idx].value);
        } else {
          resolve(choices[0].value); // default to first
        }
      });
    } else {
      rl.question("  > ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

// ── Version ─────────────────────────────────────────────────────────────────
let version = "unknown";
try {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8"));
  version = pkg.version;
} catch {}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Support --update flag for the update skill
  if (args.includes("--update")) {
    return runUpdate();
  }

  console.log("");
  console.log(c.bold(c.cyan("  Agent Orchestrator")));
  console.log(c.dim(`  v${version}`));
  console.log("  " + "─".repeat(36));

  // ── Parse non-interactive flags ─────────────────────────────────────────
  const hasFlag = (f) => args.includes(f);
  let runtime = null;
  let scope = null;

  if (hasFlag("--claude")) runtime = "claude-code";
  if (hasFlag("--global")) scope = "global";
  if (hasFlag("--local"))  scope = "local";

  // ── Step 1: Choose runtime ──────────────────────────────────────────────
  if (!runtime) {
    runtime = await ask("Which runtime are you using?", [
      { label: "Claude Code", value: "claude-code", description: "Anthropic CLI" },
    ]);
  }

  // ── Step 2: Choose scope ────────────────────────────────────────────────
  if (!scope) {
    scope = await ask("Install scope?", [
      { label: "Global", value: "global", description: "Available in all projects" },
      { label: "Local",  value: "local",  description: "Current project only" },
    ]);
  }

  console.log("");
  info("Installing...");
  console.log("");

  const home = homedir();

  if (scope === "global") {
    installGlobal(home);
  } else {
    installLocal(home, process.cwd());
  }

  // ── Save version marker ───────────────────────────────────────────────
  const versionFile = join(home, ".claude", ".orchestrator-version");
  mkdirSync(dirname(versionFile), { recursive: true });
  writeFileSync(versionFile, version + "\n");

  // ── Done ──────────────────────────────────────────────────────────────
  console.log("");
  console.log(c.bold("  Done!") + ` v${version} installed.`);
  console.log("");
  if (scope === "global") {
    console.log(`  Next steps:`);
    console.log(`    ${c.cyan("cd your-project")}`);
    console.log(`    ${c.cyan("npx agent-orchestrator-cc@latest")} and choose ${c.bold("Local")} to set up the project`);
  }
  console.log(`    Then in Claude Code: ${c.cyan("/orchestrator build me a ...")}`);
  console.log("");
  console.log(`  To update later: ${c.cyan("/orchestrator:update")} in Claude Code`);
  console.log(`  Or run: ${c.cyan("npx agent-orchestrator-cc@latest")}`);
  console.log("");
}

// ── Global install: link skills into ~/.claude/skills/ ──────────────────────
function installGlobal(home) {
  const skillsDir = join(home, ".claude", "skills");
  mkdirSync(skillsDir, { recursive: true });

  const sourceSkillsDir = join(PKG_ROOT, "skills");
  if (!existsSync(sourceSkillsDir)) {
    fail(`Skills directory not found at ${sourceSkillsDir}`);
  }

  // Copy each skill
  for (const skill of readdirSync(sourceSkillsDir)) {
    const src = join(sourceSkillsDir, skill);
    const dest = join(skillsDir, skill);

    // Remove existing
    if (existsSync(dest)) {
      try {
        const stat = lstatSync(dest);
        if (stat.isSymbolicLink()) {
          unlinkSync(dest);
        } else {
          execSync(`rm -rf "${dest}"`);
        }
      } catch {}
    }

    // Copy recursively
    cpSync(src, dest, { recursive: true });
    ok(`Installed skill: ${c.bold(skill)}`);
  }

  // Copy the update skill
  const updateSkillSrc = join(PKG_ROOT, "bin", "skills", "update");
  const updateSkillDest = join(skillsDir, "orchestrator-update");
  if (existsSync(updateSkillSrc)) {
    if (existsSync(updateSkillDest)) {
      try { execSync(`rm -rf "${updateSkillDest}"`); } catch {}
    }
    cpSync(updateSkillSrc, updateSkillDest, { recursive: true });
    ok(`Installed skill: ${c.bold("orchestrator:update")}`);
  }
}

// ── Local install: set up the current project ───────────────────────────────
function installLocal(home, projectDir) {
  // Create agent directory
  const agentDir = join(projectDir, ".claude", "agents", "project");
  mkdirSync(agentDir, { recursive: true });
  ok("Created .claude/agents/project/");

  // Create checkpoint directory
  const checkpointDir = join(projectDir, ".claude", "context", "checkpoints");
  mkdirSync(checkpointDir, { recursive: true });
  ok("Created .claude/context/checkpoints/");

  // Copy agent template
  const templateSrc = join(PKG_ROOT, "templates", "new-agent.md");
  const templateDest = join(agentDir, "_template.md");
  if (!existsSync(templateDest) && existsSync(templateSrc)) {
    cpSync(templateSrc, templateDest);
    ok("Copied agent template");
  }

  // Copy config
  const configSrc = join(PKG_ROOT, "templates", "orchestrator.config.json");
  const configDest = join(projectDir, "orchestrator.config.json");
  if (!existsSync(configDest) && existsSync(configSrc)) {
    cpSync(configSrc, configDest);
    ok("Copied orchestrator.config.json");
  }

  // Copy CLAUDE.md template
  const claudeMdSrc = join(PKG_ROOT, "templates", "CLAUDE.md.template");
  const claudeMdDest = join(projectDir, ".claude", "CLAUDE.md");
  if (!existsSync(claudeMdDest) && existsSync(claudeMdSrc)) {
    cpSync(claudeMdSrc, claudeMdDest);
    ok("Copied .claude/CLAUDE.md");
  }

  // Create memory directory
  const memoryDir = join(projectDir, ".claude", "memory");
  mkdirSync(memoryDir, { recursive: true });
  ok("Created .claude/memory/");

  // Update .gitignore
  const gitignore = join(projectDir, ".gitignore");
  const entry = ".claude/context/checkpoints/";
  if (existsSync(gitignore)) {
    const content = readFileSync(gitignore, "utf8");
    if (!content.includes(entry)) {
      writeFileSync(gitignore, content + `\n# Agent orchestrator checkpoint files\n${entry}\n`);
      ok("Updated .gitignore");
    }
  } else {
    writeFileSync(gitignore, `# Agent orchestrator checkpoint files\n${entry}\n`);
    ok("Created .gitignore");
  }

  // Also do global install if skills aren't there yet
  const skillsDir = join(home, ".claude", "skills");
  const hasSkills = existsSync(join(skillsDir, "orchestrator"));
  if (!hasSkills) {
    info("Skills not found globally, installing...");
    installGlobal(home);
  }
}

// ── Update flow ─────────────────────────────────────────────────────────────
function runUpdate() {
  console.log("");
  console.log(c.bold(c.cyan("  Agent Orchestrator — Update")));
  console.log("  " + "─".repeat(36));
  console.log("");

  const home = homedir();
  const versionFile = join(home, ".claude", ".orchestrator-version");
  let installedVersion = "unknown";
  if (existsSync(versionFile)) {
    installedVersion = readFileSync(versionFile, "utf8").trim();
  }

  info(`Installed: v${installedVersion}`);
  info(`Latest:    v${version}`);
  console.log("");

  if (installedVersion === version) {
    ok("Already up to date!");
    console.log("");
    return;
  }

  info("Updating skills...");
  installGlobal(home);

  writeFileSync(versionFile, version + "\n");

  console.log("");
  ok(`Updated from v${installedVersion} to v${version}!`);
  console.log("");
}

main().catch((err) => {
  fail(err.message);
});
