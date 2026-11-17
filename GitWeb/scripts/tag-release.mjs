// Dispara uma release de qualquer tipo empurrando só a tag; quem empacota e
// publica é o .github/workflows/gitweb-release.yml.
//
// Substitui o `npm version` dos scripts release:*: rodado dentro de GitWeb/,
// onde não há .git, o npm nem cria a tag. E a versão do package.json fica para
// trás de propósito (o auto-release empurra só a tag), então a próxima versão
// sai da última tag, como no CI.
//
// Uso:
//   npm run release:patch | release:minor | release:major
//   npm run release:minor -- --dry-run
//
// Rode depois que o auto-release do último push terminar (ou faça esse push
// com [skip release]): os dois calculam a versão a partir da última tag, e um
// auto-release ainda em andamento publicaria um patch por cima desta versão.

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const kind = args.find((a) => ['patch', 'minor', 'major'].includes(a))
const dryRun = args.includes('--dry-run')

// Sem shell, pelo mesmo motivo do release-local.mjs: no cmd.exe as aspas de
// 'v*.*.*' chegariam ao git.
const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: projectDir, encoding: 'utf8' }).trim()

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

if (!kind) fail('Informe patch, minor ou major.')

// A tag aponta para o HEAD: ele precisa ser exatamente o que está no remoto.
if (git('status', '--porcelain')) fail('Working tree sujo. Faça commit ou stash antes.')
git('fetch', '--tags', 'origin')
const sha = git('rev-parse', 'HEAD')
if (git('rev-parse', 'origin/main') !== sha) {
  fail('HEAD não é igual a origin/main. Faça push (ou pull) antes de publicar.')
}

const latestTag = git('tag', '-l', 'v*.*.*', '--sort=-v:refname').split('\n')[0] || ''
if (!latestTag) fail('Nenhuma tag v*.*.* encontrada.')

const [major, minor, patch] = latestTag.replace(/^v/, '').split('.').map(Number)
const next =
  kind === 'major' ? `${major + 1}.0.0` : kind === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
const tag = `v${next}`
if (git('tag', '-l', tag)) fail(`A tag ${tag} já existe.`)

console.log(`\n  última tag : ${latestTag}`)
console.log(`  nova tag   : ${tag} (${kind})`)
console.log(`  commit     : ${sha.slice(0, 7)}\n`)

if (dryRun) {
  console.log('--dry-run: nenhuma tag foi criada.')
  process.exit(0)
}

git('tag', '-a', tag, '-m', `Release ${tag}`)
try {
  git('push', 'origin', `refs/tags/${tag}`)
} catch (err) {
  // Sem isto a tag ficava só aqui: a próxima execução recusaria a mesma
  // versão ou pularia uma, porque lê as tags locais.
  git('tag', '-d', tag)
  fail(`O push da tag ${tag} falhou; a tag local foi apagada. ${err instanceof Error ? err.message.split('\n')[0] : ''}`)
}
console.log(`✔ ${tag} enviada. O workflow gitweb-release.yml empacota e publica.`)
