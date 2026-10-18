# Skill: arquivo que não devia ter sido commitado

Use quando um commit trouxe um arquivo que não deveria estar no Git: push recusado por arquivo grande (GH001, "exceeds GitHub's file size limit of 100.00 MB", "Large files detected"), um backup/dump de banco, um binário gerado, ou um segredo (`.env`, chave, token). Resolva você mesmo com as ferramentas, até o `push` passar.

**Um "Diagnóstico verificado pelo app" no prompt é fato.** Não o contradiga nem o reverifique. Sua próxima ação é a ferramenta indicada em "Próximo passo", anexada nesta mesma resposta, sem perguntar em texto.

## 1. Ache o arquivo
- `list_commits`, depois `read_commit` nos commits à frente do remoto, para ver quais trazem o arquivo. O contexto do repositório mostra quantos commits estão à frente (ahead).
- Push recusado não enviou nada. Se o arquivo só está nos commits à frente do remoto, não existe histórico remoto para reescrever.
- O arquivo não está mais no disco → a única cópia está no commit. Avise o usuário antes de desfazê-lo.

## 2. Corrija — uma ferramenta por resposta
1. `undo_last_commit` — uma vez por commit, do mais novo para o mais antigo, até desfazer o commit mais antigo que traz o arquivo. As mudanças voltam para o stage; nada se perde.
2. `ignore_files` com o caminho do arquivo — tira do stage e adiciona ao `.gitignore`. O arquivo continua no disco.
3. `commit`.
4. `push`.

Antes de cada ferramenta, diga em uma frase o que ela faz e anexe a chamada nessa mesma resposta. O card de aprovação é a pergunta de sim/não.

## 3. Nunca
- Um commit novo apagando o arquivo **não** resolve: o push envia todos os commits, inclusive o que adicionou o arquivo.
- Nada de Git LFS para backup, dump ou binário gerado — só se o usuário disser que o arquivo precisa ficar no repositório.
- Nada de `filter-branch`, `filter-repo`, BFG, `reset --hard` ou force push, nem como passo manual.
- Não invente telas ou configurações do GitHub (não existe configuração "remover arquivo grande").

## 4. O arquivo já está no remoto
`undo_last_commit` vai recusar. Não tente limpar o histórico remoto.
- **Segredo:** diga que ele deve ser tratado como vazado e revogado/trocado onde foi emitido. Depois `ignore_files` + `commit` + `push` para parar de versioná-lo. Nunca repita o valor.
- **Arquivo grande que o remoto já aceitou:** `ignore_files` + `commit` + `push`, para ele sair das próximas versões. Explique que ele continua no histórico antigo e que tirá-lo de lá exige reescrever o histórico, fora deste chat.
