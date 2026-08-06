import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(await readFile(path.join(workspaceRoot, "package.json"), "utf8"));

const response = await fetch("https://pi.dev/api/latest-version", {
  signal: AbortSignal.timeout(10_000),
});
if (!response.ok) {
  throw new Error(`Pi version check failed: HTTP ${response.status}`);
}

const latest = await response.json();
if (!latest.ok || typeof latest.version !== "string" || typeof latest.packageName !== "string") {
  throw new Error("Pi version check returned an invalid response");
}

if (!packageJson.devDependencies?.[latest.packageName]) {
  throw new Error(`Expected ${latest.packageName} in devDependencies`);
}

const installedPackageJsonPath = path.join(workspaceRoot, "node_modules", latest.packageName, "package.json");
const installedPackageJson = JSON.parse(await readFile(installedPackageJsonPath, "utf8"));
if (installedPackageJson.version !== latest.version) {
  throw new Error(
    `Pi type package is ${installedPackageJson.version}, latest is ${latest.version}; update package.json and package-lock.json`,
  );
}

const cliVersion = spawnSync("pi", ["--version"], { encoding: "utf8" });
if (cliVersion.error) throw cliVersion.error;
if (cliVersion.status !== 0) {
  throw new Error(cliVersion.stderr.trim() || `pi --version exited with code ${cliVersion.status}`);
}

const installedCliVersion = cliVersion.stdout.trim();
if (installedCliVersion !== latest.version) {
  throw new Error(`Pi CLI is ${installedCliVersion}, latest is ${latest.version}`);
}

console.log(`Pi CLI and type package are current: ${latest.packageName}@${latest.version}`);
