import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let hasLoadedDefaultEnvFile = false;

export function loadEnvFile(path = join(process.cwd(), ".env")): void {
  if (path === join(process.cwd(), ".env")) {
    if (hasLoadedDefaultEnvFile) {
      return;
    }
    hasLoadedDefaultEnvFile = true;
  }

  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).replace(/^export\s+/, "").trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] = stripMatchingQuotes(value);
  }
}

export function resetEnvFileStateForTests(): void {
  hasLoadedDefaultEnvFile = false;
}

function stripMatchingQuotes(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
