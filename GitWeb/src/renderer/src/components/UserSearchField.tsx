import { useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Avatar } from '../views/PullRequestsView'
import { useClickOutside } from '../lib/useClickOutside'
import { useT } from '../lib/i18n'
import { userSearchQuery, type GitHubUserSuggestion } from '../../../shared/github'

// GitHub allows 30 searches a minute on REST and bills GraphQL by the point, so
// one per pause in typing, not one per key.
const SEARCH_DELAY_MS = 300
const MIN_QUERY_LENGTH = 2
const AVATAR_SIZE = 24

interface UserSearchFieldProps {
  id: string
  host: string
  value: string
  onChange: (value: string) => void
  /** A short note about someone in the results, such as already having access. */
  statusOf: (login: string) => string | null
  invalid?: boolean
  describedBy?: string
  placeholder?: string
}

/**
 * A username field that suggests GitHub accounts while typing. Choosing one only
 * fills the field: inviting stays a separate, deliberate step, and a username
 * the search doesn't find can still be typed in full.
 */
function UserSearchField({ id, host, value, onChange, statusOf, invalid, describedBy, placeholder }: UserSearchFieldProps): JSX.Element {
  const t = useT().collaborators
  const listboxId = useId()
  const optionIdPrefix = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<GitHubUserSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  // -1 until the user moves into the list, so Enter on a typed username submits the form.
  const [highlighted, setHighlighted] = useState(-1)
  useClickOutside(ref, () => setOpen(false))

  const query = userSearchQuery(value)
  const searchable = query.length >= MIN_QUERY_LENGTH
  const showList = open && searchable

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- resets results as the query changes; the search itself runs over IPC
    setHighlighted(-1)
    if (!open || !searchable) {
      setResults([])
      setIsSearching(false)
      setFailed(false)
      return
    }
    let stale = false
    setIsSearching(true)
    const timer = setTimeout(() => {
      window.api.github
        .searchUsers(host, query)
        .then((users) => {
          if (stale) return
          setResults(users)
          setFailed(false)
        })
        .catch(() => {
          if (stale) return
          setResults([])
          setFailed(true)
        })
        .finally(() => {
          if (!stale) setIsSearching(false)
        })
    }, SEARCH_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [host, open, query, searchable])

  function choose(user: GitHubUserSuggestion): void {
    onChange(user.login)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    } else if (e.key === 'Enter') {
      const user = showList ? results[highlighted] : undefined
      if (user) {
        e.preventDefault()
        choose(user)
      } else {
        setOpen(false)
      }
    }
  }

  return (
    <div className="relative mt-1.5" ref={ref}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={showList && results[highlighted] ? `${optionIdPrefix}-${highlighted}` : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="field h-[34px] w-full py-0"
      />

      {showList && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-full min-w-80 rounded-md border border-default-border bg-coal-raised p-1 shadow-floating">
          <ul id={listboxId} role="listbox" aria-label={t.suggestionsAria} className="max-h-72 overflow-y-auto">
            {results.map((user, index) => {
              const status = statusOf(user.login)
              const active = index === highlighted
              return (
                <li key={user.login} id={`${optionIdPrefix}-${index}`} role="option" aria-selected={active}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(user)}
                    className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left ${active ? 'bg-active-overlay' : ''}`}
                  >
                    <Avatar key={user.login} login={user.login} src={user.avatarUrl} size={AVATAR_SIZE} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-body font-medium ${active ? 'text-command-blue' : 'text-primary-text'}`}>
                        {user.login}
                      </span>
                      {user.name && <span className="block truncate text-caption text-tertiary-text">{user.name}</span>}
                    </span>
                    {status && <span className="shrink-0 text-caption text-tertiary-text">{status}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          {results.length === 0 && (
            <p role="status" className="flex items-center gap-2 px-2.5 py-2 text-caption text-tertiary-text">
              {isSearching ? (
                <>
                  <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
                  {t.searching}
                </>
              ) : failed ? (
                t.searchFailed
              ) : (
                t.noMatches(query)
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default UserSearchField
