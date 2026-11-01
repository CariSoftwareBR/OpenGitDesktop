/**
 * Browser-only preview stub. Installed only when Electron preload did not
 * expose `window.api` — so Electron builds are untouched.
 *
 * Seeds a demo repo + configured AI model so the shell and AiChatView can
 * be visually validated in a regular browser.
 */
import type { Api } from '../../preload/index.d'
import {
  DEFAULT_INVESTIGATION_CONCURRENCY,
  DEFAULT_INVESTIGATION_CONTEXT_TOKENS,
  DEFAULT_MAX_DIFF_CHARS,
  SYSTEM_SAMPLING,
  type AiSettings
} from '../../shared/ai'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../../shared/settings'
import { resolveLocale } from '../../shared/i18n/locales'
import type {
  BranchInfo,
  CommitDetails,
  CommitSummary,
  FileBlame,
  GitResult,
  GraphCommit,
  RecentReposData,
  RecentRepository,
  RepoGroup,
  RepoStatus,
  RepoUpdateStatus
} from '../../shared/git'
import type { UpdateStatus } from '../../shared/updates'

const DEMO_PATH = 'C:\\Demo\\OpenGitDesktop'

const AI_DEFAULTS: AiSettings = {
  activeProvider: 'ollama',
  samplingMode: 'system',
  userSampling: SYSTEM_SAMPLING,
  maxDiffChars: DEFAULT_MAX_DIFF_CHARS,
  investigationConcurrency: DEFAULT_INVESTIGATION_CONCURRENCY,
  investigationContextTokens: DEFAULT_INVESTIGATION_CONTEXT_TOKENS,
  reasoningEffort: 'off',
  providers: {
    openai: { model: '', apiBaseUrl: '' },
    claude: { model: '', apiBaseUrl: '' },
    openrouter: { model: '', apiBaseUrl: '' },
    ollama: { model: 'llama3.2', apiBaseUrl: 'http://localhost:11434' },
    local: { model: '', apiBaseUrl: '' }
  }
}

let appSettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  lastRepositoryPath: DEMO_PATH,
  cloneBaseFolders: ['C:\\Demo']
}

let aiSettings: AiSettings = structuredClone(AI_DEFAULTS)
const secrets = new Map<string, string>()
const GITHUB_UNAVAILABLE = 'O GitHub não está disponível no preview de browser.'

function demoGithub(): boolean {
  try {
    return localStorage.getItem('demoGithub') === '1'
  } catch {
    return false
  }
}

const DEMO_USER = { login: 'demo-dev', name: 'Demo Dev', avatarUrl: 'https://github.com/github.png' }

const hoursAgo = (h: number): string => new Date(Date.now() - h * 3600e3).toISOString()

const DEMO_PRS = [
  { number: 19, title: 'Redesenha o diálogo Clonar repositório', body: 'O clone aparece como uma **rota** do remoto até a pasta local.\n\n- Lista rica com dono, linguagem e data\n- Filtro por dono', state: 'open' as const, draft: false, merged: false, headRef: 'feature/redesenho-clonar', headSha: 'a1b2c3d', baseRef: 'feature/grafo-historico', mergeable: null, mergeableState: null, authorLogin: 'demo-dev', htmlUrl: 'https://github.com/demo/OpenGitDesktop/pull/19', createdAt: hoursAgo(1) },
  { number: 18, title: 'Grafo do histórico, cards visuais no chat, autoria, tags e nova tela inicial', body: 'Grafo, autoria por linha, tags e uma tela inicial nova.', state: 'open' as const, draft: false, merged: false, headRef: 'feature/grafo-historico', headSha: 'b2c3d4e', baseRef: 'main', mergeable: null, mergeableState: null, authorLogin: 'demo-dev', htmlUrl: 'https://github.com/demo/OpenGitDesktop/pull/18', createdAt: hoursAgo(5) },
  { number: 17, title: 'Corrige o tema escuro em alto contraste', body: null, state: 'open' as const, draft: false, merged: false, headRef: 'fix/alto-contraste', headSha: 'c3d4e5f', baseRef: 'main', mergeable: null, mergeableState: null, authorLogin: 'octocat', htmlUrl: 'https://github.com/demo/OpenGitDesktop/pull/17', createdAt: hoursAgo(30) },
  { number: 16, title: 'Experimento: atalhos de teclado configuráveis', body: null, state: 'open' as const, draft: true, merged: false, headRef: 'exp/atalhos', headSha: 'd4e5f6a', baseRef: 'main', mergeable: null, mergeableState: null, authorLogin: 'hubot', htmlUrl: 'https://github.com/demo/OpenGitDesktop/pull/16', createdAt: hoursAgo(80) },
  { number: 13, title: 'Bump undici from 7.29.1 to 7.30.1', body: null, state: 'closed' as const, draft: false, merged: true, headRef: 'dependabot/undici', headSha: 'e5f6a7b', baseRef: 'main', mergeable: null, mergeableState: null, authorLogin: 'dependabot', htmlUrl: 'https://github.com/demo/OpenGitDesktop/pull/13', createdAt: hoursAgo(200) },
  { number: 11, title: 'Tentativa de cache no grafo', body: null, state: 'closed' as const, draft: false, merged: false, headRef: 'exp/cache', headSha: 'f6a7b8c', baseRef: 'main', mergeable: null, mergeableState: null, authorLogin: 'octocat', htmlUrl: 'https://github.com/demo/OpenGitDesktop/pull/11', createdAt: hoursAgo(400) }
]

const DEMO_PR_FILES = [
  { filename: 'GitWeb/src/renderer/src/components/CloneModal.tsx', status: 'modified', additions: 590, deletions: 206, patch: '@@ -1,4 +1,6 @@ import\n-import { KeyRound } from \'lucide-react\'\n+import { ArrowDownToLine, KeyRound } from \'lucide-react\'\n+import { relativeTime } from \'../lib/relativeTime\'\n import Github from \'./icons/Github\'\n import { useRepoStore } from \'../store/repoStore\'' },
  { filename: 'GitWeb/src/renderer/src/styles/global.css', status: 'modified', additions: 242, deletions: 0, patch: '@@ -1520,3 +1520,8 @@\n }\n+\n+.clone-sheet {\n+  animation: clone-sheet-in 320ms;\n+}' },
  { filename: 'GitWeb/src/shared/i18n/messages/clone.ts', status: 'modified', additions: 66, deletions: 3, patch: '@@ -36,3 +36,5 @@\n-  baseFoldersAria: \'Pastas-base cadastradas\'\n+  baseFoldersAria: \'Pastas-base cadastradas\',\n+  subtitle: \'Traga um repositório para a sua bancada.\'' },
  { filename: 'GitWeb/src/shared/github.ts', status: 'modified', additions: 7, deletions: 0, patch: '@@ -15,3 +15,8 @@\n   private: boolean\n+  description?: string | null\n+  language?: string | null' },
  { filename: 'GitWeb/test/cloneRoute.test.ts', status: 'added', additions: 48, deletions: 0, patch: '@@ -0,0 +1,3 @@\n+import { describe } from \'vitest\'\n+\n+describe(\'route\', () => {})' }
]

const DEMO_PR_COMMENTS = [
  { id: 1, authorLogin: 'octocat', body: 'Ficou ótimo! Só uma dúvida: o selo **na bancada** compara só o nome da pasta?', createdAt: hoursAgo(0.8) },
  { id: 2, authorLogin: 'demo-dev', body: 'Isso, só o nome. Deixei anotado na descrição.', createdAt: hoursAgo(0.5) }
]

const demoStatus: RepoStatus = {
  branch: 'main',
  upstream: 'origin/main',
  ahead: 1,
  behind: 0,
  entries: [
    { path: 'README.md', index: ' ', worktree: 'M' },
    { path: 'src/app.ts', index: 'A', worktree: ' ' }
  ]
}

const demoUpdateStatus: RepoUpdateStatus = {
  state: 'behind',
  message: '3 commit(s) atrás de origin/main.',
  branch: 'main',
  defaultBranch: 'main',
  behindDefault: 3,
  aheadOfDefault: 1,
  hasLocalDefault: true,
  localDefaultBehind: 3,
  localDefaultAhead: 0,
  ahead: 1,
  behind: 3,
  localChanges: 2,
  canFastForward: true
}

const demoBranches: BranchInfo[] = [
  { name: 'main', isCurrent: true },
  { name: 'feature/demo', isCurrent: false }
]

const demoLog: CommitSummary[] = [
  {
    hash: 'abc1234567890',
    shortHash: 'abc1234',
    summary: 'Seed commit for browser preview',
    body: '',
    authorName: 'Preview',
    authorEmail: 'preview@local',
    date: new Date().toISOString()
  }
]

/** A year of plausible history for the demo mode — deterministic, so screenshots are stable. */
function demoYear(): CommitSummary[] {
  const people = [
    ['Demo Dev', 'demo@local'],
    ['Octo Cat', 'octo@local'],
    ['Hu Bot', 'hubot@local'],
    ['Mona Lisa', 'mona@local']
  ]
  const subjects = ['Ajusta o grafo', 'Corrige o tema claro', 'Novo cartão no chat', 'Refatora o store', 'Atualiza dependências', 'Melhora o diff', 'Testes do rebase', 'Textos em espanhol']
  const commits: CommitSummary[] = []
  let seed = 7
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let day = 0; day < 365; day++) {
    // Busier lately, quiet weekends, a vacation gap in the middle.
    const date = new Date(Date.now() - day * 86400e3)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    if (day > 150 && day < 175) continue
    const intensity = (weekend ? 0.15 : 0.7) * (day < 60 ? 1.6 : 1)
    const count = Math.floor(rand() * 4 * intensity)
    for (let k = 0; k < count; k++) {
      const [authorName, authorEmail] = people[Math.floor(Math.pow(rand(), 1.8) * people.length)]
      date.setHours(9 + Math.floor(rand() * 10), Math.floor(rand() * 60))
      const hash = (Math.floor(rand() * 0xffffffff).toString(16) + day.toString(16) + k).padEnd(12, '0')
      commits.push({ hash, shortHash: hash.slice(0, 7), summary: subjects[Math.floor(rand() * subjects.length)], body: '', authorName, authorEmail, date: date.toISOString() })
    }
  }
  return commits
}

const DEMO_ROOT = DEMO_PATH.replace(/OpenGitDesktop$/, '')
const recentGroups: RepoGroup[] = []
const recent: RecentRepository[] = [
  { path: DEMO_PATH, name: 'OpenGitDesktop', groupId: null, missing: false },
  { path: `${DEMO_ROOT}api-pagamentos`, name: 'api-pagamentos', groupId: null, missing: false },
  { path: `${DEMO_ROOT}site-institucional`, name: 'site-institucional', groupId: null, missing: false },
  { path: `${DEMO_ROOT}design-tokens`, name: 'design-tokens', groupId: null, missing: false },
  { path: `${DEMO_ROOT}scripts-locais`, name: 'scripts-locais', groupId: null, missing: false },
  { path: `${DEMO_ROOT}legado-erp`, name: 'legado-erp', groupId: null, missing: false },
  { path: `${DEMO_ROOT}prototipo-antigo`, name: 'prototipo-antigo', groupId: null, missing: true }
]

// One recent repository per state the start screen can draw.
function demoRepoStatus(path: string): RepoUpdateStatus {
  const base = { ...demoUpdateStatus, localChanges: 0, ahead: 0, behind: 0, refreshing: false }
  if (path.endsWith('api-pagamentos')) {
    return { ...base, state: 'diverged', branch: 'develop', defaultBranch: 'main', localDefaultAhead: 2, localDefaultBehind: 5, behindDefault: 5, canFastForward: false, message: 'main local divergiu de origin/main.' }
  }
  if (path.endsWith('site-institucional')) {
    return { ...base, state: 'upToDate', branch: 'main', behindDefault: 0, localDefaultBehind: 0, aheadOfDefault: 0, canFastForward: false, message: 'Em dia com origin/main.' }
  }
  if (path.endsWith('design-tokens')) {
    return { ...base, state: 'upToDate', branch: 'feature/tema-claro', behindDefault: 0, localDefaultBehind: 0, ahead: 3, localChanges: 4, canFastForward: false, message: 'Em dia com origin/main.' }
  }
  if (path.endsWith('scripts-locais')) {
    return { ...base, state: 'noRemote', branch: 'main', defaultBranch: null, behindDefault: 0, localDefaultBehind: 0, ahead: 2, localChanges: 1, canFastForward: false, message: 'Sem remote configurado.' }
  }
  if (path.endsWith('legado-erp')) {
    return { ...base, state: 'failed', branch: 'master', behindDefault: 0, canFastForward: false, message: 'fatal: could not read from remote repository.' }
  }
  return demoUpdateStatus
}
const recentData = (): RecentReposData => ({ groups: recentGroups, repos: recent })
const newRecent = (path: string): RecentRepository => ({
  path,
  name: path.split(/[/\\]/).pop() ?? path,
  groupId: null,
  missing: false
})

const demoCommitDetails: CommitDetails = { ...demoLog[0], parents: [] }

// A small but branchy history so the History graph can be reviewed in the
// browser preview: a feature branch merged into main, one still open, a
// remote-only branch and a release tag.
function demoCommit(
  id: string,
  summary: string,
  author: string,
  hoursAgo: number,
  parents: string[],
  refs: GraphCommit['refs'] = []
): GraphCommit {
  const hash = id.padEnd(40, '0')
  return {
    hash,
    shortHash: hash.slice(0, 7),
    authorName: author,
    authorEmail: `${author.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    date: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    summary,
    body: '',
    parents: parents.map((p) => p.padEnd(40, '0')),
    refs
  }
}

const demoGraph: GraphCommit[] = [
  demoCommit('a1f3c90', 'Adiciona grafo de commits ao Histórico', 'Ana Souza', 1, ['b27d4e1'], [
    { name: 'main', kind: 'local', current: true }
  ]),
  demoCommit('c4e81aa', 'Cards visuais para resultados do agente', 'Diego Lima', 3, ['d9b2f07'], [
    { name: 'feature/agent-cards', kind: 'local' },
    { name: 'origin/feature/agent-cards', kind: 'remote' }
  ]),
  demoCommit('b27d4e1', 'Corrige rolagem do histórico virtualizado', 'Ana Souza', 5, ['e55a0c3'], [
    { name: 'origin/main', kind: 'remote' }
  ]),
  demoCommit('e55a0c3', "Merge branch 'feature/blame'", 'Paula Reis', 9, ['f0c7d21', '7aa9e34']),
  demoCommit('7aa9e34', 'Blame colorido pela idade da linha', 'Paula Reis', 12, ['18bd5f2']),
  demoCommit('d9b2f07', 'Esqueleto do componente ToolVisual', 'Diego Lima', 14, ['f0c7d21']),
  demoCommit('18bd5f2', 'Timeline de arquivo com +/−', 'Paula Reis', 20, ['f0c7d21']),
  demoCommit('f0c7d21', 'Prepara release 0.1.0', 'Ana Souza', 30, ['3e9c6b8'], [{ name: 'v0.1.0', kind: 'tag' }]),
  demoCommit('9d04e5b', 'Experimento de tema claro', 'Rafa Prado', 34, ['3e9c6b8'], [
    { name: 'origin/experiment/light', kind: 'remote' }
  ]),
  demoCommit('3e9c6b8', 'Painel de PR com etapas', 'Diego Lima', 40, ['2c5aa10']),
  demoCommit('2c5aa10', 'Stage por hunk no diff', 'Ana Souza', 52, ['0b1e2f3']),
  demoCommit('0b1e2f3', 'Commit inicial', 'Ana Souza', 80, [])
]

function demoBlame(path: string): FileBlame {
  const source = [
    "import { useMemo } from 'react'",
    "import { computeGraphLayout } from '../lib/commitGraph'",
    '',
    'export function Graph({ commits }) {',
    '  const layout = useMemo(() => computeGraphLayout(commits), [commits])',
    '  if (layout.rows.length === 0) return null',
    '  return (',
    '    <svg width={layout.width}>',
    '      {layout.rows.map((row) => <Row key={row.hash} row={row} />)}',
    '    </svg>',
    '  )',
    '}'
  ]
  const owners = [11, 11, 11, 7, 6, 4, 7, 2, 0, 2, 7, 11]
  const commits: FileBlame['commits'] = {}
  const lines = source.map((content, i) => {
    const c = demoGraph[owners[i]]
    commits[c.hash] = { hash: c.hash, shortHash: c.shortHash, authorName: c.authorName, date: c.date, summary: c.summary, uncommitted: false }
    return { line: i + 1, content, hash: c.hash }
  })
  return { path, rev: null, lines, commits, totalLines: lines.length, truncated: false }
}

const okGit = (): GitResult => ({ exitCode: 0, stdout: '', stderr: '' })

function installBrowserApiStub(): void {
  if (typeof window === 'undefined' || window.api) return

  const api: Api = {
    app: {
      getVersion: async () => '0.1.0-browser-preview',
      getUpdateStatus: async (): Promise<UpdateStatus> => ({
        state: 'disabled',
        reason: 'Atualizações automáticas só funcionam na versão instalada.'
      }),
      checkForUpdates: async (): Promise<UpdateStatus> => ({
        state: 'disabled',
        reason: 'Atualizações automáticas só funcionam na versão instalada.'
      }),
      quitAndInstall: async () => undefined,
      // No page capture outside Electron; the chat then clears without the dust effect.
      capturePage: async () => {
        throw new Error('Captura de página indisponível no navegador.')
      },
      onUpdateStatus: () => () => undefined
    },
    git: {
      isRepository: async () => true,
      scanForRepositories: async () => [],
      init: async () => undefined,
      clone: async () => ({ status: 'ok' as const }),
      cancelClone: async () => undefined,
      onCloneProgress: () => () => undefined,
      status: async () => demoStatus,
      stage: async () => undefined,
      unstage: async () => undefined,
      discard: async () => undefined,
      diff: async () => 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
      diffStagedAll: async () => '',
      diffUnstagedAll: async () => 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old\n+new\n',
      branchDiff: async () => '',
      commit: async () => undefined,
      applyPatch: async () => undefined,
      resetSoftHead: async () => undefined,
      commitAmend: async () => undefined,
      branches: async () => demoBranches,
      createBranch: async () => undefined,
      switchBranch: async () => ({ switched: true as const }),
      log: async () => (demoGithub() ? demoYear() : demoLog),
      commitFiles: async () => [],
      commitDiff: async () => '',
      commitDetails: async () => demoCommitDetails,
      commitPatch: async () => '',
      remoteUrl: async () => 'https://github.com/demo/OpenGitDesktop.git',
      getIdentity: async () => ({ local: { name: 'Demo', email: 'demo@example.com' }, global: { name: null, email: null } }),
      setIdentity: async () => undefined,
      listFiles: async () =>
        demoGithub()
          ? [
              ...Array.from({ length: 140 }, (_, i) => `src/renderer/src/file${i}.tsx`),
              ...Array.from({ length: 60 }, (_, i) => `src/main/mod${i}.ts`),
              ...Array.from({ length: 22 }, (_, i) => `src/styles/s${i}.css`),
              ...Array.from({ length: 12 }, (_, i) => `docs/page${i}.md`),
              'package.json',
              'tsconfig.json',
              ...Array.from({ length: 9 }, (_, i) => `assets/icon${i}.png`)
            ]
          : ['README.md', 'src/app.ts'],
      readFileForAgent: async () => '// preview de browser: conteúdo indisponível\n',
      fetch: async () => undefined,
      fetchDryRun: async () => okGit(),
      pull: async () => okGit(),
      push: async () => undefined,
      forcePush: async () => undefined,
      stashPatch: async () => '',
      revertCommit: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      remoteBranches: async () => [],
      branchIntegration: async () => ({ base: 'origin/main', protectedNames: ['main', 'master'], branches: [] }),
      deleteIntegratedBranches: async () => [],
      checkoutRemoteBranch: async () => ({ switched: true as const }),
      deleteBranch: async () => undefined,
      branchDeleteCheck: async () => {
        throw new Error('Not available in the browser preview.')
      },
      deleteCheckedBranch: async () => undefined,
      renameBranch: async () => undefined,
      deleteRemoteBranch: async () => undefined,
      repoUpdateStatus: async (cwd: string) => demoRepoStatus(cwd),
      updateToDefaultBranch: async () => ({
        outcome: 'updated' as const,
        message: '3 commit(s) baixado(s) em "main" (preview).',
        commitsPulled: 3
      }),
      merge: async () => okGit(),
      mergeAbort: async () => undefined,
      stashList: async () => [],
      stashPush: async () => undefined,
      stashApply: async () => undefined,
      stashPop: async () => undefined,
      stashDrop: async () => undefined,
      addToGitIgnore: async () => ({ success: true, message: 'Adicionado ao .gitignore (preview).' }),
      stopTracking: async () => ({ success: true, message: '' }),
      locateFileInHistory: async (_cwd: string, path: string) => ({
        path,
        upstream: 'origin/main',
        localCommits: [],
        undoCount: 0,
        onRemote: false,
        existsOnDisk: true,
        inIndex: true
      }),
      isPathIgnored: async () => false,
      isCommitPublished: async () => false,
      undoUnpublishedCommit: async () => undefined,
      graphLog: async () => demoGraph,
      logWithStats: async () => demoGraph.slice(0, 6).map((c, i) => ({ ...c, additions: 12 * (i + 1), deletions: 3 * i, files: i + 1 })),
      commitFileStats: async () => [
        { path: 'src/renderer/src/views/HistoryView.tsx', status: 'M', additions: 84, deletions: 12, binary: false },
        { path: 'src/renderer/src/lib/commitGraph.ts', status: 'A', additions: 140, deletions: 0, binary: false },
        { path: 'README.md', status: 'M', additions: 2, deletions: 1, binary: false }
      ],
      commitRange: async () => ({ commits: demoGraph.slice(1, 4), total: 3 }),
      refsContaining: async () => [
        { name: 'main', kind: 'local' as const, current: true },
        { name: 'origin/main', kind: 'remote' as const },
        { name: 'v0.1.0', kind: 'tag' as const }
      ],
      fileBlame: async (_cwd: string, path: string) => demoBlame(path),
      fileTimeline: async () => demoGraph.slice(0, 7).map((c, i) => ({ ...c, additions: 20 - i * 2, deletions: i })),
      listTags: async () => [
        { name: 'v0.1.0', target: demoGraph[6].hash, shortTarget: demoGraph[6].shortHash, date: demoGraph[6].date, annotated: true, message: 'v0.1.0' }
      ],
      createTag: async (_cwd: string, name: string) => ({
        name,
        target: demoGraph[0].hash,
        shortTarget: demoGraph[0].shortHash,
        date: new Date().toISOString(),
        annotated: true,
        message: name
      }),
      pushTag: async () => undefined,
      latestTag: async () => 'v0.1.0',
      localRebaseInfo: async () => ({
        branch: 'main',
        head: demoGraph[0].hash,
        base: demoGraph[3].hash,
        commits: demoGraph.slice(0, 3).reverse(),
        blocked: null
      }),
      runLocalRebase: async () => ({ newHead: demoGraph[0].hash, commitCount: 2 }),
      workingTreeStats: async () => ({
        staged: [{ path: 'src/renderer/src/views/ChangesView.tsx', additions: 48, deletions: 12, binary: false }],
        unstaged: [
          { path: 'src/main/gitProcess.ts', additions: 31, deletions: 4, binary: false },
          { path: 'README.md', additions: 2, deletions: 2, binary: false }
        ]
      }),
      branchOverview: async () => [
        { name: 'main', isCurrent: true, date: new Date(Date.now() - 3600e3).toISOString(), subject: 'Grafo do histórico', upstream: 'origin/main', ahead: 1, behind: 3, gone: false },
        { name: 'feature/novo-grafo', isCurrent: false, date: new Date(Date.now() - 2 * 86400e3).toISOString(), subject: 'Layout das faixas', upstream: 'origin/feature/novo-grafo', ahead: 2, behind: 0, gone: false },
        { name: 'fix/espaco-em-branco', isCurrent: false, date: new Date(Date.now() - 21 * 86400e3).toISOString(), subject: 'Corrige espaço', upstream: 'origin/fix/espaco-em-branco', ahead: 0, behind: 0, gone: true },
        { name: 'experimento', isCurrent: false, date: new Date(Date.now() - 90 * 86400e3).toISOString(), subject: 'Teste local', upstream: null, ahead: 0, behind: 0, gone: false }
      ],
      repoChurn: async () => ({
        commits: Array.from({ length: 60 }, (_, i) => ({
          date: new Date(Date.now() - i * 2.5 * 86400e3).toISOString(),
          additions: 20 + ((i * 37) % 160),
          deletions: 5 + ((i * 23) % 70)
        })),
        hotspots: [
          { path: 'src/renderer/src/views/ChangesView.tsx', commits: 18, additions: 640, deletions: 210 },
          { path: 'src/main/gitProcess.ts', commits: 14, additions: 820, deletions: 120 },
          { path: 'src/renderer/src/store/repoStore.ts', commits: 11, additions: 300, deletions: 140 },
          { path: 'src/shared/i18n/messages/main.ts', commits: 7, additions: 160, deletions: 40 },
          { path: 'package.json', commits: 5, additions: 12, deletions: 9 }
        ],
        truncated: false
      })
    },
    fs: {
      readRepoFile: async () => '',
      writeRepoFile: async () => undefined,
      resolveRepoPath: async (_cwd, path) => `${DEMO_PATH}\\${path.replace(/\//g, '\\')}`,
      pathExists: async () => true
    },
    shell: {
      showItemInFolder: async () => undefined,
      openPath: async () => ''
    },
    dialogs: {
      openDirectory: async () => DEMO_PATH
    },
    secrets: {
      save: async (key, value) => {
        secrets.set(key, value)
      },
      get: async (key) => secrets.get(key) ?? null,
      delete: async (key) => {
        secrets.delete(key)
      }
    },
    // The browser preview has no main process, so there is nowhere to hold a
    // GitHub session — every call fails the same way instead of pretending.
    github: {
      getOAuthAppInfo: async () => ({ clientId: '', scopes: [], revokeUrl: 'https://github.com/settings/applications' }),
      deviceFlowStart: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      deviceFlowPoll: async () => ({ status: 'error' as const, errorMessage: GITHUB_UNAVAILABLE }),
      deviceFlowCancel: async () => undefined,

      // Opt-in demo session (localStorage.demoGithub = '1') so the Pull
      // Requests screen can be designed in the browser; off by default.
      getSession: async () => (demoGithub() ? DEMO_USER : null),
      loginWithPat: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      logout: async () => undefined,

      listUserRepos: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      listUserReposWithToken: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },

      listPullRequests: async (_host, _owner, _repo, state) =>
        demoGithub() ? DEMO_PRS.filter((pr) => state === 'all' || pr.state === state) : [],
      getPullRequest: async (_host, _owner, _repo, number) => {
        const pr = demoGithub() ? DEMO_PRS.find((p) => p.number === number) : undefined
        if (!pr) throw new Error(GITHUB_UNAVAILABLE)
        return { ...pr, mergeable: pr.number !== 17, mergeableState: pr.number === 17 ? 'dirty' : 'clean' }
      },
      getBranchRules: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      getPullRequestStatus: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      createPullRequest: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      listPullRequestFiles: async () => (demoGithub() ? DEMO_PR_FILES : []),
      listPullRequestComments: async () => (demoGithub() ? DEMO_PR_COMMENTS : []),
      addPullRequestComment: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      mergePullRequest: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      setPullRequestState: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      addPullRequestReviewComment: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      },
      submitPullRequestReview: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
      }
    },
    recentRepos: {
      list: async () => recentData(),
      add: async (path) => {
        if (!recent.some((r) => r.path === path)) recent.unshift(newRecent(path))
        return recentData()
      },
      addMany: async (paths) => {
        for (const path of paths) {
          if (!recent.some((r) => r.path === path)) recent.unshift(newRecent(path))
        }
        return recentData()
      },
      remove: async (path) => {
        const i = recent.findIndex((r) => r.path === path)
        if (i >= 0) recent.splice(i, 1)
        return recentData()
      },
      createGroup: async (name) => {
        recentGroups.push({ id: `g${recentGroups.length + 1}`, name, collapsed: false })
        return recentData()
      },
      renameGroup: async (id, name) => {
        const group = recentGroups.find((g) => g.id === id)
        if (group) group.name = name
        return recentData()
      },
      deleteGroup: async (id) => {
        const i = recentGroups.findIndex((g) => g.id === id)
        if (i >= 0) recentGroups.splice(i, 1)
        for (const repo of recent) if (repo.groupId === id) repo.groupId = null
        return recentData()
      },
      setRepoGroup: async (path, groupId) => {
        const repo = recent.find((r) => r.path === path)
        if (repo) repo.groupId = groupId
        return recentData()
      },
      setGroupCollapsed: async (id, collapsed) => {
        const group = recentGroups.find((g) => g.id === id)
        if (group) group.collapsed = collapsed
        return recentData()
      }
    },
    settings: {
      get: async () => appSettings,
      setLastRepositoryPath: async (path) => {
        appSettings = { ...appSettings, lastRepositoryPath: path }
      },
      setAppSettings: async (partial) => {
        appSettings = { ...appSettings, ...partial }
        return appSettings
      },
      getSystemLocale: async () => resolveLocale(navigator.languages)
    },
    ai: {
      getSettings: async () => structuredClone(aiSettings),
      setSettings: async (settings) => {
        aiSettings = structuredClone(settings)
      },
      sendChatRequest: async () => ({
        content: 'ok',
        toolCalls: []
      }),
      listModels: async () => ['llama3.2', 'qwen2.5'],
      abortChatRequest: async () => undefined,
      sendToolAwareChatRequest: async () => ({
        ok: true,
        response: {
          content:
            'Modo preview no browser — as ações reais de Git só rodam no Electron. Use a aba IA para revisar o layout.',
          toolCalls: []
        }
      })
    }
  }

  window.api = api
  document.documentElement.dataset.browserPreview = 'true'
  console.info('[OpenGitDesktop] Browser preview stub active — Git/AI IPC is mocked.')
}

installBrowserApiStub()
