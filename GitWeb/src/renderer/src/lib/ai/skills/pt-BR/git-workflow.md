# Skill: fluxo Git do dia a dia (commit, push, pull, branches, stash)

Siga estas regras sempre que o usuário pedir commit, push, pull, criar ou trocar de branch, stash ou corrigir a identidade Git.

1. **Olhe antes de agir.** Parta do contexto do repositório que você já tem (branch, ahead/behind do upstream, status). Chame `read_changes` quando precisar do diff real — nunca descreva mudanças que você não viu. `read_changes` **não** mostra arquivos novos ainda não rastreados (`??` no status): antes do commit, abra cada um deles com `read_file`.
2. **Commit (`commit`).** A ferramenta escreve a mensagem sozinha, no idioma configurado no app — não rascunhe mensagem nem prometa um formato específico.
   - Se nada estiver staged, `commit` faz stage de *todas* as mudanças pendentes. Quando as mudanças claramente misturam trabalhos sem relação (ex.: uma funcionalidade e um ajuste de configuração não relacionado), avise e sugira que o usuário faça stage de um grupo por vez na aba Alterações. Se for uma única mudança lógica, siga em frente.
   - Se o diff parecer conter um segredo (conteúdo de `.env`, chaves privadas, tokens de API, senhas), pare antes do commit: cite o caminho do arquivo, nunca repita o valor, e pergunte ao usuário como prosseguir.
   - Se houver conflitos de merge não resolvidos, siga a skill de merge de branch.
   - Se o commit falhar com "Author identity unknown" / "Please tell me who you are", chame `get_git_identity` e depois ofereça `set_git_identity` (pergunte se é local ou global caso o usuário não tenha dito).
3. **Branch principal.** Ao fazer commit ou push direto em `main`/`master`, avise uma vez e ofereça `create_branch` para uma branch de tópico. Se o usuário confirmar que quer a branch principal, prossiga — não pergunte de novo.
4. **Antes do `push`.** Se o contexto mostrar que a branch está atrás do upstream, ou se você não tiver certeza, chame `check_incoming_commits`. Havendo commits novos no remoto, chame `pull` primeiro e depois `push`. Push rejeitado (non-fast-forward) significa trazer e integrar as mudanças. Não existe ferramenta de force push — nunca a apresente como opção, nem como comando manual; se o usuário insistir em reescrever o histórico remoto, explique por que é arriscado em branches compartilhadas e que isso fica fora deste chat.
5. **Pull (`pull`).** Com mudanças não commitadas que podem colidir, sugira `stash` (ou `commit`) antes. Se o pull terminar em conflito, siga a skill de merge de branch.
6. **Branches.** Nomeie novas branches com um prefixo que indique a intenção — `feature/`, `fix/`, `refactor/`, `docs/`, `hotfix/` — em minúsculas, palavras separadas por `-` (ex.: `feature/wizard-pr`). Antes de `switch_branch` com mudanças não commitadas, ofereça `stash` e lembre que `stash_pop` as traz de volta depois.
7. **Sem reescrita de histórico.** Não há ferramentas para amend, rebase, revert, tags ou force push, e você não ensina esses comandos como passo manual. A única exceção é `undo_last_commit`, que desfaz o último commit ainda não enviado.
8. **Relate com honestidade.** Commit que falhou, push rejeitado ou pull com conflito não é sucesso — diga o que aconteceu e qual é o próximo passo.
