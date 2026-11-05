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
  clone: {
    heading: 'Clonar',
    organizeByOwner: 'Organizar por conta',
    organizeByOwnerHint:
      'Ao clonar, cria uma pasta para cada conta dentro da pasta escolhida: pasta › conta › repositório.'
  },
  reorganize: {
    rowLabel: 'Reorganizar repositórios',
    rowHint: 'Move os repositórios que já estão no computador para pasta › conta › repositório. Mostra o que vai mudar antes de mover.',
    open: 'Reorganizar…',
    title: 'Reorganizar repositórios',
    lead: 'Cada repositório vai para a pasta da conta dona do remote origin. O nome da pasta dele não muda.',
    folder: 'Pasta principal',
    noFolder: 'Nenhuma pasta escolhida',
    chooseFolder: 'Escolher pasta…',
    scanning: 'Procurando repositórios…',
    rootIsRepository: 'Esta pasta é um repositório. Escolha a pasta que contém os seus repositórios.',
    summary: (moves: number, organized: number) => {
      const toMove = moves === 0 ? 'Nada para mover' : moves === 1 ? '1 repositório será movido' : `${moves} repositórios serão movidos`
      if (organized === 0) return `${toMove}.`
      return `${toMove} · ${organized === 1 ? '1 já organizado' : `${organized} já organizados`}.`
    },
    skippedHeading: (n: number) => (n === 1 ? '1 não será movido' : `${n} não serão movidos`),
    reason: {
      noRemote: 'Sem remote origin',
      unknownOwner: 'Não deu para identificar a conta pelo remote',
      targetExists: 'Já existe uma pasta com esse nome no destino',
      ownerFolderIsRepo: 'A pasta da conta é outro repositório',
      hasWorktrees: 'Tem worktrees ligadas, que parariam de funcionar'
    },
    safetyNote:
      'Commits, branches e arquivos não são alterados, só a pasta muda. Feche editores e terminais abertos nessas pastas. Atalhos e scripts de fora do app que usem o caminho antigo precisarão ser atualizados.',
    move: (n: number) => (n === 1 ? 'Mover 1 repositório' : `Mover ${n} repositórios`),
    moving: 'Movendo…',
    movedSummary: (n: number) => (n === 1 ? '1 repositório movido.' : `${n} repositórios movidos.`),
    failedHeading: (n: number) => (n === 1 ? '1 não pôde ser movido' : `${n} não puderam ser movidos`),
    recentError: (detail: string) => `As pastas foram movidas, mas não consegui atualizar a lista de recentes: ${detail}`,
    failure: {
      inUse: 'Pasta em uso. Feche editores e terminais abertos nela e reorganize de novo',
      targetExists: 'Já existe uma pasta com esse nome no destino',
      ownerFolderIsRepo: 'A pasta da conta é outro repositório',
      planChanged: 'A pasta mudou depois da prévia',
      stranded: 'Não consegui concluir nem desfazer. O repositório está intacto, nesta pasta oculta; mova-o manualmente',
      other: 'Não foi possível mover'
    }
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
  clone: {
    heading: 'Clone',
    organizeByOwner: 'Organize by account',
    organizeByOwnerHint:
      'When cloning, creates one folder per account inside the chosen folder: folder › account › repository.'
  },
  reorganize: {
    rowLabel: 'Reorganize repositories',
    rowHint: 'Moves the repositories already on this computer to folder › account › repository. Shows what will change before moving.',
    open: 'Reorganize…',
    title: 'Reorganize repositories',
    lead: 'Each repository goes to the folder of the account that owns its origin remote. Its own folder name stays the same.',
    folder: 'Main folder',
    noFolder: 'No folder chosen',
    chooseFolder: 'Choose folder…',
    scanning: 'Looking for repositories…',
    rootIsRepository: 'This folder is a repository. Choose the folder that contains your repositories.',
    summary: (moves, organized) => {
      const toMove = moves === 0 ? 'Nothing to move' : moves === 1 ? '1 repository will be moved' : `${moves} repositories will be moved`
      return organized === 0 ? `${toMove}.` : `${toMove} · ${organized} already organized.`
    },
    skippedHeading: (n) => (n === 1 ? '1 will not be moved' : `${n} will not be moved`),
    reason: {
      noRemote: 'No origin remote',
      unknownOwner: 'Could not tell the account from the remote',
      targetExists: 'A folder with this name already exists at the destination',
      ownerFolderIsRepo: 'The account folder is another repository',
      hasWorktrees: 'Has linked worktrees, which would stop working'
    },
    safetyNote:
      'Commits, branches and files are not changed; only the folder does. Close editors and terminals open in these folders. Shortcuts and scripts outside the app that use the old path will need updating.',
    move: (n) => (n === 1 ? 'Move 1 repository' : `Move ${n} repositories`),
    moving: 'Moving…',
    movedSummary: (n) => (n === 1 ? '1 repository moved.' : `${n} repositories moved.`),
    failedHeading: (n) => (n === 1 ? '1 could not be moved' : `${n} could not be moved`),
    recentError: (detail) => `The folders were moved, but the list of recents could not be updated: ${detail}`,
    failure: {
      inUse: 'Folder in use. Close editors and terminals open in it and reorganize again',
      targetExists: 'A folder with this name already exists at the destination',
      ownerFolderIsRepo: 'The account folder is another repository',
      planChanged: 'The folder changed after the preview',
      stranded: 'Could not finish or undo the move. The repository is intact, in this hidden folder; move it manually',
      other: 'Could not move'
    }
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
  clone: {
    heading: 'Clonar',
    organizeByOwner: 'Organizar por cuenta',
    organizeByOwnerHint:
      'Al clonar, crea una carpeta por cuenta dentro de la carpeta elegida: carpeta › cuenta › repositorio.'
  },
  reorganize: {
    rowLabel: 'Reorganizar repositorios',
    rowHint: 'Mueve los repositorios que ya están en el equipo a carpeta › cuenta › repositorio. Muestra qué cambiará antes de mover.',
    open: 'Reorganizar…',
    title: 'Reorganizar repositorios',
    lead: 'Cada repositorio va a la carpeta de la cuenta dueña del remote origin. El nombre de su carpeta no cambia.',
    folder: 'Carpeta principal',
    noFolder: 'Ninguna carpeta elegida',
    chooseFolder: 'Elegir carpeta…',
    scanning: 'Buscando repositorios…',
    rootIsRepository: 'Esta carpeta es un repositorio. Elige la carpeta que contiene tus repositorios.',
    summary: (moves, organized) => {
      const toMove = moves === 0 ? 'Nada que mover' : moves === 1 ? 'Se moverá 1 repositorio' : `Se moverán ${moves} repositorios`
      if (organized === 0) return `${toMove}.`
      return `${toMove} · ${organized === 1 ? '1 ya organizado' : `${organized} ya organizados`}.`
    },
    skippedHeading: (n) => (n === 1 ? '1 no se moverá' : `${n} no se moverán`),
    reason: {
      noRemote: 'Sin remote origin',
      unknownOwner: 'No se pudo identificar la cuenta por el remote',
      targetExists: 'Ya existe una carpeta con ese nombre en el destino',
      ownerFolderIsRepo: 'La carpeta de la cuenta es otro repositorio',
      hasWorktrees: 'Tiene worktrees vinculados, que dejarían de funcionar'
    },
    safetyNote:
      'Los commits, ramas y archivos no se modifican, solo cambia la carpeta. Cierra los editores y terminales abiertos en esas carpetas. Los accesos directos y scripts fuera de la app que usen la ruta antigua deberán actualizarse.',
    move: (n) => (n === 1 ? 'Mover 1 repositorio' : `Mover ${n} repositorios`),
    moving: 'Moviendo…',
    movedSummary: (n) => (n === 1 ? '1 repositorio movido.' : `${n} repositorios movidos.`),
    failedHeading: (n) => (n === 1 ? '1 no se pudo mover' : `${n} no se pudieron mover`),
    recentError: (detail) => `Las carpetas se movieron, pero no se pudo actualizar la lista de recientes: ${detail}`,
    failure: {
      inUse: 'Carpeta en uso. Cierra los editores y terminales abiertos en ella y reorganiza de nuevo',
      targetExists: 'Ya existe una carpeta con ese nombre en el destino',
      ownerFolderIsRepo: 'La carpeta de la cuenta es otro repositorio',
      planChanged: 'La carpeta cambió después de la vista previa',
      stranded: 'No se pudo terminar ni deshacer. El repositorio está intacto, en esta carpeta oculta; muévelo manualmente',
      other: 'No se pudo mover'
    }
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
