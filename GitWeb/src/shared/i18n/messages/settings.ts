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
    appearanceHint: 'Idioma e tema',
    security: 'Segurança',
    securityHint: 'Arquivos sensíveis no commit'
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
  security: {
    heading: 'Verificação antes do commit',
    check: 'Verificar arquivos sensíveis',
    checkHint:
      'Antes de cada commit, procura arquivos .env, chaves privadas e tokens no que vai entrar nele. Vale para a tela de Alterações e para o Assistente IA, e roda só no seu computador. Ligada, também tira esses conteúdos de tudo o que é enviado à IA.',
    modeHeading: 'Ao encontrar algo',
    modeAria: 'O que fazer ao encontrar arquivos sensíveis',
    warn: 'Avisar',
    warnHint: 'Mostra o que encontrou e você decide se commita mesmo assim.',
    block: 'Bloquear',
    blockHint: 'Não deixa commitar enquanto os arquivos estiverem no commit.',
    offHint: 'Ligue a verificação para escolher.',
    coverageHeading: 'O que é verificado',
    byName: 'Pelo nome do arquivo',
    byContent: 'Pelo conteúdo das linhas adicionadas',
    exempt: 'Modelos como .env.example e chaves públicas (.pub) não contam. Um arquivo que está sendo apagado também não.'
  },
  app: {
    heading: 'Aplicativo',
    about: 'Sobre o OpenGitDesktop',
    aboutHint: 'Nome, versão e data da build.'
  },
  connectedTo: (host: string) => `Conectado a ${host}`,
  themeAria: 'Tema da interface',
  languageAria: 'Idioma da interface',
  followsSystem: 'Segue o sistema operacional'
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
    appearanceHint: 'Language and theme',
    security: 'Security',
    securityHint: 'Sensitive files in commits'
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
  security: {
    heading: 'Pre-commit check',
    check: 'Check for sensitive files',
    checkHint:
      'Before each commit, looks for .env files, private keys and tokens in what is about to go in. Applies to the Changes view and the AI assistant, and runs only on your computer. While on, it also keeps that content out of everything sent to the AI.',
    modeHeading: 'When something is found',
    modeAria: 'What to do when sensitive files are found',
    warn: 'Warn',
    warnHint: 'Shows what was found and lets you decide whether to commit anyway.',
    block: 'Block',
    blockHint: 'Refuses to commit while those files are in the commit.',
    offHint: 'Turn the check on to choose.',
    coverageHeading: 'What is checked',
    byName: 'By file name',
    byContent: 'By the content of added lines',
    exempt: 'Templates like .env.example and public keys (.pub) do not count. Neither does a file being deleted.'
  },
  app: {
    heading: 'Application',
    about: 'About OpenGitDesktop',
    aboutHint: 'Name, version and build date.'
  },
  connectedTo: (host) => `Connected to ${host}`,
  themeAria: 'Interface theme',
  languageAria: 'Interface language',
  followsSystem: 'Follows the operating system'
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
    appearanceHint: 'Idioma y tema',
    security: 'Seguridad',
    securityHint: 'Archivos sensibles en el commit'
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
  security: {
    heading: 'Verificación antes del commit',
    check: 'Verificar archivos sensibles',
    checkHint:
      'Antes de cada commit, busca archivos .env, claves privadas y tokens en lo que va a entrar. Se aplica a la pantalla de Cambios y al Asistente IA, y se ejecuta solo en tu equipo. Activada, también quita ese contenido de todo lo que se envía a la IA.',
    modeHeading: 'Al encontrar algo',
    modeAria: 'Qué hacer al encontrar archivos sensibles',
    warn: 'Avisar',
    warnHint: 'Muestra lo que encontró y tú decides si haces commit igualmente.',
    block: 'Bloquear',
    blockHint: 'No permite el commit mientras esos archivos estén en él.',
    offHint: 'Activa la verificación para elegir.',
    coverageHeading: 'Qué se verifica',
    byName: 'Por el nombre del archivo',
    byContent: 'Por el contenido de las líneas añadidas',
    exempt: 'Las plantillas como .env.example y las claves públicas (.pub) no cuentan. Tampoco un archivo que se está borrando.'
  },
  app: {
    heading: 'Aplicación',
    about: 'Acerca de OpenGitDesktop',
    aboutHint: 'Nombre, versión y fecha de la build.'
  },
  connectedTo: (host) => `Conectado a ${host}`,
  themeAria: 'Tema de la interfaz',
  languageAria: 'Idioma de la interfaz',
  followsSystem: 'Sigue el sistema operativo'
}

export default { 'pt-BR': ptBR, en, es }
