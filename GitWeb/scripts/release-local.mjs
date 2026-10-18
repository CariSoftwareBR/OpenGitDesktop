// Publica uma release do Windows a partir da máquina local.
//
// Existe porque a cota mensal de GitHub Actions do repositório se esgotou e os
// workflows não conseguem empacotar até ela renovar. Reproduz o que o
// gitweb-auto-release faz: calcula a próxima versão a partir da última tag,
// empacota e sobe os arquivos para uma Release nova.
//
// Uso:
//   npm run release:local            -> bump de patch a partir da última tag
//   npm run release:local -- 0.2.0   -> versão explícita
//   npm run release:local -- --dry-run
//
// Os três arquivos enviados são obrigatórios: sem o latest.yml o
// electron-updater não enxerga a versão nova e o auto-update para de
// funcionar silenciosamente.

import { execFileSync, execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(projectDir, 'package.json')
const lockPath = join(projectDir, 'package-lock.json')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const explicitVersion = args.find((a) => /^\d+\.\d+\.\d+$/.test(a))

const run = (cmd, opts = {}) =>
  execSync(cmd, { cwd: projectDir, stdio: 'inherit', ...opts })

// Sem shell: no Windows o execSync cai no cmd.exe, onde aspas simples são
// literais e um padrão como 'v*.*.*' chegaria ao git com as aspas junto.
const git = (...args) =>
  execFileSync('git', args, { cwd: projectDir, encoding: 'utf8' }).trim()

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

// --- Pré-condições -------------------------------------------------------

try {
  execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' })
} catch {
  fail('GitHub CLI não autenticado. Rode: gh auth login')
}

// A Release aponta para o commit atual, então um working tree sujo publicaria
// um binário que não corresponde a nenhum commit do repositório.
if (git('status', '--porcelain')) {
  fail('Working tree sujo. Faça commit ou stash antes de publicar.')
}

const sha = git('rev-parse', 'HEAD')
if (git('rev-parse', 'origin/main') !== sha) {
  fail('HEAD não é igual a origin/main. Faça push (ou pull) antes de publicar.')
}

for (const icon of ['build/icon.png', 'build/icon.ico']) {
  if (!existsSync(join(projectDir, icon))) {
    fail(`${icon} não encontrado. Sem ele o app sai com o ícone padrão do Electron.`)
  }
}

// --- Versão --------------------------------------------------------------

execSync('git fetch --tags origin', { cwd: projectDir, stdio: 'ignore' })
const latestTag = git('tag', '-l', 'v*.*.*', '--sort=-v:refname').split('\n')[0] || ''

let version = explicitVersion
if (!version) {
  if (!latestTag) fail('Nenhuma tag v*.*.* encontrada; passe a versão explicitamente.')
  const [major, minor, patch] = latestTag.replace(/^v/, '').split('.').map(Number)
  version = `${major}.${minor}.${patch + 1}`
}
const tag = `v${version}`

if (git('tag', '-l', tag)) fail(`A tag ${tag} já existe.`)

console.log(`\n  última tag : ${latestTag || '(nenhuma)'}`)
console.log(`  publicando : ${tag}`)
console.log(`  commit     : ${sha.slice(0, 7)}\n`)

if (dryRun) {
  console.log('--dry-run: nada foi construído nem publicado.')
  process.exit(0)
}

// --- Build ---------------------------------------------------------------

// O CI bumpa a versão sem commitar (só a tag é enviada); o mesmo vale aqui, e
// por isso package.json e package-lock.json são restaurados no finally.
const originalPkg = readFileSync(pkgPath, 'utf8')
const originalLock = readFileSync(lockPath, 'utf8')

try {
  const pkg = JSON.parse(originalPkg)
  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  console.log('→ typecheck')
  run('npm run typecheck')

  console.log('→ testes')
  run('npm test')

  console.log('→ build')
  run('npm run build')

  console.log('→ empacotando Windows')
  run('npx electron-builder --win --publish never')

  const exe = `dist/GitWeb-Setup-${version}.exe`
  const files = [exe, `${exe}.blockmap`, 'dist/latest.yml']
  for (const f of files) {
    if (!existsSync(join(projectDir, f))) fail(`Esperado mas não gerado: ${f}`)
  }

  // --- Notas ---------------------------------------------------------------

  const logArgs = latestTag
    ? ['log', '--format=%s', '--no-merges', `${latestTag}..HEAD`]
    : ['log', '--format=%s', '--no-merges', '-1', 'HEAD']
  const commits = git(...logArgs)
    .split('\n')
    .filter((s) => s && !s.startsWith('chore(gitweb): release '))
    .map((s) => `- ${s}`)
    .join('\n')

  const compare = latestTag
    ? `**Changelog completo:** [${latestTag}...${tag}](https://github.com/CariSoftwareBR/OpenGitDesktop/compare/${latestTag}...${tag})`
    : ''

  const notes = `## O que mudou

${commits || '- Sem commits de produto desde a tag anterior.'}

---

> **Somente Windows nesta versão.** Gerada localmente porque a cota mensal de
> GitHub Actions do repositório se esgotou. Os builds de macOS e Linux voltam
> quando a cota renovar e o CI publicar de novo.

${compare}
`
  const notesPath = join(projectDir, 'dist', 'release-notes.md')
  writeFileSync(notesPath, notes)

  console.log(`→ publicando ${tag}`)
  execFileSync(
    'gh',
    [
      'release', 'create', tag,
      '--repo', 'CariSoftwareBR/OpenGitDesktop',
      '--target', sha,
      '--title', `GitWeb ${tag}`,
      '--notes-file', notesPath,
      '--latest',
      ...files
    ],
    { cwd: projectDir, stdio: 'inherit' }
  )

  console.log(`\n✔ ${tag} publicada.`)
} finally {
  writeFileSync(pkgPath, originalPkg)
  writeFileSync(lockPath, originalLock)
}
