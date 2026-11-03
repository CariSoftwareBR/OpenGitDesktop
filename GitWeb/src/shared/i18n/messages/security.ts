// Sensitive-file check: kind labels, the pre-commit dialog and the texts the
// AI commit tool shows or hands to the model.
import type { SensitiveKind } from '../../sensitiveFiles'

const ptBR = {
  kinds: {
    envFile: 'Arquivo de ambiente (.env)',
    privateKeyFile: 'Arquivo de chave privada',
    sshKey: 'Chave SSH privada',
    keystore: 'Repositório de certificados',
    credentialsFile: 'Arquivo de credenciais',
    privateKey: 'Chave privada',
    githubToken: 'Token do GitHub',
    gitlabToken: 'Token do GitLab',
    awsKey: 'Chave de acesso da AWS',
    openaiKey: 'Chave de API da OpenAI',
    anthropicKey: 'Chave de API da Anthropic',
    googleKey: 'Chave de API do Google',
    slackToken: 'Token do Slack',
    stripeKey: 'Chave da Stripe',
    npmToken: 'Token do npm',
    genericSecret: 'Senha ou segredo no código'
  } as Record<SensitiveKind, string>,
  line: (line: number) => `linha ${line}`,
  warnTitle: 'Possíveis segredos neste commit',
  blockTitle: 'Commit bloqueado: arquivos sensíveis',
  warnLead:
    'Estes arquivos costumam guardar senhas, chaves ou tokens. Depois do push, quem tiver acesso ao repositório pode vê-los, e tirá-los do histórico é difícil.',
  blockLead: 'A verificação de segurança está configurada para bloquear. Tire estes arquivos do commit para continuar.',
  contentTip: 'Token dentro do código: apague-o e leia o valor de uma variável de ambiente.',
  unstage: 'Tirar do commit',
  ignore: 'Adicionar ao .gitignore',
  ignorePreview: 'Entra no .gitignore:',
  codeOnlyUnstaged: (files: string) =>
    `${files}: só sai do commit. É código, e colocá-lo no .gitignore esconderia o arquivo do Git.`,
  commitAnyway: 'Commitar mesmo assim',
  settingsLink: 'Configurações de segurança',
  aiCardLead: 'O assistente tentou fazer o commit, mas estes arquivos parecem guardar senhas, chaves ou tokens.',
  doneUnstaged: 'Arquivos tirados do commit. Peça o commit de novo ao assistente.',
  doneIgnored: 'Arquivos adicionados ao .gitignore e tirados do commit. Peça o commit de novo ao assistente.',
  more: (count: number) => `e mais ${count}`,
  aiWarning: (list: string) => `Possíveis arquivos sensíveis neste commit: ${list}. Revise antes de aprovar.`,
  aiBlocked: (list: string) =>
    `Commit bloqueado pela verificação de segurança (Configurações › Segurança): ${list}. Sugira tirar esses arquivos do commit — ignore_files para arquivos como .env — ou remover o segredo do código. Nunca repita o valor de um segredo.`
}

type M = typeof ptBR

const en: M = {
  kinds: {
    envFile: 'Environment file (.env)',
    privateKeyFile: 'Private key file',
    sshKey: 'Private SSH key',
    keystore: 'Certificate store',
    credentialsFile: 'Credentials file',
    privateKey: 'Private key',
    githubToken: 'GitHub token',
    gitlabToken: 'GitLab token',
    awsKey: 'AWS access key',
    openaiKey: 'OpenAI API key',
    anthropicKey: 'Anthropic API key',
    googleKey: 'Google API key',
    slackToken: 'Slack token',
    stripeKey: 'Stripe key',
    npmToken: 'npm token',
    genericSecret: 'Password or secret in code'
  },
  line: (line) => `line ${line}`,
  warnTitle: 'Possible secrets in this commit',
  blockTitle: 'Commit blocked: sensitive files',
  warnLead:
    'These files usually hold passwords, keys or tokens. Once pushed, anyone with access to the repository can see them, and removing them from history is hard.',
  blockLead: 'The security check is set to block. Take these files out of the commit to continue.',
  contentTip: 'Token inside the code: delete it and read the value from an environment variable.',
  unstage: 'Take out of commit',
  ignore: 'Add to .gitignore',
  ignorePreview: 'Goes into .gitignore:',
  codeOnlyUnstaged: (files) =>
    `${files}: only taken out of the commit. It is code, and adding it to .gitignore would hide the file from Git.`,
  commitAnyway: 'Commit anyway',
  settingsLink: 'Security settings',
  aiCardLead: 'The assistant tried to commit, but these files look like they hold passwords, keys or tokens.',
  doneUnstaged: 'Files taken out of the commit. Ask the assistant to commit again.',
  doneIgnored: 'Files added to .gitignore and taken out of the commit. Ask the assistant to commit again.',
  more: (count) => `and ${count} more`,
  aiWarning: (list) => `Possible sensitive files in this commit: ${list}. Review before approving.`,
  aiBlocked: (list) =>
    `Commit blocked by the security check (Settings › Security): ${list}. Suggest taking these files out of the commit — ignore_files for files like .env — or removing the secret from the code. Never repeat a secret's value.`
}

const es: M = {
  kinds: {
    envFile: 'Archivo de entorno (.env)',
    privateKeyFile: 'Archivo de clave privada',
    sshKey: 'Clave SSH privada',
    keystore: 'Almacén de certificados',
    credentialsFile: 'Archivo de credenciales',
    privateKey: 'Clave privada',
    githubToken: 'Token de GitHub',
    gitlabToken: 'Token de GitLab',
    awsKey: 'Clave de acceso de AWS',
    openaiKey: 'Clave de API de OpenAI',
    anthropicKey: 'Clave de API de Anthropic',
    googleKey: 'Clave de API de Google',
    slackToken: 'Token de Slack',
    stripeKey: 'Clave de Stripe',
    npmToken: 'Token de npm',
    genericSecret: 'Contraseña o secreto en el código'
  },
  line: (line) => `línea ${line}`,
  warnTitle: 'Posibles secretos en este commit',
  blockTitle: 'Commit bloqueado: archivos sensibles',
  warnLead:
    'Estos archivos suelen guardar contraseñas, claves o tokens. Tras el push, cualquiera con acceso al repositorio puede verlos, y quitarlos del historial es difícil.',
  blockLead: 'La verificación de seguridad está configurada para bloquear. Saca estos archivos del commit para continuar.',
  contentTip: 'Token dentro del código: bórralo y lee el valor de una variable de entorno.',
  unstage: 'Sacar del commit',
  ignore: 'Añadir al .gitignore',
  ignorePreview: 'Entra en el .gitignore:',
  codeOnlyUnstaged: (files) =>
    `${files}: solo sale del commit. Es código, y añadirlo al .gitignore ocultaría el archivo de Git.`,
  commitAnyway: 'Hacer commit igualmente',
  settingsLink: 'Configuración de seguridad',
  aiCardLead: 'El asistente intentó hacer el commit, pero estos archivos parecen guardar contraseñas, claves o tokens.',
  doneUnstaged: 'Archivos sacados del commit. Pide el commit de nuevo al asistente.',
  doneIgnored: 'Archivos añadidos al .gitignore y sacados del commit. Pide el commit de nuevo al asistente.',
  more: (count) => `y ${count} más`,
  aiWarning: (list) => `Posibles archivos sensibles en este commit: ${list}. Revisa antes de aprobar.`,
  aiBlocked: (list) =>
    `Commit bloqueado por la verificación de seguridad (Configuración › Seguridad): ${list}. Sugiere sacar esos archivos del commit — ignore_files para archivos como .env — o quitar el secreto del código. Nunca repitas el valor de un secreto.`
}

export default { 'pt-BR': ptBR, en, es }
