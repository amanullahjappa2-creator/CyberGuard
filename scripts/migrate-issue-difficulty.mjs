import { readFile, writeFile } from "node:fs/promises";

for (let id = 1; id <= 10; id += 1) {
  const file = new URL(`../levels/level${String(id).padStart(2, "0")}.json`, import.meta.url);
  const level = JSON.parse(await readFile(file, "utf8"));
  level.issues.forEach((issue, index) => {
    issue.difficulty ??= Math.min(5, 1 + ((id + index) % 4));
  });
  await writeFile(file, `${JSON.stringify(level, null, 2)}\n`);
}
