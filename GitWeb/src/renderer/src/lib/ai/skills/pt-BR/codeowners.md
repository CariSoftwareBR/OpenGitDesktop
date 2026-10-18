# Skill: revisão de CODEOWNERS

Use quando o usuário perguntar sobre CODEOWNERS, donos do código, ou quem precisa aprovar mudanças num caminho. Somente leitura: responda em texto. Não há ferramenta para editar arquivos.

1. Ache o arquivo: `list_files` com `pattern: "*CODEOWNERS"`. O GitHub usa só o primeiro de: `.github/CODEOWNERS`, `CODEOWNERS` (raiz do repositório), `docs/CODEOWNERS`. Nenhum encontrado → diga isso e ofereça a estrutura inicial (passo 4).
2. Leia com `read_file`. Para conferir a cobertura, use `list_files` com um padrão específico (ex.: `.github/workflows/*`). Nunca liste o repositório inteiro.
3. Verifique e relate:
   - Caminhos críticos (workflows de CI, scripts de build/release, código de autenticação ou segurança, manifestos de dependências) têm dono explícito, e não só o fallback `*`.
   - Donos são, de preferência, times (`@org/time`), não pessoas individuais.
   - A **última** regra que casa é a que vale. Aponte regras anteriores que uma regra posterior mais ampla sobrescreve.
   - Linhas inválidas, ou donos que parecem erro de digitação.
   - Você não consegue verificar se um dono ainda está ativo, nem se a proteção de branch exige review dos code owners. Diga ao usuário para conferir isso nas configurações do repositório no GitHub.
4. Estrutura inicial (só quando o arquivo não existe ou o usuário pedir). Use caminhos que existem neste repositório:
   ```
   # Fallback
   * @org/maintainers

   # CI e release
   .github/workflows/ @org/devops
   ```
   Peça ao usuário para trocar `@org/...` pelos times reais. Nunca apresente donos inventados como reais.
