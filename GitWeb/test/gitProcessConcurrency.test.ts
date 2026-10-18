import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({ spawn: vi.fn() }))
vi.mock('electron', () => ({ shell: { trashItem: vi.fn() } }))
vi.mock('../src/main/credentials', () => ({ getSecret: vi.fn(async () => null) }))

const { runGit, undoUnpublishedCommit } = await import('../src/main/gitProcess')

it('waits for an in-flight push before checking whether the approved commit can be undone', async () => {
  let published = false
  let finishPush!: () => void
  let signalPush!: () => void
  const pushStarted = new Promise<void>((resolve) => { signalPush = resolve })
  const commands: string[] = []

  vi.mocked(spawn).mockImplementation((_command, args) => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn()
    })
    const argv = args as string[]
    const finish = (stdout = '', exitCode = 0): void => {
      child.stdout.write(stdout)
      child.emit('close', exitCode)
    }

    queueMicrotask(() => {
      commands.push(argv.join(' '))
      if (argv[0] === 'push') {
        finishPush = () => {
          published = true
          commands.push('push completed')
          finish()
        }
        signalPush()
      } else if (argv[0] === 'rev-list') {
        finish(published ? '' : 'approved-hash\n')
      } else if (argv.includes('MERGE_HEAD')) {
        finish('', 1)
      } else if (argv[0] === 'rev-parse') {
        finish(argv.includes('HEAD~1') ? 'parent-hash\n' : 'approved-hash\n')
      } else if (argv[0] === 'reset') {
        finish()
      } else {
        child.stderr.write(`Unexpected command: ${argv.join(' ')}`)
        finish('', 1)
      }
    })
    return child as ChildProcessWithoutNullStreams
  })

  const pushing = runGit(['push'], 'queued-push-repo')
  await pushStarted
  // Capture the outcome immediately to avoid an unhandled rejection. The fake
  // push stays in flight through a full event-loop turn: unqueued checks would
  // complete against the old refs and put a stale reset behind it.
  const undoing = undoUnpublishedCommit('queued-push-repo', 'approved-hash').then(
    () => null,
    (error: Error) => error
  )
  await new Promise<void>((resolve) => setImmediate(resolve))
  finishPush()
  await pushing
  const error = await undoing

  expect(error?.message).toMatch(/já foi enviado/)
  expect(commands).not.toContain('reset --soft HEAD~1')
  expect(commands.indexOf('rev-parse --verify HEAD')).toBeGreaterThan(commands.indexOf('push completed'))
  // Rejection releases the queue rather than stranding subsequent operations.
  expect((await runGit(['rev-parse', 'HEAD'], 'queued-push-repo')).exitCode).toBe(0)
})
