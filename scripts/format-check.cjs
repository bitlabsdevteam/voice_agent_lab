const fs = require("node:fs");
const path = require("node:path");

const roots = ["src", "tests", "scripts", "prompts", "docs", "public"];
const problems = [];

for (const file of walk(roots)) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.endsWith("\n")) {
    problems.push(`${file}: missing trailing newline`);
  }
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) {
      problems.push(`${file}:${index + 1}: trailing whitespace`);
    }
  });
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}

function walk(entries) {
  const files = [];
  for (const entry of entries) {
    if (!fs.existsSync(entry)) {
      continue;
    }
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(entry)) {
        files.push(...walk([path.join(entry, child)]));
      }
    } else if (/\.(ts|js|cjs|md)$/.test(entry)) {
      files.push(entry);
    }
  }
  return files;
}
