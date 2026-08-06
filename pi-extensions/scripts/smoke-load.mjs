import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const packagesRoot = path.join(workspaceRoot, "packages");
const packageNames = (await readdir(packagesRoot)).sort();
const packages = [];

for (const directoryName of packageNames) {
  const packageRoot = path.join(packagesRoot, directoryName);
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  if (manifest.pi?.extensions?.length > 0) {
    packages.push({ name: manifest.name ?? directoryName, root: packageRoot });
  }
}

if (packages.length === 0) {
  throw new Error(`No Pi extension packages found under ${packagesRoot}`);
}

for (const pkg of packages) {
  const result = spawnSync(
    "pi",
    [
      "--offline",
      "--no-extensions",
      "-e",
      pkg.root,
      "--no-skills",
      "--no-prompt-templates",
      "--no-themes",
      "--no-context-files",
      "--list-models",
      "__pi_extension_smoke__",
    ],
    {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: { ...process.env, PI_OFFLINE: "1" },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = result.stderr.trim() || result.stdout.trim() || `exit code ${result.status}`;
    throw new Error(`${pkg.name} failed to load: ${details}`);
  }

  console.log(`Loaded ${pkg.name}`);
}
