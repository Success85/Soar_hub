export class IntegrationNotConfiguredError extends Error {
  constructor(public integration: string, detail: string) {
    super(`${integration} is not configured: ${detail}`);
    this.name = "IntegrationNotConfiguredError";
  }
}
export class ProviderError extends Error {
  constructor(public provider: string, message: string, public retryable = true, public response?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}
