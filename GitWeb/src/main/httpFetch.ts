import { net } from 'electron'
import { tMain } from './i18n'
import http from 'node:http'
import https from 'node:https'
import type { RequestOptions as HttpRequestOptions } from 'node:http'
import type { RequestOptions as HttpsRequestOptions } from 'node:https'

// Local OpenAI-compatible servers (LAN IPs, http://) must use Node's HTTP/1.1
// stack: Chromium `net.fetch` applies Local Network Access checks and may
// HTTP/2-preface a server that only speaks HTTP/1.1, which shows up as
// net::ERR_CONNECTION_RESET. Public HTTPS APIs are the opposite problem —
// Node/undici on Windows often ECONNRESET, while Chromium's TLS works.
// Try the stack that matches the URL first, then fall back once.

function networkErrorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return ''
  const withCause = err as { code?: unknown; cause?: unknown; message?: unknown }
  if (typeof withCause.code === 'string') return withCause.code
  if (typeof withCause.message === 'string') {
    const chrome = withCause.message.match(/net::([A-Z0-9_]+)/)
    if (chrome) return chrome[1]
  }
  return networkErrorCode(withCause.cause)
}

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return false
  const code = networkErrorCode(err)
  const message = err instanceof Error ? err.message : String(err)
  return (
    code === 'ECONNRESET' ||
    code === 'ERR_CONNECTION_RESET' ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ERR_CONNECTION_TIMED_OUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ERR_CONNECTION_REFUSED' ||
    code === 'ENOTFOUND' ||
    message.includes('fetch failed') ||
    message.includes('ERR_CONNECTION_RESET') ||
    message.includes('ERR_FAILED')
  )
}

function originLabel(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return url
  }
}

function isPrivateOrLocalUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol === 'http:') return true
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return true
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true
    return false
  } catch {
    return false
  }
}

export function describeNetworkError(err: unknown, url?: string): string {
  const t = tMain().network
  if (err instanceof Error && err.name === 'AbortError') return t.cancelled

  const where = url ? t.where(originLabel(url)) : ''
  const code = networkErrorCode(err)
  const localHint = url && isPrivateOrLocalUrl(url) ? t.localHint : t.remoteHint

  switch (code) {
    case 'ECONNRESET':
    case 'ERR_CONNECTION_RESET':
      return t.connectionReset(where, localHint)
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return t.dnsFailed(where)
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'ERR_CONNECTION_TIMED_OUT':
      return t.timedOut(where)
    case 'ECONNREFUSED':
    case 'ERR_CONNECTION_REFUSED':
      return t.refused(where)
    case 'CERT_HAS_EXPIRED':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
      return t.certificate(where)
    default:
      break
  }

  if (err instanceof Error) {
    const cause = 'cause' in err && err.cause instanceof Error ? err.cause.message : ''
    if (err.message.includes('fetch failed') || err.message.includes('ERR_CONNECTION_RESET')) {
      return cause ? t.failedWithCause(where, cause, localHint) : t.failed(where, localHint)
    }
    return where ? `${err.message} (${originLabel(url ?? '')})` : err.message
  }

  return String(err)
}

function headerRecord(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = { connection: 'close' }
  if (!headers) return out
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = value
    return out
  }
  return { ...out, ...headers }
}

function nodeRequest(url: string, init?: RequestInit): Promise<Response> {
  const parsed = new URL(url)
  const isHttps = parsed.protocol === 'https:'
  const lib = isHttps ? https : http
  const headers = headerRecord(init?.headers)
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = typeof init?.body === 'string' ? init.body : undefined
  if (body && !headers['content-length'] && !headers['Content-Length']) {
    headers['content-length'] = String(Buffer.byteLength(body))
  }

  const options: HttpRequestOptions & HttpsRequestOptions = {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: `${parsed.pathname}${parsed.search}`,
    method,
    headers,
    family: 4,
    agent: isHttps
      ? new https.Agent({ keepAlive: false, family: 4 })
      : new http.Agent({ keepAlive: false, family: 4 })
  }

  return new Promise((resolve, reject) => {
    if (init?.signal?.aborted) {
      reject(init.signal.reason instanceof Error ? init.signal.reason : new DOMException('Aborted', 'AbortError'))
      return
    }

    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk as Buffer))
      res.on('end', () => {
        const responseHeaders = new Headers()
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') responseHeaders.set(key, value)
          else if (Array.isArray(value)) responseHeaders.set(key, value.join(', '))
        }
        resolve(
          new Response(Buffer.concat(chunks), {
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? '',
            headers: responseHeaders
          })
        )
      })
    })

    const onAbort = (): void => {
      req.destroy()
      // The reason tells a timeout (TimeoutError) apart from a user cancel.
      const reason = init?.signal?.reason
      reject(reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError'))
    }
    init?.signal?.addEventListener('abort', onAbort, { once: true })
    req.on('error', (err) => {
      init?.signal?.removeEventListener('abort', onAbort)
      reject(err)
    })
    req.on('close', () => init?.signal?.removeEventListener('abort', onAbort))
    if (body) req.write(body)
    req.end()
  })
}

async function chromiumFetch(url: string, init?: RequestInit): Promise<Response> {
  return await net.fetch(url, init)
}

// Neither Chromium's net.fetch nor the raw Node http/https path below has any
// built-in cap on how long a request can hang — a stalled connection (flaky
// network, a slow endpoint) would otherwise leave the caller's promise
// pending forever with zero feedback. A caller-supplied signal (e.g. a "stop"
// button) is preserved and combined with this timeout, not replaced by it.
const DEFAULT_TIMEOUT_MS = 30_000

export async function httpFetch(
  input: string | URL,
  init?: RequestInit,
  options?: { timeoutMs?: number }
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const timedInit: RequestInit = {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal
  }
  const order = isPrivateOrLocalUrl(url)
    ? [nodeRequest, chromiumFetch]
    : [chromiumFetch, nodeRequest]

  let lastError: unknown
  for (let i = 0; i < order.length; i++) {
    try {
      return await order[i](url, timedInit)
    } catch (err) {
      // Checked on the signal itself: net.fetch reports both a timeout and a
      // user cancel as a plain AbortError, and only the latter is "cancelled".
      if (timeoutSignal.aborted && !init?.signal?.aborted) {
        throw new Error(tMain().network.requestTimedOut(originLabel(url), timeoutMs / 1000))
      }
      if (err instanceof Error && err.name === 'AbortError') throw err
      lastError = err
      const retry = i < order.length - 1 && isRetryableNetworkError(err)
      if (retry) {
        console.warn(`[httpFetch] ${init?.method ?? 'GET'} ${originLabel(url)} failed via ${order[i].name}, retrying:`, err)
        continue
      }
      break
    }
  }

  throw new Error(describeNetworkError(lastError, url))
}
