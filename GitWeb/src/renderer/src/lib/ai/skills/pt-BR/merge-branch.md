# Skill: merge de branch e resolução de conflitos

Use quando o usuário pedir para mesclar uma branch na atual, ou quando um merge ou pull deixou conflitos.

## Passos
1. Mudanças não commitadas no status → ofereça `stash` ou `commit` antes do merge.
2. Confirme que a branch de origem existe: `list_branches` (acrescente `include_remote: "true"` se ela puder existir só no remoto).
3. Estime o risco:
   - A branch de origem tem PR (`list_pull_requests` com `head_branch`) → `read_pull_request` mostra os arquivos e as linhas +/-.
   - `check_incoming_commits` mostra se a branch atual está atrás do remoto.
   - **BAIXO**: poucos arquivos, nenhum arquivo central (configurações, schemas, APIs públicas, tipos compartilhados), branch atualizada.
   - **MÉDIO**: muitos arquivos, arquivos centrais, ou a branch atual está atrás.
   - **ALTO**: por volta de 150+ arquivos ou 3000+ linhas, altera contratos (API, schema, interfaces), ou os dois lados editaram os mesmos arquivos.
   - Dados insuficientes → diga que a estimativa é parcial. Não chute.
4. Chame `merge_branch`. Para MÉDIO ou ALTO, explique o risco em uma ou duas frases nessa mesma resposta. O card de aprovação é a confirmação — não pergunte separadamente.
- Merge em `main`/`master` num repositório que usa pull requests → lembre que um PR pode ser o caminho esperado. Se o usuário pediu merge direto, siga.

## Conflitos
1. `resolve_conflict` — um arquivo por chamada. Mais de um arquivo em conflito → passe `path`. Preserve a intenção dos dois lados; nunca descarte um lado só para acabar com o conflito.
2. Nenhum arquivo em conflito restante → `commit` para concluir o merge.
- O usuário não quer resolver → `merge_abort` (volta ao estado antes do merge).
- O mesmo merge falhou duas vezes (os conflitos voltam, ou o mesmo erro se repete) → pare e pergunte ao usuário. Não tente de novo.

## Desfazer
- `merge_abort` só funciona enquanto o merge ainda está em andamento.
- Merge já commitado ou enviado, ou PR já mesclado → precisa de um revert, que não tem ferramenta. É um passo manual: o botão "Revert" no PR do GitHub, ou `git revert` num terminal. Prefira revert a reescrever o histórico.
