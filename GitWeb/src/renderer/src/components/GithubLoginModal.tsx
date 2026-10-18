import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import Github from './icons/Github'
import { useGithubAuthStore } from '../store/githubAuthStore'
import { useFocusTrap } from '../lib/useFocusTrap'
import type { GitHubUser } from '../lib/github'

interface GithubLoginModalProps {
  open: boolean
  onClose: () => void
  host?: string
  description?: string
  onSuccess: (user: GitHubUser, host: string) => void
}

function GithubLoginModal({
  open,
  onClose,
  host = 'github.com',
  description,
  onSuccess
}: GithubLoginModalProps): JSX.Element | null {
  const titleId = useId()
  const deviceFlow = useGithubAuthStore((s) => s.deviceFlow)
  const startDeviceFlowLogin = useGithubAuthStore((s) => s.startDeviceFlowLogin)
  const cancelDeviceFlowLogin = useGithubAuthStore((s) => s.cancelDeviceFlowLogin)
  const clearDeviceFlow = useGithubAuthStore((s) => s.clearDeviceFlow)
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [scopes, setScopes] = useState<string[]>([])

  const isPolling = deviceFlow?.status === 'polling'

  const failureMessage: Record<Exclude<NonNullable<typeof deviceFlow>['status'], 'polling' | 'success'>, string> = {
    denied: 'Autorização negada no GitHub.',
    expired: 'O código expirou. Tente novamente.',
    cancelled: 'Login cancelado.',
    error: deviceFlow?.errorMessage ?? 'Falha ao entrar com o GitHub.'
  }

  const handleClose = useCallback((): void => {
    if (useGithubAuthStore.getState().deviceFlow?.status === 'polling') {
      cancelDeviceFlowLogin()
    }
    clearDeviceFlow()
    onClose()
  }, [cancelDeviceFlowLogin, clearDeviceFlow, onClose])

  useFocusTrap(panelRef, open, { onEscape: handleClose, initialFocusRef: confirmRef })

  async function handleStart(): Promise<void> {
    clearDeviceFlow()
    const user = await startDeviceFlowLogin(host)
    if (user) onSuccess(user, host)
  }

  // Asking for `repo` means read/write on every private repository the account
  // can reach, so the modal says so before the user authorizes anything.
  useEffect(() => {
    if (!open) return
    void window.api.github.getOAuthAppInfo().then((info) => setScopes(info.scopes))
  }, [open])

  useEffect(() => {
    if (!open) return
    clearDeviceFlow()
    // Only re-run when the modal opens; clearDeviceFlow is stable enough for this lifecycle effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-scrim p-4" role="presentation" onClick={handleClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-default-border bg-obsidian-panel p-5 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-title font-semibold text-primary-text">
            Entrar com GitHub
          </h2>
          <button type="button" onClick={handleClose} className="hit-area rounded-sm p-1 text-tertiary-text hover:bg-hover-overlay" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {description && <p className="mt-2 text-body text-secondary-text">{description}</p>}

        <div className="mt-4">
          {deviceFlow && deviceFlow.status !== 'success' ? (
            <div className="flex flex-col gap-2 rounded-md border border-default-border bg-coal-raised px-4 py-3">
              {isPolling ? (
                <>
                  <p className="text-body text-secondary-text">
                    Acesse{' '}
                    <a
                      href={deviceFlow.verificationUriComplete ?? deviceFlow.verificationUri}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-command-blue underline"
                    >
                      {deviceFlow.verificationUri}
                    </a>{' '}
                    e informe o código:
                  </p>
                  <p className="text-title font-semibold tracking-widest text-primary-text">{deviceFlow.userCode}</p>
                  <div className="flex items-center gap-2 text-caption text-tertiary-text">
                    <Loader2 size={14} className="animate-spin" /> Aguardando autorização…
                    <button type="button" onClick={cancelDeviceFlowLogin} className="ml-auto text-command-blue hover:underline">
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body text-danger-red">
                    {failureMessage[deviceFlow.status as Exclude<typeof deviceFlow.status, 'polling' | 'success'>]}
                  </p>
                  <button type="button" onClick={handleStart} className="text-command-blue hover:underline">
                    Tentar de novo
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {scopes.length > 0 && (
                <div className="rounded-md border border-default-border bg-coal-raised px-3 py-2.5">
                  <p className="text-caption text-secondary-text">
                    O GitHub vai pedir estas permissões:{' '}
                    {scopes.map((scope, index) => (
                      <span key={scope}>
                        {index > 0 && ', '}
                        <code className="rounded-sm bg-midnight-base px-1 py-0.5 font-mono text-[0.85em] text-attention-orange">
                          {scope}
                        </code>
                      </span>
                    ))}
                    .
                  </p>
                  <p className="mt-1.5 text-caption text-tertiary-text">
                    <code className="font-mono">repo</code> dá leitura e escrita nos seus repositórios públicos e
                    privados; <code className="font-mono">workflow</code> é exigido pelo GitHub para enviar commits que
                    alterem arquivos em <code className="font-mono">.github/workflows/</code>. O token fica guardado no
                    cofre do sistema operacional, só nesta máquina.
                  </p>
                </div>
              )}
              <button ref={confirmRef} type="button" onClick={handleStart} className="btn-primary flex w-full items-center justify-center gap-2">
                <Github size={16} /> Continuar com GitHub
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GithubLoginModal
