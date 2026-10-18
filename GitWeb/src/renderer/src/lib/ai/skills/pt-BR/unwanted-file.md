# Skill: arquivo que não devia ter sido commitado

Use esta skill quando um commit trouxe um arquivo que não deveria estar no Git: push recusado por arquivo grande (GH001, "exceeds GitHub's file size limit of 100.00 MB", "Large files detected"), um backup/dump de banco, um binário gerado ou um segredo (`.env`, chave, token). Resolva você mesmo com as ferramentas, até o `push` passar.

**Se o prompt tiver um "Diagnóstico verificado pelo app", ele manda:** são fatos checados no repositório. Não os contradiga e não os re-investigue — sua próxima ação é a ferramenta indicada em "Próximo passo", anexada nesta mesma resposta, sem perguntar em texto.

## 1. Confirme onde o arquivo está
- Use `list_commits` e `read_commit` para achar os commits que trazem o arquivo, e o contexto do repositório para ver quantos commits estão à frente do remoto (ahead).
- Push recusado = nada daquele push chegou ao remoto. Se o arquivo só aparece nos commits à frente, **não existe histórico remoto para reescrever**.
- Se o arquivo não está mais no disco (apagado), a única cópia está no commit. Avise isso ao usuário antes de desfazer o commit.

## 2. Corrija, uma ferramenta por vez
1. `undo_last_commit` — repita até passar do último commit que trouxe o arquivo. As mudanças voltam para o stage, nada se perde.
2. `ignore_files` com o caminho do arquivo — tira do stage e adiciona ao `.gitignore`; o arquivo continua no disco.
3. `commit`.
4. `push`.

Antes de cada ferramenta, diga em uma frase o que ela faz e anexe a chamada na mesma resposta — o card de aprovação é a pergunta de sim/não.

## 3. O que não fazer
- Um commit novo apagando o arquivo **não** resolve: o push envia todos os commits, inclusive o que adicionou o arquivo.
- Não sugira Git LFS para backup, dump ou binário gerado. Só se o usuário disser que o arquivo precisa mesmo ficar no repositório.
- Nunca `filter-branch`, `filter-repo`, BFG, `reset --hard` ou force push — nem como passo manual.
- Nunca invente telas, menus ou configurações do GitHub (não existe "remover arquivo grande" nas configurações do repositório).

## 4. Se o arquivo já está no remoto
`undo_last_commit` vai recusar. Não tente limpar o histórico remoto.
- **Segredo:** diga que ele deve ser tratado como vazado e **revogado/trocado** no serviço de origem; depois `ignore_files` + `commit` + `push` para parar de versioná-lo. Nunca repita o valor do segredo.
- **Arquivo grande já aceito pelo remoto:** `ignore_files` + `commit` + `push` para ele sair das próximas versões. Explique que ele continua no histórico antigo e que tirá-lo de lá exige reescrever o histórico, algo fora deste chat.
