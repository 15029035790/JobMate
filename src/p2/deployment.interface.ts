export interface RuntimeHealth {
  service: string
  status: "ok" | "degraded" | "down"
  checkedAt: string
}

export interface DeploymentPort {
  health(): RuntimeHealth
}

export class LocalDeploymentPort implements DeploymentPort {
  health(): RuntimeHealth {
    return { service: "jobmate-ai-core", status: "ok", checkedAt: new Date().toISOString() }
  }
}
