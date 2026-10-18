import { randomUUID } from 'crypto'
import type { DeviceFlowPollResult, DeviceFlowStart, OAuthAppInfo } from '../shared/githubAuth'
import { fetchUser } from './githubApi'
import { saveSecret } from './credentials'
import { credentialKey } from '../shared/githubRemote'
import { httpFetch } from './httpFetch'
import { tMain } from './i18n'

// GitHub OAuth Apps don't need a client secret for the Device Flow, so the
// client_id is not sensitive and can live in source. Device Flow only works
// against github.com — GitHub Enterprise Server would need its own OAuth App
// registered on that instance, so Enterprise keeps using a Personal Access
// Token (see githubRemote.ts / the PAT login path).
const GITHUB_OAUTH_CLIENT_ID = process.env.GITWEB_GITHUB_OAUTH_CLIENT_ID || 'Ov23litzZ3NEb1SdgDBr'
// `repo` covers private/public repository git + API access. `workflow` is
// required by GitHub to create or update files under `.github/workflows/` —
// without it, `git push` is rejected when the commit touches Actions YAML.
const DEVICE_FLOW_SCOPE = 'repo workflow'

// Logging out only deletes the local token — the OAuth grant itself lives on
// GitHub, and revoking it needs a client secret this app deliberately does not
// have. So the UI links the user to the page where they can revoke it.
export function getOAuthAppInfo(): OAuthAppInfo {
  return {
    clientId: GITHUB_OAUTH_CLIENT_ID,
    scopes: DEVICE_FLOW_SCOPE.split(' '),
    revokeUrl: `https://github.com/settings/connections/applications/${GITHUB_OAUTH_CLIENT_ID}`
  }
}

interface DeviceCodeApiResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

interface AccessTokenApiResponse {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
  interval?: number
}

// device_code, deadline and poll interval are held here, keyed by an opaque id
// the renderer gets instead. Entries are dropped as soon as the flow reaches a
// terminal state.
interface PendingFlow {
  host: string
  deviceCode: string
  interval: number
  expiresAt: number
  controller: AbortController
}

const pendingFlows = new Map<string, PendingFlow>()

export async function startDeviceFlow(host: string): Promise<DeviceFlowStart> {
  if (host !== 'github.com') {
    throw new Error(tMain().github.deviceFlowGithubOnly)
  }

  const response = await httpFetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_OAUTH_CLIENT_ID, scope: DEVICE_FLOW_SCOPE })
  })
  if (!response.ok) {
    throw new Error(tMain().github.deviceFlowStartFailed(response.status))
  }

  const json = (await response.json()) as DeviceCodeApiResponse
  const flowId = randomUUID()
  pendingFlows.set(flowId, {
    host,
    deviceCode: json.device_code,
    interval: Math.max(json.interval, 1),
    expiresAt: Date.now() + json.expires_in * 1000,
    controller: new AbortController()
  })

  return {
    flowId,
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    verificationUriComplete: json.verification_uri_complete
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

async function pollOnce(deviceCode: string, signal: AbortSignal): Promise<AccessTokenApiResponse> {
  const response = await httpFetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_OAUTH_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    }),
    signal
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(tMain().github.deviceFlowPollFailed(response.status, text.slice(0, 200)))
  }
  return response.json() as Promise<AccessTokenApiResponse>
}

// Resolves only once the flow reaches a terminal state (success, expired,
// denied, cancelled, or an unrecoverable error) — the renderer just awaits
// one IPC call instead of re-invoking on every poll tick. On success the token
// is stored here and only the resulting user is returned.
export async function pollDeviceFlow(flowId: string): Promise<DeviceFlowPollResult> {
  const flow = pendingFlows.get(flowId)
  if (!flow) return { status: 'error', errorMessage: tMain().github.loginExpired }

  let interval = flow.interval

  try {
    while (Date.now() < flow.expiresAt) {
      await delay(interval * 1000, flow.controller.signal)
      const result = await pollOnce(flow.deviceCode, flow.controller.signal)

      if (result.access_token) {
        const user = await fetchUser(flow.host, result.access_token)
        await saveSecret(credentialKey(flow.host), result.access_token)
        return { status: 'success', user }
      }
      switch (result.error) {
        case 'authorization_pending':
          continue
        case 'slow_down':
          interval = result.interval ?? interval + 5
          continue
        case 'expired_token':
          return { status: 'expired' }
        case 'access_denied':
          return { status: 'denied' }
        default:
          return { status: 'error', errorMessage: result.error_description || result.error || tMain().github.unknownError }
      }
    }
    return { status: 'expired' }
  } catch (err) {
    if (flow.controller.signal.aborted) return { status: 'cancelled' }
    return { status: 'error', errorMessage: err instanceof Error ? err.message : String(err) }
  } finally {
    pendingFlows.delete(flowId)
  }
}

export function cancelDeviceFlow(flowId: string): void {
  pendingFlows.get(flowId)?.controller.abort()
}
