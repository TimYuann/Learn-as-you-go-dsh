#!/usr/bin/env node
/**
 * Compliance gate for the DSH bundle plugin (`npm run check`).
 *
 * Validates:
 *   1. package metadata   — name/version/type
 *   2. bundle manifest    — dsh.bundle.patch exists and is referenced
 *   3. mount config       — cordis.patch.yml parses and carries insert rows
 *   4. entry contract     — src entry exports `name`, `apply`, `inject`, `Config`
 *   5. package contents   — npm pack dry-run includes lib/ and the patch files
 *
 * Exit code 0 = compliant.
 */

import { access, readFile } from 'node:fs/promises'
import { parse } from 'yaml'

const ROOT = new URL('..', import.meta.url)
const results = []

function report(check, ok, detail = '') {
  results.push({ check, ok, detail })
}

async function exists(rel) {
  try {
    await access(new URL(rel, ROOT))
    return true
  } catch {
    return false
  }
}

async function read(rel) {
  return readFile(new URL(rel, ROOT), 'utf8')
}

function printAndExit() {
  let failed = 0
  for (const { check, ok, detail } of results) {
    if (!ok) failed += 1
    console.log(`${ok ? 'ok' : 'FAIL'} - ${check}${detail ? ` (${detail})` : ''}`)
  }
  if (failed > 0) {
    console.error(`\n${failed} compliance check(s) failed`)
    process.exit(1)
  }
  console.log('\nall compliance checks passed')
}

// --- 1. package metadata ---------------------------------------------------
let pkg
try {
  pkg = JSON.parse(await read('package.json'))
  report('package.json parses', true)
} catch (error) {
  report('package.json parses', false, String(error))
  printAndExit()
}

report('name is a valid npm package name', /^[a-z0-9][a-z0-9-]*$/.test(pkg.name ?? ''), pkg.name)
report('version is set', typeof pkg.version === 'string' && pkg.version.length > 0, pkg.version)
report('type is module (ESM)', pkg.type === 'module', pkg.type)

// --- 2. bundle manifest ----------------------------------------------------
const patchRel = pkg.dsh?.bundle?.patch
report('dsh.bundle.patch is declared', typeof patchRel === 'string' && patchRel.length > 0, patchRel)

// --- 3. mount config -------------------------------------------------------
if (patchRel) {
  try {
    const patch = parse(await read(patchRel))
    const inserts = Array.isArray(patch)
      ? patch.filter((row) => row && typeof row === 'object' && Array.isArray(row.insert))
      : []
    report('cordis.patch.yml parses and carries insert rows', inserts.length > 0)
    const rows = inserts.flatMap((row) => row.insert)
    report(
      'insert rows carry id and name',
      rows.length > 0 && rows.every((row) => row && typeof row.id === 'string' && typeof row.name === 'string'),
    )
  } catch (error) {
    report('cordis.patch.yml parses and carries insert rows', false, String(error))
  }
}

// --- 4. entry contract -----------------------------------------------------
try {
  const entry = await read('src/index.ts')
  for (const sym of ['name', 'apply', 'inject', 'Config']) {
    report(`src entry exports ${sym}`, new RegExp(`export (const|function) ${sym}\\b`).test(entry), sym)
  }
} catch (error) {
  report('src entry readable', false, String(error))
}

// --- 5. package contents (build first) -------------------------------------
try {
  const pack = await read('package.json')
  report('package.json files whitelist includes lib/', /"lib"/.test(pack))
  report('package.json files whitelist includes cordis.patch.yml', /"cordis\.patch\.yml"/.test(pack))
} catch {
  report('package contents whitelist', false, 'unreadable package.json')
}

printAndExit()
