// Messages raised by renderer stores and helper libraries (errors, notices, diff placeholders).
const ptBR = {
  notARepo: (path: string) => `"${path}" não é um repositório git.`,
  untrackedFolder: '(pasta não rastreada — use o menu de contexto para ignorá-la ou adicione seus arquivos)',
  fileTruncated: '… (arquivo truncado)',
  emptyNewFile: '(arquivo novo vazio)',
  pushFailedAfterCommit: (error: string) => `Commit criado, mas o push falhou: ${error}`,
  fileChangedSinceDiff: 'O arquivo mudou desde que o diff foi exibido. Confira o diff atualizado e tente de novo.',
  cannotReadHunks: 'Não foi possível ler os hunks deste diff.',
  invalidHunk: 'Hunk inválido.',
  pullFailed: 'git pull falhou.',
  mergeFailed: (branch: string) => `git merge ${branch} falhou.`,
  mergeConflicts: 'Merge com conflitos. Resolva os arquivos marcados em Alterações antes de continuar.',
  revertConflicts: 'A reversão gerou conflitos. Resolva os arquivos em Alterações e conclua com o commit.',
  revertFailed: 'git revert falhou.',
  noBranchToPublish: 'Nenhuma branch atual para publicar.',
  pullConflicts: 'Pull com conflitos. Resolva os arquivos marcados em Alterações antes de continuar.',
  leaseRejected:
    'O remoto recebeu commits novos de outra pessoa desde a última busca, então nada foi sobrescrito. Use "Buscar origin", confira o histórico e integre antes de publicar.',

  prNoLongerOpen: (n: number, state: string) => `A pull request #${n} não está mais aberta (estado atual: ${state}).`,
  prStateClosed: 'fechada',
  prMerged: (n: number, title: string) => `Pull request #${n} "${title}" mesclada com sucesso.`,
  prClosed: (n: number, title: string) => `Pull request #${n} "${title}" fechada.`,
  prReopened: (n: number, title: string) => `Pull request #${n} "${title}" reaberta.`,

  aiPing: 'Responda apenas "ok".',
  connectionOk: 'Conexão OK.',
  actionCancelled: 'Ação cancelada pelo usuário.',
  tooManyToolRounds: (n: number) =>
    `A IA encadeou ${n} rodadas de ferramentas sem concluir. Envie uma nova mensagem para continuar.`,
  noResult: '(sem resultado)',

  branchStartsWithDash: 'O nome não pode começar com "-".',
  branchIsAt: 'O nome não pode ser só "@".',
  branchControlChars: 'O nome não pode conter ~ ^ : ? * [ \\ nem caracteres de controle.',
  branchDoubleDot: 'O nome não pode conter "..".',
  branchAtBrace: 'O nome não pode conter "@{".',
  branchDoubleSlash: 'O nome não pode conter "//".',
  branchSlashEdge: 'O nome não pode começar nem terminar com "/".',
  branchEndsWithDot: 'O nome não pode terminar com ".".',
  branchPartDot: 'Nenhuma parte do nome pode começar com ".".',
  branchPartLock: 'Nenhuma parte do nome pode terminar com ".lock".',
  branchExists: (name: string) => `Já existe uma branch "${name}".`,

  conflictBlockUnresolved: (id: number) => `Bloco de conflito #${id} não foi resolvido pela IA.`,
  aiNoResolution: 'A IA não retornou uma resolução de conflito válida.',
  aiMissingBlocks: 'A IA não resolveu todos os blocos de conflito.',
  aiCustomEmpty: (id: number) => `A IA indicou uma resolução "custom" sem conteúdo para o bloco #${id}.`,
  aiStillHasMarkers: (id: number) => `A resolução da IA para o bloco #${id} ainda contém marcadores de conflito.`,
  conflictSummary: (path: string) => `Resolução de conflito em ${path}`,

  checking: 'Verificando…'
}

type M = typeof ptBR

const en: M = {
  notARepo: (path) => `"${path}" is not a git repository.`,
  untrackedFolder: '(untracked folder — use the context menu to ignore it or add its files)',
  fileTruncated: '… (file truncated)',
  emptyNewFile: '(empty new file)',
  pushFailedAfterCommit: (error) => `Commit created, but the push failed: ${error}`,
  fileChangedSinceDiff: 'The file changed since the diff was shown. Check the updated diff and try again.',
  cannotReadHunks: 'Could not read the hunks of this diff.',
  invalidHunk: 'Invalid hunk.',
  pullFailed: 'git pull failed.',
  mergeFailed: (branch) => `git merge ${branch} failed.`,
  mergeConflicts: 'Merge has conflicts. Resolve the marked files in Changes before continuing.',
  revertConflicts: 'The revert produced conflicts. Resolve the files in Changes and finish with a commit.',
  revertFailed: 'git revert failed.',
  noBranchToPublish: 'No current branch to publish.',
  pullConflicts: 'Pull has conflicts. Resolve the marked files in Changes before continuing.',
  leaseRejected:
    'The remote received new commits from someone else since the last fetch, so nothing was overwritten. Use "Fetch origin", check the history and integrate before publishing.',

  prNoLongerOpen: (n, state) => `Pull request #${n} is no longer open (current state: ${state}).`,
  prStateClosed: 'closed',
  prMerged: (n, title) => `Pull request #${n} "${title}" merged successfully.`,
  prClosed: (n, title) => `Pull request #${n} "${title}" closed.`,
  prReopened: (n, title) => `Pull request #${n} "${title}" reopened.`,

  aiPing: 'Reply with just "ok".',
  connectionOk: 'Connection OK.',
  actionCancelled: 'Action cancelled by the user.',
  tooManyToolRounds: (n) => `The AI chained ${n} tool rounds without finishing. Send a new message to continue.`,
  noResult: '(no result)',

  branchStartsWithDash: 'The name cannot start with "-".',
  branchIsAt: 'The name cannot be just "@".',
  branchControlChars: 'The name cannot contain ~ ^ : ? * [ \\ or control characters.',
  branchDoubleDot: 'The name cannot contain "..".',
  branchAtBrace: 'The name cannot contain "@{".',
  branchDoubleSlash: 'The name cannot contain "//".',
  branchSlashEdge: 'The name cannot start or end with "/".',
  branchEndsWithDot: 'The name cannot end with ".".',
  branchPartDot: 'No part of the name can start with ".".',
  branchPartLock: 'No part of the name can end with ".lock".',
  branchExists: (name) => `A branch "${name}" already exists.`,

  conflictBlockUnresolved: (id) => `Conflict block #${id} was not resolved by the AI.`,
  aiNoResolution: 'The AI did not return a valid conflict resolution.',
  aiMissingBlocks: 'The AI did not resolve every conflict block.',
  aiCustomEmpty: (id) => `The AI chose a "custom" resolution with no content for block #${id}.`,
  aiStillHasMarkers: (id) => `The AI resolution for block #${id} still contains conflict markers.`,
  conflictSummary: (path) => `Conflict resolution in ${path}`,

  checking: 'Checking…'
}

const es: M = {
  notARepo: (path) => `"${path}" no es un repositorio git.`,
  untrackedFolder: '(carpeta sin seguimiento — usa el menú contextual para ignorarla o añade sus archivos)',
  fileTruncated: '… (archivo truncado)',
  emptyNewFile: '(archivo nuevo vacío)',
  pushFailedAfterCommit: (error) => `Commit creado, pero el push falló: ${error}`,
  fileChangedSinceDiff: 'El archivo cambió desde que se mostró el diff. Revisa el diff actualizado e inténtalo de nuevo.',
  cannotReadHunks: 'No se pudieron leer los hunks de este diff.',
  invalidHunk: 'Hunk no válido.',
  pullFailed: 'git pull falló.',
  mergeFailed: (branch) => `git merge ${branch} falló.`,
  mergeConflicts: 'Merge con conflictos. Resuelve los archivos marcados en Cambios antes de continuar.',
  revertConflicts: 'La reversión generó conflictos. Resuelve los archivos en Cambios y termina con el commit.',
  revertFailed: 'git revert falló.',
  noBranchToPublish: 'No hay una rama actual para publicar.',
  pullConflicts: 'Pull con conflictos. Resuelve los archivos marcados en Cambios antes de continuar.',
  leaseRejected:
    'El remoto recibió commits nuevos de otra persona desde la última búsqueda, así que no se sobrescribió nada. Usa "Obtener origin", revisa el historial e integra antes de publicar.',

  prNoLongerOpen: (n, state) => `La pull request #${n} ya no está abierta (estado actual: ${state}).`,
  prStateClosed: 'cerrada',
  prMerged: (n, title) => `Pull request #${n} "${title}" fusionada correctamente.`,
  prClosed: (n, title) => `Pull request #${n} "${title}" cerrada.`,
  prReopened: (n, title) => `Pull request #${n} "${title}" reabierta.`,

  aiPing: 'Responde solo "ok".',
  connectionOk: 'Conexión OK.',
  actionCancelled: 'Acción cancelada por el usuario.',
  tooManyToolRounds: (n) =>
    `La IA encadenó ${n} rondas de herramientas sin terminar. Envía un mensaje nuevo para continuar.`,
  noResult: '(sin resultado)',

  branchStartsWithDash: 'El nombre no puede empezar con "-".',
  branchIsAt: 'El nombre no puede ser solo "@".',
  branchControlChars: 'El nombre no puede contener ~ ^ : ? * [ \\ ni caracteres de control.',
  branchDoubleDot: 'El nombre no puede contener "..".',
  branchAtBrace: 'El nombre no puede contener "@{".',
  branchDoubleSlash: 'El nombre no puede contener "//".',
  branchSlashEdge: 'El nombre no puede empezar ni terminar con "/".',
  branchEndsWithDot: 'El nombre no puede terminar con ".".',
  branchPartDot: 'Ninguna parte del nombre puede empezar con ".".',
  branchPartLock: 'Ninguna parte del nombre puede terminar con ".lock".',
  branchExists: (name) => `Ya existe una rama "${name}".`,

  conflictBlockUnresolved: (id) => `La IA no resolvió el bloque de conflicto #${id}.`,
  aiNoResolution: 'La IA no devolvió una resolución de conflicto válida.',
  aiMissingBlocks: 'La IA no resolvió todos los bloques de conflicto.',
  aiCustomEmpty: (id) => `La IA indicó una resolución "custom" sin contenido para el bloque #${id}.`,
  aiStillHasMarkers: (id) => `La resolución de la IA para el bloque #${id} todavía contiene marcadores de conflicto.`,
  conflictSummary: (path) => `Resolución de conflicto en ${path}`,

  checking: 'Comprobando…'
}

export default { 'pt-BR': ptBR, en, es }
