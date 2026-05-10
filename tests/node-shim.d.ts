declare module "node:test" {
  const test: (name: string, fn: (...args: any[]) => any) => any
  export default test
}

declare module "node:assert/strict" {
  const assert: any
  export default assert
}
