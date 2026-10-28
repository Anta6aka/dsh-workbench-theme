import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const ATTACHMENTS = path.join(DSH_HOME, 'attachments', 'v1', 'objects')
const SESSIONS = path.join(DSH_HOME, 'sessions')
const QUARANTINE = path.join(DSH_HOME, 'attachments', 'v1', 'tmp')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const HASH = /^[0-9a-f]{64}$/i
const MAX_AGE_MS = Number(process.env.PRUNE_MAX_AGE_HOURS || 24) * 60 * 60 * 1000
const apply = process.argv.includes('--apply')

function decompress(file) {
  const buf = fs.readFileSync(file)
  const offsets = []
  let index = 0
  while ((index = buf.indexOf(MAGIC, index)) !== -1) {
    offsets.push(index)
    index += 4
  }
  const parts = []
  for (let i = 0; i < offsets.length; i += 1) {
    try { parts.push(zlib.zstdDecompressSync(buf.subarray(offsets[i], offsets[i + 1] ?? buf.length))) } catch {}
  }
  return Buffer.concat(parts).toString('utf8')
}

function files(root, out = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) files(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

if (!fs.existsSync(ATTACHMENTS)) {
  console.log(`no attachment objects: ${ATTACHMENTS}`)
  process.exit(0)
}

const objects = new Map()
for (const file of fs.readdirSync(ATTACHMENTS, { withFileTypes: true })) {
  if (!file.isDirectory()) continue
  const dir = path.join(ATTACHMENTS, file.name)
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !HASH.test(entry.name)) continue
    const full = path.join(dir, entry.name)
    const stat = fs.statSync(full)
    objects.set(entry.name, { file: full, size: stat.size, mtime: stat.mtimeMs })
  }
}

const referenced = new Set()
const sessionFiles = fs.existsSync(SESSIONS) ? files(SESSIONS).filter(file => file.endsWith('.jsonl.zstd')) : []
for (const file of sessionFiles) {
  let text = ''
  try { text = decompress(file) } catch { continue }
  for (const match of text.matchAll(/[0-9a-f]{64}/gi)) {
    if (objects.has(match[0])) referenced.add(match[0])
  }
}

const cutoff = Date.now() - MAX_AGE_MS
const candidates = [...objects.entries()].filter(([hash, info]) => !referenced.has(hash) && info.mtime < cutoff)
const bytes = candidates.reduce((sum, [, info]) => sum + info.size, 0)
console.log(`objects=${objects.size}`)
console.log(`session_files=${sessionFiles.length}`)
console.log(`referenced=${referenced.size}`)
console.log(`unreferenced_older_than_${Math.round(MAX_AGE_MS / 3600000)}h=${candidates.length} (${(bytes / 1024 / 1024).toFixed(1)} MiB)`)
if (!candidates.length) process.exit(0)
if (!apply) {
  console.log('dry run only; pass --apply to move candidates into v1/tmp/pruned-<timestamp>/')
  process.exit(0)
}

const target = path.join(QUARANTINE, `pruned-${new Date().toISOString().replace(/[:.]/g, '-')}`)
fs.mkdirSync(target, { recursive: true })
for (const [hash, info] of candidates) {
  fs.renameSync(info.file, path.join(target, hash))
}
console.log(`moved ${candidates.length} files to ${target}`)
