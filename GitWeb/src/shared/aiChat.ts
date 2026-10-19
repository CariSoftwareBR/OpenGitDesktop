export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolName?: string
  /** Present on assistant turns that requested native tool calls (for multi-turn replay). */
  toolCalls?: ToolCallRequest[]
}

export interface ToolCallRequest {
  id: string
  name: string
  arguments: Record<string, string>
}

export interface ChatResponse {
  content: string
  toolCalls: ToolCallRequest[]
}

// Never-rejecting outcome for the tool-aware chat IPC channel — the renderer
// needs the HTTP status code to decide whether to retry with the textual
// tool-calling fallback, and thrown-error properties don't reliably survive
// the IPC boundary.
export interface ChatRequestOutcome {
  ok: boolean
  statusCode?: number
  response?: ChatResponse
  errorMessage?: string
}

export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, { type: string; description: string; enum?: string[] }>
  required: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameterSchema
}

// Ported 1:1 from the WinUI app's AiToolService.BuildDefinitions() (C#) so no
// capability is lost in the move to GitWeb. Parameter names match the
// original exactly, with two deliberate additions noted inline.
export const TOOL_CATALOG: ToolDefinition[] = [
  {
    name: 'create_branch',
    description: 'Cria uma nova branch local a partir de outra branch.',
    parameters: {
      type: 'object',
      properties: {
        branch_name: { type: 'string', description: 'Nome da nova branch (ex: feature/login).' },
        from_branch: { type: 'string', description: 'Branch base (opcional). Usa HEAD atual se omitido.' },
        // Addition vs. the original tool: lets the model choose whether to
        // also switch to the new branch, instead of always leaving it as a
        // separate step for the user.
        checkout: { type: 'string', description: '"true" para já trocar para a nova branch (padrão: true).', enum: ['true', 'false'] }
      },
      required: ['branch_name']
    }
  },
  {
    name: 'create_pull_request',
    description: 'Cria um Pull Request no GitHub a partir da branch atual.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do PR.' },
        body: { type: 'string', description: 'Corpo/descrição do PR em Markdown.' },
        base_branch: { type: 'string', description: 'Branch de destino (ex: main).' },
        draft: { type: 'string', description: 'Se o PR deve ser criado como rascunho. Padrão: false.', enum: ['true', 'false'] }
      },
      required: ['title', 'body', 'base_branch']
    }
  },
  {
    name: 'list_pull_requests',
    description: 'Lista pull requests do repositório remoto (com filtro opcional por estado e branch).',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Estado do PR: open, closed ou all. Padrão: open.', enum: ['open', 'closed', 'all'] },
        head_branch: { type: 'string', description: 'Filtra PRs pela branch de origem (head), ex: feature/login.' }
      },
      required: []
    }
  },
  {
    name: 'read_pull_request',
    description: 'Lê os detalhes de um pull request (resumo, arquivos alterados, diffs opcionais e comentários). Use include_diffs para revisar o código de verdade.',
    parameters: {
      type: 'object',
      properties: {
        pull_request_number: { type: 'number', description: 'Número do PR (ex: 123).' },
        include_files: { type: 'string', description: 'Se deve incluir a lista de arquivos alterados. Padrão: true.', enum: ['true', 'false'] },
        include_diffs: {
          type: 'string',
          description: 'Se deve incluir o diff (patch) de cada arquivo alterado, necessário para avaliar a qualidade do código. Padrão: false.',
          enum: ['true', 'false']
        },
        include_comments: { type: 'string', description: 'Se deve incluir comentários do PR. Padrão: true.', enum: ['true', 'false'] }
      },
      required: ['pull_request_number']
    }
  },
  {
    name: 'read_commit',
    description:
      'Lê os detalhes de um commit do repositório aberto: autor, data, mensagem completa, arquivos alterados e, opcionalmente, o diff. Use esta tool (e não read_pull_request) quando o usuário falar em commit. Se o usuário citar um arquivo específico, chame com include_diff="true" e path=<arquivo> — o diff do commit inteiro é truncado e pode cortar justamente o arquivo pedido. Padrão: o último commit (HEAD).',
    parameters: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Commit a ler: hash, HEAD, HEAD~1, tag ou branch. Padrão: HEAD.' },
        path: {
          type: 'string',
          description:
            'Limita o diff (e a lista de arquivos) a um único arquivo do commit. Aceita o caminho relativo à raiz do repositório ou apenas o nome do arquivo. Use sempre que o usuário citar um arquivo específico.'
        },
        include_files: { type: 'string', description: 'Se deve incluir a lista de arquivos alterados. Padrão: true.', enum: ['true', 'false'] },
        include_diff: {
          type: 'string',
          description: 'Se deve incluir o diff do commit (ou apenas do arquivo em "path"), necessário para avaliar o código de verdade. Padrão: false.',
          enum: ['true', 'false']
        }
      },
      required: []
    }
  },
  {
    name: 'list_commits',
    description: 'Lista os commits mais recentes da branch atual (hash, autor, data e mensagem). Use para localizar o commit certo antes de chamar read_commit.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Quantidade de commits a listar. Padrão: 20.' }
      },
      required: []
    }
  },
  {
    name: 'merge_pull_request',
    description: 'Faz merge de um pull request diretamente no GitHub.',
    parameters: {
      type: 'object',
      properties: {
        pull_request_number: { type: 'number', description: 'Número do PR (ex: 123).' },
        merge_method: { type: 'string', description: 'Método de merge: merge, squash ou rebase. Padrão: merge.', enum: ['merge', 'squash', 'rebase'] },
        commit_title: { type: 'string', description: 'Título opcional do commit de merge.' },
        commit_message: { type: 'string', description: 'Mensagem opcional do commit de merge.' }
      },
      required: ['pull_request_number']
    }
  },
  {
    name: 'review_pull_request',
    description:
      'Envia uma review em um pull request: aprovar, pedir mudanças ou apenas comentar. O GitHub não permite aprovar o próprio PR — nesse caso use COMMENT ou REQUEST_CHANGES.',
    parameters: {
      type: 'object',
      properties: {
        pull_request_number: { type: 'string', description: 'Número do pull request.' },
        event: {
          type: 'string',
          description: 'Tipo de review: APPROVE (aprovar), REQUEST_CHANGES (pedir mudanças) ou COMMENT (só comentar).',
          enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT']
        },
        body: { type: 'string', description: 'Texto da review. Obrigatório para REQUEST_CHANGES e COMMENT.' }
      },
      required: ['pull_request_number', 'event']
    }
  },
  {
    name: 'comment_pull_request',
    description: 'Adiciona um comentário geral na conversa de um pull request (não é uma review).',
    parameters: {
      type: 'object',
      properties: {
        pull_request_number: { type: 'string', description: 'Número do pull request.' },
        body: { type: 'string', description: 'Texto do comentário.' }
      },
      required: ['pull_request_number', 'body']
    }
  },
  {
    name: 'set_pull_request_state',
    description: 'Fecha um pull request sem mergear, ou reabre um que foi fechado.',
    parameters: {
      type: 'object',
      properties: {
        pull_request_number: { type: 'string', description: 'Número do pull request.' },
        state: { type: 'string', description: 'Novo estado do PR.', enum: ['open', 'closed'] }
      },
      required: ['pull_request_number', 'state']
    }
  },
  {
    name: 'merge_branch',
    description: 'Faz merge de outra branch para dentro da branch atual.',
    parameters: {
      type: 'object',
      properties: {
        source_branch: { type: 'string', description: 'Branch a ser mergeada na atual.' }
      },
      required: ['source_branch']
    }
  },
  {
    name: 'merge_abort',
    description:
      'Aborta um merge em andamento (git merge --abort), descartando a mesclagem e voltando o repositório ao estado anterior. Use quando o merge gerou conflitos que o usuário não quer resolver.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'commit',
    description:
      "Faz commit das mudanças staged usando uma mensagem gerada por IA (mesmo prompt do botão 'Compor com IA'). Se nada estiver staged, todas as mudanças pendentes são staged automaticamente antes do commit.",
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'undo_last_commit',
    description:
      'Desfaz o último commit local (git reset --soft HEAD~1): o commit sai do histórico e as mudanças dele voltam para o stage, sem perder nada. Só funciona se o commit ainda NÃO foi enviado ao remoto. Use, por exemplo, quando um push foi recusado porque o commit trouxe um arquivo que não deveria (arquivo grande, segredo) — depois, chame ignore_files e commit de novo.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'ignore_files',
    description:
      'Adiciona arquivos ou pastas ao .gitignore e, se já estiverem rastreados ou no stage, tira eles do Git (git rm --cached). Os arquivos continuam no disco. Use para arquivos que não devem ser versionados: backups, dumps de banco, binários grandes, segredos.',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'string',
          description: 'Caminhos relativos à raiz do repositório, separados por vírgula ou quebra de linha (ex: "backup.sql" ou "dumps/,logs/app.log").'
        }
      },
      required: ['paths']
    }
  },
  {
    name: 'resolve_conflict',
    description:
      'Propõe uma resolução de conflito de merge para um arquivo (a IA decide cada bloco marcado com <<<<<<<) para aprovação do usuário antes de aplicar. Se "path" for omitido e houver só um arquivo em conflito, resolve esse; se houver mais de um, retorna a lista para escolha.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo em conflito a resolver (relativo à raiz do repositório). Opcional se houver apenas um arquivo em conflito.' }
      },
      required: []
    }
  },
  {
    name: 'check_incoming_commits',
    description: 'Verifica se há commits novos no remoto SEM fazer pull (usa fetch --dry-run).',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_git_identity',
    description:
      'Lê a identidade Git configurada (user.name e user.email) nos níveis local (deste repositório) e global (deste computador). Use quando um commit falhar por identidade desconhecida ("Author identity unknown", "Please tell me who you are") ou quando o usuário perguntar qual nome/email está configurado.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'set_git_identity',
    description:
      'Configura user.name e/ou user.email no Git. Use "local" para aplicar somente a este repositório ou "global" para aplicar a todos os repositórios deste usuário na máquina. Se não estiver claro no pedido do usuário qual escopo ele quer, pergunte antes de chamar esta tool.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome a configurar (user.name). Opcional se só o email estiver sendo alterado.' },
        email: { type: 'string', description: 'Email a configurar (user.email). Opcional se só o nome estiver sendo alterado.' },
        scope: { type: 'string', description: 'Onde aplicar: "local" (só este repositório) ou "global" (toda a máquina).', enum: ['local', 'global'] }
      },
      required: ['scope']
    }
  },
  {
    name: 'list_files',
    description:
      'Lista os arquivos do repositório aberto que podem ser lidos (versionados no git, mais os novos ainda não commitados). Arquivos ignorados pelo .gitignore nunca aparecem. Use um padrão para filtrar — sem ele a lista pode ter milhares de arquivos.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Padrão no estilo do git pathspec, ex: "src/main/*.ts" ou "src/**/*.tsx". Opcional.'
        }
      },
      required: []
    }
  },
  {
    name: 'read_file',
    description:
      'Lê o conteúdo de um arquivo do repositório aberto, com as linhas numeradas. Arquivos ignorados pelo .gitignore são recusados (é onde ficam segredos), assim como binários. Para arquivos grandes, use start_line/end_line em vez de ler tudo.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo relativo à raiz do repositório.' },
        start_line: { type: 'string', description: 'Primeira linha a retornar (1-based). Opcional.' },
        end_line: { type: 'string', description: 'Última linha a retornar (inclusive). Opcional.' }
      },
      required: ['path']
    }
  },
  {
    name: 'read_changes',
    description:
      'Mostra o diff das alterações NÃO commitadas do working tree (o que git diff mostraria). Para ver o conteúdo de um commit já feito, use read_commit.',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Quais alterações incluir. Padrão: all.',
          enum: ['unstaged', 'staged', 'all']
        },
        path: { type: 'string', description: 'Limita o diff a um arquivo específico. Opcional.' }
      },
      required: []
    }
  },
  {
    name: 'list_all_repos',
    description: 'Lista os repositórios recentes disponíveis para operações globais.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'list_branches',
    description: 'Lista as branches do repositório aberto, indicando qual é a atual.',
    parameters: {
      type: 'object',
      properties: {
        include_remote: { type: 'string', description: 'Se deve incluir as branches remotas conhecidas localmente. Padrão: false.', enum: ['true', 'false'] }
      },
      required: []
    }
  },
  {
    name: 'list_branches_all_repos',
    description:
      'Lista as branches locais de cada repositório recente. Use para responder se algum repositório tem branches além da principal.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'list_unmerged_branches',
    description:
      'Compara cada branch (locais e as remotas sem cópia local) com a branch principal e diz quais ainda têm trabalho que não chegou nela e quais já estão integradas — inclusive as integradas por squash ou rebase merge, que o git sozinho ainda vê como "não mergeadas". Use quando o usuário perguntar o que falta mergear, o que já está na main ou quais branches podem ser apagadas. Usa as refs do último fetch: se o usuário quiser dados atuais do remoto, chame fetch_all antes.',
    parameters: {
      type: 'object',
      properties: {
        base_branch: {
          type: 'string',
          description: 'Branch com a qual comparar (ex: main, develop). Padrão: a branch padrão do remote (origin/main na maioria dos repositórios).'
        }
      },
      required: []
    }
  },
  {
    name: 'delete_merged_branches',
    description:
      'Apaga branches LOCAIS cujo trabalho já está todo na branch base (mergeadas, ou integradas por squash/rebase). Passe exatamente as branches que o usuário pediu — nunca acrescente outras por conta própria. Se o usuário pedir "todas as que já estão na main", chame list_unmerged_branches antes e passe só as que ela marcou como integradas. A tool recusa a chamada inteira se alguma branch tiver commits fora da base, for a atual, for só remota ou for protegida (main, master e a branch padrão nunca são apagadas). Não apaga nada no remoto.',
    parameters: {
      type: 'object',
      properties: {
        branch_names: { type: 'string', description: 'Branches locais a apagar, separadas por vírgula ou quebra de linha (ex: "feature/a, fix/b").' },
        base_branch: { type: 'string', description: 'Branch base usada na verificação. Padrão: a branch padrão do remote.' }
      },
      required: ['branch_names']
    }
  },
  {
    name: 'check_all_repos',
    description: 'Verifica em todos os repositórios recentes se há atualizações remotas pendentes.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'fetch_all',
    description: 'Executa fetch em todos os repositórios recentes com remote configurado.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'pull_repo',
    description: 'Executa pull em um repositório específico pelo caminho completo.',
    parameters: {
      type: 'object',
      properties: {
        repo_path: { type: 'string', description: 'Caminho completo do repositório.' }
      },
      required: ['repo_path']
    }
  },
  {
    name: 'pull_all',
    description: 'Executa pull em todos os repositórios que tiverem atualização remota detectada.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'push',
    description: 'Envia os commits da branch atual para o remote (origin). Configura o upstream automaticamente se a branch ainda não tiver.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'pull',
    description: 'Traz e aplica os commits novos do remote na branch atual.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'switch_branch',
    description: 'Faz checkout para outra branch existente.',
    parameters: {
      type: 'object',
      properties: {
        branch_name: { type: 'string', description: 'Nome da branch para qual mudar.' }
      },
      required: ['branch_name']
    }
  },
  {
    name: 'stash',
    description: 'Salva as mudanças não-commitadas em um stash, deixando o working tree limpo.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Descrição opcional do stash.' }
      },
      required: []
    }
  },
  {
    name: 'stash_pop',
    description: 'Aplica um stash de volta no working tree e o remove da lista. Por padrão usa o stash mais recente.',
    parameters: {
      type: 'object',
      properties: {
        stash_ref: { type: 'string', description: 'Referência do stash (ex: stash@{0}). Padrão: stash@{0}.' }
      },
      required: []
    }
  }
]

// ---------------------------------------------------------------------------
// Human-approval rules and the textual tool-calling fallback protocol.
// Ported from AiToolService.BuildRulesSection() / BuildSystemPromptSection().
// ---------------------------------------------------------------------------

export const TOOL_RULES_SECTION = `You have access to tools that can perform actions on the user's Git repository.

CRITICAL RULES:
1. NEVER fabricate or report a tool result. A tool only runs AFTER the user explicitly approves it.
2. Before each tool call, explain in plain text what you intend to do and why.
3. Call at most ONE tool per response. Wait for the result before chaining another tool.
4. If the user only asked a question, answer it — do NOT call a tool.
5. If the previous tool was cancelled by the user, do NOT immediately retry. Ask what they want instead.
6. Never end a response with only a stated intention ("I'll check...", "now I'll push...") and no tool call attached. If you're about to do something, attach the tool call for it in that same response — don't describe it and stop. The only reason to end a response without a tool call is because you're asking the user a question you need their answer to before continuing.
7. The approval card the app shows for each tool call IS the yes/no question. Never ask for permission in text ("Do you want me to run...?", "Should I...?") — call the tool and let the user approve or cancel it. You have no terminal: never offer to run commands in one, and never hand the user commands or buttons for something one of your tools does.
8. NEVER run, suggest or teach destructive Git commands, not even as a "manual step": push --force / --force-with-lease, reset --hard, checkout -- . / restore . over uncommitted work, filter-branch / filter-repo / BFG, rebase of pushed commits, clean -f / -fd / -fdx, stash drop / clear, branch -D (other than through delete_merged_branches, rule 9), deleting remote branches, reflog expire, gc --prune=now, deleting .git or re-cloning. A misread of the situation must never cost the user their repository. If only such a command would fix the problem, stop, explain what you found and the risk, and offer the safe alternatives that exist.
9. The ONLY way to delete branches is the delete_merged_branches tool, which re-verifies that each branch's work is already on the base and never deletes main, master or the default branch. Pass exactly the branches the user asked for — never add others on your own — and never try to delete a protected branch.`

// Only sent to providers that rejected a native `tools` array — teaching this
// textual format alongside native tools makes models blend the two and emit
// malformed JSON, exactly as the original C# comment warns.
export function buildTextualToolsPrompt(tools: ToolDefinition[]): string {
  const lines: string[] = [
    TOOL_RULES_SECTION,
    '',
    'To request a tool, append a SINGLE <tool_call> block at the END of your message in this exact format:',
    '',
    '<tool_call>',
    '{"tool":"<name>","args":{ ... }}',
    '</tool_call>',
    '',
    'The JSON must be valid and on a single line. Use ONLY the tool names listed below.',
    '',
    'Available tools:'
  ]

  for (const def of tools) {
    const params = Object.entries(def.parameters.properties)
    lines.push(`- ${def.name} — ${def.description}`)
    if (params.length === 0) {
      lines.push('  args: {}')
      continue
    }
    const argsList = params
      .map(([key, p]) => `"${key}"${def.parameters.required.includes(key) ? '' : '?'}: ${p.type}`)
      .join(', ')
    lines.push(`  args: { ${argsList} }`)
    for (const [key, p] of params) lines.push(`    - ${key}: ${p.description}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Textual tool-call parsing — the fallback path for providers without native
// function-calling. Ported from AiToolService's regexes + TryReadToolCallJson
// + SanitizeToolJson, tolerant of the same key aliases and malformed JSON
// quirks smaller/local models produce.
// ---------------------------------------------------------------------------

const TOOL_CALL_TAG_REGEX = /<\s*tool[_\- ]?call\s*>\s*(\{[\s\S]*?\})\s*<\s*\/\s*tool[_\- ]?call\s*>/i
const FENCED_TOOL_CALL_REGEX = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i
const TOOL_NAME_KEYS = ['tool', 'name', 'tool_name', 'toolname']
const TOOL_ARGS_KEYS = ['args', 'arguments', 'parameters', 'params', 'input']
const TOOL_WRAPPER_KEYS = ['function', 'tool_call', 'toolcall', 'tool_use']

// Raw control characters inside a JSON string are illegal, and models do
// emit them mid-token (e.g. {"\ntool": "list_all_repos"}) — drop them
// instead of losing the whole call to a parse error.
function sanitizeToolJson(raw: string): string {
  let result = ''
  let inString = false
  let escaped = false

  for (const c of raw) {
    if (escaped) {
      result += c
      escaped = false
      continue
    }
    if (inString && c === '\\') {
      result += c
      escaped = true
      continue
    }
    if (c === '"') {
      inString = !inString
      result += c
      continue
    }
    if (inString && (c === '\n' || c === '\r' || c === '\t')) continue
    result += c
  }

  return result.trim()
}

function findKey(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === key.toLowerCase()) return obj[k]
    }
  }
  return undefined
}

function readToolCallObject(obj: Record<string, unknown>): ToolCallRequest | null {
  let current = obj

  // Unwrap nesting such as {"function":{"name":...,"arguments":...}}.
  for (let depth = 0; depth < 3; depth++) {
    const name = findKey(current, TOOL_NAME_KEYS)
    if (typeof name === 'string' && name.trim()) {
      const argsRaw = findKey(current, TOOL_ARGS_KEYS)
      const args: Record<string, string> = {}

      if (argsRaw && typeof argsRaw === 'object') {
        for (const [k, v] of Object.entries(argsRaw as Record<string, unknown>)) args[k] = String(v)
      } else if (typeof argsRaw === 'string') {
        // OpenAI-compatible servers deliver arguments as a JSON string.
        try {
          const inner = JSON.parse(sanitizeToolJson(argsRaw))
          for (const [k, v] of Object.entries(inner)) args[k] = String(v)
        } catch {
          // malformed nested args — proceed with an empty args object
        }
      }

      return { id: `textual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), arguments: args }
    }

    const wrapper = findKey(current, TOOL_WRAPPER_KEYS)
    if (wrapper && typeof wrapper === 'object') {
      current = wrapper as Record<string, unknown>
      continue
    }
    return null
  }

  return null
}

export function parseTextualToolCall(text: string): { call: ToolCallRequest | null; textWithoutCall: string } {
  if (!text) return { call: null, textWithoutCall: text }

  let match = TOOL_CALL_TAG_REGEX.exec(text)
  if (!match) match = FENCED_TOOL_CALL_REGEX.exec(text)
  if (!match) return { call: null, textWithoutCall: text }

  const jsonText = match[1]
  try {
    const parsed = JSON.parse(sanitizeToolJson(jsonText))
    const call = parsed && typeof parsed === 'object' ? readToolCallObject(parsed) : null
    if (!call) return { call: null, textWithoutCall: text }
    const textWithoutCall = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim()
    return { call, textWithoutCall }
  } catch {
    return { call: null, textWithoutCall: text }
  }
}

// True when the text carries something that looks like a tool-call attempt,
// whether or not it actually parses — lets the caller report a malformed
// call instead of silently dropping the raw block into the chat.
export function looksLikeToolCall(text: string): boolean {
  return TOOL_CALL_TAG_REGEX.test(text)
}
