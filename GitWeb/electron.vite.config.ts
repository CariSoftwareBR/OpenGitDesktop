import { resolve } from 'path'
import { execFileSync } from 'child_process'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** The commit this build came from, for About's "git log -1" card; '' outside a checkout. */
function buildCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: __dirname, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_COMMIT__: JSON.stringify(buildCommit())
    },
    plugins: [react(), tailwindcss()]
  }
})
