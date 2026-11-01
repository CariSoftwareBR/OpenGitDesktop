// Approval cards and results of the history/tag/blame/reorganize agent tools.
// Results are read by the model, so they state facts plainly and say what the
// user is now seeing on screen.
const ptBR = {
  showInHistoryHeadline: (hash: string) => `Mostrar ${hash} no Histórico`,
  notInGraph: (ref: string) =>
    `O commit "${ref}" não aparece no histórico das branches, remotos e tags deste repositório (pode ser de um stash ou já ter sido descartado).`,
  shownInHistory: (hash: string, summary: string) =>
    `O Histórico foi aberto no commit ${hash} ("${summary}") e ele está destacado no grafo para o usuário.`,
  containedInLine: (names: string) => `Presente em: ${names}.`,
  containedInNone: 'Ainda não está em nenhuma outra branch nem tag — só na branch onde foi criado.',
  parentsLine: (parents: string) => `Pais: ${parents}.`,

  fileHistoryHeadline: (path: string, line?: number) => (line ? `Explicar a linha ${line} de ${path}` : `Explicar o histórico de ${path}`),
  pathLabel: 'Arquivo',
  lineLabel: 'Linha',
  lineOutOfRange: (line: number, total: number) => `O arquivo tem ${total} linha(s); a linha ${line} não existe.`,
  lineHeader: (line: number, content: string) => `Linha ${line}: ${content}`,
  lastChange: (hash: string, summary: string, author: string, date: string) =>
    `Última mudança: ${hash} — "${summary}" (${author}, ${date}).`,
  uncommittedLine: 'Esta linha foi alterada e ainda não foi commitada.',
  fullMessage: 'Mensagem completa do commit:',
  authorsHeader: 'Autoria atual do arquivo (linhas por pessoa):',
  timelineHeader: (n: number) => `Últimos ${n} commit(s) que mudaram o arquivo:`,
  insightOpened: 'A linha do tempo e a autoria do arquivo foram abertas na tela para o usuário.',

  listTagsHeadline: 'Listar tags',
  noTags: 'Este repositório ainda não tem tags.',
  tagsHeader: (n: number) => `${n} tag(s), da mais nova para a mais antiga:`,

  createTagHeadline: (name: string, hash: string) => `Criar a tag "${name}" em ${hash}`,
  tagLabel: 'Tag',
  messageLabel: 'Mensagem',
  createTagWarning: 'A tag fica só neste computador. Para publicar, é preciso um push da tag.',
  tagCreated: (name: string, hash: string) => `Tag "${name}" criada em ${hash}. Ainda não foi enviada ao remoto.`,
  pushTagHeadline: (name: string) => `Enviar a tag "${name}" para o remoto`,
  pushTagWarning: 'Publica a tag para todo mundo que usa o remoto. Apagar uma tag publicada é trabalhoso.',
  tagPushed: (name: string) => `Tag "${name}" enviada para origin.`,
  tagUnknown: (name: string, list: string) => `A tag "${name}" não existe. Tags locais: ${list || '(nenhuma)'}`,
  tagInvalid: (name: string) => `"${name}" não é um nome de tag válido (use algo como v1.2.0).`,
  tagTaken: (name: string) => `A tag "${name}" já existe.`,

  releaseHeadline: (from: string, to: string) => `Reunir commits para notas de release (${from} → ${to})`,
  releaseFromStart: 'início do repositório',
  releaseRangeLabel: 'Intervalo',
  releaseHeader: (n: number, range: string) => `${n} commit(s) em ${range}:`,
  releaseInstruction:
    'Escreva as notas de release em Markdown a partir desta lista: título com a versão, seções "Novidades", "Correções" e "Outras mudanças" (omita as vazias), uma linha por mudança em linguagem de usuário, sem hashes.',
  releaseEmpty: (range: string) => `Nenhum commit em ${range}.`,
  releaseMore: (n: number) => `… e mais ${n} commit(s) não listados.`,

  rebaseHeadline: (before: number, after: number) => `Reorganizar ${before} commits locais em ${after}`,
  rebaseWarning:
    'Só mexe em commits que ainda não foram enviados. Se algum passo falhar, a branch volta exatamente como estava.',
  rebasePlanLabel: 'Plano',
  rebaseBlocked: (reason: string) => `Não dá para reorganizar agora: ${reason}`,
  rebaseBadLine: (line: string) => `Linha do plano não reconhecida: "${line}". Use "pick|reword|squash|fixup|drop <hash> [mensagem]".`,
  rebaseProblem: {
    unknown: (hash: string) => `O commit ${hash} não está entre os commits locais desta branch.`,
    ambiguous: (hash: string) => `O hash ${hash} é ambíguo; use mais caracteres.`,
    duplicate: (hash: string) => `O commit ${hash} aparece mais de uma vez no plano.`,
    missing: (hashes: string) => `O plano precisa listar todos os commits locais. Faltaram: ${hashes}.`,
    squashFirst: 'O primeiro commit mantido (o mais antigo) não pode ser squash nem fixup.',
    nothingKept: 'O plano descarta todos os commits; mantenha pelo menos um.',
    emptyMessage: (hash: string) => `reword de ${hash} precisa de uma nova mensagem.`
  },
  localCommitsHeader: 'Commits locais desta branch, do mais antigo para o mais novo:',
  rebaseDone: (n: number) => `Commits locais reorganizados: a branch agora tem ${n} commit(s) que ainda não foram enviados.`,

  localMarker: '(local, não enviado)'
}

type M = typeof ptBR

const en: M = {
  showInHistoryHeadline: (hash) => `Show ${hash} in History`,
  notInGraph: (ref) =>
    `The commit "${ref}" is not in the history of this repository's branches, remotes and tags (it may belong to a stash or have been dropped).`,
  shownInHistory: (hash, summary) => `History was opened on commit ${hash} ("${summary}") and it is highlighted in the graph for the user.`,
  containedInLine: (names) => `Present in: ${names}.`,
  containedInNone: 'Not in any other branch or tag yet — only on the branch where it was made.',
  parentsLine: (parents) => `Parents: ${parents}.`,

  fileHistoryHeadline: (path, line) => (line ? `Explain line ${line} of ${path}` : `Explain the history of ${path}`),
  pathLabel: 'File',
  lineLabel: 'Line',
  lineOutOfRange: (line, total) => `The file has ${total} line(s); line ${line} does not exist.`,
  lineHeader: (line, content) => `Line ${line}: ${content}`,
  lastChange: (hash, summary, author, date) => `Last change: ${hash} — "${summary}" (${author}, ${date}).`,
  uncommittedLine: 'This line was changed and is not committed yet.',
  fullMessage: 'Full commit message:',
  authorsHeader: 'Current authorship of the file (lines per person):',
  timelineHeader: (n) => `Last ${n} commit(s) that changed the file:`,
  insightOpened: 'The file’s timeline and authorship were opened on screen for the user.',

  listTagsHeadline: 'List tags',
  noTags: 'This repository has no tags yet.',
  tagsHeader: (n) => `${n} tag(s), newest first:`,

  createTagHeadline: (name, hash) => `Create tag "${name}" at ${hash}`,
  tagLabel: 'Tag',
  messageLabel: 'Message',
  createTagWarning: 'The tag stays on this computer. Publishing it takes a tag push.',
  tagCreated: (name, hash) => `Tag "${name}" created at ${hash}. It was not pushed to the remote yet.`,
  pushTagHeadline: (name) => `Push tag "${name}" to the remote`,
  pushTagWarning: 'Publishes the tag to everyone using the remote. Deleting a published tag is laborious.',
  tagPushed: (name) => `Tag "${name}" pushed to origin.`,
  tagUnknown: (name, list) => `The tag "${name}" does not exist. Local tags: ${list || '(none)'}`,
  tagInvalid: (name) => `"${name}" is not a valid tag name (use something like v1.2.0).`,
  tagTaken: (name) => `The tag "${name}" already exists.`,

  releaseHeadline: (from, to) => `Gather commits for release notes (${from} → ${to})`,
  releaseFromStart: 'start of the repository',
  releaseRangeLabel: 'Range',
  releaseHeader: (n, range) => `${n} commit(s) in ${range}:`,
  releaseInstruction:
    'Write the release notes in Markdown from this list: a title with the version, "New", "Fixes" and "Other changes" sections (omit empty ones), one line per change in user-facing language, no hashes.',
  releaseEmpty: (range) => `No commits in ${range}.`,
  releaseMore: (n) => `… and ${n} more commit(s) not listed.`,

  rebaseHeadline: (before, after) => `Reorganize ${before} local commits into ${after}`,
  rebaseWarning: 'Only touches commits that were not pushed yet. If any step fails, the branch goes back exactly as it was.',
  rebasePlanLabel: 'Plan',
  rebaseBlocked: (reason) => `Cannot reorganize right now: ${reason}`,
  rebaseBadLine: (line) => `Unrecognized plan line: "${line}". Use "pick|reword|squash|fixup|drop <hash> [message]".`,
  rebaseProblem: {
    unknown: (hash) => `Commit ${hash} is not among this branch’s local commits.`,
    ambiguous: (hash) => `The hash ${hash} is ambiguous; use more characters.`,
    duplicate: (hash) => `Commit ${hash} appears more than once in the plan.`,
    missing: (hashes) => `The plan must list every local commit. Missing: ${hashes}.`,
    squashFirst: 'The first kept commit (the oldest) cannot be squash or fixup.',
    nothingKept: 'The plan drops every commit; keep at least one.',
    emptyMessage: (hash) => `reword of ${hash} needs a new message.`
  },
  localCommitsHeader: 'This branch’s local commits, oldest first:',
  rebaseDone: (n) => `Local commits reorganized: the branch now has ${n} commit(s) not pushed yet.`,

  localMarker: '(local, not pushed)'
}

const es: M = {
  showInHistoryHeadline: (hash) => `Mostrar ${hash} en el Historial`,
  notInGraph: (ref) =>
    `El commit "${ref}" no aparece en el historial de las ramas, remotos y tags de este repositorio (puede ser de un stash o haberse descartado).`,
  shownInHistory: (hash, summary) => `Se abrió el Historial en el commit ${hash} ("${summary}") y está resaltado en el grafo para el usuario.`,
  containedInLine: (names) => `Presente en: ${names}.`,
  containedInNone: 'Todavía no está en ninguna otra rama ni tag — solo en la rama donde se creó.',
  parentsLine: (parents) => `Padres: ${parents}.`,

  fileHistoryHeadline: (path, line) => (line ? `Explicar la línea ${line} de ${path}` : `Explicar el historial de ${path}`),
  pathLabel: 'Archivo',
  lineLabel: 'Línea',
  lineOutOfRange: (line, total) => `El archivo tiene ${total} línea(s); la línea ${line} no existe.`,
  lineHeader: (line, content) => `Línea ${line}: ${content}`,
  lastChange: (hash, summary, author, date) => `Último cambio: ${hash} — "${summary}" (${author}, ${date}).`,
  uncommittedLine: 'Esta línea se modificó y todavía no tiene commit.',
  fullMessage: 'Mensaje completo del commit:',
  authorsHeader: 'Autoría actual del archivo (líneas por persona):',
  timelineHeader: (n) => `Últimos ${n} commit(s) que cambiaron el archivo:`,
  insightOpened: 'La línea de tiempo y la autoría del archivo se abrieron en pantalla para el usuario.',

  listTagsHeadline: 'Listar tags',
  noTags: 'Este repositorio todavía no tiene tags.',
  tagsHeader: (n) => `${n} tag(s), del más nuevo al más antiguo:`,

  createTagHeadline: (name, hash) => `Crear el tag "${name}" en ${hash}`,
  tagLabel: 'Tag',
  messageLabel: 'Mensaje',
  createTagWarning: 'El tag queda solo en este equipo. Para publicarlo hace falta un push del tag.',
  tagCreated: (name, hash) => `Tag "${name}" creado en ${hash}. Todavía no se envió al remoto.`,
  pushTagHeadline: (name) => `Enviar el tag "${name}" al remoto`,
  pushTagWarning: 'Publica el tag para todos los que usan el remoto. Borrar un tag publicado es laborioso.',
  tagPushed: (name) => `Tag "${name}" enviado a origin.`,
  tagUnknown: (name, list) => `El tag "${name}" no existe. Tags locales: ${list || '(ninguno)'}`,
  tagInvalid: (name) => `"${name}" no es un nombre de tag válido (usa algo como v1.2.0).`,
  tagTaken: (name) => `El tag "${name}" ya existe.`,

  releaseHeadline: (from, to) => `Reunir commits para notas de versión (${from} → ${to})`,
  releaseFromStart: 'inicio del repositorio',
  releaseRangeLabel: 'Intervalo',
  releaseHeader: (n, range) => `${n} commit(s) en ${range}:`,
  releaseInstruction:
    'Escribe las notas de versión en Markdown a partir de esta lista: título con la versión, secciones "Novedades", "Correcciones" y "Otros cambios" (omite las vacías), una línea por cambio en lenguaje de usuario, sin hashes.',
  releaseEmpty: (range) => `Ningún commit en ${range}.`,
  releaseMore: (n) => `… y ${n} commit(s) más no listados.`,

  rebaseHeadline: (before, after) => `Reorganizar ${before} commits locales en ${after}`,
  rebaseWarning: 'Solo toca commits que todavía no se enviaron. Si algún paso falla, la rama vuelve exactamente como estaba.',
  rebasePlanLabel: 'Plan',
  rebaseBlocked: (reason) => `No se puede reorganizar ahora: ${reason}`,
  rebaseBadLine: (line) => `Línea del plan no reconocida: "${line}". Usa "pick|reword|squash|fixup|drop <hash> [mensaje]".`,
  rebaseProblem: {
    unknown: (hash) => `El commit ${hash} no está entre los commits locales de esta rama.`,
    ambiguous: (hash) => `El hash ${hash} es ambiguo; usa más caracteres.`,
    duplicate: (hash) => `El commit ${hash} aparece más de una vez en el plan.`,
    missing: (hashes) => `El plan debe listar todos los commits locales. Faltaron: ${hashes}.`,
    squashFirst: 'El primer commit que se mantiene (el más antiguo) no puede ser squash ni fixup.',
    nothingKept: 'El plan descarta todos los commits; mantén al menos uno.',
    emptyMessage: (hash) => `reword de ${hash} necesita un mensaje nuevo.`
  },
  localCommitsHeader: 'Commits locales de esta rama, del más antiguo al más nuevo:',
  rebaseDone: (n) => `Commits locales reorganizados: la rama ahora tiene ${n} commit(s) sin enviar.`,

  localMarker: '(local, sin enviar)'
}

export default { 'pt-BR': ptBR, en, es }
