// "Publicar no GitHub": the dialog, the top-bar entry and the AI tool.

const ptBR = {
  topBarLabel: 'Publicar no GitHub',
  topBarHint: 'Cria o repositório e envia',
  title: 'Publicar no GitHub',
  lead: (branch: string) => `Cria o repositório no GitHub, liga-o como origin e envia a branch ${branch}.`,
  name: 'Nome',
  nameHint: 'Letras, números, ".", "-" e "_". Espaços viram "-".',
  description: 'Descrição (opcional)',
  owner: 'Dono',
  ownerYou: (login: string) => `${login} (você)`,
  visibility: 'Visibilidade',
  private: 'Privado',
  privateHint: 'Só você e quem você convidar veem.',
  public: 'Público',
  publicHint: 'Qualquer pessoa na internet vê.',
  publish: 'Publicar',
  publishing: 'Publicando…',
  signInLead: 'Entre com o GitHub para criar o repositório na sua conta.',
  signIn: 'Entrar com GitHub',
  checking: 'Verificando o histórico…',
  historyBlocked:
    'O histórico local tem arquivos sensíveis, e publicar envia todos os commits, inclusive esses. Desfaça os commits que os trazem antes de publicar.',
  historyWarn: 'O histórico local tem possíveis arquivos sensíveis. Publicar envia todos os commits, inclusive esses.',
  acknowledge: 'Entendo, publicar mesmo assim',
  doneTitle: 'Publicado no GitHub',
  doneLead: (fullName: string, branch: string) => `${fullName} foi criado e a branch ${branch} foi enviada.`,
  open: 'Abrir no GitHub',
  close: 'Fechar',
  aiHeadline: (fullName: string) => `Publicar ${fullName} no GitHub`,
  aiBranch: 'Branch enviada',
  aiNotSignedIn: 'Não há login do GitHub no app. Peça ao usuário para entrar com o GitHub (Configurações › Geral) e tente de novo.',
  aiHistoryWarn: (list: string) => `Possíveis arquivos sensíveis no histórico, que será enviado inteiro: ${list}. Revise antes de aprovar.`,
  aiHistoryBlocked: (list: string) =>
    `Publicação bloqueada pela verificação de segurança: o histórico local tem ${list}. Publicar enviaria esses commits. Explique ao usuário que é preciso desfazer os commits que trazem esses arquivos antes de publicar. Nunca repita o valor de um segredo.`,
  aiPublished: (fullName: string, url: string, branch: string) =>
    `Repositório ${fullName} criado no GitHub (${url}), ligado como origin, e a branch ${branch} foi enviada com upstream.`
}

type M = typeof ptBR

const en: M = {
  topBarLabel: 'Publish to GitHub',
  topBarHint: 'Creates the repository and pushes',
  title: 'Publish to GitHub',
  lead: (branch) => `Creates the repository on GitHub, sets it as origin and pushes the ${branch} branch.`,
  name: 'Name',
  nameHint: 'Letters, digits, ".", "-" and "_". Spaces become "-".',
  description: 'Description (optional)',
  owner: 'Owner',
  ownerYou: (login) => `${login} (you)`,
  visibility: 'Visibility',
  private: 'Private',
  privateHint: 'Only you and the people you invite can see it.',
  public: 'Public',
  publicHint: 'Anyone on the internet can see it.',
  publish: 'Publish',
  publishing: 'Publishing…',
  signInLead: 'Sign in with GitHub to create the repository in your account.',
  signIn: 'Sign in with GitHub',
  checking: 'Checking the history…',
  historyBlocked:
    'The local history has sensitive files, and publishing pushes every commit, including those. Undo the commits that carry them before publishing.',
  historyWarn: 'The local history has possible sensitive files. Publishing pushes every commit, including those.',
  acknowledge: 'I understand, publish anyway',
  doneTitle: 'Published to GitHub',
  doneLead: (fullName, branch) => `${fullName} was created and the ${branch} branch was pushed.`,
  open: 'Open on GitHub',
  close: 'Close',
  aiHeadline: (fullName) => `Publish ${fullName} to GitHub`,
  aiBranch: 'Branch pushed',
  aiNotSignedIn: 'There is no GitHub sign-in in the app. Ask the user to sign in with GitHub (Settings › General) and try again.',
  aiHistoryWarn: (list) => `Possible sensitive files in the history, which is pushed in full: ${list}. Review before approving.`,
  aiHistoryBlocked: (list) =>
    `Publishing blocked by the security check: the local history has ${list}. Publishing would push those commits. Explain to the user that the commits carrying those files must be undone before publishing. Never repeat a secret's value.`,
  aiPublished: (fullName, url, branch) =>
    `Repository ${fullName} created on GitHub (${url}), set as origin, and the ${branch} branch was pushed with upstream.`
}

const es: M = {
  topBarLabel: 'Publicar en GitHub',
  topBarHint: 'Crea el repositorio y envía',
  title: 'Publicar en GitHub',
  lead: (branch) => `Crea el repositorio en GitHub, lo deja como origin y envía la rama ${branch}.`,
  name: 'Nombre',
  nameHint: 'Letras, números, ".", "-" y "_". Los espacios pasan a "-".',
  description: 'Descripción (opcional)',
  owner: 'Propietario',
  ownerYou: (login) => `${login} (tú)`,
  visibility: 'Visibilidad',
  private: 'Privado',
  privateHint: 'Solo tú y quien invites pueden verlo.',
  public: 'Público',
  publicHint: 'Cualquier persona en internet puede verlo.',
  publish: 'Publicar',
  publishing: 'Publicando…',
  signInLead: 'Inicia sesión con GitHub para crear el repositorio en tu cuenta.',
  signIn: 'Iniciar sesión con GitHub',
  checking: 'Verificando el historial…',
  historyBlocked:
    'El historial local tiene archivos sensibles, y publicar envía todos los commits, incluidos esos. Deshaz los commits que los traen antes de publicar.',
  historyWarn: 'El historial local tiene posibles archivos sensibles. Publicar envía todos los commits, incluidos esos.',
  acknowledge: 'Entiendo, publicar igualmente',
  doneTitle: 'Publicado en GitHub',
  doneLead: (fullName, branch) => `${fullName} se creó y se envió la rama ${branch}.`,
  open: 'Abrir en GitHub',
  close: 'Cerrar',
  aiHeadline: (fullName) => `Publicar ${fullName} en GitHub`,
  aiBranch: 'Rama enviada',
  aiNotSignedIn: 'No hay sesión de GitHub en la app. Pide al usuario que inicie sesión con GitHub (Configuración › General) y vuelve a intentarlo.',
  aiHistoryWarn: (list) => `Posibles archivos sensibles en el historial, que se envía completo: ${list}. Revisa antes de aprobar.`,
  aiHistoryBlocked: (list) =>
    `Publicación bloqueada por la verificación de seguridad: el historial local tiene ${list}. Publicar enviaría esos commits. Explica al usuario que hay que deshacer los commits que traen esos archivos antes de publicar. Nunca repitas el valor de un secreto.`,
  aiPublished: (fullName, url, branch) =>
    `Repositorio ${fullName} creado en GitHub (${url}), configurado como origin, y la rama ${branch} se envió con upstream.`
}

export default { 'pt-BR': ptBR, en, es }
