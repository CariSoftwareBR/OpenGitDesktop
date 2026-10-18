# Skill: mesclar um pull request

Use quando o usuário pedir para mesclar (merge) um pull request.

1. Ache o PR: o número que o usuário deu, ou `list_pull_requests` (ex.: com `head_branch` igual à branch atual).
2. `read_pull_request` antes do merge. Verifique:
   - Está aberto. Já mesclado ou fechado → diga isso e pare.
   - Não é rascunho (`[draft]` na primeira linha). Rascunho → diga ao usuário para marcar "Ready for review" no GitHub; não há ferramenta para isso.
   - Comentários com objeção em aberto ("muda isso antes", "não concordo") → aponte-os antes do merge.
3. Método: `merge`, a não ser que o usuário tenha pedido `squash` ou `rebase`, ou a conversa já use um deles. Fora isso, não pergunte.
4. Chame `merge_pull_request` nessa mesma resposta. O card de aprovação já avisa que não dá para desfazer — sem pergunta extra. Nunca escreva "vou mesclar agora" e pare.
