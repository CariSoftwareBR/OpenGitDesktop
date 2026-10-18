import { ChevronLeft, ChevronRight } from 'lucide-react'

function Pagination({
  page,
  pageCount,
  onChange
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}): JSX.Element | null {
  if (pageCount <= 1) return null

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-default-border py-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
        className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft size={14} aria-hidden />
      </button>
      <span className="text-caption tabular-nums text-tertiary-text">
        Página {page} de {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Próxima página"
        className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay hover:text-primary-text disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  )
}

export default Pagination
