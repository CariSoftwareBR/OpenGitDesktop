const ptBR = {
  title: 'Histórico',
  noCommits: 'Nenhum commit encontrado.',
  searchPlaceholder: 'Buscar mensagem, autor ou hash',
  search: 'Buscar no histórico',
  backToCommits: 'Voltar para a lista de commits',
  commits: 'Commits',
  copyHashTitle: 'Copiar o hash completo do commit',
  copied: 'Copiado',
  copyHash: 'Copiar hash',
  branchHereTitle: 'Criar uma branch que começa neste commit',
  branchHere: 'Nova branch daqui',
  revertTitle: 'Criar um novo commit que desfaz as mudanças deste',
  revert: 'Reverter commit',
  changedFiles: 'Arquivos alterados',
  noChangedFiles:
    'Nenhum arquivo alterado em relação ao commit anterior (comum em merges que mantiveram a versão da branch).',
  fileHistoryTitle: (path: string) => `Histórico de ${path}`,
  fileHistoryAria: (path: string) => `Ver histórico só de ${path}`,
  resizeFiles: 'Redimensionar lista de arquivos',
  branchFromTitle: 'Nova branch a partir deste commit',
  branchFromMessage: (hash: string) => `A branch começa em ${hash} e vira a branch atual.`,
  branchName: 'Nome da branch',
  createBranch: 'Criar branch',
  revertDialogTitle: 'Reverter commit?',
  revertDialogMessage: (summary: string, hash: string) =>
    `Cria um novo commit que desfaz "${summary}" (${hash}). O histórico não é reescrito, então é seguro mesmo que ele já esteja no remoto.`,
  revertConfirm: 'Reverter',
  stopWorkTitle: 'Parar o trabalho atual?',
  stopWorkMessage: 'Já há uma análise em andamento. Parar e explorar este commit, ou deixar a atual terminar?',
  stopAndStart: 'Parar e começar',
  letFinish: 'Deixar terminar',
  selectCommit: 'Selecione um commit.'
}

type M = typeof ptBR

const en: M = {
  title: 'History',
  noCommits: 'No commits found.',
  searchPlaceholder: 'Search message, author or hash',
  search: 'Search history',
  backToCommits: 'Back to the commit list',
  commits: 'Commits',
  copyHashTitle: 'Copy the full commit hash',
  copied: 'Copied',
  copyHash: 'Copy hash',
  branchHereTitle: 'Create a branch that starts at this commit',
  branchHere: 'New branch from here',
  revertTitle: 'Create a new commit that undoes this one’s changes',
  revert: 'Revert commit',
  changedFiles: 'Changed files',
  noChangedFiles:
    'No files changed relative to the previous commit (common in merges that kept the branch’s version).',
  fileHistoryTitle: (path) => `History of ${path}`,
  fileHistoryAria: (path) => `Show history of ${path} only`,
  resizeFiles: 'Resize file list',
  branchFromTitle: 'New branch from this commit',
  branchFromMessage: (hash) => `The branch starts at ${hash} and becomes the current branch.`,
  branchName: 'Branch name',
  createBranch: 'Create branch',
  revertDialogTitle: 'Revert commit?',
  revertDialogMessage: (summary, hash) =>
    `Creates a new commit that undoes "${summary}" (${hash}). History is not rewritten, so it is safe even if the commit is already on the remote.`,
  revertConfirm: 'Revert',
  stopWorkTitle: 'Stop the current work?',
  stopWorkMessage: 'An analysis is already running. Stop it and explore this commit, or let the current one finish?',
  stopAndStart: 'Stop and start',
  letFinish: 'Let it finish',
  selectCommit: 'Select a commit.'
}

const es: M = {
  title: 'Historial',
  noCommits: 'No se encontró ningún commit.',
  searchPlaceholder: 'Buscar mensaje, autor o hash',
  search: 'Buscar en el historial',
  backToCommits: 'Volver a la lista de commits',
  commits: 'Commits',
  copyHashTitle: 'Copiar el hash completo del commit',
  copied: 'Copiado',
  copyHash: 'Copiar hash',
  branchHereTitle: 'Crear una rama que empiece en este commit',
  branchHere: 'Nueva rama desde aquí',
  revertTitle: 'Crear un nuevo commit que deshaga los cambios de este',
  revert: 'Revertir commit',
  changedFiles: 'Archivos modificados',
  noChangedFiles:
    'Ningún archivo modificado respecto al commit anterior (común en merges que mantuvieron la versión de la rama).',
  fileHistoryTitle: (path) => `Historial de ${path}`,
  fileHistoryAria: (path) => `Ver solo el historial de ${path}`,
  resizeFiles: 'Redimensionar lista de archivos',
  branchFromTitle: 'Nueva rama a partir de este commit',
  branchFromMessage: (hash) => `La rama empieza en ${hash} y pasa a ser la rama actual.`,
  branchName: 'Nombre de la rama',
  createBranch: 'Crear rama',
  revertDialogTitle: '¿Revertir commit?',
  revertDialogMessage: (summary, hash) =>
    `Crea un nuevo commit que deshace "${summary}" (${hash}). El historial no se reescribe, así que es seguro aunque ya esté en el remoto.`,
  revertConfirm: 'Revertir',
  stopWorkTitle: '¿Detener el trabajo actual?',
  stopWorkMessage: 'Ya hay un análisis en curso. ¿Detenerlo y explorar este commit, o dejar que termine el actual?',
  stopAndStart: 'Detener y empezar',
  letFinish: 'Dejar terminar',
  selectCommit: 'Selecciona un commit.'
}

export default { 'pt-BR': ptBR, en, es }
