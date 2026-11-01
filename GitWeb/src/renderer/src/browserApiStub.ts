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
      log: async () => demoLog,
      commitFiles: async () => [],
      commitDiff: async () => '',
      commitDetails: async () => demoCommitDetails,
      commitPatch: async () => '',
      remoteUrl: async () => 'https://github.com/demo/OpenGitDesktop.git',
      getIdentity: async () => ({ local: { name: 'Demo', email: 'demo@example.com' }, global: { name: null, email: null } }),
      setIdentity: async () => undefined,
      listFiles: async () => ['README.md', 'src/app.ts'],
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
      runLocalRebase: async () => ({ newHead: demoGraph[0].hash, commitCount: 2 })
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

      getSession: async () => null,
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

      listPullRequests: async () => [],
      getPullRequest: async () => {
        throw new Error(GITHUB_UNAVAILABLE)
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
      listPullRequestFiles: async () => [],
      listPullRequestComments: async () => [],
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
