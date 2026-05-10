import type { PendingConfirmation } from "../state/session-state.types.ts"

export class ConfirmationGate {
  createPendingConfirmation(input: PendingConfirmation): PendingConfirmation {
    return input
  }

  assertMatches(pending: PendingConfirmation | undefined, type: PendingConfirmation["type"], targetId: string): void {
    if (!pending || pending.type !== type || pending.targetId !== targetId) {
      throw new Error(`Expected confirmation ${type} for ${targetId}.`)
    }
  }
}
