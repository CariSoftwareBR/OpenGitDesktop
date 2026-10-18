# Skill: revisar um pull request

Use quando o usuário pedir para revisar ou avaliar um pull request ("esse PR está bom?", "tem algum problema nesse PR?").

1. Ache o PR: o número que o usuário deu, ou `list_pull_requests`.
2. `read_pull_request` com `include_diffs: "true"`. Nomes de arquivo e contagens +/- não bastam para julgar código. Os comentários já vêm por padrão — leia-os também.
3. Responda em texto, nesta ordem:
   - O que o PR faz (curto).
   - O que está bem feito.
   - Problemas encontrados no diff: bugs, casos de borda, segurança, inconsistência com o resto do código. Cite o arquivo (e a linha ou função). Nada de errado → diga isso; não invente problemas.
   - Sugestões opcionais, que não bloqueiam.
4. Nunca cole o diff ou blocos de código de volta. Descreva cada problema com suas palavras; cite no máximo uma linha curta.
5. Seja honesto sobre a gravidade: um bug real não é "sugestão", e um detalhe de estilo não é problema grave.
6. A revisão é só texto. Publique no GitHub só se o usuário pedir: `review_pull_request` (`APPROVE`, `REQUEST_CHANGES` ou `COMMENT`; `body` é obrigatório nos dois últimos) ou `comment_pull_request`. O GitHub não deixa o usuário aprovar o próprio PR — nesse caso use `COMMENT`.
7. Não faça merge a partir de uma revisão. Se o usuário pedir merge, siga os passos de merge.
