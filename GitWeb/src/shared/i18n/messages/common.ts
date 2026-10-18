// Strings shared by several screens, plus the app shell (App.tsx).

const ptBR = {
  cancel: 'Cancelar',
  close: 'Fechar',
  confirm: 'Confirmar',
  save: 'Salvar',
  delete: 'Excluir',
  retry: 'Tentar novamente',
  loading: 'Carregando…',
  dismissError: 'Fechar aviso de erro',
  dismissSuccess: 'Fechar aviso de sucesso',
  resizeAiChat: 'Redimensionar chat de IA',
  aiChat: 'Chat de IA',
  aiChatFloating: 'Chat de IA (flutuante)',
  openAiChat: 'Abrir chat de IA'
}

type M = typeof ptBR

const en: M = {
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Confirm',
  save: 'Save',
  delete: 'Delete',
  retry: 'Try again',
  loading: 'Loading…',
  dismissError: 'Dismiss error',
  dismissSuccess: 'Dismiss success message',
  resizeAiChat: 'Resize AI chat',
  aiChat: 'AI chat',
  aiChatFloating: 'AI chat (floating)',
  openAiChat: 'Open AI chat'
}

const es: M = {
  cancel: 'Cancelar',
  close: 'Cerrar',
  confirm: 'Confirmar',
  save: 'Guardar',
  delete: 'Eliminar',
  retry: 'Reintentar',
  loading: 'Cargando…',
  dismissError: 'Cerrar aviso de error',
  dismissSuccess: 'Cerrar aviso de éxito',
  resizeAiChat: 'Redimensionar chat de IA',
  aiChat: 'Chat de IA',
  aiChatFloating: 'Chat de IA (flotante)',
  openAiChat: 'Abrir chat de IA'
}

export default { 'pt-BR': ptBR, en, es }
