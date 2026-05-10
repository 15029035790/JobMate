declare module "node:fs" {
  const fs: {
    readFileSync(path: string, encoding: string): string
  }
  export default fs
}

declare module "node:readline/promises" {
  export function createInterface(opts: any): any
}

declare module "node:process" {
  const stdin: any
  const stdout: any
  export { stdin, stdout }
}

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit(code?: number): never
}
