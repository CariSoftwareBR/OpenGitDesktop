# Política de segurança

## Versões suportadas

Apenas a versão mais recente publicada em
[Releases](https://github.com/CariSoftwareBR/OpenGitDesktop/releases) recebe
correções de segurança. O app se atualiza sozinho; mantenha-o atualizado.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Use o reporte privado do GitHub:

1. Acesse a aba [Security](https://github.com/CariSoftwareBR/OpenGitDesktop/security)
   do repositório.
2. Clique em **Report a vulnerability**.
3. Descreva o problema, os passos para reproduzir e o impacto esperado.

Você deve receber uma primeira resposta em até 7 dias. Depois de confirmada, a
falha é corrigida em uma nova release e divulgada por um security advisory, com
crédito a quem reportou (se desejar).

## Escopo

Interessam especialmente falhas que permitam:

- vazamento de tokens do GitHub ou chaves de provedores de IA guardados no
  cofre do sistema;
- o assistente de IA executar ações no Git **sem** a aprovação do usuário;
- execução de código a partir do conteúdo de um repositório, de um diff ou de
  uma resposta da IA;
- contornar o isolamento entre o renderer e o processo main do Electron.
