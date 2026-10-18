// Messages the main process produces and the renderer shows verbatim (errors
// thrown across IPC, update and repo-update statuses). Raw git stderr is never
// translated — only the text the app writes itself.

const ptBR = {
  git: {
    cloneUrlStartsWithDash: 'URL inválida: uma URL de repositório não pode começar com "-".',
    cloneUrlNotAllowed:
      'URL inválida: use https://, ssh://, git@host:dono/repo ou um caminho local. Transportes como "ext::" não são aceitos.',
    optionLabel: {
      baseBranch: 'Branch base',
      sourceBranch: 'Branch de origem',
      remoteBranch: 'Branch remota',
      branchName: 'Nome de branch',
      remoteName: 'Nome de remote',
      newBranchName: 'Novo nome de branch'
    },
    optionLikeValue: (label: string) => `${label} inválido: não pode começar com "-".`,
    labels: {
      commitRef: 'Referência de commit',
      stashRef: 'Referência de stash',
      ref: 'Referência',
      defaultBranch: 'Branch padrão',
      branchName: 'Nome de branch'
    },
    undoParentUnavailable:
      'Não foi possível desfazer o commit: o commit anterior não está disponível neste repositório (clone raso ou histórico truncado).',
    noRemote: 'Repositório sem remote configurado.',
    fetchFailed: 'Falha ao buscar do remote.',
    noDefaultBranchDetected: 'Não foi possível determinar o branch padrão do remote.',
    behindDefault: (count: number, branch: string) => `${count} commit(s) atrás de origin/${branch}.`,
    noLocalDefaultToAdvance: (branch: string) =>
      ` Não existe um branch "${branch}" local para avançar — abra o repositório e faça checkout dele, ou um pull no branch atual.`,
    localDefaultDivergedDetail: (branch: string, ahead: number, behind: number) =>
      `"${branch}" local divergiu: ${ahead} commit(s) só seu(s), ${behind} no remote.`,
    upToDateWith: (branch: string) => `Em dia com origin/${branch}.`,
    noDefaultBranch: 'Sem branch padrão no remote.',
    noLocalBranch: (branch: string) => `Não existe um branch "${branch}" local.`,
    compareFailed: (branch: string) => `Não foi possível comparar com origin/${branch}.`,
    alreadyUpToDate: (branch: string) => `"${branch}" já está em dia.`,
    localDefaultDiverged: (branch: string, ahead: number) => `"${branch}" local divergiu (${ahead} commit(s) só seu(s)).`,
    uncommittedChanges: (count: number) => `${count} alteração(ões) local(is) não commitada(s).`,
    pullFfOnlyFailed: 'git pull --ff-only falhou.',
    commitsPulled: (count: number, branch: string) => `${count} commit(s) baixado(s) em "${branch}".`,
    advanceFailed: (branch: string) => `Falha ao avançar "${branch}".`,
    detachedHead: 'HEAD desanexado',
    advancedWhileOnOther: (branch: string, count: number, current: string) =>
      `"${branch}" avançou ${count} commit(s); você continua em "${current}".`,
    divergedMergeFailed: 'O branch local divergiu do remoto e o merge falhou. Resolva os conflitos e tente de novo.',
    divergedRebaseFailed: 'O branch local divergiu do remoto e o rebase falhou. Resolva os conflitos e tente de novo.',
    historyRewritten:
      'Você reescreveu commits que já estavam no remoto (desfazer ou alterar o último commit). Para publicar, é preciso forçar o push — ele substitui no remoto os commits que você reescreveu.',
    noCommitsYet: 'Este repositório ainda não tem commits.',
    lastCommitChanged: 'O último commit mudou desde a aprovação. Peça de novo para ver o commit atual.',
    mergeInProgress: 'Há um merge em andamento. Conclua ou aborte o merge antes de desfazer um commit.',
    lastCommitPublished:
      'O último commit já foi enviado para o remoto. Desfazê-lo exigiria force push, que é um passo manual — não faço isso pelo chat.',
    agentReadGitDir: (path: string) =>
      `"${path}" está dentro de .git/ e não pode ser lido pela IA — o diretório do git guarda credenciais e estado interno.`,
    agentReadIgnored: (path: string) =>
      `"${path}" está no .gitignore e não pode ser lido pela IA — arquivos ignorados costumam guardar segredos.`,
    agentReadBinary: (path: string) => `"${path}" parece ser um arquivo binário e não pode ser lido como texto.`,
    gitignorePatternExists: 'O padrão já existe no .gitignore.',
    gitignoreAdded: (patterns: string) => `Adicionado ao .gitignore: ${patterns}`,
    stopTrackingFailed: 'Falha ao parar o tracking dos arquivos.'
  },
  shell: {
    fileNotFound: (path: string) => `Arquivo não encontrado: ${path}`
  },
  network: {
    cancelled: 'Requisição cancelada.',
    where: (origin: string) => ` em ${origin}`,
    localHint:
      ' A porta pode estar aberta e o processo de IA mesmo assim não responder HTTP — reinicie o servidor local e confira a URL nas configurações.',
    remoteHint: ' Verifique a internet, um proxy ou um antivírus que inspecione HTTPS.',
    connectionReset: (where: string, hint: string) => `A conexão${where} foi encerrada (conexão resetada).${hint}`,
    dnsFailed: (where: string) => `Não foi possível resolver o endereço${where}. Verifique a internet e o DNS.`,
    timedOut: (where: string) => `A conexão${where} esgotou o tempo. Tente de novo.`,
    refused: (where: string) =>
      `O servidor${where} recusou a conexão. Confira se o serviço está no ar e a URL nas configurações.`,
    certificate: (where: string) =>
      `Falha na verificação do certificado HTTPS${where}. Um proxy ou antivírus pode estar interceptando a conexão.`,
    failedWithCause: (where: string, cause: string, hint: string) => `Falha de rede${where} (${cause}).${hint}`,
    failed: (where: string, hint: string) => `Falha de rede${where}.${hint}`,
    requestTimedOut: (origin: string, seconds: number) =>
      `A requisição para ${origin} excedeu o tempo limite de ${seconds}s.`
  },
  ai: {
    localBaseUrlRequired: 'Configure a URL base para o provedor local nas configurações de IA.',
    listModelsFailed: (status: number) => `Não foi possível listar modelos (HTTP ${status}).`
  },
  github: {
    notAuthenticated: (host: string) => `Você não está autenticado em ${host}. Entre com o GitHub e tente de novo.`,
    requestRejected: (status: number) => `GitHub recusou a solicitação (${status}).`,
    tokenRequired: 'Informe um token.',
    deviceFlowGithubOnly:
      'OAuth Device Flow só é suportado em github.com. Para GitHub Enterprise, use um Personal Access Token.',
    deviceFlowStartFailed: (status: number) => `GitHub respondeu ${status} ao iniciar o login por OAuth.`,
    deviceFlowPollFailed: (status: number, detail: string) =>
      `GitHub respondeu ${status} ao consultar o token${detail ? `: ${detail}` : ''}.`,
    loginExpired: 'Login expirado. Comece de novo.',
    unknownError: 'Erro desconhecido do GitHub.'
  },
  updater: {
    privateReleasesUnavailable: (repo: string) =>
      `Não foi possível acessar as releases do repositório privado. Confirme que você está logado no GitHub no OpenGitDesktop com uma conta que tenha acesso a ${repo}, e tente de novo.`,
    privateFeedLoginRequired:
      'O repositório de releases é privado. Entre no GitHub pelo OpenGitDesktop (botão na barra superior ou na tela inicial) e tente de novo.',
    onlyInstalled: 'Atualizações automáticas só funcionam na versão instalada.',
    checkFailed: 'Não foi possível consultar atualizações.'
  }
}

export type MainMessages = typeof ptBR

const en: MainMessages = {
  git: {
    cloneUrlStartsWithDash: 'Invalid URL: a repository URL cannot start with "-".',
    cloneUrlNotAllowed:
      'Invalid URL: use https://, ssh://, git@host:owner/repo or a local path. Transports such as "ext::" are not accepted.',
    optionLabel: {
      baseBranch: 'Base branch',
      sourceBranch: 'Source branch',
      remoteBranch: 'Remote branch',
      branchName: 'Branch name',
      remoteName: 'Remote name',
      newBranchName: 'New branch name'
    },
    optionLikeValue: (label) => `Invalid ${label.toLowerCase()}: it cannot start with "-".`,
    labels: {
      commitRef: 'Commit reference',
      stashRef: 'Stash reference',
      ref: 'Reference',
      defaultBranch: 'Default branch',
      branchName: 'Branch name'
    },
    undoParentUnavailable:
      'Could not undo the commit: the previous commit is not available in this repository (shallow clone or truncated history).',
    noRemote: 'Repository has no remote configured.',
    fetchFailed: 'Failed to fetch from the remote.',
    noDefaultBranchDetected: "Could not determine the remote's default branch.",
    behindDefault: (count, branch) => `${count} commit(s) behind origin/${branch}.`,
    noLocalDefaultToAdvance: (branch) =>
      ` There is no local "${branch}" branch to advance — open the repository and check it out, or pull on the current branch.`,
    localDefaultDivergedDetail: (branch, ahead, behind) =>
      `Local "${branch}" has diverged: ${ahead} commit(s) only yours, ${behind} on the remote.`,
    upToDateWith: (branch) => `Up to date with origin/${branch}.`,
    noDefaultBranch: 'No default branch on the remote.',
    noLocalBranch: (branch) => `There is no local "${branch}" branch.`,
    compareFailed: (branch) => `Could not compare with origin/${branch}.`,
    alreadyUpToDate: (branch) => `"${branch}" is already up to date.`,
    localDefaultDiverged: (branch, ahead) => `Local "${branch}" has diverged (${ahead} commit(s) only yours).`,
    uncommittedChanges: (count) => `${count} uncommitted local change(s).`,
    pullFfOnlyFailed: 'git pull --ff-only failed.',
    commitsPulled: (count, branch) => `${count} commit(s) pulled into "${branch}".`,
    advanceFailed: (branch) => `Failed to advance "${branch}".`,
    detachedHead: 'detached HEAD',
    advancedWhileOnOther: (branch, count, current) =>
      `"${branch}" advanced ${count} commit(s); you are still on "${current}".`,
    divergedMergeFailed: 'The local branch diverged from the remote and the merge failed. Resolve the conflicts and try again.',
    divergedRebaseFailed:
      'The local branch diverged from the remote and the rebase failed. Resolve the conflicts and try again.',
    historyRewritten:
      'You rewrote commits that were already on the remote (undo or amend the last commit). To publish, you need to force push — it replaces the commits you rewrote on the remote.',
    noCommitsYet: 'This repository has no commits yet.',
    lastCommitChanged: 'The last commit changed since it was approved. Ask again to see the current commit.',
    mergeInProgress: 'A merge is in progress. Finish or abort the merge before undoing a commit.',
    lastCommitPublished:
      'The last commit was already pushed to the remote. Undoing it would require a force push, which is a manual step — I do not do that from the chat.',
    agentReadGitDir: (path) =>
      `"${path}" is inside .git/ and cannot be read by the AI — the git directory holds credentials and internal state.`,
    agentReadIgnored: (path) =>
      `"${path}" is in .gitignore and cannot be read by the AI — ignored files often hold secrets.`,
    agentReadBinary: (path) => `"${path}" looks like a binary file and cannot be read as text.`,
    gitignorePatternExists: 'The pattern already exists in .gitignore.',
    gitignoreAdded: (patterns) => `Added to .gitignore: ${patterns}`,
    stopTrackingFailed: 'Failed to stop tracking the files.'
  },
  shell: {
    fileNotFound: (path) => `File not found: ${path}`
  },
  network: {
    cancelled: 'Request cancelled.',
    where: (origin) => ` at ${origin}`,
    localHint:
      ' The port may be open and the AI process still not answer HTTP — restart the local server and check the URL in the settings.',
    remoteHint: ' Check your internet connection, a proxy, or an antivirus that inspects HTTPS.',
    connectionReset: (where, hint) => `The connection${where} was closed (connection reset).${hint}`,
    dnsFailed: (where) => `Could not resolve the address${where}. Check your internet connection and DNS.`,
    timedOut: (where) => `The connection${where} timed out. Try again.`,
    refused: (where) =>
      `The server${where} refused the connection. Check that the service is running and the URL in the settings.`,
    certificate: (where) =>
      `HTTPS certificate verification failed${where}. A proxy or antivirus may be intercepting the connection.`,
    failedWithCause: (where, cause, hint) => `Network failure${where} (${cause}).${hint}`,
    failed: (where, hint) => `Network failure${where}.${hint}`,
    requestTimedOut: (origin, seconds) => `The request to ${origin} exceeded the ${seconds}s time limit.`
  },
  ai: {
    localBaseUrlRequired: 'Set the base URL for the local provider in the AI settings.',
    listModelsFailed: (status) => `Could not list models (HTTP ${status}).`
  },
  github: {
    notAuthenticated: (host) => `You are not signed in to ${host}. Sign in with GitHub and try again.`,
    requestRejected: (status) => `GitHub rejected the request (${status}).`,
    tokenRequired: 'Enter a token.',
    deviceFlowGithubOnly:
      'OAuth Device Flow is only supported on github.com. For GitHub Enterprise, use a Personal Access Token.',
    deviceFlowStartFailed: (status) => `GitHub responded ${status} when starting the OAuth sign-in.`,
    deviceFlowPollFailed: (status, detail) =>
      `GitHub responded ${status} when checking the token${detail ? `: ${detail}` : ''}.`,
    loginExpired: 'Sign-in expired. Start again.',
    unknownError: 'Unknown GitHub error.'
  },
  updater: {
    privateReleasesUnavailable: (repo) =>
      `Could not access the private repository's releases. Make sure you are signed in to GitHub in OpenGitDesktop with an account that has access to ${repo}, and try again.`,
    privateFeedLoginRequired:
      'The releases repository is private. Sign in to GitHub in OpenGitDesktop (button in the top bar or on the start screen) and try again.',
    onlyInstalled: 'Automatic updates only work in the installed version.',
    checkFailed: 'Could not check for updates.'
  }
}

const es: MainMessages = {
  git: {
    cloneUrlStartsWithDash: 'URL no válida: una URL de repositorio no puede empezar con "-".',
    cloneUrlNotAllowed:
      'URL no válida: usa https://, ssh://, git@host:dueño/repo o una ruta local. No se aceptan transportes como "ext::".',
    optionLabel: {
      baseBranch: 'Rama base',
      sourceBranch: 'Rama de origen',
      remoteBranch: 'Rama remota',
      branchName: 'Nombre de rama',
      remoteName: 'Nombre de remote',
      newBranchName: 'Nuevo nombre de rama'
    },
    optionLikeValue: (label) => `${label} no válido: no puede empezar con "-".`,
    labels: {
      commitRef: 'Referencia de commit',
      stashRef: 'Referencia de stash',
      ref: 'Referencia',
      defaultBranch: 'Rama predeterminada',
      branchName: 'Nombre de rama'
    },
    undoParentUnavailable:
      'No se pudo deshacer el commit: el commit anterior no está disponible en este repositorio (clon superficial o historial truncado).',
    noRemote: 'El repositorio no tiene un remoto configurado.',
    fetchFailed: 'Error al obtener del remoto.',
    noDefaultBranchDetected: 'No se pudo determinar la rama predeterminada del remoto.',
    behindDefault: (count, branch) => `${count} commit(s) por detrás de origin/${branch}.`,
    noLocalDefaultToAdvance: (branch) =>
      ` No existe una rama "${branch}" local para avanzar — abre el repositorio y haz checkout de ella, o un pull en la rama actual.`,
    localDefaultDivergedDetail: (branch, ahead, behind) =>
      `"${branch}" local divergió: ${ahead} commit(s) solo tuyo(s), ${behind} en el remoto.`,
    upToDateWith: (branch) => `Al día con origin/${branch}.`,
    noDefaultBranch: 'No hay rama predeterminada en el remoto.',
    noLocalBranch: (branch) => `No existe una rama "${branch}" local.`,
    compareFailed: (branch) => `No se pudo comparar con origin/${branch}.`,
    alreadyUpToDate: (branch) => `"${branch}" ya está al día.`,
    localDefaultDiverged: (branch, ahead) => `"${branch}" local divergió (${ahead} commit(s) solo tuyo(s)).`,
    uncommittedChanges: (count) => `${count} cambio(s) local(es) sin commit.`,
    pullFfOnlyFailed: 'git pull --ff-only falló.',
    commitsPulled: (count, branch) => `${count} commit(s) descargado(s) en "${branch}".`,
    advanceFailed: (branch) => `Error al avanzar "${branch}".`,
    detachedHead: 'HEAD desacoplado',
    advancedWhileOnOther: (branch, count, current) =>
      `"${branch}" avanzó ${count} commit(s); sigues en "${current}".`,
    divergedMergeFailed:
      'La rama local divergió del remoto y el merge falló. Resuelve los conflictos e inténtalo de nuevo.',
    divergedRebaseFailed:
      'La rama local divergió del remoto y el rebase falló. Resuelve los conflictos e inténtalo de nuevo.',
    historyRewritten:
      'Reescribiste commits que ya estaban en el remoto (deshacer o modificar el último commit). Para publicar, hay que forzar el push — reemplaza en el remoto los commits que reescribiste.',
    noCommitsYet: 'Este repositorio todavía no tiene commits.',
    lastCommitChanged: 'El último commit cambió desde la aprobación. Pídelo de nuevo para ver el commit actual.',
    mergeInProgress: 'Hay un merge en curso. Termina o aborta el merge antes de deshacer un commit.',
    lastCommitPublished:
      'El último commit ya se envió al remoto. Deshacerlo exigiría un force push, que es un paso manual — no lo hago desde el chat.',
    agentReadGitDir: (path) =>
      `"${path}" está dentro de .git/ y la IA no puede leerlo — el directorio de git guarda credenciales y estado interno.`,
    agentReadIgnored: (path) =>
      `"${path}" está en .gitignore y la IA no puede leerlo — los archivos ignorados suelen guardar secretos.`,
    agentReadBinary: (path) => `"${path}" parece ser un archivo binario y no se puede leer como texto.`,
    gitignorePatternExists: 'El patrón ya existe en .gitignore.',
    gitignoreAdded: (patterns) => `Añadido a .gitignore: ${patterns}`,
    stopTrackingFailed: 'Error al dejar de rastrear los archivos.'
  },
  shell: {
    fileNotFound: (path) => `Archivo no encontrado: ${path}`
  },
  network: {
    cancelled: 'Solicitud cancelada.',
    where: (origin) => ` en ${origin}`,
    localHint:
      ' El puerto puede estar abierto y aun así el proceso de IA no responder HTTP — reinicia el servidor local y revisa la URL en la configuración.',
    remoteHint: ' Revisa la conexión a internet, un proxy o un antivirus que inspeccione HTTPS.',
    connectionReset: (where, hint) => `La conexión${where} se cerró (conexión restablecida).${hint}`,
    dnsFailed: (where) => `No se pudo resolver la dirección${where}. Revisa la conexión a internet y el DNS.`,
    timedOut: (where) => `La conexión${where} agotó el tiempo de espera. Inténtalo de nuevo.`,
    refused: (where) =>
      `El servidor${where} rechazó la conexión. Comprueba que el servicio esté activo y la URL en la configuración.`,
    certificate: (where) =>
      `Falló la verificación del certificado HTTPS${where}. Un proxy o antivirus puede estar interceptando la conexión.`,
    failedWithCause: (where, cause, hint) => `Fallo de red${where} (${cause}).${hint}`,
    failed: (where, hint) => `Fallo de red${where}.${hint}`,
    requestTimedOut: (origin, seconds) => `La solicitud a ${origin} superó el tiempo límite de ${seconds}s.`
  },
  ai: {
    localBaseUrlRequired: 'Configura la URL base del proveedor local en la configuración de IA.',
    listModelsFailed: (status) => `No se pudieron listar los modelos (HTTP ${status}).`
  },
  github: {
    notAuthenticated: (host) => `No has iniciado sesión en ${host}. Inicia sesión con GitHub e inténtalo de nuevo.`,
    requestRejected: (status) => `GitHub rechazó la solicitud (${status}).`,
    tokenRequired: 'Introduce un token.',
    deviceFlowGithubOnly:
      'OAuth Device Flow solo es compatible con github.com. Para GitHub Enterprise, usa un Personal Access Token.',
    deviceFlowStartFailed: (status) => `GitHub respondió ${status} al iniciar el inicio de sesión por OAuth.`,
    deviceFlowPollFailed: (status, detail) =>
      `GitHub respondió ${status} al consultar el token${detail ? `: ${detail}` : ''}.`,
    loginExpired: 'El inicio de sesión expiró. Empieza de nuevo.',
    unknownError: 'Error desconocido de GitHub.'
  },
  updater: {
    privateReleasesUnavailable: (repo) =>
      `No se pudo acceder a las releases del repositorio privado. Confirma que iniciaste sesión en GitHub en OpenGitDesktop con una cuenta que tenga acceso a ${repo}, e inténtalo de nuevo.`,
    privateFeedLoginRequired:
      'El repositorio de releases es privado. Inicia sesión en GitHub desde OpenGitDesktop (botón en la barra superior o en la pantalla inicial) e inténtalo de nuevo.',
    onlyInstalled: 'Las actualizaciones automáticas solo funcionan en la versión instalada.',
    checkFailed: 'No se pudieron consultar las actualizaciones.'
  }
}

export default { 'pt-BR': ptBR, en, es }
