import fs from "node:fs"
import path from "node:path"

export function loadEnvFile(filePath = ".env"): void {
  const resolved = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(resolved)) return

  const content = fs.readFileSync(resolved, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = stripQuotes(rawValue.trim())
  }
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}
