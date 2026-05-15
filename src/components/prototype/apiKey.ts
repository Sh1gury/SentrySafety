export function getDemoApiKey(): string {
  return process.env.NEXT_PUBLIC_DEMO_API_KEY ?? 'demo';
}
