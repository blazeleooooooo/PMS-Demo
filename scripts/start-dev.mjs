/**
 * Clean Next.js dev start — kills stale servers, clears .next, starts on port 3000.
 * Prevents unstyled pages from corrupted shared .next cache or dual dev processes.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const PORTS = [3000, 3001];
const root = join(import.meta.dirname, "..");

function killPort(port) {
  const isWin = platform() === "win32";
  try {
    if (isWin) {
      const ps = `$p=${port}; Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
      execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" });
    } else {
      execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: "ignore", shell: true });
    }
  } catch {
    // Port not in use
  }
}

function removeDir(label, dirPath) {
  if (!existsSync(dirPath)) return;
  console.log(`Clearing ${label}...`);
  rmSync(dirPath, { recursive: true, force: true });
}

console.log("Stopping existing Next.js dev servers on ports 3000/3001...");
for (const port of PORTS) killPort(port);
await sleep(1500);

removeDir(".next cache", join(root, ".next"));
removeDir("node_modules/.cache", join(root, "node_modules", ".cache"));

console.log("Starting Next.js dev server on http://localhost:3000 ...");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", "3000"], {
  cwd: root,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
