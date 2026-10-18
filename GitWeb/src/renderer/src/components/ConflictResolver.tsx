import { useMemo, useState } from 'react'
import { CheckCircle2, GitMerge } from 'lucide-react'
import { parseConflictBlocks, renderResolved, type Resolution } from '../lib/conflicts'
import { useRepoStore } from '../store/repoStore'
import { useT } from '../lib/i18n'

interface ConflictResolverProps {
  path: string
  content: string
}

function ChoiceButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'inline-flex items-center gap-1.5 rounded-md border border-command-blue bg-command-blue-soft px-2.5 h-8 text-caption text-command-blue'
          : 'inline-flex items-center gap-1.5 rounded-md border border-default-border bg-coal-raised px-2.5 h-8 text-caption text-secondary-text hover:bg-hover-overlay'
      }
    >
      {active && <CheckCircle2 size={13} />}
      {children}
    </button>
  )
}

function ConflictResolver({ path, content }: ConflictResolverProps): JSX.Element {
  const resolveConflict = useRepoStore((s) => s.resolveConflict)
  const isBusy = useRepoStore((s) => s.isBusy)
  const t = useT().ui
  const blocks = useMemo(() => parseConflictBlocks(content), [content])
  const conflictBlocks = blocks.filter((b) => b.type === 'conflict')
  const [resolutions, setResolutions] = useState<Map<number, Resolution>>(new Map())

  function choose(id: number, resolution: Resolution): void {
    setResolutions((prev) => new Map(prev).set(id, resolution))
  }

  const allResolved = conflictBlocks.every((b) => resolutions.has(b.id))

  async function handleSave(): Promise<void> {
    const resolved = renderResolved(blocks, resolutions)
    await resolveConflict(path, resolved)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center gap-2 text-title font-semibold text-warning-amber">
        <GitMerge size={16} />
        <span>
          {t.conflictsIn(conflictBlocks.length)}{' '}
          <span className="text-secondary-text">{path}</span>
        </span>
      </div>

      {blocks.map((block, index) =>
        block.type === 'text' ? (
          <pre key={index} className="whitespace-pre-wrap font-mono text-caption text-tertiary-text">
            {block.lines.join('\n')}
          </pre>
        ) : (
          <div key={block.id} className="overflow-hidden rounded-lg border border-default-border">
            <div className="border-b border-default-border bg-success-green-soft">
              <div className="px-3 py-1 text-label uppercase text-success-green">
                {block.oursLabel || t.ours}
              </div>
              <pre className="whitespace-pre-wrap px-3 pb-3 font-mono text-caption text-primary-text">
                {block.ours.join('\n')}
              </pre>
            </div>
            <div className="border-b border-default-border bg-command-blue-soft">
              <div className="px-3 py-1 text-label uppercase text-command-blue">
                {block.theirsLabel || t.theirs}
              </div>
              <pre className="whitespace-pre-wrap px-3 pb-3 font-mono text-caption text-primary-text">
                {block.theirs.join('\n')}
              </pre>
            </div>
            <div className="flex gap-2 bg-obsidian-panel p-2">
              <ChoiceButton active={resolutions.get(block.id) === 'ours'} onClick={() => choose(block.id, 'ours')}>
                {t.useOurs}
              </ChoiceButton>
              <ChoiceButton active={resolutions.get(block.id) === 'theirs'} onClick={() => choose(block.id, 'theirs')}>
                {t.useTheirs}
              </ChoiceButton>
              <ChoiceButton active={resolutions.get(block.id) === 'both'} onClick={() => choose(block.id, 'both')}>
                {t.keepBoth}
              </ChoiceButton>
            </div>
          </div>
        )
      )}

      <div className="sticky bottom-0 pt-2">
        <button type="button" onClick={handleSave} disabled={!allResolved || isBusy} className="btn-primary w-full">
          {t.saveResolved}
        </button>
      </div>
    </div>
  )
}

export default ConflictResolver
