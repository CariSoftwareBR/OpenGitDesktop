import type { AiSettings } from './ai'
import type { Locale } from './i18n/locales'

// The AI speaks the app language; there is no separate AI language setting.
export type AiLanguage = Locale

function pick<T>(language: AiLanguage, variants: Record<AiLanguage, T>): T {
  return variants[language]
}

export function languageInstruction(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Responda ao usuário em português brasileiro (pt-BR), a menos que ele peça explicitamente outro idioma.',
    en: 'Respond to the user in English, unless they explicitly ask for another language.',
    es: 'Responde al usuario en español, a menos que pida explícitamente otro idioma.'
  })
}

const LANGUAGE_NAME: Record<AiLanguage, string> = {
  'pt-BR': 'Brazilian Portuguese (pt-BR)',
  en: 'English',
  es: 'Spanish (es)'
}

export function commitMessageLanguageInstruction(language: AiLanguage): string {
  return `Write summary and description in ${LANGUAGE_NAME[language]}.`
}

export function conflictSummaryLanguageInstruction(language: AiLanguage): string {
  return `Write "summary" in ${LANGUAGE_NAME[language]}.`
}

export interface RepoContextInput {
  repoPath: string | null
  branch: string
  upstream: { name: string; ahead: number; behind: number } | null
  statusLines: string
  lastCommits: string
}

export function formatRepoContext(language: AiLanguage, repo: RepoContextInput): string {
  if (!repo.repoPath) {
    return pick(language, {
      'pt-BR': 'Nenhum repositório aberto no momento.',
      en: 'No repository is currently open.',
      es: 'No hay ningún repositorio abierto en este momento.'
    })
  }

  const upstream = repo.upstream
  const upstreamInfo = upstream
    ? pick(language, {
        'pt-BR': `${upstream.name} (${upstream.ahead} à frente, ${upstream.behind} atrás)`,
        en: `${upstream.name} (ahead ${upstream.ahead}, behind ${upstream.behind})`,
        es: `${upstream.name} (${upstream.ahead} por delante, ${upstream.behind} por detrás)`
      })
    : pick(language, {
        'pt-BR': '(sem upstream configurado)',
        en: '(no upstream configured)',
        es: '(sin upstream configurado)'
      })

  const labels = pick(language, {
    'pt-BR': {
      title: 'Contexto do repositório:',
      path: 'Caminho',
      branch: 'Branch atual',
      upstream: 'Upstream',
      status: 'Status Git (porcelain):',
      clean: '(limpo)',
      commits: 'Commits recentes:',
      noCommits: '(ainda sem commits)'
    },
    en: {
      title: 'Repository context:',
      path: 'Path',
      branch: 'Current branch',
      upstream: 'Upstream',
      status: 'Git status (porcelain):',
      clean: '(clean)',
      commits: 'Recent commits:',
      noCommits: '(no commits yet)'
    },
    es: {
      title: 'Contexto del repositorio:',
      path: 'Ruta',
      branch: 'Rama actual',
      upstream: 'Upstream',
      status: 'Estado de Git (porcelain):',
      clean: '(limpio)',
      commits: 'Commits recientes:',
      noCommits: '(todavía sin commits)'
    }
  })

  return [
    labels.title,
    `- ${labels.path}: ${repo.repoPath}`,
    `- ${labels.branch}: ${repo.branch}`,
    `- ${labels.upstream}: ${upstreamInfo}`,
    '',
    labels.status,
    repo.statusLines || labels.clean,
    '',
    labels.commits,
    repo.lastCommits || labels.noCommits
  ].join('\n')
}

export function aiNotConfiguredMessage(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Configure um provedor de IA na aba "IA" antes de usar este recurso.',
    en: 'Configure an AI provider in the "AI" tab before using this feature.',
    es: 'Configura un proveedor de IA en la pestaña "IA" antes de usar esta función.'
  })
}

export function openRepoBeforeFixMessage(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Abra um repositório antes de pedir uma correção.',
    en: 'Open a repository before requesting a fix.',
    es: 'Abre un repositorio antes de pedir una corrección.'
  })
}

export function proposeFixNoContentError(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'A IA não devolveu o arquivo corrigido.',
    en: 'The AI did not return the corrected file.',
    es: 'La IA no devolvió el archivo corregido.'
  })
}

export function proposeFixMissingFileError(language: AiLanguage, path: string): string {
  return pick(language, {
    'pt-BR': `O arquivo '${path}' não existe na árvore de trabalho. Se o commit explorado foi desfeito, a correção não tem o que editar.`,
    en: `The file '${path}' does not exist in the working tree. If the explored commit was undone, there is nothing for the fix to edit.`,
    es: `El archivo '${path}' no existe en el árbol de trabajo. Si el commit explorado se deshizo, la corrección no tiene nada que editar.`
  })
}

export function proposeFixStaleFileError(language: AiLanguage, path: string): string {
  return pick(language, {
    'pt-BR': `${path} mudou desde que a correção foi gerada. Peça a correção novamente.`,
    en: `${path} changed since the fix was generated. Request the fix again.`,
    es: `${path} cambió desde que se generó la corrección. Pide la corrección de nuevo.`
  })
}

export function contactProviderFailedMessage(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Falha ao contatar o provedor de IA.',
    en: 'Failed to contact the AI provider.',
    es: 'Error al contactar con el proveedor de IA.'
  })
}

export function proposeFixUserMessage(
  language: AiLanguage,
  finding: {
    path: string
    line?: number
    priority: string
    claim: string
    description: string
    example?: string
    fix: string
  },
  fileContent: string
): string {
  const labels = pick(language, {
    'pt-BR': {
      file: 'Arquivo',
      priority: 'Prioridade',
      bug: 'Bug',
      example: 'Exemplo',
      suggestedFix: 'Correção sugerida pelos subagentes'
    },
    en: {
      file: 'File',
      priority: 'Priority',
      bug: 'Bug',
      example: 'Example',
      suggestedFix: 'Suggested fix from subagents'
    },
    es: {
      file: 'Archivo',
      priority: 'Prioridad',
      bug: 'Bug',
      example: 'Ejemplo',
      suggestedFix: 'Corrección sugerida por los subagentes'
    }
  })

  return `${labels.file}: ${finding.path}${finding.line ? `:${finding.line}` : ''}
${labels.priority}: ${finding.priority}
${labels.bug}: ${finding.claim}
${finding.description}
${finding.example ? `${labels.example}: ${finding.example}` : ''}
${labels.suggestedFix}: ${finding.fix}

\`\`\`
${fileContent}
\`\`\``
}

const PR_TOOL_NAMES = new Set([
  'create_pull_request',
  'list_pull_requests',
  'read_pull_request',
  'check_pull_request_status',
  'merge_pull_request',
  'review_pull_request',
  'comment_pull_request',
  'set_pull_request_state'
])

const PR_INTENT_PATTERN =
  /\b(pull\s*request|pull-request|\bpr\b|merge\s+(?:the\s+)?pr|review\s+(?:the\s+)?pr|open\s+(?:a\s+)?pr|criar\s+(?:um\s+)?pr|abrir\s+(?:um\s+)?pr|mesclar\s+(?:o\s+)?pr|revisar\s+(?:o\s+|el\s+)?pr|avaliar\s+(?:o\s+)?pr|crear\s+(?:un\s+)?pr|fusionar\s+(?:el\s+)?pr|evaluar\s+(?:el\s+)?pr|pull\s+requests?)\b/i

export function appSystemPrompt(language: AiLanguage): string {
  return pick(language, {
    'pt-BR':
      'Você é um assistente dentro de um app desktop de Git. Use sempre o contexto do repositório ao responder. Você pode sugerir e propor ações via ferramentas (commit, push, branches, pull requests), mas cada ação que altera o repositório ou um remoto só executa após aprovação explícita do usuário. Seja conciso e prático; explique o necessário sem enrolar. Se o usuário pedir para limpar a conversa, sugira iniciar uma nova sessão, mas não apague mensagens antigas.',
    en: 'You are an assistant inside a Git desktop app. Always consider repository context when answering. You can suggest and propose actions via tools (commit, push, branches, pull requests), but each action that changes the repository or a remote only runs after the user explicitly approves it. Be concise and practical; explain only what is needed. If the user asks to clear the conversation, suggest starting a new session but do not delete old messages.',
    es: 'Eres un asistente dentro de una app de escritorio de Git. Usa siempre el contexto del repositorio al responder. Puedes sugerir y proponer acciones mediante herramientas (commit, push, ramas, pull requests), pero cada acción que modifica el repositorio o un remoto solo se ejecuta tras la aprobación explícita del usuario. Sé conciso y práctico; explica lo necesario sin rodeos. Si el usuario pide limpiar la conversación, sugiere iniciar una nueva sesión, pero no borres mensajes antiguos.'
  })
}

export function reasoningInstruction(
  language: AiLanguage,
  effort: AiSettings['reasoningEffort']
): string {
  if (effort === 'off') return ''
  const labels: Record<AiLanguage, Record<string, string>> = {
    'pt-BR': {
      low: 'Pense brevemente antes de responder.',
      medium: 'Raciocine com cuidado antes de responder.',
      high: 'Raciocine com cuidado e considere alternativas antes de responder.',
      xhigh: 'Raciocine extensivamente, considerando várias alternativas, antes da resposta final.'
    },
    en: {
      low: 'Think briefly before answering.',
      medium: 'Reason carefully before answering.',
      high: 'Reason carefully and consider alternatives before answering.',
      xhigh: 'Reason extensively, considering multiple alternatives, before giving your final answer.'
    },
    es: {
      low: 'Piensa brevemente antes de responder.',
      medium: 'Razona con cuidado antes de responder.',
      high: 'Razona con cuidado y considera alternativas antes de responder.',
      xhigh: 'Razona extensamente, considerando varias alternativas, antes de la respuesta final.'
    }
  }
  return labels[language][effort] ?? ''
}

export function explainBugDescriptionPrompt(language: AiLanguage): string {
  return pick(language, {
    'pt-BR':
      'Explique o texto recebido para uma pessoa desenvolvedora iniciante, em português simples. Diga o que ele significa na prática, sem inventar detalhes que não estejam no texto. Seja breve e didático.',
    en: 'Explain the received text to a junior developer in plain English. Say what it means in practice, without inventing details not present in the text. Be brief and didactic.',
    es: 'Explica el texto recibido a una persona desarrolladora principiante, en español sencillo. Di qué significa en la práctica, sin inventar detalles que no estén en el texto. Sé breve y didáctico.'
  })
}

export function explainDiffPrompt(language: AiLanguage): string {
  return pick(language, {
    'pt-BR':
      'Explique o diff recebido em português claro e didático. Fale como para uma pessoa desenvolvedora júnior. Descreva o que mudou, o efeito prático e pontos de atenção, sem inventar detalhes fora do diff. Use Markdown com seções curtas.',
    en: 'Explain the received diff in clear, didactic English. Speak as if to a junior developer. Describe what changed, the practical effect, and points of attention, without inventing details outside the diff. Use Markdown with short sections.',
    es: 'Explica el diff recibido en un español claro y didáctico. Habla como a una persona desarrolladora júnior. Describe qué cambió, el efecto práctico y los puntos de atención, sin inventar detalles fuera del diff. Usa Markdown con secciones cortas.'
  })
}

// The banner's "explain" button starts a real agent turn: the error lands in the
// chat history (so the matching skill is detected) and the agent may attach the
// first fixing tool right away — the approval card still gates it.
export function explainBannerErrorInstruction(language: AiLanguage): string {
  return pick(language, {
    'pt-BR':
      'A operação Git abaixo falhou no aplicativo. Explique em 2–3 frases o que o erro significa, sem inventar detalhes que não estejam na mensagem ou no contexto do repositório. Se uma das suas ferramentas resolver o problema, anexe já a chamada do primeiro passo nesta mesma resposta — não pergunte em texto se pode fazer.',
    en: 'The Git operation below failed in the app. Explain in 2–3 sentences what the error means, without inventing details that are not in the message or the repository context. If one of your tools fixes the problem, attach the call for the first step in this same response — do not ask in text whether you may.',
    es: 'La operación de Git de abajo falló en la aplicación. Explica en 2–3 frases qué significa el error, sin inventar detalles que no estén en el mensaje o en el contexto del repositorio. Si una de tus herramientas resuelve el problema, adjunta ya la llamada del primer paso en esta misma respuesta — no preguntes en texto si puedes hacerlo.'
  })
}

// "remote: error: File backup.sql is 520.54 MB; this exceeds GitHub's file size limit"
const LARGE_FILE_ERROR = /\bFile (.+?) is \d+(?:\.\d+)? MB; this exceeds/g

/** Paths GitHub named in a GH001 rejection, in the order they appear. */
export function extractRejectedLargeFiles(text: string): string[] {
  const paths = [...text.matchAll(LARGE_FILE_ERROR)].map((m) => m[1].trim())
  return [...new Set(paths)]
}

const FILE_LOCATION_FACTS: Record<
  AiLanguage,
  {
    heading: string
    theRemote: string
    earlierVersionOnRemote: (path: string, remote: string) => string
    alreadyIgnored: (path: string) => string
    alreadyUndone: (path: string, remote: string) => string
    onlyLocal: (path: string, commits: string, remote: string) => string
    notOnDisk: (path: string) => string
    nextStep: (path: string, undoCount: number) => string
  }
> = {
  'pt-BR': {
    heading: 'Diagnóstico verificado pelo app (fatos — não contradiga):',
    theRemote: 'o remoto',
    earlierVersionOnRemote: (path, remote) =>
      `- Uma versão anterior de ${path} já existe em ${remote} e continua no histórico antigo; a versão recusada não chegou lá.`,
    alreadyIgnored: (path) =>
      `- ${path} já está fora dos commits locais e no .gitignore. Próximo passo: commit (se houver mudanças no stage) e push.`,
    alreadyUndone: (path, remote) =>
      `- ${path} não está em nenhum commit à frente de ${remote} — o commit com ele já foi desfeito. Próximo passo: ignore_files com "${path}", depois commit e push.`,
    onlyLocal: (path, commits, remote) =>
      `- A versão de ${path} que foi recusada está SOMENTE em commit(s) local(is) ainda não enviado(s): ${commits}. Ela NÃO está em ${remote}; não há histórico remoto para reescrever.`,
    notOnDisk: (path) =>
      `- ${path} não existe mais no disco: a única cópia está nesse commit. Avise o usuário disso em uma frase antes de desfazer.`,
    nextStep: (path, undoCount) =>
      `- Próximo passo: undo_last_commit (${undoCount} vez(es) no total), depois ignore_files com "${path}", commit e push.`
  },
  en: {
    heading: 'Diagnosis verified by the app (facts — do not contradict):',
    theRemote: 'the remote',
    earlierVersionOnRemote: (path, remote) =>
      `- An earlier version of ${path} already exists on ${remote} and stays in the old history; the rejected version never got there.`,
    alreadyIgnored: (path) =>
      `- ${path} is already out of the local commits and in .gitignore. Next step: commit (if anything is staged) and push.`,
    alreadyUndone: (path, remote) =>
      `- ${path} is in no commit ahead of ${remote} — the commit with it was already undone. Next step: ignore_files with "${path}", then commit and push.`,
    onlyLocal: (path, commits, remote) =>
      `- The rejected version of ${path} is ONLY in local commit(s) not pushed yet: ${commits}. It is NOT on ${remote}; there is no remote history to rewrite.`,
    notOnDisk: (path) =>
      `- ${path} no longer exists on disk: the only copy lives in that commit. Tell the user so in one sentence before undoing.`,
    nextStep: (path, undoCount) =>
      `- Next step: undo_last_commit (${undoCount} time(s) in total), then ignore_files with "${path}", commit and push.`
  },
  es: {
    heading: 'Diagnóstico verificado por la app (hechos — no los contradigas):',
    theRemote: 'el remoto',
    earlierVersionOnRemote: (path, remote) =>
      `- Una versión anterior de ${path} ya existe en ${remote} y sigue en el historial antiguo; la versión rechazada nunca llegó allí.`,
    alreadyIgnored: (path) =>
      `- ${path} ya está fuera de los commits locales y en .gitignore. Siguiente paso: commit (si hay cambios en el stage) y push.`,
    alreadyUndone: (path, remote) =>
      `- ${path} no está en ningún commit por delante de ${remote} — el commit que lo contenía ya se deshizo. Siguiente paso: ignore_files con "${path}", luego commit y push.`,
    onlyLocal: (path, commits, remote) =>
      `- La versión rechazada de ${path} está SOLO en commit(s) local(es) aún no enviado(s): ${commits}. NO está en ${remote}; no hay historial remoto que reescribir.`,
    notOnDisk: (path) =>
      `- ${path} ya no existe en el disco: la única copia está en ese commit. Avísale al usuario en una frase antes de deshacer.`,
    nextStep: (path, undoCount) =>
      `- Siguiente paso: undo_last_commit (${undoCount} vez/veces en total), luego ignore_files con "${path}", commit y push.`
  }
}

interface FileLocationFacts {
  path: string
  upstream: string | null
  localCommits: { shortHash: string; summary: string }[]
  undoCount: number
  onRemote: boolean
  existsOnDisk: boolean
  ignored: boolean
}

// Facts the app verified, stated so plainly a small model can't reason its way
// to "it's already on the remote": the diagnosis and the next tool to call.
export function formatFileLocationFacts(language: AiLanguage, facts: FileLocationFacts[]): string {
  if (facts.length === 0) return ''
  const t = FILE_LOCATION_FACTS[language]
  const lines = [t.heading]

  for (const f of facts) {
    const remote = f.upstream ?? t.theRemote
    const commits = f.localCommits.map((c) => `${c.shortHash} "${c.summary}"`).join(', ')

    // These paths come from a rejected push, so the rejected content is never on
    // the remote — at most an older version of the same path is. That must not
    // steer the model away from undoing the local commits.
    if (f.onRemote) lines.push(t.earlierVersionOnRemote(f.path, remote))
    if (f.localCommits.length === 0 && f.ignored) {
      lines.push(t.alreadyIgnored(f.path))
      continue
    }
    if (f.localCommits.length === 0) {
      lines.push(t.alreadyUndone(f.path, remote))
      continue
    }

    lines.push(t.onlyLocal(f.path, commits, remote))
    if (!f.existsOnDisk) lines.push(t.notOnDisk(f.path))
    lines.push(t.nextStep(f.path, f.undoCount))
  }

  return lines.join('\n')
}

export function askAsTeacherInstruction(language: AiLanguage, subject: string): string {
  return pick(language, {
    'pt-BR': `Você é um professor que está explicando sobre git. O aluno tem dúvidas sobre "${subject}". Seja educado, calmo e sem exageros. Explique em português, com exemplos curtos se ajudar. Não execute nenhuma ação no repositório — só ensine.`,
    en: `You are a teacher explaining Git. The student has questions about "${subject}". Be polite, calm, and measured. Explain in English, with short examples if helpful. Do not perform any repository actions — only teach.`,
    es: `Eres un profesor que explica Git. El alumno tiene dudas sobre "${subject}". Sé educado, tranquilo y mesurado. Explica en español, con ejemplos cortos si ayuda. No ejecutes ninguna acción en el repositorio — solo enseña.`
  })
}

export function askAsTeacherUserMessage(language: AiLanguage, subject: string): string {
  return pick(language, { 'pt-BR': `O que é ${subject}?`, en: `What is ${subject}?`, es: `¿Qué es ${subject}?` })
}

export function userRequestLabel(language: AiLanguage): string {
  return pick(language, { 'pt-BR': 'Pedido do usuário', en: 'User request', es: 'Solicitud del usuario' })
}

export function explainBugFallback(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Não foi possível gerar uma explicação.',
    en: 'Could not generate an explanation.',
    es: 'No se pudo generar una explicación.'
  })
}

export function explainDiffFallback(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Não foi possível gerar uma explicação para este diff.',
    en: 'Could not generate an explanation for this diff.',
    es: 'No se pudo generar una explicación para este diff.'
  })
}

export function diffTruncationNote(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': '\n\n> Observação: a explicação considera apenas a parte inicial do diff, devido ao limite configurado.',
    en: '\n\n> Note: the explanation covers only the beginning of the diff, due to the configured limit.',
    es: '\n\n> Nota: la explicación solo considera la parte inicial del diff, debido al límite configurado.'
  })
}

export function diffExplanationHeader(language: AiLanguage, path: string): string {
  const { title, fileLabel } = pick(language, {
    'pt-BR': { title: 'Explicação do diff', fileLabel: 'Arquivo' },
    en: { title: 'Diff explanation', fileLabel: 'File' },
    es: { title: 'Explicación del diff', fileLabel: 'Archivo' }
  })
  return `## ${title}\n\n**${fileLabel}:** \`${path}\`\n\n`
}

export function investigationFailedMessage(language: AiLanguage, error: string): string {
  const prefix = pick(language, {
    'pt-BR': 'Não foi possível concluir a investigação deste commit.',
    en: 'Could not complete the investigation of this commit.',
    es: 'No se pudo completar la investigación de este commit.'
  })
  return `${prefix}\n\n${error}`
}

// The investigation markdown starts with a localized "Findings" heading; the
// chat recognises it (and the empty result) in every language, since a stored
// conversation may predate a language switch.
const FINDINGS_HEADING: Record<AiLanguage, string> = {
  'pt-BR': '### Achados',
  en: '### Findings',
  es: '### Hallazgos'
}

const NO_CLEAR_ERRORS: Record<AiLanguage, string> = {
  'pt-BR': 'Nenhum erro claro neste commit.',
  en: 'No clear errors in this commit.',
  es: 'Ningún error claro en este commit.'
}

export function investigationConsolidationFallback(language: AiLanguage): string {
  const body = pick(language, {
    'pt-BR': 'Não foi possível consolidar os resultados da investigação.',
    en: 'Could not consolidate the investigation results.',
    es: 'No se pudieron consolidar los resultados de la investigación.'
  })
  return `${FINDINGS_HEADING[language]}\n\n${body}`
}

export function proposeFixPrompt(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': `Você aplica UMA correção pontual no arquivo. Não refatore, não reformate o que não precisa, não invente outros bugs. Não altere linhas fora do trecho necessário para corrigir o bug descrito.

Responda APENAS JSON válido, sem markdown:
{"content":"arquivo completo já corrigido"}

O campo content deve ser o arquivo inteiro, com a correção aplicada e o restante idêntico.`,
    en: `You apply ONE targeted fix in the file. Do not refactor, do not reformat what does not need it, do not invent other bugs. Do not change lines outside the section needed to fix the described bug.

Respond with ONLY valid JSON, no markdown:
{"content":"full corrected file"}

The content field must be the entire file, with the fix applied and everything else identical.`,
    es: `Aplicas UNA corrección puntual en el archivo. No refactorices, no reformatees lo que no lo necesita, no inventes otros bugs. No cambies líneas fuera del tramo necesario para corregir el bug descrito.

Responde SOLO JSON válido, sin markdown:
{"content":"archivo completo ya corregido"}

El campo content debe ser el archivo entero, con la corrección aplicada y el resto idéntico.`
  })
}

export function emptyInvestigationMarkdown(language: AiLanguage): string {
  return `${FINDINGS_HEADING[language]}\n\n${NO_CLEAR_ERRORS[language]}`
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const EMPTY_INVESTIGATION_PATTERNS = (Object.keys(FINDINGS_HEADING) as AiLanguage[]).map((language) => {
  const heading = escapeRegExp(FINDINGS_HEADING[language].replace(/^###\s*/, ''))
  const body = escapeRegExp(NO_CLEAR_ERRORS[language].replace(/\.$/, ''))
  return new RegExp(`^###\\s*${heading}\\s+${body}\\.?\\s*$`, 'i')
})

export function isEmptyInvestigationMarkdown(text: string): boolean {
  const normalized = text.trim().replace(/\r\n/g, '\n').replace(/\n+/g, ' ')
  return EMPTY_INVESTIGATION_PATTERNS.some((pattern) => pattern.test(normalized))
}

export interface InvestigationLabels {
  subject: string
  message: string
  filesInCommit: string
  moreFiles: (count: number) => string
  findingFile: string
  finding: string
  diffFor: (path: string) => string
  relatedDiff: (path: string) => string
  file: string
  batch: string
}

/** Scaffolding around the diffs the investigation subagents receive. */
export function investigationLabels(language: AiLanguage): InvestigationLabels {
  return pick<InvestigationLabels>(language, {
    'pt-BR': {
      subject: 'Assunto',
      message: 'Mensagem',
      filesInCommit: 'Arquivos deste commit:',
      moreFiles: (count) => `e mais ${count} arquivo(s)`,
      findingFile: 'Arquivo do achado',
      finding: 'Achado',
      diffFor: (path) => `Diff de ${path}:`,
      relatedDiff: (path) => `Diff relacionado (${path}):`,
      file: 'Arquivo',
      batch: 'Lote'
    },
    en: {
      subject: 'Subject',
      message: 'Message',
      filesInCommit: 'Files in this commit:',
      moreFiles: (count) => `and ${count} more file(s)`,
      findingFile: 'Finding file',
      finding: 'Finding',
      diffFor: (path) => `Diff for ${path}:`,
      relatedDiff: (path) => `Related diff (${path}):`,
      file: 'File',
      batch: 'Batch'
    },
    es: {
      subject: 'Asunto',
      message: 'Mensaje',
      filesInCommit: 'Archivos de este commit:',
      moreFiles: (count) => `y ${count} archivo(s) más`,
      findingFile: 'Archivo del hallazgo',
      finding: 'Hallazgo',
      diffFor: (path) => `Diff de ${path}:`,
      relatedDiff: (path) => `Diff relacionado (${path}):`,
      file: 'Archivo',
      batch: 'Lote'
    }
  })
}

export function investigationWorkerPrompt(language: AiLanguage): string {
  if (language === 'en') {
    return `You are a bug-investigation subagent. Analyze only the diff received for ONE file. An empty list is the correct and expected result — inventing a problem to seem useful is the worst possible outcome.

You also receive a short commit index (message and files). This is NOT the diff of other files: do not invent bugs in them.

The commit message is NOT the correction spec: messages generated from the diff often copy the wrong code. The contract in the file itself (doc/comment, constant name, written formula) prevails. If the new code contradicts that contract and you have a concrete example, report it — even if the message describes the if/return as written.

Use the message only to avoid reporting a removal/replacement it declares as intentional (optional field, prop removed because the callee also removed it, validation the commit says was deliberately relaxed).

Only report a finding if ALL are true:
- The defect was introduced by the + lines in this commit (did not exist on the - side or only in context).
- You can provide an example in the format \`concrete input → wrong output\` with values, not narrative.
- With that input, the new code produces an objectively wrong result: wrong stored/sent/returned value, exception on the path this commit created, or resource leak on that path.
- The evidence is in this diff. Functions, types, and files outside the diff work.

Do not report:
- Null/empty "not handled" without the diff showing null reaches that path.
- Missing validation, try/catch, field, parameter, or contract when the message or index indicates it became optional/replaced.
- Missing validation, try/catch, or test when the rest of the file does not do it either — a new function in the same shape as neighbors is not a bug.
- Local try/catch around a helper/wrapper the file already uses for the same failure type: assume the wrapper handles it. "Dependency down → generic infrastructure error" is not a finding.
- Injection, XSS, or filter bypass if, applying the allowlist/encoder/sanitizer from + lines, the example does not survive as dangerous output.
- New validation that rejects input after sanitizing, stripping markup, or measuring visible text, when the commit describes exactly that rule (minimum, maximum, empty content). Rejecting markup-only or short visible text is the goal, not a crash on the common path.
- Code only from context or the - side: the defect must come from + lines.
- "May", "perhaps", "consider", "should verify", style, names, architecture, performance, duplication.
- A bug that already existed in context lines or the old side.

Priority (if it does not fit, discard — P3 is not a guess drawer):
- P1: breaks in normal use — wrong data stored/sent, exception on the common path.
- P2: only breaks on an uncommon input this diff makes possible.
- P3: real, demonstrable defect, small impact.

Line: in hunk \`@@ -a,b +c,d @@\`, the first context or + line is \`c\`. Each context or + advances 1; - lines do not count. If unsure, omit \`line\`.

Respond with ONLY valid JSON, no markdown:
{"findings":[{"priority":"P1|P2|P3","line":123,"claim":"up to 15 words","description":"when it triggers and what goes wrong, up to 25 words","example":"input → wrong output","fix":"short code or fix"}]}

If there is no clear finding, respond {"findings":[]}.`
  }

  if (language === 'es') {
    return `Eres un subagente de investigación de bugs. Analiza solo el diff recibido de UN archivo. Una lista vacía es el resultado correcto y esperado — inventar un problema para parecer útil es el peor resultado posible.

También recibes un índice corto del commit (mensaje y archivos). Eso NO es el diff de los otros archivos: no inventes bugs en ellos.

El mensaje del commit NO es la especificación de la corrección: los mensajes generados a partir del diff suelen copiar el código erróneo. Prevalece el contrato del propio archivo (doc/comentario, nombre de constante, fórmula escrita). Si el código nuevo contradice ese contrato y tienes un example concreto, repórtalo — aunque el mensaje describa el if/retorno tal como está.

Usa el mensaje solo para no reportar una eliminación/sustitución que declara como objetivo (campo opcional, prop eliminada porque el callee también la eliminó, validación que el commit dice haber relajado a propósito).

Solo reporta un hallazgo si TODO esto es cierto:
- El defecto lo introdujeron las líneas + de este commit (no existía en el lado - ni solo en el contexto).
- Puedes dar un ejemplo con el formato \`entrada concreta → salida errónea\` con valores, no narrativa.
- Con esa entrada, el código nuevo produce un resultado objetivamente erróneo: valor guardado/enviado/devuelto incorrecto, excepción en el camino que creó este commit, o recurso filtrado en ese camino.
- La evidencia está en este diff. Las funciones, tipos y archivos fuera del diff funcionan.

No reportes:
- Nulo/vacío "no tratado" sin que el diff muestre que null llega a ese camino.
- Validación, try/catch, campo, parámetro o contrato eliminado cuando el mensaje del commit o el índice indican que pasó a ser opcional/sustituido.
- Validación, try/catch o test ausente cuando el resto del archivo tampoco lo hace — una función nueva con la misma forma que sus vecinas no es un bug.
- try/catch local alrededor de un helper/wrapper que el archivo ya usa para el mismo tipo de fallo: asume que el wrapper lo trata. "Dependencia caída → error genérico de infraestructura" no es un hallazgo.
- Inyección, XSS o bypass de filtro si, al aplicar el allowlist/encoder/sanitizador de las líneas +, el example no sobrevive como salida peligrosa.
- Validación nueva que rechaza la entrada tras sanitizar, quitar markup o medir el texto visible, cuando el commit describe exactamente esa regla (mínimo, máximo, contenido vacío). Rechazar solo markup o texto visible corto es el objetivo, no un fallo en el camino común.
- Código solo de contexto o del lado -: el defecto tiene que nacer en las líneas +.
- "Puede", "quizás", "considera", "debería verificar", estilo, nombres, arquitectura, rendimiento, duplicación.
- Un bug que ya estaba en las líneas de contexto o en el lado antiguo.

Prioridad (si no encaja, descártalo — P3 no es un cajón de suposiciones):
- P1: se rompe en el uso normal — dato erróneo guardado/enviado, excepción en el camino común.
- P2: solo se rompe con una entrada poco común que el propio diff hace posible.
- P3: defecto real y demostrable, de impacto pequeño.

Línea: en el hunk \`@@ -a,b +c,d @@\`, la primera línea de contexto o + es \`c\`. Cada línea de contexto o + avanza 1; las líneas - no cuentan. Si no estás seguro, omite \`line\`.

Responde SOLO JSON válido, sin markdown:
{"findings":[{"priority":"P1|P2|P3","line":123,"claim":"hasta 15 palabras","description":"cuándo ocurre y qué sale mal, hasta 25 palabras","example":"entrada → salida errónea","fix":"código o corrección corta"}]}

Si no hay un hallazgo claro, responde {"findings":[]}.`
  }

  return `Você é um subagente de investigação de bugs. Analise somente o diff recebido de UM arquivo. Lista vazia é o resultado correto e esperado — inventar um problema para parecer útil é o pior resultado possível.

Você também recebe um índice curto do commit (mensagem e arquivos). Isso NÃO é o diff dos outros arquivos: não invente bugs neles.

A mensagem do commit NÃO é a especificação de correção: mensagens geradas a partir do diff costumam copiar o código errado. O contrato no próprio arquivo (doc/comentário, nome de constante, fórmula escrita) prevalece. Se o código novo contradiz esse contrato e você tem example concreto, reporte — mesmo que a mensagem descreva o if/retorno tal como está.

Use a mensagem só para não reportar uma remoção/substituição que ela declara como objetivo (campo opcional, prop removida porque o callee também removeu, validação que o commit diz ter soltado de propósito).

Só reporte um achado se TODAS forem verdade:
- O defeito foi introduzido pelas linhas + deste commit (não existia no lado - nem só no contexto).
- Você consegue um exemplo no formato \`entrada concreta → saída errada\` com valores, não narrativa.
- Com essa entrada, o código novo produz resultado objetivamente errado: valor gravado/enviado/retornado errado, exceção no caminho que este commit criou, ou recurso vazado nesse caminho.
- A evidência está neste diff. Funções, tipos e arquivos fora do diff funcionam.

Não reporte:
- Nulo/vazio "não tratado" sem o diff mostrar que null chega nesse caminho.
- Validação, try/catch, campo, parâmetro ou contrato removido quando a mensagem do commit ou o índice indica que isso passou a ser opcional/substituído.
- Validação, try/catch ou teste ausente quando o resto do arquivo também não faz isso — uma função nova no mesmo formato das vizinhas não é bug.
- try/catch local em volta de um helper/wrapper que o arquivo já usa para o mesmo tipo de falha: assuma que o wrapper trata. "Dependência fora → erro genérico de infraestrutura" não é achado.
- Injeção, XSS ou bypass de filtro se, ao aplicar o allowlist/encoder/sanitizador das linhas +, o example não sobrevive como saída perigosa.
- Validação nova que recusa entrada depois de sanitizar, tirar markup ou medir texto visível, quando o commit descreve exatamente essa regra (mínimo, máximo, conteúdo vazio). Recusar markup-only ou texto curto visível é o objetivo, não um crash no caminho comum.
- Código só de contexto ou do lado -: o defeito tem de nascer nas linhas +.
- "Pode", "talvez", "considere", "deveria verificar", estilo, nomes, arquitetura, desempenho, duplicação.
- Bug que já estava nas linhas de contexto ou no lado antigo.

Prioridade (se não encaixa, descarte — P3 não é gaveta de palpite):
- P1: quebra em uso normal — dado errado gravado/enviado, exceção no caminho comum.
- P2: só quebra numa entrada incomum que o próprio diff torna possível.
- P3: defeito real e demonstrável, impacto pequeno.

Linha: no hunk \`@@ -a,b +c,d @@\`, a primeira linha de contexto ou + é \`c\`. Cada contexto ou + avança 1; linhas - não contam. Sem certeza, omita \`line\`.

Responda APENAS JSON válido, sem markdown:
{"findings":[{"priority":"P1|P2|P3","line":123,"claim":"até 15 palavras","description":"quando dispara e o que sai errado, até 25 palavras","example":"entrada → saída errada","fix":"código ou correção curta"}]}

Se não houver achado claro, responda {"findings":[]}.`
}

export function investigationVerifyPrompt(language: AiLanguage): string {
  if (language === 'en') {
    return `You are a skeptical subagent. Prefer reject. When in doubt, reject.

Confirm ONLY if the example reproduces an objectively wrong result introduced by + lines, and related diffs do NOT show the commit deliberately replaced that behavior.

Confirm if the example violates the written contract in the same file (doc, comment, constant name like threshold/minimum), even if the commit message paraphrases the wrong code.

Reject if:
- the message describes a product change (remove validation, make field optional, swap API) and the diff does exactly that — do not reject only because the message copies a new if/formula
- validation, field, parameter, or contract was removed and another hunk/file in the commit handles the new case
- hypothetical null, guess ("may", "perhaps", "consider"), bug already on the - side, style, tests, or architecture
- the cited line is not a + line (nor the new effect of a changed line): context and code the commit did not change are not findings

Reject missing error handling / validation (not a bug, it is review):
- missing local try/catch or validation when another function in the same file has the same shape
- the new line is already inside a helper/wrapper the file already uses for the same failure type
- the example is "dependency down / exception → generic infrastructure error" without the diff showing a throw outside any existing handling
- symbols outside this file work, including those that translate errors: do not require try/catch around the call if the rest of the file does not wrap that call either

Reject injection / sanitization / encoding / allowlist bypass unless you can walk the example through the + line rules and still get dangerous output. If the filter does not match the payload, it is harmless text — reject.

Reject validation that refuses: if the commit started measuring sanitized/visible value and the example is "markup only, spaces, or short text → rule refuses", that is the goal of the change. Refusing is not a defect.

Respond with ONLY valid JSON, no markdown:
{"verdict":"confirm"|"reject"}`
  }

  if (language === 'es') {
    return `Eres un subagente escéptico. Prefiere reject. Ante la duda, reject.

Confirma SOLO si el example reproduce un resultado objetivamente erróneo introducido por las líneas +, y los diffs relacionados NO muestran que el commit sustituyó ese comportamiento a propósito.

Confirma si el example viola el contrato escrito en el mismo archivo (doc, comentario, nombre de constante como umbral/mínimo), aunque el mensaje del commit parafrasee el código erróneo.

Rechaza si:
- el mensaje describe un cambio de producto (quitar validación, hacer un campo opcional, cambiar de API) y el diff hace exactamente eso — no rechaces solo porque el mensaje copia un if/fórmula nuevos
- se eliminó una validación, campo, parámetro o contrato y otro hunk/archivo del commit trata el nuevo caso
- nulo hipotético, suposición ("puede", "quizás", "considera"), bug ya presente en el lado -, estilo, tests o arquitectura
- la línea citada no es una línea + (ni el efecto nuevo de una línea modificada): el contexto y el código que el commit no cambió no son hallazgos

Rechaza tratamiento de errores / validación "ausente" (no es un bug, es revisión):
- falta un try/catch o validación local cuando otra función del mismo archivo tiene la misma forma
- la línea nueva ya está dentro de un helper/wrapper que el archivo ya usa para el mismo tipo de fallo
- el example es "dependencia caída / excepción → error genérico de infraestructura" sin que el diff muestre un throw fuera de cualquier tratamiento existente
- los símbolos fuera de este archivo funcionan, incluidos los que traducen errores: no exijas try/catch alrededor de la llamada si el resto del archivo tampoco envuelve esa llamada

Rechaza inyección / bypass de sanitización / encoding / allowlist a menos que puedas recorrer el example por las reglas de las líneas + y aun así obtener una salida peligrosa. Si el filtro no coincide con el payload, es texto inofensivo — reject.

Rechaza validación que rechaza: si el commit pasó a medir el valor sanitizado/visible y el example es "solo markup, espacios o texto corto → la regla lo rechaza", ese es el objetivo del cambio. Rechazar no es un defecto.

Responde SOLO JSON válido, sin markdown:
{"verdict":"confirm"|"reject"}`
  }

  return `Você é um subagente cético. Prefira reject. Em dúvida, reject.

Confirme SOMENTE se o example reproduz um resultado objetivamente errado introduzido pelas linhas + , e os diffs relacionados NÃO mostram que o commit substituiu esse comportamento de propósito.

Confirme se o example viola o contrato escrito no mesmo arquivo (doc, comentário, nome de constante como limiar/mínimo), mesmo que a mensagem do commit parafraseie o código errado.

Rejeite se:
- a mensagem descreve uma mudança de produto (remover validação, tornar campo opcional, trocar API) e o diff faz exatamente isso — não rejeite só porque a mensagem copia um if/fórmula novos
- validação, campo, parâmetro ou contrato foi removido e outro hunk/arquivo do commit trata o novo caso
- nulo hipotético, palpite ("pode", "talvez", "considere"), bug já presente no lado -, estilo, testes ou arquitetura
- a linha citada não é linha + (nem o efeito novo de uma linha alterada): contexto e código que o commit não mudou não são achado

Rejeite tratamento de erro / validação "ausente" (não é bug, é review):
- try/catch ou validação local faltando quando outra função no mesmo arquivo tem a mesma forma
- a linha nova já está dentro de um helper/wrapper que o arquivo já usa para o mesmo tipo de falha
- o example é "dependência fora / exceção → erro genérico de infraestrutura" sem o diff mostrar um throw fora de qualquer tratamento já existente
- símbolos fora deste arquivo funcionam, inclusive os que traduzem erro: não exija try/catch em volta da chamada se o resto do arquivo também não envolve essa chamada

Rejeite injeção / bypass de sanitização / encoding / allowlist a menos que você consiga percorrer o example pelas regras das linhas + e ainda obter saída perigosa. Se o filtro não casa o payload, ele é texto inofensivo — reject.

Rejeite validação que recusa: se o commit passou a medir o valor sanitizado/visível e o example é "só markup, espaços ou texto curto → a regra recusa", isso é o objetivo da mudança. Recusar não é defeito.

Responda APENAS JSON válido, sem markdown:
{"verdict":"confirm"|"reject"}`
}

export function investigationFinalPrompt(language: AiLanguage): string {
  if (language === 'en') {
    return `You consolidate results from subagents that analyzed a commit. You did NOT receive the diff: do not invent findings and use only the concrete findings provided. Do not lower the evidence bar or turn guesses into P3.

Respond in English. The first characters must be "### Findings". One block per finding, in decreasing priority:

**[P1]** \`file:line\` — short claim

**Bug description:** explain in one or two simple sentences, as for a junior developer: what happens, when it happens, and why the result is wrong.

**Example:** input → wrong output

**Suggested fix:** \`code\`

Omit Example if not provided. Remove duplicates. If there are no findings and all coverage is complete, respond exactly:

### Findings

No clear errors in this commit.

If any file failed or is partial, state that concisely instead of claiming there are no errors.`
  }

  if (language === 'es') {
    return `Consolidas los resultados de subagentes que analizaron un commit. NO recibiste el diff: no inventes hallazgos y usa solo los hallazgos concretos informados. No bajes el listón de evidencia ni conviertas suposiciones en P3.

Responde en español. Los primeros caracteres deben ser "### Hallazgos". Un bloque por hallazgo, en prioridad decreciente:

**[P1]** \`archivo:línea\` — afirmación corta

**Descripción del bug:** explica en una o dos frases sencillas, como para una persona desarrolladora júnior: qué ocurre, cuándo ocurre y por qué el resultado es erróneo.

**Ejemplo:** entrada → salida errónea

**Corrección sugerida:** \`código\`

Omite Ejemplo si no se proporcionó. Elimina duplicados. Si no hay hallazgos y toda la cobertura está completa, responde exactamente:

### Hallazgos

Ningún error claro en este commit.

Si algún archivo falló o quedó parcial, infórmalo de forma concisa en lugar de afirmar que no hay errores.`
  }

  return `Você consolida resultados de subagentes que analisaram um commit. Você NÃO recebeu o diff: não invente achados e use somente os achados concretos informados. Não rebaixe a barra de evidência nem transforme palpite em P3.

Responda em português. Os primeiros caracteres devem ser "### Achados". Um bloco por achado, em prioridade decrescente:

**[P1]** \`arquivo:linha\` — afirmação curta

**Descrição do bug:** explique em uma ou duas frases simples, como para uma pessoa desenvolvedora júnior: o que acontece, quando acontece e por que o resultado é errado.

**Exemplo:** entrada → saída errada

**Correção sugerida:** \`código\`

Omita Exemplo se não foi fornecido. Remova duplicatas. Se não houver achado e toda a cobertura estiver completa, responda exatamente:

### Achados

Nenhum erro claro neste commit.

Se algum arquivo falhou ou ficou parcial, informe isso de forma concisa em vez de afirmar que não há erros.`
}

interface PrSkillMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { call: { name: string } }[]
  toolFeedback?: unknown
}

// Tool results are replayed as synthetic user messages; counting them would push
// the real request out of the window after a few tool rounds and let tool output
// match the intent patterns instead.
const RECENT_USER_REQUESTS = 4

function isUserRequest(message: PrSkillMessage): boolean {
  return message.role === 'user' && !message.toolFeedback
}

/** The messages from the last few real user requests on: "the current task". */
function recentWindow(messages: PrSkillMessage[]): PrSkillMessage[] {
  let seen = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isUserRequest(messages[i]) && ++seen === RECENT_USER_REQUESTS) return messages.slice(i)
  }
  return messages
}

function recentUserRequestText(messages: PrSkillMessage[]): string {
  return recentWindow(messages)
    .filter(isUserRequest)
    .map((message) => message.content)
    .join('\n')
}

export function shouldIncludePrSkills(messages: PrSkillMessage[]): boolean {
  for (const message of messages) {
    if (message.toolCalls?.some((call) => PR_TOOL_NAMES.has(call.call.name))) return true
  }

  return PR_INTENT_PATTERN.test(recentUserRequestText(messages))
}

export type ScmSkillId = 'git-workflow' | 'merge-branch' | 'codeowners' | 'repository-risk' | 'unwanted-file'

// Same gating as the PR skills: a skill joins the system prompt only once the
// conversation is about it, so everyday chats don't pay for every playbook.
// `supersedes`: while it matches, those skills are left out, so a focused
// playbook isn't diluted by the general one it already covers.
const SCM_SKILL_TRIGGERS: { id: ScmSkillId; tools: Set<string>; pattern: RegExp; supersedes?: ScmSkillId[] }[] = [
  {
    id: 'git-workflow',
    tools: new Set([
      'commit',
      'push',
      'pull',
      'pull_repo',
      'pull_all',
      'create_branch',
      'switch_branch',
      'stash',
      'stash_pop',
      'check_incoming_commits',
      'get_git_identity',
      'set_git_identity',
      'show_in_history',
      'explain_file_history',
      'list_tags',
      'create_tag',
      'push_tag',
      'prepare_release_notes',
      'reorganize_local_commits'
    ]),
    // "pull request" belongs to the PR skills, not to pull.
    pattern:
      /\b(commit\w*|comitar|comitear|push\w*|pull\w*(?!\s*-?\s*requests?)|branch(?:es)?|ramas?|stash\w*|identidade|identidad|identity|tags?|releases?|changelog|squash\w*|rebase\w*|blame|hist[oó]rico|historial|history)\b/i
  },
  {
    id: 'merge-branch',
    tools: new Set(['merge_branch', 'merge_abort', 'resolve_conflict']),
    pattern: /\b(merge\w*|mescl\w*|fusion\w*|fusi[oó]n|conflit\w*|conflict\w*)\b/i
  },
  {
    id: 'codeowners',
    tools: new Set(),
    pattern:
      /\b(code\s*owners?|codeowners|donos?\s+d[oe]\s+c[oó]digo|(?:due[nñ]os?|propietarios?)\s+del\s+c[oó]digo|ownership)\b/i
  },
  {
    id: 'repository-risk',
    tools: new Set(),
    pattern:
      /\b(riscos?|riesgos?|risks?|risky|hotspots?|bus\s*factor|sa[uú]de\s+do\s+(?:reposit[oó]rio|projeto)|salud\s+del\s+(?:repositorio|proyecto)|(?:repo|repository|project)\s+health|onboarding)\b/i
  },
  {
    // A file that should never have been committed (GH001 large file, backup,
    // secret). The playbook is self-contained through commit and push, so it
    // replaces git-workflow — but not merge-branch etc. if the user moves on.
    id: 'unwanted-file',
    tools: new Set(['undo_last_commit', 'ignore_files']),
    pattern:
      /\bGH001\b|large files? detected|file size limit|\barquivos?\s+(?:muito\s+)?grandes?\b|\barchivos?\s+(?:muy\s+)?grandes?\b|\bgit\s+lfs\b|n[aã]o\s+(?:deveria|devia)\s+(?:ter\s+)?(?:sido\s+)?(?:commitad|comitad|subid|enviad|versionad)|\bno\s+(?:deber[ií]a|deb[ií]a)\s+(?:haber\s+)?(?:sido\s+)?(?:commitead|comitead|subid|enviad|versionad)|\b(?:commitei|comitei|subi)\s+(?:sem\s+querer|errado|por\s+engano)|\b(?:commite[eé]|comite[eé]|sub[ií])\s+(?:sin\s+querer|por\s+error|mal)/i,
    supersedes: ['git-workflow']
  }
]

export function selectScmSkills(messages: PrSkillMessage[]): ScmSkillId[] {
  // Tools count only within the same window as the text, so a skill follows
  // the current task instead of sticking for the rest of the conversation.
  const recent = recentWindow(messages)
  const usedTools = new Set(recent.flatMap((message) => message.toolCalls?.map((call) => call.call.name) ?? []))
  const recentUserText = recentUserRequestText(messages)

  const matched = SCM_SKILL_TRIGGERS.filter(
    (trigger) => trigger.pattern.test(recentUserText) || [...trigger.tools].some((name) => usedTools.has(name))
  )
  const superseded = new Set(matched.flatMap((trigger) => trigger.supersedes ?? []))
  return matched.filter((trigger) => !superseded.has(trigger.id)).map((trigger) => trigger.id)
}

export function isInvestigationMarkdown(text: string): boolean {
  const trimmed = text.trimStart()
  return Object.values(FINDINGS_HEADING).some((heading) => trimmed.startsWith(heading))
}

export function bugDescriptionHeading(language: AiLanguage): string {
  return pick(language, {
    'pt-BR': 'Descrição do bug:',
    en: 'Bug description:',
    es: 'Descripción del bug:'
  })
}

export interface AiUiStrings {
  emptyInvestigation: string
  bugDescriptionHeading: string
  explainDescriptionAria: string
  explainDescriptionTitle: string
  explainDescriptionDoneTitle: string
  detailedExplanation: string
  explainError: string
  explainErrorConfigure: string
  investigationSubagent: string
  investigationAnalyzing: (file: string) => string
  investigationFinished: string
  investigationExploring: (completed: number, total: number) => string
  investigationCancelled: string
  investigationFilesAnalyzed: (total: number, failed: number) => string
  investigationConsolidating: string
  investigationConsolidatingAria: string
  investigationSubagents: (count: number) => string
  investigationInterrupted: string
  investigationPartialFailure: string
  proposeFix: string
  preparingFix: string
  generateCommitTitle: string
  generateCommit: string
  generatingCommit: string
  explainDiff: string
  explainDiffAria: (path: string) => string
  exploreBug: string
  exploreBugTitle: string
  exploreBugAria: (hash: string) => string
  examplePrompts: string[]
  chatSettings: string
  chatSettingsLabel: string
  chatEffort: string
  chatEffortLevels: Record<AiSettings['reasoningEffort'], string>
  chatEffortHint: string
  chatEffortReset: string
  chatClear: string
  chatClearPending: string
  chatDock: string
  chatFloat: string
  chatDockBack: string
  chatFloatResize: string
  chatCollapse: string
  chatCloseFloat: string
  chatRetry: string
  chatCloseError: string
  chatThinking: string
  chatPlaceholder: string
  chatSend: string
  chatStop: string
  chatStopAria: string
  chatEmptyTitle: string
  chatEmptyBody: string
  chatConfigure: string
  chatComposerNotConfigured: string
  chatComposerBusy: string
  chatClearTitle: string
  chatClearPendingMessage: (count: number) => string
  chatClearMessage: string
  chatClearConfirm: string
  patchPreviewTitle: string
  patchPreviewMessage: (claim: string) => string
  patchPreviewConfirm: string
  toolApprove: string
  toolApproveDanger: string
  toolCancel: string
  toolExecuting: string
  toolRetry: string
}

export function aiUiStrings(language: AiLanguage): AiUiStrings {
  if (language === 'en') {
    return {
      emptyInvestigation: 'No clear errors in this commit.',
      bugDescriptionHeading: 'Bug description:',
      explainDescriptionAria: 'Explain this description for a beginner',
      explainDescriptionTitle: 'Generate detailed explanation',
      explainDescriptionDoneTitle: 'Explanation already generated',
      detailedExplanation: 'Detailed explanation',
      explainError: 'Explain this error',
      explainErrorConfigure: 'Configure AI to explain the error',
      investigationSubagent: 'Subagent',
      investigationAnalyzing: (file) => `Analyzing ${file}`,
      investigationFinished: 'Exploration finished',
      investigationExploring: (completed, total) => `Exploring · ${completed}/${total}`,
      investigationCancelled: 'Exploration stopped',
      investigationFilesAnalyzed: (total, failed) =>
        `${total} file(s) analyzed${failed > 0 ? ` · ${failed} failed` : ''}`,
      investigationConsolidating: 'Consolidating results',
      investigationConsolidatingAria: 'Consolidating results',
      investigationSubagents: (count) => ` · ${count} subagents`,
      investigationInterrupted: 'The exploration was interrupted.',
      investigationPartialFailure: 'The investigation finished with files that could not be analyzed.',
      proposeFix: 'Propose fix',
      preparingFix: 'Preparing fix…',
      generateCommitTitle: 'Generate commit message from staged diff with the agent',
      generateCommit: 'Generate with Agent',
      generatingCommit: 'Generating…',
      explainDiff: 'Explain diff',
      explainDiffAria: (path) => `Explain the diff for ${path}`,
      exploreBug: 'Explore bug',
      exploreBugTitle: 'Explore bug — AI analyzes this commit looking for clear errors only',
      exploreBugAria: (hash) => `Explore bug in commit ${hash}`,
      examplePrompts: [
        'Which files are modified?',
        'Create a branch called feature/x',
        'Commit the staged changes'
      ],
      chatSettings: 'Open AI settings',
      chatSettingsLabel: 'Settings',
      chatEffort: 'Reasoning effort',
      chatEffortLevels: { off: 'Off', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high' },
      chatEffortHint: 'Higher levels examine in more detail and may take longer.',
      chatEffortReset: 'Reset to default (low)',
      chatClear: 'Clear conversation',
      chatClearPending: 'Actions awaiting approval',
      chatDock: 'Dock AI chat',
      chatFloat: 'Float AI chat in a resizable window',
      chatDockBack: 'Dock back',
      chatFloatResize: 'Resize floating chat',
      chatCollapse: 'Collapse AI chat',
      chatCloseFloat: 'Close floating chat',
      chatRetry: 'Try again',
      chatCloseError: 'Dismiss error',
      chatThinking: 'Thinking…',
      chatPlaceholder: 'Write a message…',
      chatSend: 'Send (Enter)',
      chatStop: 'Stop',
      chatStopAria: 'Stop generation',
      chatEmptyTitle: 'Supervised assistant',
      chatEmptyBody:
        'The AI proposes repo actions — nothing runs without your approval. Keep browsing Changes/History while you chat.',
      chatConfigure: 'Configure AI',
      chatComposerNotConfigured: 'Configure a model and API key in Settings to send messages.',
      chatComposerBusy: 'Wait for the current response or use Stop.',
      chatClearTitle: 'Clear conversation?',
      chatClearPendingMessage: (count) =>
        `${count} action(s) awaiting approval. Clearing the conversation cancels those gates and cannot be undone.`,
      chatClearMessage: 'The entire conversation will be deleted. This cannot be undone.',
      chatClearConfirm: 'Clear conversation',
      patchPreviewTitle: 'Apply proposed fix',
      patchPreviewMessage: (claim) =>
        `${claim} — nothing is written to the repository until you confirm.`,
      patchPreviewConfirm: 'Apply to file',
      toolApprove: 'Approve',
      toolApproveDanger: 'Approve irreversible action',
      toolCancel: 'Cancel',
      toolExecuting: 'Running…',
      toolRetry: 'Try again'
    }
  }

  if (language === 'es') {
    return {
      emptyInvestigation: 'Ningún error claro en este commit.',
      bugDescriptionHeading: 'Descripción del bug:',
      explainDescriptionAria: 'Explicar esta descripción para principiantes',
      explainDescriptionTitle: 'Generar explicación detallada',
      explainDescriptionDoneTitle: 'Explicación ya generada',
      detailedExplanation: 'Explicación detallada',
      explainError: 'Explicar este error',
      explainErrorConfigure: 'Configura la IA para explicar el error',
      investigationSubagent: 'Subagente',
      investigationAnalyzing: (file) => `Analizando ${file}`,
      investigationFinished: 'Exploración finalizada',
      investigationExploring: (completed, total) => `Explorando · ${completed}/${total}`,
      investigationCancelled: 'Exploración interrumpida',
      investigationFilesAnalyzed: (total, failed) =>
        `${total} archivo(s) analizado(s)${failed > 0 ? ` · ${failed} con error` : ''}`,
      investigationConsolidating: 'Consolidando resultados',
      investigationConsolidatingAria: 'Consolidando resultados',
      investigationSubagents: (count) => ` · ${count} subagentes`,
      investigationInterrupted: 'La exploración se interrumpió.',
      investigationPartialFailure: 'La investigación terminó con archivos que no se pudieron analizar.',
      proposeFix: 'Proponer corrección',
      preparingFix: 'Preparando corrección…',
      generateCommitTitle: 'Generar el mensaje con el agente a partir del diff en stage',
      generateCommit: 'Generar con Agente',
      generatingCommit: 'Generando…',
      explainDiff: 'Explicar diff',
      explainDiffAria: (path) => `Explicar el diff de ${path}`,
      exploreBug: 'Explorar bug',
      exploreBugTitle: 'Explorar bug — la IA analiza este commit buscando solo errores claros',
      exploreBugAria: (hash) => `Explorar bug en el commit ${hash}`,
      examplePrompts: [
        '¿Qué archivos están modificados?',
        'Crea una rama llamada feature/x',
        'Haz commit de los cambios en stage'
      ],
      chatSettings: 'Abrir configuración de IA',
      chatSettingsLabel: 'Configuración',
      chatEffort: 'Esfuerzo de razonamiento',
      chatEffortLevels: { off: 'Desactivado', low: 'Bajo', medium: 'Medio', high: 'Alto', xhigh: 'Muy alto' },
      chatEffortHint: 'Los niveles más altos examinan con más detalle y pueden tardar más.',
      chatEffortReset: 'Volver al predeterminado (bajo)',
      chatClear: 'Limpiar conversación',
      chatClearPending: 'Hay acciones pendientes de aprobación',
      chatDock: 'Acoplar chat de IA',
      chatFloat: 'Separar el chat de IA en una ventana flotante',
      chatDockBack: 'Volver a acoplar',
      chatFloatResize: 'Redimensionar chat flotante',
      chatCollapse: 'Contraer chat de IA',
      chatCloseFloat: 'Cerrar chat flotante',
      chatRetry: 'Reintentar',
      chatCloseError: 'Cerrar aviso de error',
      chatThinking: 'Pensando…',
      chatPlaceholder: 'Escribe un mensaje…',
      chatSend: 'Enviar (Enter)',
      chatStop: 'Detener',
      chatStopAria: 'Detener generación',
      chatEmptyTitle: 'Asistente supervisado',
      chatEmptyBody:
        'La IA propone acciones en el repo — nada se ejecuta sin tu aprobación. Sigue navegando por Cambios/Historial mientras conversas.',
      chatConfigure: 'Configurar IA',
      chatComposerNotConfigured: 'Configura un modelo y una clave de API en Configuración para enviar mensajes.',
      chatComposerBusy: 'Espera la respuesta actual o usa Detener.',
      chatClearTitle: '¿Limpiar conversación?',
      chatClearPendingMessage: (count) =>
        `Hay ${count} acción(es) pendiente(s) de aprobación. Limpiar la conversación cancela esas aprobaciones y no se puede deshacer.`,
      chatClearMessage: 'Se borrará toda la conversación. Esto no se puede deshacer.',
      chatClearConfirm: 'Limpiar conversación',
      patchPreviewTitle: 'Aplicar corrección propuesta',
      patchPreviewMessage: (claim) =>
        `${claim} — no se escribe nada en el repositorio hasta que confirmes.`,
      patchPreviewConfirm: 'Aplicar al archivo',
      toolApprove: 'Aprobar',
      toolApproveDanger: 'Aprobar acción irreversible',
      toolCancel: 'Cancelar',
      toolExecuting: 'Ejecutando…',
      toolRetry: 'Reintentar'
    }
  }

  return {
    emptyInvestigation: 'Nenhum erro claro neste commit.',
    bugDescriptionHeading: 'Descrição do bug:',
    explainDescriptionAria: 'Explicar esta descrição para iniciante',
    explainDescriptionTitle: 'Gerar explicação detalhada',
    explainDescriptionDoneTitle: 'Explicação já gerada',
    detailedExplanation: 'Explicação detalhada',
    explainError: 'Explicar este erro',
    explainErrorConfigure: 'Configure a IA para explicar o erro',
    investigationSubagent: 'Subagente',
    investigationAnalyzing: (file) => `Analisando ${file}`,
    investigationFinished: 'Exploração finalizada',
    investigationExploring: (completed, total) => `Explorando · ${completed}/${total}`,
    investigationCancelled: 'Exploração interrompida',
    investigationFilesAnalyzed: (total, failed) =>
      `${total} arquivo(s) analisado(s)${failed > 0 ? ` · ${failed} com erro` : ''}`,
    investigationConsolidating: 'Consolidando dados',
    investigationConsolidatingAria: 'Consolidando dados',
    investigationSubagents: (count) => ` · ${count} subagentes`,
    investigationInterrupted: 'A exploração foi interrompida.',
    investigationPartialFailure: 'A investigação terminou com arquivos que não puderam ser analisados.',
    proposeFix: 'Propor correção',
    preparingFix: 'Preparando correção…',
    generateCommitTitle: 'Gerar a mensagem com o agente a partir do diff staged',
    generateCommit: 'Gerar com Agente',
    generatingCommit: 'Gerando…',
    explainDiff: 'Explicar diff',
    explainDiffAria: (path) => `Explicar o diff de ${path}`,
    exploreBug: 'Explorar bug',
    exploreBugTitle: 'Explorar bug — a IA analisa este commit procurando apenas erros claros',
    exploreBugAria: (hash) => `Explorar bug no commit ${hash}`,
    examplePrompts: [
      'Quais arquivos estão modificados?',
      'Crie uma branch chamada feature/x',
      'Faça commit das mudanças staged'
    ],
    chatSettings: 'Abrir configurações de IA',
    chatSettingsLabel: 'Configurações',
    chatEffort: 'Esforço de raciocínio',
    chatEffortLevels: { off: 'Desligado', low: 'Baixo', medium: 'Médio', high: 'Alto', xhigh: 'Muito alto' },
    chatEffortHint: 'Níveis mais altos examinam com mais detalhe e podem demorar mais.',
    chatEffortReset: 'Voltar ao padrão (baixo)',
    chatClear: 'Limpar conversa',
    chatClearPending: 'Há ações aguardando aprovação',
    chatDock: 'Encaixar chat de IA',
    chatFloat: 'Destacar chat de IA em janela flutuante',
    chatDockBack: 'Encaixar de volta',
    chatFloatResize: 'Redimensionar chat flutuante',
    chatCollapse: 'Recolher chat de IA',
    chatCloseFloat: 'Fechar chat flutuante',
    chatRetry: 'Tentar novamente',
    chatCloseError: 'Fechar aviso de erro',
    chatThinking: 'Pensando…',
    chatPlaceholder: 'Escreva uma mensagem…',
    chatSend: 'Enviar (Enter)',
    chatStop: 'Parar',
    chatStopAria: 'Parar geração',
    chatEmptyTitle: 'Assistente supervisionado',
    chatEmptyBody:
      'A IA propõe ações no repo — nada roda sem a sua aprovação. Continue navegando em Alterações/Histórico enquanto conversa.',
    chatConfigure: 'Configurar IA',
    chatComposerNotConfigured: 'Configure um modelo e uma chave de API em Configurações para enviar mensagens.',
    chatComposerBusy: 'Aguarde a resposta atual ou use Parar.',
    chatClearTitle: 'Limpar conversa?',
    chatClearPendingMessage: (count) =>
      `Há ${count} ação(ões) aguardando aprovação. Limpar a conversa cancela esses gates e não pode ser desfeito.`,
    chatClearMessage: 'Toda a conversa será apagada. Isso não pode ser desfeito.',
    chatClearConfirm: 'Limpar conversa',
    patchPreviewTitle: 'Aplicar correção proposta',
    patchPreviewMessage: (claim) =>
      `${claim} — nada é gravado no repositório até você confirmar.`,
    patchPreviewConfirm: 'Aplicar no arquivo',
    toolApprove: 'Aprovar',
    toolApproveDanger: 'Aprovar ação irreversível',
    toolCancel: 'Cancelar',
    toolExecuting: 'Executando…',
    toolRetry: 'Tentar de novo'
  }
}
