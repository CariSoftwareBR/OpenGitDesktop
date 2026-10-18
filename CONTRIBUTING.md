# Como contribuir

Obrigado pelo interesse em melhorar o OpenGitDesktop! Este guia explica como
propor mudanças sem atrito.

## Antes de começar

- **Bugs e ideias:** abra uma [issue](https://github.com/CariSoftwareBR/OpenGitDesktop/issues)
  usando um dos modelos. Para mudanças grandes, discuta na issue antes de
  escrever código — evita retrabalho dos dois lados.
- **Falhas de segurança:** não abra issue pública. Siga o [`SECURITY.md`](SECURITY.md).
- Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).

## Ambiente de desenvolvimento

**Requisitos:** Node.js 20+ e Git no `PATH`.

```bash
cd GitWeb
npm install
npm run dev
```

Estrutura do código e detalhes técnicos: [`GitWeb/README.md`](GitWeb/README.md).

## Fluxo de contribuição

1. Faça um fork e crie uma branch a partir de `main`
   (ex.: `fix/diff-com-crlf`, `feat/rebase-interativo`).
2. Faça a mudança, com testes quando fizer sentido.
3. Rode as mesmas verificações do CI antes de abrir o PR:

   ```bash
   cd GitWeb
   npm run typecheck
   npm test
   ```

4. Abra o Pull Request contra `main` e preencha o modelo.

## Diretrizes

- **A IA nunca age sozinha.** Qualquer ferramenta nova do assistente que altere
  o repositório precisa passar pela aprovação explícita do usuário — este é o
  princípio central do projeto.
- **Tokens e chaves não saem do processo main.** Chamadas autenticadas ficam no
  `main`; o renderer nunca recebe o token.
- Siga o estilo do código ao redor (TypeScript estrito, nomes e comentários no
  mesmo padrão do arquivo).
- Mantenha os PRs focados: uma mudança por PR facilita a revisão.
- Mudanças visíveis na interface ficam melhores com um print ou GIF no PR.

## Traduções

O app fala **pt-BR**, **en** e **es**. Interface, mensagens do processo main e
respostas da IA usam um único idioma, escolhido em Configurações (o padrão segue
o sistema operacional).

- **Dicionários:** `GitWeb/src/shared/i18n/messages/<namespace>.ts`. Cada arquivo
  traz as três traduções lado a lado; `en` e `es` são tipados a partir do objeto
  `ptBR`, então uma chave faltando ou sobrando quebra o `npm run typecheck`.
  Textos com variáveis ou plural são funções (`(n: number) => …`).
- **Usar no renderer:** `const t = useT().<namespace>` em componentes;
  `getT()` / `getLocale()` em stores e funções fora do React. Datas e números
  passam por `useFormatters()` / `getFmt()` — nada de `'pt-BR'` fixo.
- **Usar no main:** `tMain()` em `GitWeb/src/main/i18n.ts`. A saída crua do
  `git` (stderr) não é traduzida.
- **Nova chave:** adicione-a nas três traduções do namespace. Para um namespace
  novo, crie o arquivo e registre-o em `GitWeb/src/shared/i18n/index.ts`.
- **IA:** prompts em `GitWeb/src/shared/aiPrompts.ts` (cada texto com uma
  versão por idioma) e skills em `GitWeb/src/renderer/src/lib/ai/skills/<idioma>/`.
- **Idioma novo:** inclua-o em `SUPPORTED_LOCALES`/`resolveLocale`
  (`GitWeb/src/shared/i18n/locales.ts`), traduza todos os namespaces, os prompts
  e as skills; o `test/i18n.test.ts` confere a paridade de chaves e strings vazias.

## Releases

As releases são geradas pelo CI a partir da `main`; quem contribui não precisa
mexer em versão. Commits que não devem gerar release (docs, ajustes de CI)
podem incluir `[skip release]` na mensagem.

## Licença

Ao contribuir, você concorda que sua contribuição será distribuída sob a
[licença MIT](LICENSE) do projeto.
