import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendChatRequest = vi.fn()
vi.stubGlobal('window', { api: { ai: { sendChatRequest } } })
vi.stubGlobal('navigator', { languages: ['pt-BR'] })

const { attachBaseLines, findDuplicateKeys, findLostChanges, keysDuplicatedByBoth, parseConflictBlocks, renderResolvedWithChoices } = await import(
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
    expect(findLostChanges(block, proposal)).toEqual([{ side: 'ours', lines: ['porta: 8080', "host: '127.0.0.1'", "log: 'warn'"] }])
  })

  it('accepts the merge that keeps every one-sided change', () => {
    const right = ['  porta: 8080,', "  host: '127.0.0.1',", '  timeout: 10000,', '  cors: true,', '  tentativas: 3,', "  log: 'warn'"]
    expect(findLostChanges(block, right)).toEqual([])
  })

  it('flags a key only one side added that went missing', () => {
    const noTentativas = ['  porta: 8080,', "  host: '127.0.0.1',", '  timeout: 10000,', '  cors: true,', "  log: 'warn'"]
    expect(findLostChanges(block, noTentativas)).toEqual([{ side: 'theirs', lines: ['tentativas: 3'] }])
  })

  it('leaves a key both sides changed to the model', () => {
    const both = { ...conflictBlock(['<<<<<<< a', 'x: 2', '=======', 'x: 3', '>>>>>>> b'].join('\n')), base: ['x: 1'] }
    expect(findLostChanges(both, ['x: 3'])).toEqual([])
  })

  it('needs the merge base', () => {
    expect(findLostChanges(conflictBlock(CONFIG_CONFLICT), ['  porta: 1'])).toEqual([])
  })
})

describe('findDuplicateKeys', () => {
  it('flags a key written twice in one object', () => {
    expect(findDuplicateKeys(['  a: 1,', '  b: 2,', '  a: 3'])).toEqual(['a'])
  })

  it('reads JSON, assignments and .env lines', () => {
    expect(findDuplicateKeys(['  "name": "x",', '  "name": "y"'])).toEqual(['name'])
    expect(findDuplicateKeys(['const port = 1', 'const port = 2'])).toEqual(['port'])
    expect(findDuplicateKeys(['API_URL=a', 'API_URL=b'])).toEqual(['API_URL'])
  })

  it('accepts the same key in separate objects or list items', () => {
    expect(findDuplicateKeys(['  {', '    name: "a",', '  },', '  {', '    name: "b",', '  }'])).toEqual([])
    expect(findDuplicateKeys(['- name: a', '  version: 1', '- name: b', '  version: 2'])).toEqual([])
  })

  it('ignores different indentation, comparisons and arrows', () => {
    expect(findDuplicateKeys(['a: 1', '  a: 2'])).toEqual([])
    expect(findDuplicateKeys(['x == y', 'x == z', 'f => 1', 'f => 2'])).toEqual([])
  })

  it('ignores keywords that repeat legitimately', () => {
    expect(findDuplicateKeys(['else:', '    pass', 'else:'])).toEqual([])
  })
})

describe('keysDuplicatedByBoth', () => {
  it('lists the keys that keeping both sides would repeat', () => {
    expect(keysDuplicatedByBoth(conflictBlock(CONFIG_CONFLICT)).sort()).toEqual(['log', 'porta'])
  })

  it('is empty when the sides add different keys', () => {
    const content = ['{', '<<<<<<< HEAD', '  a: 1,', '=======', '  b: 2,', '>>>>>>> other', '}'].join('\n')
    expect(keysDuplicatedByBoth(conflictBlock(content))).toEqual([])
  })
})

describe('findResolutionProblems', () => {
  const blocks = parseConflictBlocks(CONFIG_CONFLICT)

  it('flags "both" when it repeats keys', () => {
    expect(findResolutionProblems('config.js', blocks, [{ id: 0, choice: 'both' }])).toEqual([
      { kind: 'duplicateKeys', blockId: 0, keys: ['porta', 'log'] }
    ])
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

    expect(sendChatRequest.mock.calls[1][2].at(-1).content).toContain('only the "HEAD" side changed these')
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

  it('does not retry a clean proposal', async () => {
    sendChatRequest.mockResolvedValueOnce({ content: fixedAnswer, toolCalls: [] })
    const result = await generateConflictResolution(config, '', 'config.js', blocks)
    expect(sendChatRequest).toHaveBeenCalledTimes(1)
    expect(result.problems).toEqual([])
  })
})
