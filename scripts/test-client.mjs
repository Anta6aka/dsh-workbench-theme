import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (!process.env.DSH_RUNTIME_ROOT) {
  console.error('Client integration requires DSH_RUNTIME_ROOT pointing to an official DSH 0.1.7-rc.2 runtime directory containing node_modules. Build this plugin and the peer Shell/Theme package first; set DSH_PEER_PACKAGE_ROOT if the peer is not a sibling checkout.')
  process.exit(1)
}
const testPath = fileURLToPath(new URL('../test/client/style-lifecycle.test.mjs', import.meta.url))
const result = spawnSync(process.execPath, ['--test', testPath], { stdio: 'inherit', env: process.env })
if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
