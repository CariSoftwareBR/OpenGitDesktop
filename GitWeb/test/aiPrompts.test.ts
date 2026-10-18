import { describe, expect, it } from 'vitest'
import { extractRejectedLargeFiles, formatFileLocationFacts, selectScmSkills } from '../src/shared/aiPrompts'

const user = (content: string) => ({ role: 'user' as const, content })

const GH001_PUSH_ERROR =
  "remote: error: File backup-antes-multiempresa.sql is 520.54 MB; this exceeds GitHub's file size limit of 100.00 MB " +
  'remote: error: GH001: Large files detected. ! [remote rejected] main -> main (pre-receive hook declined) ' +
  "error: failed to push some refs to 'https://github.com/owner/repo.git'"

describe('selectScmSkills — unwanted-file', () => {
  it('loads alone for a GH001 push rejection, even though the text also says push', () => {
    expect(selectScmSkills([user(GH001_PUSH_ERROR)])).toEqual(['unwanted-file'])
  })

  it('loads alone for a plain-language request', () => {
    expect(selectScmSkills([user('commitei sem querer um arquivo muito grande, resolve')])).toEqual(['unwanted-file'])
    expect(selectScmSkills([user('esse arquivo não devia ter sido commitado')])).toEqual(['unwanted-file'])
  })

  it('stays loaded while its tools are in use, after the error scrolls out of view', () => {
    const skills = selectScmSkills([
      user(GH001_PUSH_ERROR),
      user('ok'),
      user('pode seguir'),
      user('sim'),
      user('agora faz o push'),
      { role: 'assistant', content: '', toolCalls: [{ call: { name: 'undo_last_commit' } }] }
    ])
    expect(skills).toEqual(['unwanted-file'])
  })

  it('lets other skills back in when the user moves on to another task', () => {
    const skills = selectScmSkills([
      user(GH001_PUSH_ERROR),
      { role: 'assistant', content: '', toolCalls: [{ call: { name: 'ignore_files' } }] },
      user('agora tenho um conflito no merge da feature')
    ])
    expect(skills).toContain('merge-branch')
  })

  it('drops out once its error and tool calls leave the recent window', () => {
    const skills = selectScmSkills([
      user(GH001_PUSH_ERROR),
      { role: 'assistant', content: '', toolCalls: [{ call: { name: 'ignore_files' } }] },
      user('quem mais mexe no projeto?'),
      user('e os hotspots?'),
      user('quais os riscos?'),
      user('resolve o conflito do merge')
    ])
    expect(skills).not.toContain('unwanted-file')
    expect(skills).toContain('merge-branch')
  })

  it('stays out of everyday Git requests', () => {
    expect(selectScmSkills([user('faz o commit e o push')])).toEqual(['git-workflow'])
    expect(selectScmSkills([user('o push deu erro de non-fast-forward')])).not.toContain('unwanted-file')
  })
})

describe('extractRejectedLargeFiles', () => {
  it('reads the path GitHub named in the GH001 rejection', () => {
    expect(extractRejectedLargeFiles(GH001_PUSH_ERROR)).toEqual(['backup-antes-multiempresa.sql'])
  })

  it('handles folders and several files, without duplicates', () => {
    const text =
      'remote: error: File dumps/a.sql is 120.00 MB; this exceeds GitHub\'s file size limit of 100.00 MB\n' +
      'remote: error: File bin/app.exe is 300.5 MB; this exceeds GitHub\'s file size limit of 100.00 MB\n' +
      'remote: error: File dumps/a.sql is 120.00 MB; this exceeds GitHub\'s file size limit of 100.00 MB'
    expect(extractRejectedLargeFiles(text)).toEqual(['dumps/a.sql', 'bin/app.exe'])
  })

  it('finds nothing in unrelated errors', () => {
    expect(extractRejectedLargeFiles('! [rejected] main -> main (fetch first)')).toEqual([])
  })
})

describe('formatFileLocationFacts', () => {
  const base = {
    path: 'backup.sql',
    upstream: 'origin/main',
    localCommits: [{ shortHash: 'a0381ad', summary: 'Consertando migration' }],
    undoCount: 1,
    onRemote: false,
    existsOnDisk: false,
    ignored: false
  }

  it('states the file is local only, warns about the only copy and names the next tool', () => {
    const text = formatFileLocationFacts('pt-BR', [base])
    expect(text).toContain('SOMENTE')
    expect(text).toContain('a0381ad')
    expect(text).toContain('NÃO está em origin/main')
    expect(text).toContain('única cópia')
    expect(text).toContain('undo_last_commit (1 vez(es)')
  })

  it('moves on to ignore_files once the commit is undone, then to commit/push once ignored', () => {
    const undone = { ...base, localCommits: [], undoCount: 0 }
    expect(formatFileLocationFacts('pt-BR', [undone])).toContain('Próximo passo: ignore_files')
    expect(formatFileLocationFacts('pt-BR', [{ ...undone, ignored: true }])).toContain('Próximo passo: commit')
  })

  it('still undoes the local commits when an earlier version of the path is on the remote', () => {
    const text = formatFileLocationFacts('en', [{ ...base, onRemote: true }])
    expect(text).toContain('An earlier version of backup.sql already exists on origin/main')
    expect(text).toContain('ONLY in local commit(s)')
    expect(text).toContain('Next step: undo_last_commit (1 time(s)')
  })

  it('moves on to ignore_files after the undo even when an earlier version is on the remote', () => {
    const text = formatFileLocationFacts('en', [{ ...base, onRemote: true, localCommits: [], undoCount: 0 }])
    expect(text).toContain('Next step: ignore_files')
    expect(text).not.toContain('Next step: undo_last_commit')
  })

  it('is empty with no files', () => {
    expect(formatFileLocationFacts('pt-BR', [])).toBe('')
  })
})
