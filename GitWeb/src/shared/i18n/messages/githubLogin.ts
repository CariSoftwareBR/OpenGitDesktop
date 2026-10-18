const ptBR = {
  denied: 'Autorização negada no GitHub.',
  expired: 'O código expirou. Tente novamente.',
  cancelled: 'Login cancelado.',
  failed: 'Falha ao entrar com o GitHub.',
  title: 'Entrar com GitHub',
  visit: 'Acesse',
  enterCode: 'e informe o código:',
  waiting: 'Aguardando autorização…',
  tryAgain: 'Tentar de novo',
  scopesIntro: 'O GitHub vai pedir estas permissões:',
  scopeRepo: 'dá leitura e escrita nos seus repositórios públicos e privados;',
  scopeWorkflow: 'é exigido pelo GitHub para enviar commits que alterem arquivos em',
  tokenStorage: 'O token fica guardado no cofre do sistema operacional, só nesta máquina.',
  continueGithub: 'Continuar com GitHub'
}

type M = typeof ptBR

const en: M = {
  denied: 'Authorization denied on GitHub.',
  expired: 'The code expired. Try again.',
  cancelled: 'Sign-in cancelled.',
  failed: 'Could not sign in with GitHub.',
  title: 'Sign in with GitHub',
  visit: 'Go to',
  enterCode: 'and enter the code:',
  waiting: 'Waiting for authorization…',
  tryAgain: 'Try again',
  scopesIntro: 'GitHub will ask for these permissions:',
  scopeRepo: 'grants read and write access to your public and private repositories;',
  scopeWorkflow: 'is required by GitHub to push commits that change files in',
  tokenStorage: 'The token is kept in the operating system keychain, on this machine only.',
  continueGithub: 'Continue with GitHub'
}

const es: M = {
  denied: 'Autorización denegada en GitHub.',
  expired: 'El código caducó. Inténtalo de nuevo.',
  cancelled: 'Inicio de sesión cancelado.',
  failed: 'No se pudo iniciar sesión con GitHub.',
  title: 'Iniciar sesión con GitHub',
  visit: 'Ve a',
  enterCode: 'e introduce el código:',
  waiting: 'Esperando autorización…',
  tryAgain: 'Intentar de nuevo',
  scopesIntro: 'GitHub pedirá estos permisos:',
  scopeRepo: 'da lectura y escritura en tus repositorios públicos y privados;',
  scopeWorkflow: 'lo exige GitHub para enviar commits que modifiquen archivos en',
  tokenStorage: 'El token se guarda en el almacén seguro del sistema operativo, solo en esta máquina.',
  continueGithub: 'Continuar con GitHub'
}

export default { 'pt-BR': ptBR, en, es }
