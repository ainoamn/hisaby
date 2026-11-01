import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const allow = new Set(
  JSON.parse(readFileSync(join(root, "docs/launch/audit-allowlist.json"), "utf8")).ghsa,
);

const result = spawnSync("npm audit --omit=dev --json", {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: true,
});
const raw = result.stdout || "";
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start < 0 || end < start) {
  console.error(result.stderr || raw || "npm audit produced no JSON");
  process.exit(1);
}

const report = JSON.parse(raw.slice(start, end + 1));
const blocked = [];
const allowedHits = [];

for (const [pkg, info] of Object.entries(report.vulnerabilities || {})) {
  const vias = Array.isArray(info.via) ? info.via : [];
  for (const item of vias) {
    if (!item || typeof item !== "object") continue;
    if (item.severity !== "high" && item.severity !== "critical") continue;
    const url = String(item.url || "");
    const match = url.match(/GHSA-[0-9a-z-]+/i);
    const id = match ? match[0] : `${pkg}:${item.title || "unknown"}`;
    const line = `${id} ${item.severity} ${pkg}: ${item.title || ""}`.trim();
    if (allow.has(id)) allowedHits.push(line);
    else blocked.push(line);
  }
}

if (allowedHits.length) {
  console.log("Allowed exceptions:");
  for (const line of [...new Set(allowedHits)]) console.log(`  ${line}`);
}
if (blocked.length) {
  console.error("Unaccepted high or critical advisories:");
  for (const line of [...new Set(blocked)]) console.error(`  ${line}`);
  process.exit(1);
}

console.log("No unaccepted high or critical advisories.");
