import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

function findFiles(dir: string, pattern: string): string[] {
  let results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        continue;
      }
      if (stat && stat.isDirectory()) {
        // Skip node_modules etc. to be fast
        if (file !== "node_modules" && file !== ".git" && file !== "dist") {
          results = results.concat(findFiles(filePath, pattern));
        }
      } else if (file.includes(pattern)) {
        results.push(filePath);
      }
    }
  } catch (err) {}
  return results;
}

console.log("Procurando por arquivos com 'foto_igreja' em todo o workspace...");
console.log(findFiles(".", "foto_igreja"));
console.log("Procurando em /tmp...");
console.log(findFiles("/tmp", "foto_igreja"));
