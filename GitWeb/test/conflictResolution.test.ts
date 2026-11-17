import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendChatRequest = vi.fn()
vi.stubGlobal('window', { api: { ai: { sendChatRequest } } })
vi.stubGlobal('navigator', { languages: ['pt-BR'] })

const { attachBaseLines, findDuplicateKeys, findLostChanges, keyStyleFor, keysDuplicatedByBoth, parseConflictBlocks, renderResolvedWithChoices } =
  await import(
  '../src/renderer/src/lib/conflicts'
)
const { findResolutionProblems, generateConflictResolution } = await import('../src/renderer/src/lib/ai/conflictResolution')

const CONFIG_CONFLICT = [
  'const config = {',
  '<<<<<<< HEAD',
  '  porta: 8080,',
  "  host: '127.0.0.1',",
  '  cors: true,',
  "  log: 'warn'",
  '=======',
  '  porta: 3000,',
  '  timeout: 10000,',
  '  tentativas: 3,',
  "  log: 'info'",
  '>>>>>>> feature/timeout-retry',
  '}'
].join('\n')

const config = { provider: 'local', model: 'm', apiBaseUrl: 'http://x', reasoningEffort: 'low' } as const

function conflictBlock(content: string) {
  const block = parseConflictBlocks(content).find((b) => b.type === 'conflict')
  if (!block || block.type !== 'conflict') throw new Error('no conflict block')
  return block
}

describe('parseConflictBlocks with a merge base', () => {
  it('reads the diff3 ||||||| section as the base, not as part of ours', () => {
    const content = ['<<<<<<< HEAD', 'a: 2', '||||||| base', 'a: 1', '=======', 'a: 3', '>>>>>>> other'].join('\n')
    expect(conflictBlock(content)).toMatchObject({ ours: ['a: 2'], base: ['a: 1'], theirs: ['a: 3'] })
  })

  it('leaves base out for the default conflict style', () => {
    expect(conflictBlock(CONFIG_CONFLICT).base).toBeUndefined()
  })
})

describe('attachBaseLines', () => {
  const diff3 = ['x', '<<<<<<< ours', 'a: 2', '||||||| base', 'a: 1', '=======', 'a: 3', '>>>>>>> theirs', 'y'].join('\n')

  it('copies the base onto the matching block, ignoring CRLF', () => {
    const working = ['x\r', '<<<<<<< HEAD\r', 'a: 2\r', '=======\r', 'a: 3\r', '>>>>>>> feature\r', 'y'].join('\n')
    const [, block] = attachBaseLines(parseConflictBlocks(working), diff3)
    expect(block).toMatchObject({ type: 'conflict', base: ['a: 1'] })
  })

  it('leaves a block it cannot match without a base', () => {
    const edited = ['<<<<<<< HEAD', 'a: 9', '=======', 'a: 3', '>>>>>>> feature'].join('\n')
    expect(conflictBlock(edited).base).toBeUndefined()
    const [block] = attachBaseLines(parseConflictBlocks(edited), diff3)
    expect(block.type === 'conflict' && block.base).toBeUndefined()
  })
})

describe('renderResolvedWithChoices line endings', () => {
  it('gives model-written lines the CRLF the file uses', () => {
    const crlf = ['{\r', '<<<<<<< HEAD\r', '  a: 1,\r', '=======\r', '  b: 2,\r', '>>>>>>> other\r', '}\r', ''].join('\n')
    const out = renderResolvedWithChoices(parseConflictBlocks(crlf), new Map([[0, { text: ['  a: 1,', '  b: 2,'] }]]))
    expect(out).toBe('{\r\n  a: 1,\r\n  b: 2,\r\n}\r\n')
  })

  it('keeps LF files as LF', () => {
    const out = renderResolvedWithChoices(parseConflictBlocks(CONFIG_CONFLICT), new Map([[0, { text: ['  porta: 8080'] }]]))
    expect(out).not.toContain('\r')
  })
})

describe('findLostChanges', () => {
  // The real case: HEAD changed porta/host/log and added cors; the feature
  // changed timeout and added tentativas.
  const block = {
    ...conflictBlock(
      [
        '<<<<<<< HEAD',
        '  porta: 8080,',
        "  host: '127.0.0.1',",
        '  timeout: 5000,',
        '  cors: true,',
        "  log: 'warn'",
        '=======',
        '  porta: 3000,',
        "  host: 'localhost',",
        '  timeout: 10000,',
        '  tentativas: 3,',
        "  log: 'info'",
        '>>>>>>> feature/timeout-retry'
      ].join('\n')
    ),
    base: ['  porta: 3000,', "  host: 'localhost',", '  timeout: 5000,', "  log: 'info'"]
  }

  it('flags the values a merge put back to the original', () => {
    const proposal = ['  porta: 3000,', "  host: 'localhost',", '  timeout: 10000,', "  log: 'info',", '  cors: true,', '  tentativas: 3']
    expect(findLostChanges(block, proposal, 'js')).toEqual([{ side: 'ours', lines: ['porta: 8080', "host: '127.0.0.1'", "log: 'warn'"] }])
  })

  it('accepts the merge that keeps every one-sided change', () => {
    const right = ['  porta: 8080,', "  host: '127.0.0.1',", '  timeout: 10000,', '  cors: true,', '  tentativas: 3,', "  log: 'warn'"]
    expect(findLostChanges(block, right, 'js')).toEqual([])
  })

  it('does not judge a dropped addition: it may be a rename', () => {
    const noTentativas = ['  porta: 8080,', "  host: '127.0.0.1',", '  timeout: 10000,', '  cors: true,', "  log: 'warn'"]
    expect(findLostChanges(block, noTentativas, 'js')).toEqual([])
  })

  it('accepts a renamed key that combines both changes', () => {
    // base timeout: 5, ours bumps it, theirs renames it to timeoutMs.
    const renamed = {
      ...conflictBlock(['<<<<<<< a', '  timeout: 10,', '=======', '  timeoutMs: 5000,', '>>>>>>> b'].join('\n')),
      base: ['  timeout: 5,']
    }
    expect(findLostChanges(renamed, ['  timeoutMs: 10000,'], 'js')).toEqual([])
  })

  it('leaves a key both sides changed to the model', () => {
    const both = { ...conflictBlock(['<<<<<<< a', 'x: 2', '=======', 'x: 3', '>>>>>>> b'].join('\n')), base: ['x: 1'] }
    expect(findLostChanges(both, ['x: 3'], 'yaml')).toEqual([])
  })

  it('needs the merge base and a known file type', () => {
    expect(findLostChanges(conflictBlock(CONFIG_CONFLICT), ['  porta: 1'], 'js')).toEqual([])
    expect(findLostChanges(block, ['  porta: 3000,'], null)).toEqual([])
  })
})

describe('keyStyleFor', () => {
  it('knows config and object-literal files, and nothing else', () => {
    expect(keyStyleFor('package.json')).toBe('json')
    expect(keyStyleFor('.github/workflows/ci.yml')).toBe('yaml')
    expect(keyStyleFor('src/config.ts')).toBe('js')
    expect(keyStyleFor('.env')).toBe('env')
    expect(keyStyleFor('.env.local')).toBe('env')
    expect(keyStyleFor('settings.ini')).toBe('env')
    expect(keyStyleFor('app.py')).toBeNull()
    expect(keyStyleFor('README.md')).toBeNull()
    expect(keyStyleFor('run.sh')).toBeNull()
  })
})

describe('findDuplicateKeys', () => {
  it('flags a key written twice in one object', () => {
    expect(findDuplicateKeys(['  a: 1,', '  b: 2,', '  a: 3'], 'js')).toEqual(['a'])
    expect(findDuplicateKeys(['  "name": "x",', '  "name": "y"'], 'json')).toEqual(['name'])
    expect(findDuplicateKeys(['API_URL=a', 'API_URL=b'], 'env')).toEqual(['API_URL'])
  })

  it('accepts the same key under different parents', () => {
    // docker-compose services
    expect(findDuplicateKeys(['  web:', '    image: a', '    restart: always', '  worker:', '    image: b', '    restart: always'], 'yaml')).toEqual([])
    // GitHub Actions jobs
    expect(findDuplicateKeys(['  build:', '    runs-on: ubuntu', '    steps: []', '  test:', '    runs-on: ubuntu', '    steps: []'], 'yaml')).toEqual([])
    // nested i18n keys
    expect(findDuplicateKeys(['save:', '  title: Salvar', 'open:', '  title: Abrir'], 'yaml')).toEqual([])
  })

  it('accepts the same key in separate objects or list items', () => {
    expect(findDuplicateKeys(['  {', '    name: "a",', '  },', '  {', '    name: "b",', '  }'], 'js')).toEqual([])
    expect(findDuplicateKeys(['- name: a', '  version: 1', '- name: b', '  version: 2'], 'yaml')).toEqual([])
    expect(findDuplicateKeys(['  - uses: x', '    with: 1', '  - uses: y', '    with: 2'], 'yaml')).toEqual([])
    expect(findDuplicateKeys(['[a]', 'port=1', '[b]', 'port=2'], 'env')).toEqual([])
  })

  it('ignores different indentation, URLs, comments and switch labels', () => {
    expect(findDuplicateKeys(['a: 1', '  a: 2'], 'yaml')).toEqual([])
    expect(findDuplicateKeys(['  url: https://a', '  # url: old', '  other: 1'], 'yaml')).toEqual([])
    expect(findDuplicateKeys(['    default:', '      return 1', '    default:'], 'js')).toEqual([])
  })

  it('checks nothing for unknown file types', () => {
    expect(findDuplicateKeys(['df = df.dropna()', 'df = df.rename()'], null)).toEqual([])
  })
})

describe('keysDuplicatedByBoth', () => {
  it('lists the keys that keeping both sides would repeat', () => {
    expect(keysDuplicatedByBoth(conflictBlock(CONFIG_CONFLICT), 'js').sort()).toEqual(['log', 'porta'])
  })

  it('is empty when the sides add different keys or whole sibling objects', () => {
    const content = ['{', '<<<<<<< HEAD', '  a: 1,', '=======', '  b: 2,', '>>>>>>> other', '}'].join('\n')
    expect(keysDuplicatedByBoth(conflictBlock(content), 'js')).toEqual([])
    const services = ['services:', '<<<<<<< HEAD', '  web:', '    image: a', '=======', '  worker:', '    image: b', '>>>>>>> other'].join('\n')
    expect(keysDuplicatedByBoth(conflictBlock(services), 'yaml')).toEqual([])
  })
})

describe('parseConflictBlocks and 7 pipes', () => {
  it('keeps an unlabeled line of 7 pipes as content', () => {
    const content = ['<<<<<<< HEAD', '| a | b |', '|||||||', '| 1 | 2 |', '=======', 'x', '>>>>>>> other'].join('\n')
    const block = conflictBlock(content)
    expect(block.ours).toEqual(['| a | b |', '|||||||', '| 1 | 2 |'])
    expect(block.base).toBeUndefined()
  })
})

describe('attachBaseLines with repeated blocks', () => {
  it('gives each block its own base, in order', () => {
    const diff3 = [
      '<<<<<<< ours', 'v: 2', '||||||| base', 'v: 1', '=======', 'v: 3', '>>>>>>> theirs',
      'mid',
      '<<<<<<< ours', 'v: 2', '||||||| base', 'v: 0', '=======', 'v: 3', '>>>>>>> theirs'
    ].join('\n')
    const working = ['<<<<<<< HEAD', 'v: 2', '=======', 'v: 3', '>>>>>>> b', 'mid', '<<<<<<< HEAD', 'v: 2', '=======', 'v: 3', '>>>>>>> b'].join('\n')
    const bases = attachBaseLines(parseConflictBlocks(working), diff3)
      .filter((b) => b.type === 'conflict')
      .map((b) => (b.type === 'conflict' ? b.base : undefined))
    expect(bases).toEqual([['v: 1'], ['v: 0']])
  })
})

describe('renderResolvedWithChoices line endings, whole file', () => {
  it('uses CRLF for a block whose sides are empty', () => {
    const crlf = ['a\r', '<<<<<<< HEAD\r', '=======\r', '>>>>>>> other\r', 'z\r', ''].join('\n')
    const out = renderResolvedWithChoices(parseConflictBlocks(crlf), new Map([[0, { text: ['x', 'y'] }]]))
    expect(out).toBe('a\r\nx\r\ny\r\nz\r\n')
  })
})

describe('findResolutionProblems', () => {
  const blocks = parseConflictBlocks(CONFIG_CONFLICT)

  it('flags "both" when it repeats keys', () => {
    expect(findResolutionProblems('config.js', blocks, [{ id: 0, choice: 'both' }])).toEqual([
      { kind: 'duplicateKeys', blockId: 0, keys: ['porta', 'log'] }
    ])
  })

  it('does not check key repetition in code files it does not know', () => {
    expect(findResolutionProblems('config.py', blocks, [{ id: 0, choice: 'both' }])).toEqual([])
  })

  it('accepts a custom merge that writes each key once', () => {
    const text = ['  porta: 8080,', "  host: '127.0.0.1',", '  cors: true,', '  timeout: 10000,', '  tentativas: 3,', "  log: 'warn'"]
    expect(findResolutionProblems('config.js', blocks, [{ id: 0, choice: 'custom', text }])).toEqual([])
  })

  it('flags a custom merge that still repeats a key', () => {
    const text = ['  porta: 8080,', '  porta: 3000,', "  log: 'warn'"]
    expect(findResolutionProblems('config.js', blocks, [{ id: 0, choice: 'custom', text }])).toEqual([
      { kind: 'duplicateKeys', blockId: 0, keys: ['porta'] }
    ])
  })

  it('accepts keeping both docker-compose services', () => {
    const compose = ['services:', '<<<<<<< HEAD', '  web:', '    image: a', '=======', '  worker:', '    image: b', '>>>>>>> other'].join('\n')
    expect(findResolutionProblems('docker-compose.yml', parseConflictBlocks(compose), [{ id: 0, choice: 'both' }])).toEqual([])
  })

  it('flags a JSON file that stops parsing', () => {
    const json = ['{', '  "a": 1,', '<<<<<<< HEAD', '  "b": 2', '=======', '  "c": 3', '>>>>>>> other', '}'].join('\n')
    expect(findResolutionProblems('package.json', parseConflictBlocks(json), [{ id: 0, choice: 'both' }])).toEqual([
      { kind: 'invalidJson' }
    ])
    expect(findResolutionProblems('package.json', parseConflictBlocks(json), [{ id: 0, choice: 'ours' }])).toEqual([])
  })

  it('skips the JSON check when neither side parses (JSON with comments)', () => {
    const jsonc = ['{', '  // comment', '<<<<<<< HEAD', '  "b": 2', '=======', '  "c": 3', '>>>>>>> other', '}'].join('\n')
    expect(findResolutionProblems('tsconfig.json', parseConflictBlocks(jsonc), [{ id: 0, choice: 'both' }])).toEqual([])
  })
})

describe('generateConflictResolution', () => {
  const blocks = parseConflictBlocks(CONFIG_CONFLICT)
  const bothAnswer = JSON.stringify({ decisions: [{ id: 0, choice: 'both' }], summary: 'mantive os dois' })
  const fixedAnswer = JSON.stringify({
    decisions: [{ id: 0, choice: 'custom', text: ['  porta: 8080,', '  timeout: 10000,', "  log: 'warn'"] }],
    summary: 'combinei os dois lados'
  })

  beforeEach(() => sendChatRequest.mockReset())

  it('sends the config it is given, effort included', async () => {
    sendChatRequest.mockResolvedValueOnce({ content: fixedAnswer, toolCalls: [] })
    await generateConflictResolution(config, '', 'config.js', blocks)
    expect(sendChatRequest.mock.calls[0][0]).toEqual(config)
  })

  it('asks once more when the first proposal has problems, and keeps the fix', async () => {
    sendChatRequest
      .mockResolvedValueOnce({ content: bothAnswer, toolCalls: [] })
      .mockResolvedValueOnce({ content: fixedAnswer, toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', blocks)

    expect(sendChatRequest).toHaveBeenCalledTimes(2)
    const followUp = sendChatRequest.mock.calls[1][2].at(-1).content as string
    expect(followUp).toContain('porta, log')
    expect(result.decisions[0].choice).toBe('custom')
    expect(result.problems).toEqual([])
    expect(result.summary).toBe('combinei os dois lados')
  })

  it('keeps the first proposal, problems flagged, when the retry is unusable', async () => {
    sendChatRequest
      .mockResolvedValueOnce({ content: bothAnswer, toolCalls: [] })
      .mockResolvedValueOnce({ content: 'não sei', toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', blocks)

    expect(result.decisions[0].choice).toBe('both')
    expect(result.problems).toEqual([{ kind: 'duplicateKeys', blockId: 0, keys: ['porta', 'log'] }])
  })

  it('sends back which one-sided changes the proposal lost', async () => {
    const withBase = blocks.map((b) =>
      b.type === 'conflict' ? { ...b, base: ['  porta: 3000,', "  log: 'info'"] } : b
    )
    const lossy = JSON.stringify({
      decisions: [{ id: 0, choice: 'custom', text: ['  porta: 3000,', "  host: '127.0.0.1',", '  cors: true,', '  timeout: 10000,', '  tentativas: 3,', "  log: 'warn'"] }],
      summary: 'x'
    })
    sendChatRequest
      .mockResolvedValueOnce({ content: lossy, toolCalls: [] })
      .mockResolvedValueOnce({ content: lossy, toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', withBase)

    expect(sendChatRequest.mock.calls[1][2].at(-1).content).toContain('only the "HEAD" side changed them')
    expect(result.problems).toEqual([{ kind: 'lostChange', blockId: 0, sideLabel: 'HEAD', lines: ['porta: 8080'] }])
  })

  it('shows the model the merge base when the block has one', async () => {
    sendChatRequest.mockResolvedValue({ content: fixedAnswer, toolCalls: [] })
    const withBase = blocks.map((b) => (b.type === 'conflict' ? { ...b, base: ['  porta: 3000,', "  log: 'info'"] } : b))
    await generateConflictResolution(config, '', 'config.js', withBase)
    expect(sendChatRequest.mock.calls[0][2][1].content).toContain("Original (merge base, before either side changed it):\n  porta: 3000,\n  log: 'info'")

    sendChatRequest.mockClear()
    await generateConflictResolution(config, '', 'config.js', blocks)
    expect(sendChatRequest.mock.calls[0][2][1].content).not.toContain('Original (merge base')
  })

  it('keeps the first answer when the retry only trades one problem for another', async () => {
    const otherDuplicate = JSON.stringify({
      decisions: [{ id: 0, choice: 'custom', text: ['  porta: 8080,', '  tentativas: 3,', '  tentativas: 3,', "  log: 'warn'"] }],
      summary: 'y'
    })
    const onlyPorta = JSON.stringify({
      decisions: [{ id: 0, choice: 'custom', text: ['  porta: 8080,', '  porta: 3000,', "  log: 'warn'"] }],
      summary: 'x'
    })
    sendChatRequest
      .mockResolvedValueOnce({ content: onlyPorta, toolCalls: [] })
      .mockResolvedValueOnce({ content: otherDuplicate, toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', blocks)
    expect(result.summary).toBe('x')
    expect(result.problems).toEqual([{ kind: 'duplicateKeys', blockId: 0, keys: ['porta'] }])
  })

  it('treats an unknown choice as a missing block instead of crashing', async () => {
    sendChatRequest.mockResolvedValueOnce({ content: JSON.stringify({ decisions: [{ id: 0, choice: 'merge' }], summary: 'z' }), toolCalls: [] })
    await expect(generateConflictResolution(config, '', 'config.js', blocks)).rejects.toThrow()
  })

  it('uses the first decision when a block is answered twice', async () => {
    const twice = JSON.stringify({ decisions: [{ id: 0, choice: 'ours' }, { id: 0, choice: 'both' }], summary: 'w' })
    sendChatRequest.mockResolvedValueOnce({ content: twice, toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', blocks)
    expect(result.decisions).toEqual([{ id: 0, choice: 'ours', text: undefined }])
  })

  it('does not retry a clean proposal', async () => {
    sendChatRequest.mockResolvedValueOnce({ content: fixedAnswer, toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', blocks)
    expect(sendChatRequest).toHaveBeenCalledTimes(1)
    expect(result.problems).toEqual([])
  })
})
