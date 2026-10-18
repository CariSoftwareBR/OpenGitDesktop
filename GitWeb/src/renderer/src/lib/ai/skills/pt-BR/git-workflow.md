# Skill: Git do dia a dia (commit, push, pull, branches, stash)

Use quando o usuário pedir commit, push, pull, criar ou trocar de branch, stash, ou corrigir o nome/email do Git.

## Antes de agir
- Leia primeiro o contexto do repositório: branch, ahead/behind do upstream, linhas de status.
- Precisa do diff? Chame `read_changes`. Nunca descreva mudanças que você não viu.
- `read_changes` não mostra arquivos novos (`??` no status). Abra-os com `read_file` antes do commit — no máximo 5, e pule binários e arquivos muito grandes.

## Commit
- Chame `commit`. Ele escreve a mensagem sozinho — não escreva uma.
- Nada no stage → `commit` coloca tudo no stage. Se as mudanças misturam trabalhos sem relação, avise e sugira fazer stage de um grupo por vez na aba Alterações. Senão, só faça o commit.
- O diff parece ter um segredo (`.env`, chave privada, token de API, senha) → não faça o commit. Cite o arquivo, nunca repita o valor, e pergunte ao usuário o que fazer.
- Arquivos ainda em conflito → primeiro `resolve_conflict` em cada arquivo, depois `commit`.
- "Author identity unknown" / "Please tell me who you are" → `get_git_identity`, depois `set_git_identity`. Pergunte "local ou global?" só se o usuário não disse.

## Branch principal
Em `main`/`master`: avise uma vez e ofereça `create_branch`. Se o usuário quiser continuar nela, siga — não pergunte de novo.

## Push
- Branch atrás do upstream, ou você não tem certeza → `check_incoming_commits` antes.
- Há commits novos no remoto → `pull`, depois `push`.
- Push recusado (non-fast-forward) → `pull`, depois `push` de novo.

## Pull
- Mudanças não commitadas → ofereça `stash` (ou `commit`) antes.
- O pull terminou em conflito → `resolve_conflict` em cada arquivo, depois `commit`.

## Branches
- Nome = prefixo + palavras em minúsculas ligadas por `-`. Prefixos: `feature/`, `fix/`, `refactor/`, `docs/`, `hotfix/` (ex.: `feature/wizard-pr`).
- Mudanças não commitadas antes de `switch_branch` → ofereça `stash`; `stash_pop` traz de volta depois.

## Nunca
- Nada de force push, amend, rebase, revert ou tags: não há ferramentas para isso, e não passe esses comandos como passo manual. Se o usuário insistir em reescrever o histórico remoto, explique o risco em branches compartilhadas; isso fica fora deste chat.
- A única exceção: `undo_last_commit` desfaz o último commit que ainda não foi enviado.
- Commit que falhou, push recusado ou pull com conflito não é sucesso. Diga o que aconteceu e qual é o próximo passo.
