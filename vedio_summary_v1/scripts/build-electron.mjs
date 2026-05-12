import { build } from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(rootDir, 'dist-electron')

await fs.rm(outDir, { recursive: true, force: true })
await fs.mkdir(path.join(outDir, 'api'), { recursive: true })
await fs.mkdir(path.join(outDir, 'scripts'), { recursive: true })

const common = {
  bundle: true,
  platform: 'node',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
}

await Promise.all([
  build({
    ...common,
    entryPoints: [path.join(rootDir, 'api/app.ts')],
    format: 'esm',
    outfile: path.join(outDir, 'api/app.mjs'),
  }),
  build({
    ...common,
    entryPoints: [path.join(rootDir, 'electron/main.ts')],
    format: 'cjs',
    external: ['electron'],
    outfile: path.join(outDir, 'main.cjs'),
  }),
  build({
    ...common,
    entryPoints: [path.join(rootDir, 'electron/preload.ts')],
    format: 'cjs',
    external: ['electron'],
    outfile: path.join(outDir, 'preload.cjs'),
  }),
])

await fs.copyFile(
  path.join(rootDir, 'api/scripts/mlx_whisper_transcribe.py'),
  path.join(outDir, 'scripts/mlx_whisper_transcribe.py'),
)
