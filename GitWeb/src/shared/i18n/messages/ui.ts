// Shared components: dialogs, menus, lists and the diff viewer.
const ptBR = {
  folderName: 'Nome da pasta',
  renameFolder: 'Renomear pasta',
  renameFolderAria: (name: string) => `Renomear a pasta ${name}`,
  deleteFolder: 'Excluir pasta (os repositórios voltam para Sem pasta)',
  deleteFolderAria: (name: string) => `Excluir a pasta ${name}`,
  dropReposHere: 'Arraste repositórios para cá.',

  prMergedInto: (n: number, base: string) => `PR #${n} mesclada em ${base}`,
  nextSteps: 'Próximos passos sugeridos:',
  dismissNextSteps: 'Dispensar próximos passos',
  pullFailed: 'git pull falhou.',
  updateBase: (base: string) => `Atualizar ${base}`,
  switchAndUpdate: (base: string) => `Ir para ${base} e atualizar`,
  switchBeforeDelete: (head: string) => `Troque para outra branch antes de excluir "${head}".`,
  branchDeleted: (head: string) => `"${head}" excluída`,
  deleteBranch: (head: string) => `Excluir a branch "${head}"`,
  goToBaseFirst: (base: string) => `Para excluir a branch, primeiro vá para ${base}.`,
  deleteMergedTitle: 'Excluir branch mesclada?',
  deleteMergedMessage: (head: string, alsoLocal: boolean, base: string, n: number) =>
    `Excluir "${head}" no remoto (origin)${alsoLocal ? ' e localmente' : ''}? O conteúdo dela já está em ${base} pela PR #${n}.`,
  delete: 'Excluir',

  discardChanges: 'Descartar alterações',
  ignoreFolder: 'Ignorar pasta (adicionar ao .gitignore)',
  ignoreFile: 'Ignorar arquivo (adicionar ao .gitignore)',
  ignoreExtension: (ext: string) => `Ignorar todos os arquivos ${ext} (adicionar ao .gitignore)`,
  copyFullPath: 'Copiar caminho do arquivo',
  copyRelativePath: 'Copiar caminho relativo',
  showInExplorer: 'Mostrar no Explorer',
  openDefault: 'Abrir com o programa padrão',

  commentLine: (line: number) => `Comentar na linha ${line}`,
  stageHunk: 'Incluir hunk',
  discardHunk: 'Descartar hunk',
  unstageHunk: 'Tirar hunk do stage',
  selectFileForDiff: 'Selecione um arquivo para ver o diff.',
  selectFileForDiffHint: 'Clique em um arquivo na lista ao lado, ou use ↑↓ com a lista em foco.',
  discardHunkConfirm: 'Descartar este hunk da árvore de trabalho?',
  discard: 'Descartar',

  conflictsIn: (n: number) => (n === 1 ? '1 conflito em' : `${n} conflitos em`),
  ours: 'Nossa versão',
  theirs: 'Versão deles',
  useOurs: 'Usar nossa versão',
  useTheirs: 'Usar a versão deles',
  keepBoth: 'Manter ambas',
  saveResolved: 'Salvar e marcar como resolvido',

  searchPlaceholder: 'Buscar…',
  searchOption: 'Buscar opção',
  selectPlaceholder: 'Selecione…',
  noResults: 'Nenhum resultado.',

  previousPage: 'Página anterior',
  pageOf: (page: number, count: number) => `Página ${page} de ${count}`,
  nextPage: 'Próxima página',

  reposFound: (n: number) => `${n} repositórios encontrados`,
  pickRepos: 'Selecione quais deseja adicionar à lista de recentes.',
  deselectAll: 'Desmarcar todos',
  selectAll: 'Selecionar todos',
  add: (n: number) => (n > 0 ? `Adicionar ${n}` : 'Adicionar'),

  applying: 'Aplicando…',

  crashTitle: 'Algo deu errado na interface',
  crashMessage: 'Seus repositórios e configurações não foram afetados. Recarregue a interface para continuar.',
  reloadUi: 'Recarregar interface'
}

type M = typeof ptBR

const en: M = {
  folderName: 'Folder name',
  renameFolder: 'Rename folder',
  renameFolderAria: (name) => `Rename the folder ${name}`,
  deleteFolder: 'Delete folder (its repositories move back to No folder)',
  deleteFolderAria: (name) => `Delete the folder ${name}`,
  dropReposHere: 'Drag repositories here.',

  prMergedInto: (n, base) => `PR #${n} merged into ${base}`,
  nextSteps: 'Suggested next steps:',
  dismissNextSteps: 'Dismiss next steps',
  pullFailed: 'git pull failed.',
  updateBase: (base) => `Update ${base}`,
  switchAndUpdate: (base) => `Switch to ${base} and update`,
  switchBeforeDelete: (head) => `Switch to another branch before deleting "${head}".`,
  branchDeleted: (head) => `"${head}" deleted`,
  deleteBranch: (head) => `Delete the branch "${head}"`,
  goToBaseFirst: (base) => `To delete the branch, switch to ${base} first.`,
  deleteMergedTitle: 'Delete merged branch?',
  deleteMergedMessage: (head, alsoLocal, base, n) =>
    `Delete "${head}" on the remote (origin)${alsoLocal ? ' and locally' : ''}? Its content is already in ${base} through PR #${n}.`,
  delete: 'Delete',

  discardChanges: 'Discard changes',
  ignoreFolder: 'Ignore folder (add to .gitignore)',
  ignoreFile: 'Ignore file (add to .gitignore)',
  ignoreExtension: (ext) => `Ignore all ${ext} files (add to .gitignore)`,
  copyFullPath: 'Copy file path',
  copyRelativePath: 'Copy relative path',
  showInExplorer: 'Show in Explorer',
  openDefault: 'Open with default program',

  commentLine: (line) => `Comment on line ${line}`,
  stageHunk: 'Stage hunk',
  discardHunk: 'Discard hunk',
  unstageHunk: 'Unstage hunk',
  selectFileForDiff: 'Select a file to see the diff.',
  selectFileForDiffHint: 'Click a file in the list beside this, or use ↑↓ with the list focused.',
  discardHunkConfirm: 'Discard this hunk from the working tree?',
  discard: 'Discard',

  conflictsIn: (n) => (n === 1 ? '1 conflict in' : `${n} conflicts in`),
  ours: 'Our version',
  theirs: 'Their version',
  useOurs: 'Use our version',
  useTheirs: 'Use their version',
  keepBoth: 'Keep both',
  saveResolved: 'Save and mark as resolved',

  searchPlaceholder: 'Search…',
  searchOption: 'Search options',
  selectPlaceholder: 'Select…',
  noResults: 'No results.',

  previousPage: 'Previous page',
  pageOf: (page, count) => `Page ${page} of ${count}`,
  nextPage: 'Next page',

  reposFound: (n) => `${n} repositories found`,
  pickRepos: 'Choose which ones to add to the recent list.',
  deselectAll: 'Deselect all',
  selectAll: 'Select all',
  add: (n) => (n > 0 ? `Add ${n}` : 'Add'),

  applying: 'Applying…',

  crashTitle: 'Something went wrong in the interface',
  crashMessage: 'Your repositories and settings were not affected. Reload the interface to continue.',
  reloadUi: 'Reload interface'
}

const es: M = {
  folderName: 'Nombre de la carpeta',
  renameFolder: 'Renombrar carpeta',
  renameFolderAria: (name) => `Renombrar la carpeta ${name}`,
  deleteFolder: 'Eliminar carpeta (los repositorios vuelven a Sin carpeta)',
  deleteFolderAria: (name) => `Eliminar la carpeta ${name}`,
  dropReposHere: 'Arrastra repositorios aquí.',

  prMergedInto: (n, base) => `PR #${n} fusionada en ${base}`,
  nextSteps: 'Próximos pasos sugeridos:',
  dismissNextSteps: 'Descartar próximos pasos',
  pullFailed: 'git pull falló.',
  updateBase: (base) => `Actualizar ${base}`,
  switchAndUpdate: (base) => `Ir a ${base} y actualizar`,
  switchBeforeDelete: (head) => `Cambia a otra rama antes de eliminar "${head}".`,
  branchDeleted: (head) => `"${head}" eliminada`,
  deleteBranch: (head) => `Eliminar la rama "${head}"`,
  goToBaseFirst: (base) => `Para eliminar la rama, primero ve a ${base}.`,
  deleteMergedTitle: '¿Eliminar la rama fusionada?',
  deleteMergedMessage: (head, alsoLocal, base, n) =>
    `¿Eliminar "${head}" en el remoto (origin)${alsoLocal ? ' y localmente' : ''}? Su contenido ya está en ${base} por la PR #${n}.`,
  delete: 'Eliminar',

  discardChanges: 'Descartar cambios',
  ignoreFolder: 'Ignorar carpeta (añadir a .gitignore)',
  ignoreFile: 'Ignorar archivo (añadir a .gitignore)',
  ignoreExtension: (ext) => `Ignorar todos los archivos ${ext} (añadir a .gitignore)`,
  copyFullPath: 'Copiar ruta del archivo',
  copyRelativePath: 'Copiar ruta relativa',
  showInExplorer: 'Mostrar en el Explorador',
  openDefault: 'Abrir con el programa predeterminado',

  commentLine: (line) => `Comentar en la línea ${line}`,
  stageHunk: 'Incluir hunk',
  discardHunk: 'Descartar hunk',
  unstageHunk: 'Quitar hunk del stage',
  selectFileForDiff: 'Selecciona un archivo para ver el diff.',
  selectFileForDiffHint: 'Haz clic en un archivo de la lista de al lado, o usa ↑↓ con la lista enfocada.',
  discardHunkConfirm: '¿Descartar este hunk del árbol de trabajo?',
  discard: 'Descartar',

  conflictsIn: (n) => (n === 1 ? '1 conflicto en' : `${n} conflictos en`),
  ours: 'Nuestra versión',
  theirs: 'Su versión',
  useOurs: 'Usar nuestra versión',
  useTheirs: 'Usar su versión',
  keepBoth: 'Mantener ambas',
  saveResolved: 'Guardar y marcar como resuelto',

  searchPlaceholder: 'Buscar…',
  searchOption: 'Buscar opción',
  selectPlaceholder: 'Selecciona…',
  noResults: 'Sin resultados.',

  previousPage: 'Página anterior',
  pageOf: (page, count) => `Página ${page} de ${count}`,
  nextPage: 'Página siguiente',

  reposFound: (n) => `${n} repositorios encontrados`,
  pickRepos: 'Selecciona cuáles quieres añadir a la lista de recientes.',
  deselectAll: 'Desmarcar todos',
  selectAll: 'Seleccionar todos',
  add: (n) => (n > 0 ? `Añadir ${n}` : 'Añadir'),

  applying: 'Aplicando…',

  crashTitle: 'Algo salió mal en la interfaz',
  crashMessage: 'Tus repositorios y ajustes no se vieron afectados. Recarga la interfaz para continuar.',
  reloadUi: 'Recargar interfaz'
}

export default { 'pt-BR': ptBR, en, es }
