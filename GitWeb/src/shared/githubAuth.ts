import type { GitHubUser } from './github'

// What the renderer is allowed to know about an in-flight device flow: enough
// to show the code and the link, and an opaque id to poll/cancel with. The
// device_code itself stays in the main process — it is the credential that
// redeems the access token, so handing it to the renderer would let renderer
// code drive its own redemption.
export interface DeviceFlowStart {
  flowId: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
}

export type DeviceFlowPollStatus = 'success' | 'expired' | 'denied' | 'cancelled' | 'error'

// No accessToken here by design — on success main has already stored the token
// and the renderer receives only the resulting identity.
export interface DeviceFlowPollResult {
  status: DeviceFlowPollStatus
  user?: GitHubUser
  errorMessage?: string
}

/**
 * Public facts about the OAuth App, surfaced so the UI can tell the user what
 * it is about to ask for and where to take the access away afterwards. The
 * client_id is not a secret in the Device Flow.
 */
export interface OAuthAppInfo {
  clientId: string
  scopes: string[]
  /** GitHub page where the user can revoke this app's access. */
  revokeUrl: string
}
