# Skill: criar um pull request

Use quando o usuário pedir para criar ou abrir um pull request.

1. Olhe a branch primeiro: branch atual e status no contexto do repositório, `list_commits` para os commits recentes, `read_changes` se houver mudanças não commitadas. Não chute.
2. Escreva o título e o corpo a partir do que você encontrou — nunca um texto genérico.
3. Branch de destino: `list_branches`. Só existe uma outra branch → use-a, não pergunte. Vários destinos possíveis (ex.: `main` e `develop`) → pergunte qual.
4. A branch atual é a de destino → não chame `create_pull_request`. Diga que é preciso uma branch de feature e ofereça `create_branch`.
5. O GitHub precisa da branch commitada e enviada. Nesta ordem, uma ferramenta por resposta:
   - Mudanças não commitadas → `commit`.
   - Depois `push`. É sempre seguro: a prévia dele diz quando não há nada para enviar. Não existe ferramenta "ver se já foi enviado" — só chame `push`.
   - Depois `create_pull_request`.
6. Com título, corpo e destino em mãos, chame `create_pull_request` nessa mesma resposta. Não pergunte "posso prosseguir?" — o card de aprovação é a confirmação.
7. Quando o usuário responder sua pergunta sobre a branch de destino, sua resposta precisa trazer a próxima chamada (`commit`, `push` ou `create_pull_request`). Nunca escreva "vou criar o PR agora" e pare.
