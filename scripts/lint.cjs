const fs = require("node:fs");
const path = require("node:path");

const roots = ["src", "tests"];
const problems = [];

for (const file of walk(roots)) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("\t")) {
    problems.push(`${file}: tabs are not allowed`);
  }
  if (text.includes("console.log(") && file !== path.join("src", "index.ts")) {
    problems.push(`${file}: console.log is only allowed in src/index.ts`);
  }
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
    } else if (/\.(ts|js|cjs)$/.test(entry)) {
      files.push(entry);
    }
  }
  return files;
}
