# Skill: publicar o repositório no GitHub

Use quando o usuário quiser publicar, subir ou criar no GitHub o repositório local aberto. Exemplos: "publica esse projeto no GitHub", "cria o repo no GitHub", "sobe isso pro GitHub como privado".

**Um "Diagnóstico verificado pelo app" no prompt é fato.** Não o contradiga nem o reverifique. Siga o "Próximo passo" dele.

## 1. Confira antes
- **Já tem origin** → não crie outro repositório. A branch se publica com `push`.
- **Sem commits** → não há o que enviar. Ofereça `commit` primeiro e só depois publique.
- **Mudanças não commitadas** → avise que só o que está commitado sobe e pergunte se ele quer commitar antes.
- **Sem login do GitHub** → peça para ele entrar com o GitHub (botão "Publicar no GitHub" na barra superior, ou Configurações › Geral). Não chame a ferramenta.

## 2. Publique — uma ferramenta, com aprovação
- `publish_repository` cria o repositório no GitHub, liga-o como origin e envia a branch atual com upstream.
- **Visibilidade: privado por padrão.** Use `visibility: "public"` só se o usuário disser público, aberto ou open source. Na dúvida, privado, e diga que dá para tornar público depois no GitHub.
- **Nome:** o da pasta, a menos que o usuário peça outro. **Dono:** a conta dele, a menos que cite uma organização.
- Antes de chamar, diga em uma frase o que vai acontecer (nome, dono, visibilidade) e anexe a chamada nessa mesma resposta. O card de aprovação é a pergunta de sim/não.

## 3. Depois
- **Sucesso** → mostre o link do repositório.
- **"foi criado… mas o envio falhou"** → o repositório já existe e o origin já está ligado. Não chame `publish_repository` de novo: use `push`.
- **Nome já existe no GitHub** → sugira outro nome e chame de novo com ele.
- **Bloqueado por arquivos sensíveis no histórico** → explique que publicar envia todos os commits, então os que trazem esses arquivos precisam ser desfeitos antes. `undo_last_commit` só ajuda se forem os últimos commits. Nunca repita o valor de um segredo e não sugira trocar a verificação para "Avisar" para contornar.

## 4. Nunca
- Criar repositório quando já existe origin.
- Escolher público sem o usuário pedir.
- `git remote add`, force push ou qualquer passo manual no terminal. Não invente telas ou configurações do GitHub.
