import { Children, isValidElement, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { isEmptyInvestigationMarkdown, isInvestigationMarkdown } from '../../../shared/aiPrompts'
import { useAiUi } from '../lib/useAiUi'
import { useAiStore } from '../store/aiStore'

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false
  try {
    const parsed = new URL(href, 'https://example.invalid')
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function isFindingHeading(children: ReactNode): boolean {
  const first = Children.toArray(children)[0]
  if (!isValidElement<{ children?: ReactNode }>(first)) return false
  const text = Children.toArray(first.props.children).join('')
  return /^\[P[1-3]\]/.test(text)
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return Children.toArray(node).map(textOf).join('')
}

function isDescriptionHeading(children: ReactNode, heading: string): boolean {
  const first = Children.toArray(children)[0]
  if (!isValidElement<{ children?: ReactNode }>(first)) return false
  return textOf(first.props.children).trim() === heading
}

function DescriptionHelp({ description, children }: { description: string; children: ReactNode }): JSX.Element {
  const ui = useAiUi()
  const explain = useAiStore((state) => state.explainBugDescription)
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [hasGeneratedExplanation, setHasGeneratedExplanation] = useState(false)
  const [expanded, setExpanded] = useState(true)

  async function handleClick(): Promise<void> {
    if (loading) return
    setLoading(true)
    try {
      setExplanation(await explain(description))
      setHasGeneratedExplanation(true)
      setExpanded(true)
    } catch (error) {
      setExplanation(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {children}{' '}
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={loading || hasGeneratedExplanation}
          className="ml-1 inline-flex h-6 w-6 align-text-bottom items-center justify-center rounded-sm border border-default-border text-tertiary-text transition-colors hover:border-command-blue/40 hover:bg-command-blue-soft hover:text-command-blue disabled:opacity-60"
          title={hasGeneratedExplanation ? ui.explainDescriptionDoneTitle : ui.explainDescriptionTitle}
          aria-label={ui.explainDescriptionAria}
        >
          {loading ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Info size={11} aria-hidden />}
        </button>
      </p>
      {explanation && (
        <div className="mt-2 rounded-md border border-command-blue/25 bg-command-blue-soft px-2.5 py-2 text-caption text-secondary-text">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="flex w-full items-center gap-1.5 text-left font-medium text-primary-text"
          >
            {expanded ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
            {ui.detailedExplanation}
          </button>
          {expanded && (
            <div className="mt-2">
              <MarkdownBlock text={explanation} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function splitFindingCards(text: string): { intro: string; cards: string[] } | null {
  const lines = text.trim().split('\n')
  const starts = lines.flatMap((line, index) => (/^\*\*\[P[1-3]\]\*\*/.test(line) ? [index] : []))
  if (starts.length === 0) return null

  return {
    intro: lines.slice(0, starts[0]).join('\n').trim(),
    cards: starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length).join('\n').trim())
  }
}

function markdownComponents(
  isInvestigationResult: boolean,
  enableDescriptionHelp: boolean,
  descriptionHeading: string
): Components {
  return {
    p: ({ children }) => {
      const finding = isInvestigationResult && isFindingHeading(children)
      const description = enableDescriptionHelp && isDescriptionHeading(children, descriptionHeading)
      const descriptionText = description ? textOf(Children.toArray(children).slice(1)).trim() : ''
      if (description && descriptionText) {
        return <DescriptionHelp description={descriptionText}>{children}</DescriptionHelp>
      }
      return (
        <p
          className={
            finding
              ? 'mt-8 whitespace-pre-wrap [overflow-wrap:anywhere]'
              : 'whitespace-pre-wrap [overflow-wrap:anywhere] [&:not(:first-child)]:mt-2'
          }
        >
          {children}
        </p>
      )
    },
    strong: ({ children }) => <strong className="font-semibold text-primary-text">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    a: ({ children, href }) =>
      isSafeHref(href) ? (
        <a href={href} target="_blank" rel="noreferrer" className="break-words text-command-blue underline hover:opacity-80">
          {children}
        </a>
      ) : (
        <span className="break-words text-command-blue underline">{children}</span>
      ),
    ul: ({ children }) => <ul className="ml-4 mt-1.5 list-disc space-y-1 [&:first-child]:mt-0">{children}</ul>,
    ol: ({ children }) => <ol className="ml-4 mt-1.5 list-decimal space-y-1 [&:first-child]:mt-0">{children}</ol>,
    li: ({ children }) => <li className="[overflow-wrap:anywhere]">{children}</li>,
    h1: ({ children }) => <h1 className="mt-2 text-title font-semibold text-primary-text [&:first-child]:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="mt-2 text-title font-semibold text-primary-text [&:first-child]:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-2 font-semibold text-primary-text [&:first-child]:mt-0">{children}</h3>,
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className ?? '')
      if (isBlock) {
        return (
          <code className={`block overflow-x-auto whitespace-pre font-mono text-caption ${className ?? ''}`}>{children}</code>
        )
      }
      return (
        <code className="rounded-sm border border-default-border bg-midnight-base px-1 py-0.5 font-mono text-[0.85em] text-attention-orange [overflow-wrap:anywhere]">
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="mt-1.5 overflow-x-auto rounded-md border border-default-border bg-midnight-base p-2.5">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mt-1.5 border-l-2 border-command-blue/40 pl-3 text-secondary-text">{children}</blockquote>
    ),
    hr: () => <hr className="my-2 border-default-border" />,
    table: ({ children }) => (
      <div className="mt-1.5 overflow-x-auto">
        <table className="border-collapse text-caption">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border border-default-border px-2 py-1 text-left font-medium">{children}</th>,
    td: ({ children }) => <td className="border border-default-border px-2 py-1">{children}</td>
  }
}

function MarkdownBlock({
  text,
  isInvestigationResult = false,
  enableDescriptionHelp = false
}: {
  text: string
  isInvestigationResult?: boolean
  enableDescriptionHelp?: boolean
}): JSX.Element {
  const ui = useAiUi()
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={markdownComponents(isInvestigationResult, enableDescriptionHelp, ui.bugDescriptionHeading)}
    >
      {text}
    </ReactMarkdown>
  )
}

function Markdown({ text }: { text: string }): JSX.Element {
  const ui = useAiUi()
  const isInvestigationResult = isInvestigationMarkdown(text)
  const findingCards = isInvestigationResult ? splitFindingCards(text) : null

  if (isEmptyInvestigationMarkdown(text)) {
    return (
      <div className="flex items-start gap-2">
        <Check size={13} className="mt-0.5 shrink-0 text-success-green" aria-hidden />
        <span className="text-caption text-secondary-text">{ui.emptyInvestigation}</span>
      </div>
    )
  }

  if (findingCards) {
    return (
      <div>
        {findingCards.intro && <MarkdownBlock text={findingCards.intro} />}
        <div className="mt-4 flex flex-col gap-6">
          {findingCards.cards.map((card, index) => (
            <div key={index} className="rounded-md border border-default-border bg-coal-raised p-3">
              <MarkdownBlock text={card} enableDescriptionHelp />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <MarkdownBlock text={text} isInvestigationResult={isInvestigationResult} />
}

export default Markdown
