# Skill: merge de branches e resolução de conflitos

Siga estes passos sempre que o usuário pedir para mesclar uma branch na atual, ou quando um merge ou pull deixar conflitos.

1. **Verifique o ponto de partida.** Pelo contexto do repositório: branch atual, mudanças pendentes, ahead/behind. Se houver mudanças não commitadas, ofereça `stash` ou `commit` antes do merge — um merge sobre working tree sujo é mais difícil de desfazer.
2. **Confirme que a branch de origem existe** com `list_branches` (`include_remote: "true"` se ela puder existir só no remoto).
3. **Estime o risco antes de chamar `merge_branch`**, com o que as ferramentas mostram:
   - Se a branch de origem tiver PR (`list_pull_requests` com `head_branch`), `read_pull_request` traz os arquivos alterados e as contagens de +/-.
   - `check_incoming_commits` indica se a branch atual está desatualizada em relação ao remoto.
   Classifique:
   - **BAIXO** — poucos arquivos, nenhum arquivo central (configurações, schemas, APIs públicas, tipos compartilhados), branch atualizada.
   - **MÉDIO** — muitos arquivos, ou toca arquivos centrais, ou a branch atual está atrás.
   - **ALTO** — mudança muito grande (por volta de 150+ arquivos ou 3000+ linhas), altera contratos (API, schema, interfaces), ou você já sabe que os dois lados editaram os mesmos arquivos.
   Se não conseguir dados suficientes, diga que a estimativa é parcial em vez de chutar. Para BAIXO, apenas chame `merge_branch`. Para MÉDIO ou ALTO, explique o risco em uma ou duas frases na mesma resposta que chama `merge_branch` — o card de aprovação é a confirmação, não pergunte separadamente.
4. **Branch principal.** Ao mesclar em `main`/`master` num repositório que trabalha com pull requests, lembre que um PR pode ser o caminho esperado. Se o usuário já pediu merge direto, prossiga.
5. **Se surgirem conflitos:**
   - Chame `resolve_conflict` para um arquivo por vez (passe `path` quando houver mais de um arquivo em conflito). Preserve a intenção dos dois lados — não descarte um lado só para o conflito sumir.
   - Quando não restar nenhum arquivo em conflito, chame `commit` para concluir o merge.
   - Se o usuário não quiser resolver, chame `merge_abort` para voltar ao estado anterior ao merge.
6. **Falha repetida.** Se o mesmo merge falhar duas vezes (conflitos voltam depois de resolvidos, ou erros se repetem), pare e pergunte ao usuário como prosseguir — não fique tentando de novo.
7. **Desfazer.** `merge_abort` só funciona enquanto o merge ainda está em andamento. Desfazer um merge já commitado ou enviado (ou um PR já mesclado) exige um revert, que não tem ferramenta — explique que é um passo manual (botão "Revert" no PR do GitHub, ou `git revert` no terminal) e prefira revert a reescrever histórico em branches compartilhadas.
