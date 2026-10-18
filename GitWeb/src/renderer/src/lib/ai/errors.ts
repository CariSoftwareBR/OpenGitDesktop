/** Turns Electron IPC wrappers and provider JSON blobs into a readable line. */
export function formatAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const unwrapped = raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
  const jsonStart = unwrapped.indexOf('{')
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(unwrapped.slice(jsonStart)) as { error?: { message?: string }; message?: string }
      const friendly = parsed.error?.message ?? parsed.message
      if (typeof friendly === 'string' && friendly.trim()) {
        const prefix = unwrapped.slice(0, jsonStart).replace(/:\s*$/, '')
        return prefix ? `${prefix}: ${friendly}` : friendly
      }
    } catch {
      // keep the unwrapped string
    }
  }
  return unwrapped
}
