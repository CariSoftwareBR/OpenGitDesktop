const ptBR = {
  title: 'Configurações',
  backToStart: 'Voltar à tela inicial',
  tabs: {
    label: 'Seções das configurações',
    general: 'Geral',
    generalHint: 'Conta, commit e sobre',
    ai: 'Assistente IA',
    aiHint: 'Provedor, chave e modelo',
    appearance: 'Aparência',
    appearanceHint: 'Idioma e tema'
  },
  github: {
    signOut: 'Sair',
    account: 'Conta do GitHub',
    checkingSession: 'Verificando sessão…',
    signInHint: 'Entre para listar e gerenciar Pull Requests dos seus repositórios.',
    signIn: 'Entrar com GitHub',
    revokeHintBefore:
      'O token foi apagado desta máquina. A autorização do OpenGitDesktop continua ativa na sua conta do GitHub — para removê-la de vez, ',
    revokeHintLink: 'revogue o acesso do aplicativo no GitHub',
    revokeHintAfter: '.'
  },
  commit: {
    heading: 'Commit',
    autoPush: 'Enviar (push) automaticamente após o commit',
    autoPushHint: 'Ao commitar, envia as alterações para o remoto em seguida, sem precisar clicar em "Push" separadamente.',
    coAuthor: 'Co-autoria do OpenGitDesktop',
    coAuthorHint:
      'Ativado, cada commit feito pelo app leva o OpenGitDesktop como co-autor. Deixe ligado se quiser apoiar o projeto: é assim que ele aparece no histórico dos repositórios onde é usado.',
    coAuthorPreview: 'Linha adicionada à mensagem:'
  },
  ai: {
    heading: 'IA',
    hint: 'Provedor, chave e modelo do assistente supervisionado.'
  },
  appearance: {
    heading: 'Aparência',
    theme: 'Tema',
    themeHint: 'Sistema segue o SO; contraste alto do sistema ativa as variantes HC automaticamente.',
    themeSystem: 'Sistema',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    language: 'Idioma',
    languageHint: 'Sistema segue o idioma do SO. Vale para a interface, as mensagens e as respostas da IA.',
    languageSystem: 'Sistema'
  },
  app: {
    heading: 'Aplicativo',
    about: 'Sobre o OpenGitDesktop',
    aboutHint: 'Nome, versão e data da build.'
  }
}

type M = typeof ptBR

const en: M = {
  title: 'Settings',
  backToStart: 'Back to the start screen',
  tabs: {
    label: 'Settings sections',
    general: 'General',
    generalHint: 'Account, commit and about',
    ai: 'AI assistant',
    aiHint: 'Provider, key and model',
    appearance: 'Appearance',
    appearanceHint: 'Language and theme'
  },
  github: {
    signOut: 'Sign out',
    account: 'GitHub account',
    checkingSession: 'Checking session…',
    signInHint: 'Sign in to list and manage Pull Requests for your repositories.',
    signIn: 'Sign in with GitHub',
    revokeHintBefore:
      'The token was deleted from this machine. OpenGitDesktop’s authorization is still active on your GitHub account — to remove it for good, ',
    revokeHintLink: 'revoke the app’s access on GitHub',
    revokeHintAfter: '.'
  },
  commit: {
    heading: 'Commit',
    autoPush: 'Push automatically after committing',
    autoPushHint: 'After committing, pushes the changes to the remote right away, without clicking "Push" separately.',
    coAuthor: 'OpenGitDesktop co-authorship',
    coAuthorHint:
      'When on, every commit made through the app lists OpenGitDesktop as a co-author. Keep it on if you want to support the project: that is how it shows up in the history of the repositories where it is used.',
    coAuthorPreview: 'Line added to the message:'
  },
  ai: {
    heading: 'AI',
    hint: 'Provider, key and model of the supervised assistant.'
  },
  appearance: {
    heading: 'Appearance',
    theme: 'Theme',
    themeHint: 'System follows the OS; the system high-contrast setting enables the HC variants automatically.',
    themeSystem: 'System',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'Language',
    languageHint: 'System follows the OS language. Applies to the interface, messages and AI replies.',
    languageSystem: 'System'
  },
  app: {
    heading: 'Application',
    about: 'About OpenGitDesktop',
    aboutHint: 'Name, version and build date.'
  }
}

const es: M = {
  title: 'Configuración',
  backToStart: 'Volver a la pantalla inicial',
  tabs: {
    label: 'Secciones de la configuración',
    general: 'General',
    generalHint: 'Cuenta, commit y acerca de',
    ai: 'Asistente IA',
    aiHint: 'Proveedor, clave y modelo',
    appearance: 'Apariencia',
    appearanceHint: 'Idioma y tema'
  },
  github: {
    signOut: 'Cerrar sesión',
    account: 'Cuenta de GitHub',
    checkingSession: 'Verificando sesión…',
    signInHint: 'Inicia sesión para listar y gestionar los Pull Requests de tus repositorios.',
    signIn: 'Iniciar sesión con GitHub',
    revokeHintBefore:
      'El token se borró de este equipo. La autorización de OpenGitDesktop sigue activa en tu cuenta de GitHub — para eliminarla definitivamente, ',
    revokeHintLink: 'revoca el acceso de la aplicación en GitHub',
    revokeHintAfter: '.'
  },
  commit: {
    heading: 'Commit',
    autoPush: 'Enviar (push) automáticamente después del commit',
    autoPushHint: 'Al hacer commit, envía los cambios al remoto a continuación, sin tener que pulsar "Push" por separado.',
    coAuthor: 'Coautoría de OpenGitDesktop',
    coAuthorHint:
      'Activado, cada commit hecho desde la app incluye a OpenGitDesktop como coautor. Déjalo activado si quieres apoyar el proyecto: así aparece en el historial de los repositorios donde se usa.',
    coAuthorPreview: 'Línea añadida al mensaje:'
  },
  ai: {
    heading: 'IA',
    hint: 'Proveedor, clave y modelo del asistente supervisado.'
  },
  appearance: {
    heading: 'Apariencia',
    theme: 'Tema',
    themeHint: 'Sistema sigue al SO; el alto contraste del sistema activa las variantes HC automáticamente.',
    themeSystem: 'Sistema',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    language: 'Idioma',
    languageHint: 'Sistema sigue el idioma del SO. Se aplica a la interfaz, los mensajes y las respuestas de la IA.',
    languageSystem: 'Sistema'
  },
  app: {
    heading: 'Aplicación',
    about: 'Acerca de OpenGitDesktop',
    aboutHint: 'Nombre, versión y fecha de la build.'
  }
}

export default { 'pt-BR': ptBR, en, es }
