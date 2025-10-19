export type DryRunArgs = { draft: any; sampleItem: any; oldItem?: any; collection?: string };
export type DryRunResult = { ok: boolean; updates?: any; sideEffects?: any[]; error?: string };
export type LintArgs = { draft: any };
export type LintResult = { ok: boolean; messages: Array<{ level: 'info'|'warn'|'error'; message: string }> };

export function makeAutomationsApi({ baseUrl, token }: { baseUrl: string; token?: string }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  async function postJson<T>(path: string, body: any): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return {
    dryRun(args: DryRunArgs): Promise<DryRunResult> {
      return postJson('/automations/dry-run', args);
    },
    lint(args: LintArgs): Promise<LintResult> {
      return postJson('/automations/lint', args);
    },
  };
}
