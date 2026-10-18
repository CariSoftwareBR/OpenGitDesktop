import { useState } from 'react'
import { GitMerge, Loader2, Trash2, X } from 'lucide-react'
import { usePullRequestStore } from '../store/pullRequestStore'
import { useRepoStore } from '../store/repoStore'
import ConfirmDialog from './ConfirmDialog'

/**
 * What is left to do once a PR is merged from this screen: the local base is
 * behind, you are still on the feature branch, and that branch now lingers
 * locally and on origin. Each step is one click here instead of three menus.
 */
function PostMergeActions(): JSX.Element | null {
  const lastMerged = usePullRequestStore((s) => s.lastMerged)
  const dismiss = usePullRequestStore((s) => s.dismissLastMerged)
  const currentBranch = useRepoStore((s) => s.status?.branch ?? null)
  const hasLocalHead = useRepoStore((s) => s.branches.some((b) => b.name === lastMerged?.headRef))
  const [running, setRunning] = useState<'switch' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)

  if (!lastMerged) return null
  const { headRef, baseRef, number } = lastMerged
  const onBase = currentBranch === baseRef

  async function switchAndUpdate(): Promise<void> {
    const repo = useRepoStore.getState()
    const path = repo.currentRepoPath
    if (!path) return
    setRunning('switch')
    try {
      if (repo.branches.some((b) => b.name === baseRef)) await repo.switchBranch(baseRef)
      else await repo.checkoutRemoteBranch(`origin/${baseRef}`)
      if (useRepoStore.getState().error) return
      const result = await window.api.git.pull(path)
      if (result.exitCode !== 0) useRepoStore.getState().setError(result.stderr.trim() || 'git pull falhou.')
      await Promise.all([repo.refreshStatus(), repo.refreshBranches(), repo.refreshLog()])
    } finally {
      setRunning(null)
    }
  }

  async function deleteMergedBranch(): Promise<void> {
    const repo = useRepoStore.getState()
    const path = repo.currentRepoPath
    if (!path) return
    setRunning('delete')
    try {
      try {
        await window.api.git.deleteRemoteBranch(headRef, path)
      } catch (err) {
        // GitHub's "delete branch on merge" may already have removed it.
        const message = err instanceof Error ? err.message : String(err)
        if (!/remote ref does not exist|unable to delete/i.test(message)) {
          repo.setError(message)
          return
        }
      }
      // Squash and rebase merges leave the local branch "unmerged" as far as
      // git can tell, although GitHub just merged its content — hence -D.
      if (useRepoStore.getState().branches.some((b) => b.name === headRef)) await repo.deleteBranch(headRef, true)
      if (!useRepoStore.getState().error) setDeleted(true)
      await repo.refreshBranches()
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-default-border bg-obsidian-panel p-4 text-left">
      <div className="flex items-start gap-2">
        <GitMerge size={16} className="mt-0.5 shrink-0 text-success-green" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-primary-text">
            PR #{number} mesclada em {baseRef}
          </p>
          <p className="mt-0.5 text-caption text-secondary-text">Próximos passos sugeridos:</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="hit-area rounded-sm p-1 text-tertiary-text transition-colors hover:bg-hover-overlay hover:text-primary-text"
          aria-label="Dispensar próximos passos"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="btn-secondary justify-center"
          onClick={() => void switchAndUpdate()}
          disabled={running !== null}
        >
          {running === 'switch' && <Loader2 size={13} className="animate-spin" aria-hidden />}
          {onBase ? `Atualizar ${baseRef}` : `Ir para ${baseRef} e atualizar`}
        </button>
        <button
          type="button"
          className="btn-ghost justify-center text-danger-red"
          onClick={() => setConfirmDelete(true)}
          disabled={running !== null || deleted || currentBranch === headRef}
          title={currentBranch === headRef ? `Troque para outra branch antes de excluir "${headRef}".` : undefined}
        >
          {running === 'delete' ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <Trash2 size={13} aria-hidden />
          )}
          {deleted ? `"${headRef}" excluída` : `Excluir a branch "${headRef}"`}
        </button>
        {currentBranch === headRef && !deleted && (
          <p className="text-caption text-tertiary-text">Para excluir a branch, primeiro vá para {baseRef}.</p>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Excluir branch mesclada?"
        message={`Excluir "${headRef}" no remoto (origin)${hasLocalHead ? ' e localmente' : ''}? O conteúdo dela já está em ${baseRef} pela PR #${number}.`}
        confirmLabel="Excluir"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          void deleteMergedBranch()
        }}
      />
    </div>
  )
}

export default PostMergeActions
