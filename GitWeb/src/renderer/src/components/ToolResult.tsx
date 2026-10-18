import { useState } from 'react'
import Markdown from './Markdown'

// Long results (a PR's diffs, a big log) would otherwise blow up the chat
// bubble's layout — collapsed by default, with an explicit toggle to expand
// inside a scrollable box instead of stretching the page.
const LONG_RESULT_THRESHOLD = 500

function renderBlock(text: string, markdown: boolean | undefined, colorClass: string): JSX.Element {
  return markdown ? (
    <div className={`text-caption ${colorClass}`}>
      <Markdown text={text} />
    </div>
  ) : (
    <div className={`whitespace-pre-wrap font-mono text-caption ${colorClass}`}>{text}</div>
  )
}

function ToolResult({
  text,
  tone,
  markdown,
  headerLines
}: {
  text: string
  tone: 'default' | 'danger'
  markdown?: boolean
  /** Number of leading lines (e.g. a PR's number/title/author/URL) to always
   * show, even collapsed — only the remainder (description/diffs/comments)
   * is hidden behind the toggle. */
  headerLines?: number
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > LONG_RESULT_THRESHOLD
  const colorClass = tone === 'danger' ? 'text-danger-red' : 'text-secondary-text'

  if (!isLong) return renderBlock(text, markdown, colorClass)

  if (headerLines) {
    const lines = text.split('\n')
    const header = lines.slice(0, headerLines).join('\n')
    const rest = lines.slice(headerLines).join('\n').trim()
    return (
      <div>
        {renderBlock(header, false, colorClass)}
        {expanded && <div className="mb-1.5 mt-1.5 max-h-80 overflow-y-auto">{renderBlock(rest, markdown, colorClass)}</div>}
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-caption text-command-blue hover:underline">
          {expanded ? 'Mostrar menos' : 'Mostrar descrição, arquivos e comentários'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {expanded && <div className="mb-1.5 max-h-80 overflow-y-auto">{renderBlock(text, markdown, colorClass)}</div>}
      <button onClick={() => setExpanded((v) => !v)} className="text-caption text-command-blue hover:underline">
        {expanded ? 'Mostrar menos' : `Mostrar resultado completo (${text.length.toLocaleString('pt-BR')} caracteres)`}
      </button>
    </div>
  )
}

export default ToolResult
