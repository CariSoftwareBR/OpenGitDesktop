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
  GitResult,
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

const recentGroups: RepoGroup[] = []
const recent: RecentRepository[] = [
  { path: DEMO_PATH, name: 'OpenGitDesktop', groupId: null, missing: false }
]
const recentData = (): RecentReposData => ({ groups: recentGroups, repos: recent })
const newRecent = (path: string): RecentRepository => ({
  path,
  name: path.split(/[/\\]/).pop() ?? path,
  groupId: null,
  missing: false
})

const demoCommitDetails: CommitDetails = { ...demoLog[0], parents: [] }

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
      renameBranch: async () => undefined,
      deleteRemoteBranch: async () => undefined,
      repoUpdateStatus: async () => demoUpdateStatus,
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
      undoUnpublishedCommit: async () => undefined
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
