import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { redactSensitiveText, scanForSensitive, sensitiveFileKind, sensitiveLineKind } from '../src/shared/sensitiveFiles'

// Fake secrets are assembled at runtime so no literal in this file looks like
// a real one to gitleaks or GitHub push protection.
const fake = {
  github: 'gh' + 'p_' + 'A1b2C3d4E5'.repeat(4),
  aws: 'AK' + 'IA' + 'Q3ZK7W2M9X4B6N1P',
  openai: 's' + 'k-proj-' + 'Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe',
  anthropic: 's' + 'k-ant-api03-' + 'Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe',
  privateKey: '-----BEGIN RSA PRIVATE ' + 'KEY-----',
  hex: 'a8f5f167' + 'f44f4964' + 'e6c998de' + 'e827110c'
}

vi.mock('electron', () => ({ shell: { trashItem: vi.fn() }, app: { getPath: () => tmpdir() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))
vi.mock('../src/main/settings', () => ({
  getSettings: vi.fn(async () => ({ sensitiveCheck: true, sensitiveCheckMode: 'block' }))
}))

describe('sensitiveFileKind', () => {
  it('flags env files but not their templates', () => {
    expect(sensitiveFileKind('.env')).toBe('envFile')
    expect(sensitiveFileKind('app/.env.production')).toBe('envFile')
    expect(sensitiveFileKind('.env.local')).toBe('envFile')
    expect(sensitiveFileKind('.envrc')).toBe('envFile')
    expect(sensitiveFileKind('.environment')).toBeNull()
    expect(sensitiveFileKind('.env.example')).toBeNull()
    expect(sensitiveFileKind('config/.env.sample')).toBeNull()
  })

  it('flags keys and credential stores, not public keys or ordinary files', () => {
    expect(sensitiveFileKind('home/.ssh/id_ed25519')).toBe('sshKey')
    expect(sensitiveFileKind('home/.ssh/id_ed25519.pub')).toBeNull()
    expect(sensitiveFileKind('certs/server.pem')).toBe('privateKeyFile')
    expect(sensitiveFileKind('android/release.keystore')).toBe('keystore')
    expect(sensitiveFileKind('.git-credentials')).toBe('credentialsFile')
    expect(sensitiveFileKind('gcp/service-account-prod.json')).toBe('credentialsFile')
    expect(sensitiveFileKind('.aws/credentials')).toBe('credentialsFile')
    expect(sensitiveFileKind('src\\secrets.yml')).toBe('credentialsFile')
    expect(sensitiveFileKind('src/environment.ts')).toBeNull()
    expect(sensitiveFileKind('docs/keyboard.md')).toBeNull()
  })
})

describe('sensitiveLineKind', () => {
  it('recognizes provider tokens', () => {
    expect(sensitiveLineKind(`const token = "${fake.github}"`)).toBe('githubToken')
    expect(sensitiveLineKind(`AWS_ACCESS_KEY_ID=${fake.aws}`)).toBe('awsKey')
    expect(sensitiveLineKind(`OPENAI_API_KEY=${fake.openai}`)).toBe('openaiKey')
    expect(sensitiveLineKind(`key: ${fake.anthropic}`)).toBe('anthropicKey')
    expect(sensitiveLineKind(fake.privateKey)).toBe('privateKey')
  })

  it('flags a quoted secret assignment but not placeholders or prose', () => {
    expect(sensitiveLineKind(`password = "Tr0ub4dor&3xyz"`)).toBe('genericSecret')
    expect(sensitiveLineKind(`"client_secret": "${fake.hex}"`)).toBe('genericSecret')
    expect(sensitiveLineKind(`password = "your_password_here1"`)).toBeNull()
    expect(sensitiveLineKind(`apiKey: '\${process.env.API_KEY}'`)).toBeNull()
    expect(sensitiveLineKind(`password: 'senha do usuário 123'`)).toBeNull()
    expect(sensitiveLineKind(`signInHint: 'Entre para listar os PRs'`)).toBeNull()
    expect(sensitiveLineKind(`const apiKey = useAiStore((s) => s.apiKey)`)).toBeNull()
  })
})

describe('scanForSensitive', () => {
  it('reads only added lines and reports their line in the new file', () => {
    const diff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -3,1 +10,2 @@',
      `-const old = "${fake.aws}"`,
      '+const fine = 1',
      `+const token = "${fake.github}"`
    ].join('\n')
    expect(scanForSensitive(['src/config.ts'], diff)).toEqual([{ path: 'src/config.ts', kind: 'githubToken', line: 11 }])
  })

  it('combines file names, diff content and whole new files, one finding per file and kind', () => {
    const diff = ['+++ b/a.ts', '@@ -0,0 +1,2 @@', `+${fake.aws}`, `+${fake.aws}`].join('\n')
    const findings = scanForSensitive(['.env', 'a.ts'], diff, [{ path: 'new.txt', content: `x\n${fake.privateKey}` }])
    expect(findings).toEqual([
      { path: '.env', kind: 'envFile' },
      { path: 'a.ts', kind: 'awsKey', line: 1 },
      { path: 'new.txt', kind: 'privateKey', line: 2 }
    ])
  })
})

describe('scanSensitive in a real repository', () => {
  it('sees staged files, and new files only in the "all" scope', async () => {
    const { scanSensitive, assertNoBlockedSensitive } = await import('../src/main/sensitiveScan')
    const repo = mkdtempSync(join(tmpdir(), 'ogd-sensitive-'))
    try {
      const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
      git('init', '-q')
      writeFileSync(join(repo, '.env'), 'DB_URL=postgres://localhost\n')
      mkdirSync(join(repo, 'src'))
      writeFileSync(join(repo, 'src', 'client.ts'), `export const key = "${fake.openai}"\n`)
      git('add', '.env')

      expect(await scanSensitive(repo, 'staged')).toEqual([{ path: '.env', kind: 'envFile' }])
      expect(await scanSensitive(repo, 'all')).toEqual([
        { path: '.env', kind: 'envFile' },
        { path: 'src/client.ts', kind: 'openaiKey', line: 1 }
      ])
      await expect(assertNoBlockedSensitive(repo)).rejects.toThrow('.env')

      git('reset', '-q')
      await expect(assertNoBlockedSensitive(repo)).resolves.toBeUndefined()

      // Concluding a merge is never blocked: what it records is already in both histories.
      git('-c', 'user.name=T', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'base')
      git('add', '.env')
      writeFileSync(join(repo, '.git', 'MERGE_HEAD'), `${git('rev-parse', 'HEAD')}\n`)
      await expect(assertNoBlockedSensitive(repo)).resolves.toBeUndefined()
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})

describe('redactSensitiveText', () => {
  const P = '[omitido]'

  it('collapses a sensitive file in a diff and masks token lines elsewhere', () => {
    const diff = [
      'diff --git a/.env b/.env',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/.env',
      '@@ -0,0 +1,2 @@',
      '+DATABASE_URL=postgres://admin:SenhaInventada123@localhost/loja',
      '+STRIPE_SECRET=inventado',
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -1,2 +1,3 @@',
      ' export const config = {',
      `+  githubToken: "${fake.github}",`,
      ' }'
    ].join('\n')
    const { text, redacted } = redactSensitiveText(diff, P)
    expect(redacted).toBe(3)
    expect(text).not.toContain('SenhaInventada123')
    expect(text).not.toContain(fake.github)
    expect(text).toContain(`+${P}\ndiff --git a/src/config.ts`)
    expect(text).toContain(`+  ${P}`)
    expect(text).toContain(' export const config = {')
  })

  it('leaves ordinary text alone', () => {
    const plain = 'Explique o que mudou em src/carrinho.ts\nconst total = 1'
    expect(redactSensitiveText(plain, P)).toEqual({ text: plain, redacted: 0 })
  })
})
