import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../lib/i18n'

function Pagination({
  page,
  pageCount,
  onChange
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}): JSX.Element | null {
  const t = useT().ui
  if (pageCount <= 1) return null

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-default-border py-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t.previousPage}
        className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={14} aria-hidden />
      </button>
      <span className="text-caption tabular-nums text-tertiary-text">
        {t.pageOf(page, pageCount)}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label={t.nextPage}
        className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  )
}

export default Pagination
