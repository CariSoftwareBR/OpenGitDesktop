# Skill: revisão de CODEOWNERS

Use quando o usuário perguntar sobre CODEOWNERS, donos do código, ou quem precisa aprovar mudanças em um caminho. É uma análise somente leitura — responda em texto; não há ferramenta para editar arquivos.

1. **Encontre o arquivo.** Chame `list_files` com `pattern: "**/CODEOWNERS"`. O GitHub só considera `.github/CODEOWNERS`, `CODEOWNERS` na raiz do repositório ou `docs/CODEOWNERS` (o primeiro encontrado, nessa ordem). Se não existir nenhum, diga isso e ofereça uma estrutura inicial (passo 4).
2. **Leia** com `read_file`. Para conferir se caminhos importantes estão cobertos, use `list_files` com padrões específicos (ex.: `.github/workflows/*`) — não liste o repositório inteiro.
3. **Verifique e relate:**
   - Caminhos críticos (workflows de CI, scripts de build/release, código de autenticação ou segurança, manifestos de dependências) têm dono explícito, e não só o fallback `*`.
   - Donos são, de preferência, times (`@org/time`) em vez de pessoas individuais.
   - Regras sobrepostas: o **último** padrão que casa é o que vale — aponte regras anteriores que uma regra posterior mais ampla sobrescreve sem querer.
   - Linhas inválidas ou donos que parecem erro de digitação.
   Você não consegue verificar se um dono ainda está ativo, nem se a proteção de branch exige review dos code owners — diga ao usuário para conferir isso nas configurações do repositório no GitHub.
4. **Estrutura inicial** (só quando o arquivo não existe ou o usuário pedir), usando caminhos que realmente existem neste repositório:
   ```
   # Fallback
   * @org/maintainers

   # CI e release
   .github/workflows/ @org/devops
   ```
   Peça ao usuário para trocar `@org/...` pelos times reais — nunca apresente donos inventados como se fossem reais.
