const ptBR = {
  newStash: 'Novo stash',
  askAiTitle: 'Perguntar à IA como usar stashes com segurança',
  aiNotConfigured: 'Configure a IA para usar esta ajuda',
  askAiAria: 'Perguntar à IA sobre stashes',
  aiTopic: 'stashes, Aplicar, Restaurar e remover, e Descartar',
  aiTopicStash: (ref: string, message: string) =>
    `o stash ${ref}, "${message}", e como decidir entre Aplicar e Restaurar e remover`,
  messagePlaceholder: 'Mensagem do stash (opcional)',
  messageLabel: 'Mensagem do stash',
  stashChanges: 'Stash das alterações atuais',
  noChanges: 'Nenhuma alteração para colocar em stash.',
  previewTitle: 'Ver o conteúdo deste stash',
  askAiStashTitle: 'Pedir orientação à IA sobre este stash',
  askAiStashAria: (ref: string) => `Pedir orientação à IA sobre ${ref}`,
  applyTitle: 'Aplicar (mantém no stash)',
  apply: 'Aplicar',
  popTitle: 'Restaurar as alterações e remover este stash',
  popAria: (ref: string) => `Restaurar e remover stash ${ref}`,
  pop: 'Restaurar e remover',
  drop: 'Descartar',
  dropAria: (ref: string) => `Descartar stash ${ref}`,
  loadingContent: 'Carregando conteúdo…',
  noTextDiff: 'Este stash não tem diferenças de texto para mostrar.',
  empty: 'Nenhuma stash salva.',
  popDialogTitle: 'Restaurar e remover stash?',
  popDialogMessage: (ref: string) =>
    `Restaurar "${ref}" na árvore de trabalho e apagar essa entrada do stash? Se houver conflito, o stash pode permanecer.`,
  dropDialogTitle: 'Descartar stash?',
  dropDialogMessage: (ref: string) => `Descartar "${ref}" definitivamente? Isso não pode ser desfeito.`
}

type M = typeof ptBR

const en: M = {
  newStash: 'New stash',
  askAiTitle: 'Ask the AI how to use stashes safely',
  aiNotConfigured: 'Set up the AI to use this help',
  askAiAria: 'Ask the AI about stashes',
  aiTopic: 'stashes, Apply, Restore and remove, and Discard',
  aiTopicStash: (ref, message) => `the stash ${ref}, "${message}", and how to choose between Apply and Restore and remove`,
  messagePlaceholder: 'Stash message (optional)',
  messageLabel: 'Stash message',
  stashChanges: 'Stash current changes',
  noChanges: 'No changes to stash.',
  previewTitle: 'View the contents of this stash',
  askAiStashTitle: 'Ask the AI for guidance on this stash',
  askAiStashAria: (ref) => `Ask the AI for guidance on ${ref}`,
  applyTitle: 'Apply (keeps it in the stash)',
  apply: 'Apply',
  popTitle: 'Restore the changes and remove this stash',
  popAria: (ref) => `Restore and remove stash ${ref}`,
  pop: 'Restore and remove',
  drop: 'Discard',
  dropAria: (ref) => `Discard stash ${ref}`,
  loadingContent: 'Loading contents…',
  noTextDiff: 'This stash has no text differences to show.',
  empty: 'No saved stashes.',
  popDialogTitle: 'Restore and remove stash?',
  popDialogMessage: (ref) =>
    `Restore "${ref}" into the working tree and delete this stash entry? If there is a conflict, the stash may remain.`,
  dropDialogTitle: 'Discard stash?',
  dropDialogMessage: (ref) => `Permanently discard "${ref}"? This cannot be undone.`
}

const es: M = {
  newStash: 'Nuevo stash',
  askAiTitle: 'Preguntar a la IA cómo usar stashes con seguridad',
  aiNotConfigured: 'Configura la IA para usar esta ayuda',
  askAiAria: 'Preguntar a la IA sobre stashes',
  aiTopic: 'stashes, Aplicar, Restaurar y eliminar, y Descartar',
  aiTopicStash: (ref, message) => `el stash ${ref}, "${message}", y cómo decidir entre Aplicar y Restaurar y eliminar`,
  messagePlaceholder: 'Mensaje del stash (opcional)',
  messageLabel: 'Mensaje del stash',
  stashChanges: 'Hacer stash de los cambios actuales',
  noChanges: 'No hay cambios para guardar en stash.',
  previewTitle: 'Ver el contenido de este stash',
  askAiStashTitle: 'Pedir orientación a la IA sobre este stash',
  askAiStashAria: (ref) => `Pedir orientación a la IA sobre ${ref}`,
  applyTitle: 'Aplicar (lo mantiene en el stash)',
  apply: 'Aplicar',
  popTitle: 'Restaurar los cambios y eliminar este stash',
  popAria: (ref) => `Restaurar y eliminar stash ${ref}`,
  pop: 'Restaurar y eliminar',
  drop: 'Descartar',
  dropAria: (ref) => `Descartar stash ${ref}`,
  loadingContent: 'Cargando contenido…',
  noTextDiff: 'Este stash no tiene diferencias de texto para mostrar.',
  empty: 'No hay stashes guardados.',
  popDialogTitle: '¿Restaurar y eliminar stash?',
  popDialogMessage: (ref) =>
    `¿Restaurar "${ref}" en el árbol de trabajo y borrar esta entrada del stash? Si hay conflicto, el stash puede permanecer.`,
  dropDialogTitle: '¿Descartar stash?',
  dropDialogMessage: (ref) => `¿Descartar "${ref}" definitivamente? Esto no se puede deshacer.`
}

export default { 'pt-BR': ptBR, en, es }
