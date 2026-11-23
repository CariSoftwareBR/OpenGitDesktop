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
    securityHint: 'Arquivos sensíveis no commit',
    identity: 'Identidade',
    identityHint: 'Nome e e-mail dos commits',
    aiRules: 'Ações da IA',
    aiRulesHint: 'Regras e registro',
    diagnostics: 'Diagnóstico',
    diagnosticsHint: 'Git, GitHub e IA'
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
    autoPushHint: 'Ao commitar, envia as alterações para o remoto em seguida, sem precisar clicar em "Enviar origin" separadamente.',
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
    lead: 'Cada repositório vai para a pasta da conta dona do remoto origin. O nome da pasta dele não muda.',
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
      noRemote: 'Sem remoto origin',
      unknownOwner: 'Não deu para identificar a conta pelo remoto',
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
  identity: {
    globalHeading: 'Identidade global',
    globalHint: 'Vale para os repositórios sem perfil nem configuração própria. Fica no seu ~/.gitconfig.',
    name: 'Nome',
    email: 'E-mail',
    namePlaceholder: 'Como você aparece nos commits',
    emailPlaceholder: 'voce@exemplo.com',
    save: 'Salvar',
    saving: 'Salvando…',
    saved: 'Salvo',
    repoHeading: 'Este repositório',
    commitsAs: 'Os commits saem como',
    notConfigured: 'Sem nome ou e-mail: o Git vai recusar o commit.',
    sourceLocal: 'Configuração do repositório',
    sourceProfile: (name: string) => `Perfil de ${name}`,
    sourceGlobal: 'Identidade global',
    sourceOther: 'Configuração do sistema',
    remoteOwner: (owner: string) => `Remoto de ${owner}`,
    mismatch: (account: string, email: string) => `Este repositório é de ${account}, mas o perfil dessa conta usa ${email}.`,
    applyProfileHere: (account: string) => `Usar o perfil de ${account} aqui`,
    profilesHeading: 'Perfis por conta',
    profilesHint:
      'Cada perfil guarda o nome e o e-mail de uma conta. Com uma pasta, todo repositório dentro dela usa o perfil sozinho (includeIf do Git). Com a conta, o app avisa quando um repositório dela for commitar com outro e-mail.',
    noProfiles: 'Nenhum perfil ainda. Crie um para cada conta com que você commita.',
    addProfile: 'Adicionar perfil',
    editProfile: 'Editar',
    removeProfile: 'Remover',
    account: 'Conta',
    accountPlaceholder: 'Dono do remoto, como aparece no GitHub',
    folder: 'Pasta',
    noFolder: 'Sem pasta',
    chooseFolder: 'Escolher pasta…',
    clearFolder: 'Tirar a pasta',
    cancel: 'Cancelar',
    saveProfile: 'Salvar perfil',
    githubSuggestions: 'Da sua conta do GitHub',
    noreply: 'privado',
    noreplyHint: 'O GitHub liga o commit à sua conta sem mostrar o seu e-mail.',
    invalidEmail: 'E-mail inválido.',
    invalidName: 'Escreva um nome.',
    needsAccountOrFolder: 'Informe a conta, a pasta ou as duas.',
    folderSuggested: 'Sugerida pela organização por conta',
    applyNote: 'Ao salvar, o app só mexe nas linhas includeIf que ele mesmo criou no seu ~/.gitconfig.',
    profileCount: (n: number) => (n === 1 ? '1 perfil' : `${n} perfis`),
    saveError: (detail: string) => `Não consegui salvar: ${detail}`
  },
  aiRules: {
    protectedHeading: 'Branches protegidas',
    protectedHint:
      'O assistente não pode commitar, enviar, fazer merge nem reescrever commits nessas branches, nem com a sua aprovação: ele precisa criar outra branch antes. Use * no fim para um prefixo, como release/*.',
    branchPlaceholder: 'Nome da branch',
    add: 'Adicionar',
    remove: (branch: string) => `Remover ${branch}`,
    suggestions: 'Sugestões',
    noneProtected: 'Nenhuma branch protegida.',
    confirmHeading: 'Aprovação',
    confirmDanger: 'Confirmar ações irreversíveis com dois cliques',
    confirmDangerHint:
      'Push, merge, apagar branches e as outras ações marcadas como irreversíveis pedem um segundo clique no cartão de aprovação.',
    logHeading: 'Registro de ações',
    logHint: 'O que o assistente propôs para mudar algo e o que você decidiu. Fica só neste computador.',
    onlyThisRepo: 'Só este repositório',
    clear: 'Limpar registro',
    clearConfirm: 'Clique de novo para apagar',
    empty: 'Nenhuma ação registrada ainda. Quando o assistente propuser uma mudança, ela aparece aqui.',
    emptyFiltered: 'Nenhuma ação registrada neste repositório.',
    completed: 'Aprovada e concluída',
    failed: 'Aprovada, mas falhou',
    rejected: 'Recusada',
    blocked: 'Bloqueada por uma regra',
    irreversible: 'irreversível',
    loadError: 'Não consegui ler o registro.'
  },
  diagnostics: {
    hint: 'Confere o Git, a sua configuração e as integrações. Nada muda sem você clicar em Corrigir.',
    rerun: 'Verificar de novo',
    running: 'Verificando…',
    allGood: 'Tudo certo',
    issues: (n: number) => (n === 1 ? '1 ponto para olhar' : `${n} pontos para olhar`),
    checkedAt: (when: string) => `Verificado ${when}`,
    fix: 'Corrigir',
    fixing: 'Corrigindo…',
    willRun: 'Vai rodar',
    openIdentity: 'Abrir Identidade',
    openAccount: 'Entrar no GitHub',
    openAi: 'Configurar a IA',
    testAi: 'Testar conexão',
    testingAi: 'Testando…',
    failed: (detail: string) => `Não consegui verificar: ${detail}`,
    statusLabel: { ok: 'OK', warn: 'Atenção', error: 'Problema', info: 'Informação' },
    checks: {
      git: {
        title: 'Git',
        ok: 'Instalado e numa versão recente.',
        outdated: 'Versão antiga. Atualize para a 2.36 ou mais nova: algumas telas usam recursos dela.',
        notFound: 'Não encontrei o Git no PATH. Instale-o e reabra o app.'
      },
      identity: {
        title: 'Nome e e-mail dos commits',
        ok: 'Configurados na identidade global.',
        missingName: 'Falta o nome na identidade global.',
        missingEmail: 'Falta o e-mail na identidade global.',
        missingBoth: 'Sem nome e e-mail globais: repositórios sem perfil não conseguem commitar.'
      },
      safeDirectory: {
        title: 'Permissão da pasta do repositório',
        ok: 'O Git aceita trabalhar nesta pasta.',
        dubiousOwnership: 'A pasta pertence a outro usuário do sistema e o Git se recusa a usá-la até ela ser marcada como confiável.'
      },
      longPaths: {
        title: 'Caminhos longos',
        ok: 'Ativado: arquivos com caminho acima de 260 caracteres funcionam.',
        disabled: 'Desativado: no Windows, arquivos com caminho acima de 260 caracteres falham no clone e no checkout.'
      },
      lfs: {
        title: 'Git LFS',
        ok: 'Instalado.',
        usedButMissing: 'Este repositório usa Git LFS, mas ele não está instalado: os arquivos grandes ficam só como ponteiros.',
        notInstalled: 'Não instalado. Só faz falta em repositórios que guardam arquivos grandes com LFS.'
      },
      ssh: {
        title: 'Cliente SSH',
        ok: 'Instalado. O remoto deste repositório usa SSH.',
        notFound: 'O remoto deste repositório usa SSH, mas não encontrei o comando ssh.'
      },
      credentialHelper: {
        title: 'Gerenciador de credenciais',
        ok: 'Configurado para os remotos fora do GitHub.',
        notConfigured: 'Não configurado. No GitHub o app usa o próprio login; outros servidores vão pedir usuário e senha.'
      },
      github: {
        title: 'Conta do GitHub',
        ok: 'Conectada.',
        notSignedIn: 'Não conectada. Pull requests, colaboradores e mensagens precisam do login.',
        tokenInvalid: 'O GitHub recusou o login salvo. Entre de novo.',
        missingRepoScope: 'O login não tem a permissão repo: repositórios privados não vão aparecer.',
        unreachable: 'Não consegui falar com o GitHub agora. Confira a internet.'
      },
      ai: {
        title: 'Assistente IA',
        notConfigured: 'Nenhum provedor configurado. O app funciona sem a IA.',
        configured: (provider: string, model: string) => `${provider} · ${model}. Teste para ver se o provedor responde.`,
        ok: (provider: string, model: string) => `${provider} · ${model} respondeu.`,
        failed: (detail: string) => `O provedor não respondeu: ${detail}`
      }
    }
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
    securityHint: 'Sensitive files in commits',
    identity: 'Identity',
    identityHint: 'Name and e-mail on commits',
    aiRules: 'AI actions',
    aiRulesHint: 'Rules and log',
    diagnostics: 'Diagnostics',
    diagnosticsHint: 'Git, GitHub and AI'
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
    autoPushHint: 'After committing, pushes the changes to the remote right away, without clicking "Push origin" separately.',
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
  identity: {
    globalHeading: 'Global identity',
    globalHint: 'Used by repositories with no profile and no setting of their own. Stored in your ~/.gitconfig.',
    name: 'Name',
    email: 'E-mail',
    namePlaceholder: 'How you appear on commits',
    emailPlaceholder: 'you@example.com',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    repoHeading: 'This repository',
    commitsAs: 'Commits are made as',
    notConfigured: 'No name or e-mail: Git will refuse the commit.',
    sourceLocal: 'Repository setting',
    sourceProfile: (name) => `${name} profile`,
    sourceGlobal: 'Global identity',
    sourceOther: 'System setting',
    remoteOwner: (owner) => `Remote owned by ${owner}`,
    mismatch: (account, email) => `This repository belongs to ${account}, but that account’s profile uses ${email}.`,
    applyProfileHere: (account) => `Use the ${account} profile here`,
    profilesHeading: 'Profiles per account',
    profilesHint:
      'Each profile holds an account’s name and e-mail. With a folder, every repository inside it uses the profile on its own (Git includeIf). With the account, the app warns when one of its repositories is about to commit with another e-mail.',
    noProfiles: 'No profiles yet. Create one for each account you commit with.',
    addProfile: 'Add profile',
    editProfile: 'Edit',
    removeProfile: 'Remove',
    account: 'Account',
    accountPlaceholder: 'Remote owner, as shown on GitHub',
    folder: 'Folder',
    noFolder: 'No folder',
    chooseFolder: 'Choose folder…',
    clearFolder: 'Remove folder',
    cancel: 'Cancel',
    saveProfile: 'Save profile',
    githubSuggestions: 'From your GitHub account',
    noreply: 'private',
    noreplyHint: 'GitHub links the commit to your account without showing your e-mail.',
    invalidEmail: 'Invalid e-mail.',
    invalidName: 'Enter a name.',
    needsAccountOrFolder: 'Enter the account, the folder or both.',
    folderSuggested: 'Suggested by organize by account',
    applyNote: 'When saving, the app only touches the includeIf lines it created itself in your ~/.gitconfig.',
    profileCount: (n) => (n === 1 ? '1 profile' : `${n} profiles`),
    saveError: (detail) => `Could not save: ${detail}`
  },
  aiRules: {
    protectedHeading: 'Protected branches',
    protectedHint:
      'The assistant cannot commit, push, merge into or rewrite commits on these branches, even with your approval: it has to create another branch first. End with * for a prefix, such as release/*.',
    branchPlaceholder: 'Branch name',
    add: 'Add',
    remove: (branch) => `Remove ${branch}`,
    suggestions: 'Suggestions',
    noneProtected: 'No protected branches.',
    confirmHeading: 'Approval',
    confirmDanger: 'Confirm irreversible actions with two clicks',
    confirmDangerHint: 'Push, merge, deleting branches and the other actions marked irreversible need a second click on the approval card.',
    logHeading: 'Action log',
    logHint: 'What the assistant proposed to change and what you decided. Stays on this computer.',
    onlyThisRepo: 'This repository only',
    clear: 'Clear log',
    clearConfirm: 'Click again to delete',
    empty: 'No actions logged yet. When the assistant proposes a change, it shows up here.',
    emptyFiltered: 'No actions logged for this repository.',
    completed: 'Approved and done',
    failed: 'Approved, but failed',
    rejected: 'Rejected',
    blocked: 'Blocked by a rule',
    irreversible: 'irreversible',
    loadError: 'Could not read the log.'
  },
  diagnostics: {
    hint: 'Checks Git, your configuration and the integrations. Nothing changes until you click Fix.',
    rerun: 'Check again',
    running: 'Checking…',
    allGood: 'All good',
    issues: (n) => (n === 1 ? '1 thing to look at' : `${n} things to look at`),
    checkedAt: (when) => `Checked ${when}`,
    fix: 'Fix',
    fixing: 'Fixing…',
    willRun: 'Will run',
    openIdentity: 'Open Identity',
    openAccount: 'Sign in to GitHub',
    openAi: 'Set up the AI',
    testAi: 'Test connection',
    testingAi: 'Testing…',
    failed: (detail) => `Could not run the checks: ${detail}`,
    statusLabel: { ok: 'OK', warn: 'Attention', error: 'Problem', info: 'Info' },
    checks: {
      git: {
        title: 'Git',
        ok: 'Installed and recent.',
        outdated: 'Old version. Update to 2.36 or newer: some screens rely on it.',
        notFound: 'Git was not found on the PATH. Install it and reopen the app.'
      },
      identity: {
        title: 'Name and e-mail on commits',
        ok: 'Set in the global identity.',
        missingName: 'The global identity has no name.',
        missingEmail: 'The global identity has no e-mail.',
        missingBoth: 'No global name or e-mail: repositories without a profile cannot commit.'
      },
      safeDirectory: {
        title: 'Repository folder permission',
        ok: 'Git agrees to work in this folder.',
        dubiousOwnership: 'The folder belongs to another system user, and Git refuses to use it until it is marked as trusted.'
      },
      longPaths: {
        title: 'Long paths',
        ok: 'On: files with paths over 260 characters work.',
        disabled: 'Off: on Windows, files with paths over 260 characters fail to clone and check out.'
      },
      lfs: {
        title: 'Git LFS',
        ok: 'Installed.',
        usedButMissing: 'This repository uses Git LFS, but it is not installed: large files stay as pointers.',
        notInstalled: 'Not installed. Only needed for repositories that store large files with LFS.'
      },
      ssh: {
        title: 'SSH client',
        ok: 'Installed. This repository’s remote uses SSH.',
        notFound: 'This repository’s remote uses SSH, but the ssh command was not found.'
      },
      credentialHelper: {
        title: 'Credential manager',
        ok: 'Set up for remotes outside GitHub.',
        notConfigured: 'Not set up. For GitHub the app uses its own sign-in; other servers will ask for a username and password.'
      },
      github: {
        title: 'GitHub account',
        ok: 'Connected.',
        notSignedIn: 'Not connected. Pull requests, collaborators and messages need the sign-in.',
        tokenInvalid: 'GitHub rejected the saved sign-in. Sign in again.',
        missingRepoScope: 'The sign-in lacks the repo permission: private repositories will not show up.',
        unreachable: 'Could not reach GitHub right now. Check your connection.'
      },
      ai: {
        title: 'AI assistant',
        notConfigured: 'No provider set up. The app works without the AI.',
        configured: (provider, model) => `${provider} · ${model}. Test it to see if the provider answers.`,
        ok: (provider, model) => `${provider} · ${model} answered.`,
        failed: (detail) => `The provider did not answer: ${detail}`
      }
    }
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
    securityHint: 'Archivos sensibles en el commit',
    identity: 'Identidad',
    identityHint: 'Nombre y correo de los commits',
    aiRules: 'Acciones de la IA',
    aiRulesHint: 'Reglas y registro',
    diagnostics: 'Diagnóstico',
    diagnosticsHint: 'Git, GitHub e IA'
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
    autoPushHint: 'Al hacer commit, envía los cambios al remoto a continuación, sin tener que pulsar "Enviar origin" por separado.',
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
    lead: 'Cada repositorio va a la carpeta de la cuenta dueña del remoto origin. El nombre de su carpeta no cambia.',
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
      noRemote: 'Sin remoto origin',
      unknownOwner: 'No se pudo identificar la cuenta por el remoto',
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
  identity: {
    globalHeading: 'Identidad global',
    globalHint: 'Vale para los repositorios sin perfil ni configuración propia. Se guarda en tu ~/.gitconfig.',
    name: 'Nombre',
    email: 'Correo',
    namePlaceholder: 'Cómo apareces en los commits',
    emailPlaceholder: 'tu@ejemplo.com',
    save: 'Guardar',
    saving: 'Guardando…',
    saved: 'Guardado',
    repoHeading: 'Este repositorio',
    commitsAs: 'Los commits se hacen como',
    notConfigured: 'Sin nombre o correo: Git va a rechazar el commit.',
    sourceLocal: 'Configuración del repositorio',
    sourceProfile: (name) => `Perfil de ${name}`,
    sourceGlobal: 'Identidad global',
    sourceOther: 'Configuración del sistema',
    remoteOwner: (owner) => `Remoto de ${owner}`,
    mismatch: (account, email) => `Este repositorio es de ${account}, pero el perfil de esa cuenta usa ${email}.`,
    applyProfileHere: (account) => `Usar el perfil de ${account} aquí`,
    profilesHeading: 'Perfiles por cuenta',
    profilesHint:
      'Cada perfil guarda el nombre y el correo de una cuenta. Con una carpeta, todo repositorio dentro de ella usa el perfil solo (includeIf de Git). Con la cuenta, la app avisa cuando un repositorio de ella va a hacer commit con otro correo.',
    noProfiles: 'Todavía no hay perfiles. Crea uno para cada cuenta con la que haces commits.',
    addProfile: 'Añadir perfil',
    editProfile: 'Editar',
    removeProfile: 'Quitar',
    account: 'Cuenta',
    accountPlaceholder: 'Dueño del remoto, como aparece en GitHub',
    folder: 'Carpeta',
    noFolder: 'Sin carpeta',
    chooseFolder: 'Elegir carpeta…',
    clearFolder: 'Quitar la carpeta',
    cancel: 'Cancelar',
    saveProfile: 'Guardar perfil',
    githubSuggestions: 'De tu cuenta de GitHub',
    noreply: 'privado',
    noreplyHint: 'GitHub vincula el commit a tu cuenta sin mostrar tu correo.',
    invalidEmail: 'Correo no válido.',
    invalidName: 'Escribe un nombre.',
    needsAccountOrFolder: 'Indica la cuenta, la carpeta o las dos.',
    folderSuggested: 'Sugerida por la organización por cuenta',
    applyNote: 'Al guardar, la app solo toca las líneas includeIf que ella misma creó en tu ~/.gitconfig.',
    profileCount: (n) => (n === 1 ? '1 perfil' : `${n} perfiles`),
    saveError: (detail) => `No pude guardar: ${detail}`
  },
  aiRules: {
    protectedHeading: 'Ramas protegidas',
    protectedHint:
      'El asistente no puede hacer commit, push, merge ni reescribir commits en estas ramas, ni siquiera con tu aprobación: tiene que crear otra rama antes. Termina con * para un prefijo, como release/*.',
    branchPlaceholder: 'Nombre de la rama',
    add: 'Añadir',
    remove: (branch) => `Quitar ${branch}`,
    suggestions: 'Sugerencias',
    noneProtected: 'Ninguna rama protegida.',
    confirmHeading: 'Aprobación',
    confirmDanger: 'Confirmar acciones irreversibles con dos clics',
    confirmDangerHint: 'Push, merge, borrar ramas y las demás acciones marcadas como irreversibles piden un segundo clic en la tarjeta de aprobación.',
    logHeading: 'Registro de acciones',
    logHint: 'Lo que el asistente propuso cambiar y lo que decidiste. Se queda solo en este equipo.',
    onlyThisRepo: 'Solo este repositorio',
    clear: 'Vaciar registro',
    clearConfirm: 'Haz clic de nuevo para borrar',
    empty: 'Todavía no hay acciones registradas. Cuando el asistente proponga un cambio, aparecerá aquí.',
    emptyFiltered: 'No hay acciones registradas en este repositorio.',
    completed: 'Aprobada y completada',
    failed: 'Aprobada, pero falló',
    rejected: 'Rechazada',
    blocked: 'Bloqueada por una regla',
    irreversible: 'irreversible',
    loadError: 'No pude leer el registro.'
  },
  diagnostics: {
    hint: 'Revisa Git, tu configuración y las integraciones. Nada cambia hasta que hagas clic en Corregir.',
    rerun: 'Revisar de nuevo',
    running: 'Revisando…',
    allGood: 'Todo bien',
    issues: (n) => (n === 1 ? '1 punto para revisar' : `${n} puntos para revisar`),
    checkedAt: (when) => `Revisado ${when}`,
    fix: 'Corregir',
    fixing: 'Corrigiendo…',
    willRun: 'Va a ejecutar',
    openIdentity: 'Abrir Identidad',
    openAccount: 'Iniciar sesión en GitHub',
    openAi: 'Configurar la IA',
    testAi: 'Probar conexión',
    testingAi: 'Probando…',
    failed: (detail) => `No pude revisar: ${detail}`,
    statusLabel: { ok: 'OK', warn: 'Atención', error: 'Problema', info: 'Información' },
    checks: {
      git: {
        title: 'Git',
        ok: 'Instalado y en una versión reciente.',
        outdated: 'Versión antigua. Actualiza a la 2.36 o más nueva: algunas pantallas la necesitan.',
        notFound: 'No encontré Git en el PATH. Instálalo y vuelve a abrir la app.'
      },
      identity: {
        title: 'Nombre y correo de los commits',
        ok: 'Configurados en la identidad global.',
        missingName: 'Falta el nombre en la identidad global.',
        missingEmail: 'Falta el correo en la identidad global.',
        missingBoth: 'Sin nombre ni correo globales: los repositorios sin perfil no pueden hacer commit.'
      },
      safeDirectory: {
        title: 'Permiso de la carpeta del repositorio',
        ok: 'Git acepta trabajar en esta carpeta.',
        dubiousOwnership: 'La carpeta pertenece a otro usuario del sistema y Git se niega a usarla hasta que se marque como confiable.'
      },
      longPaths: {
        title: 'Rutas largas',
        ok: 'Activado: los archivos con rutas de más de 260 caracteres funcionan.',
        disabled: 'Desactivado: en Windows, los archivos con rutas de más de 260 caracteres fallan al clonar y en el checkout.'
      },
      lfs: {
        title: 'Git LFS',
        ok: 'Instalado.',
        usedButMissing: 'Este repositorio usa Git LFS, pero no está instalado: los archivos grandes quedan solo como punteros.',
        notInstalled: 'No instalado. Solo hace falta en repositorios que guardan archivos grandes con LFS.'
      },
      ssh: {
        title: 'Cliente SSH',
        ok: 'Instalado. El remoto de este repositorio usa SSH.',
        notFound: 'El remoto de este repositorio usa SSH, pero no encontré el comando ssh.'
      },
      credentialHelper: {
        title: 'Administrador de credenciales',
        ok: 'Configurado para los remotos fuera de GitHub.',
        notConfigured: 'No configurado. En GitHub la app usa su propio inicio de sesión; otros servidores van a pedir usuario y contraseña.'
      },
      github: {
        title: 'Cuenta de GitHub',
        ok: 'Conectada.',
        notSignedIn: 'No conectada. Las pull requests, los colaboradores y los mensajes necesitan el inicio de sesión.',
        tokenInvalid: 'GitHub rechazó el inicio de sesión guardado. Vuelve a iniciar sesión.',
        missingRepoScope: 'El inicio de sesión no tiene el permiso repo: los repositorios privados no van a aparecer.',
        unreachable: 'No pude hablar con GitHub ahora. Revisa la conexión.'
      },
      ai: {
        title: 'Asistente IA',
        notConfigured: 'Ningún proveedor configurado. La app funciona sin la IA.',
        configured: (provider, model) => `${provider} · ${model}. Pruébalo para ver si el proveedor responde.`,
        ok: (provider, model) => `${provider} · ${model} respondió.`,
        failed: (detail) => `El proveedor no respondió: ${detail}`
      }
    }
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
