#!/usr/bin/env node
/**
 * NestAdmin Convention Checker
 * Run: node scripts/check-conventions.js
 * CI gate: npm run lint:conventions
 *
 * Checks src/modules/**\/*.ts for violations of AGENTS.md rules.
 * Exit 0 = pass, Exit 1 = violations found.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC_MODULES = path.join(ROOT, 'src', 'modules')
const TESTS_DIR = path.join(ROOT, 'tests')

// ─── Helpers ────────────────────────────────────────────────────────────────

function walkDir(dir, ext = '.ts') {
  if (!fs.existsSync(dir)) return []
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full, ext))
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full)
    }
  }
  return results
}

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n')
}

function relPath(file) {
  return path.relative(ROOT, file)
}

// ─── Violation collector ─────────────────────────────────────────────────────

const violations = []

function fail(file, line, msg) {
  violations.push(`  ${relPath(file)}:${line}  →  ${msg}`)
}

// ─── File classification ─────────────────────────────────────────────────────

function isServiceFile(file) {
  // Matches: services/v1/XService.ts (not IXService.ts)
  return /services[/\\]v\d+[/\\][^/\\]+Service\.ts$/.test(file)
    && !path.basename(file).startsWith('I')
}

function isServiceInterface(file) {
  return /services[/\\]v\d+[/\\]I[^/\\]+Service\.ts$/.test(file)
}

function isControllerFile(file) {
  return /controllers[/\\](web|api)[/\\]v\d+[/\\][^/\\]+Controller\.ts$/.test(file)
}

function isEntityFile(file) {
  return /models[/\\][^/\\]+\.entity\.ts$/.test(file)
}

// ─── Get module dirs ──────────────────────────────────────────────────────────

function getModuleDirs() {
  if (!fs.existsSync(SRC_MODULES)) return []
  return fs.readdirSync(SRC_MODULES, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => ({ name: e.name, dir: path.join(SRC_MODULES, e.name) }))
}

// ─── Get all test file content (for module coverage check) ───────────────────

function getAllTestContent() {
  const testFiles = walkDir(TESTS_DIR)
  return testFiles.map(f => ({
    file: f,
    content: fs.readFileSync(f, 'utf8'),
  }))
}

// ─── Checks ──────────────────────────────────────────────────────────────────

function checkServiceFile(file) {
  const lines = readLines(file)
  const content = lines.join('\n')

  // 1. Must have @Injectable() decorator
  if (!/@Injectable\s*\(\s*\)/.test(content)) {
    fail(file, 1, 'Service file missing @Injectable() decorator')
  }

  // 2. Must implement I*Service
  if (!/implements\s+I[A-Z][A-Za-z]+Service/.test(content)) {
    fail(file, 1, 'Service file missing "implements I*Service" (interface contract required)')
  }

  // 3. No `return error` pattern (should throw)
  lines.forEach((line, i) => {
    if (/return\s+(?:new\s+)?(?:Error|AppError|NotFoundError|ConflictError|ValidationError|UnauthorizedError|ForbiddenError)\s*[(\[]/.test(line)) {
      fail(file, i + 1, 'return error detected — use "throw new AppError(...)" instead')
    }
    // Broader: return <varName> where the var looks like an error
    if (/return\s+\w*[Ee]rr(?:or)?\b/.test(line) && !/\/\//.test(line.split('return')[0])) {
      fail(file, i + 1, 'Possible "return error" pattern — services must throw, not return errors')
    }
  })

  // 4. No `instanceof Error` pattern in service
  lines.forEach((line, i) => {
    if (/instanceof\s+Error\b/.test(line) && !line.trimStart().startsWith('//')) {
      fail(file, i + 1, '"instanceof Error" in service — use AppError subclasses and throw')
    }
  })

  // 5. No raw .query() calls
  lines.forEach((line, i) => {
    if (/\.\s*query\s*\(/.test(line) && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
      fail(file, i + 1, 'Raw .query() call detected — use QueryBuilder + ciLike() for portability')
    }
  })

  // 6. No process.env in modules
  lines.forEach((line, i) => {
    if (/process\.env\b/.test(line) && !line.trimStart().startsWith('//')) {
      fail(file, i + 1, 'process.env in modules/ — use ConfigService from @nestjs/config')
    }
  })
}

function checkControllerFile(file) {
  const lines = readLines(file)
  const content = lines.join('\n')

  // 1. Must have @Controller() decorator
  if (!/@Controller\s*\(/.test(content)) {
    fail(file, 1, 'Controller file missing @Controller() decorator')
  }

  // 2. No new XService() instantiation
  lines.forEach((line, i) => {
    if (/new\s+[A-Z][A-Za-z]+Service\s*\(/.test(line) && !line.trimStart().startsWith('//')) {
      fail(file, i + 1, '"new XService()" in controller — inject via constructor (NestJS DI)')
    }
  })

  // 3. No process.env
  lines.forEach((line, i) => {
    if (/process\.env\b/.test(line) && !line.trimStart().startsWith('//')) {
      fail(file, i + 1, 'process.env in modules/ — use ConfigService from @nestjs/config')
    }
  })
}

function checkEntityFile(file) {
  const lines = readLines(file)

  // 1. Non-portable column types
  const forbiddenTypes = ['longtext', 'mediumtext', 'datetime']
  lines.forEach((line, i) => {
    forbiddenTypes.forEach(t => {
      // Match type: 'longtext' or type: "longtext"
      if (new RegExp(`type\\s*:\\s*['"]${t}['"]`).test(line) && !line.trimStart().startsWith('//')) {
        fail(file, i + 1, `Non-portable column type "${t}" — use "text" or "varchar" for cross-DB portability`)
      }
    })
  })

  // 2. No collation hardcoded
  lines.forEach((line, i) => {
    if (/collation\s*:/.test(line) && !line.trimStart().startsWith('//')) {
      fail(file, i + 1, 'collation: hardcoded in entity — omit for cross-DB portability')
    }
  })
}

function checkGenericModuleFile(file) {
  const lines = readLines(file)

  // process.env anywhere in modules/
  lines.forEach((line, i) => {
    if (/process\.env\b/.test(line) && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
      fail(file, i + 1, 'process.env in modules/ — use ConfigService from @nestjs/config')
    }
  })
}

function checkModuleHasTest(moduleName, testContents) {
  // Look for any test file that imports or references this module by name (case-insensitive)
  const moduleLower = moduleName.toLowerCase()
  const hasTest = testContents.some(({ content }) => {
    const lower = content.toLowerCase()
    return lower.includes(`/${moduleLower}/`) || lower.includes(`${moduleLower}service`) || lower.includes(`${moduleLower}.module`)
  })
  if (!hasTest) {
    const moduleDir = path.join(SRC_MODULES, moduleName)
    fail(moduleDir, 0, `Module "${moduleName}" has no corresponding test file in tests/ — add at minimum an integration test`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('NestAdmin Convention Checker')
  console.log('Scanning src/modules/**/*.ts ...\n')

  if (!fs.existsSync(SRC_MODULES)) {
    console.log('  (no src/modules directory found — skipping)')
    console.log('\n✅ Conventions check passed (nothing to check)')
    process.exit(0)
  }

  const allTsFiles = walkDir(SRC_MODULES)
  const testContents = getAllTestContent()
  const moduleDirs = getModuleDirs()

  // Skip modules that are purely infrastructure (no service)
  const INFRA_MODULES = new Set(['home', 'media'])

  for (const file of allTsFiles) {
    if (isServiceFile(file)) {
      checkServiceFile(file)
    } else if (isControllerFile(file)) {
      checkControllerFile(file)
    } else if (isEntityFile(file)) {
      checkEntityFile(file)
    } else {
      // Generic check on all module files
      checkGenericModuleFile(file)
    }
  }

  // Check each module with a service directory has at least one test
  for (const { name, dir } of moduleDirs) {
    if (INFRA_MODULES.has(name)) continue
    const servicesDir = path.join(dir, 'services')
    if (!fs.existsSync(servicesDir)) continue   // no service = no test required by checker
    // Only check if there are concrete service files (not just interfaces)
    const serviceFiles = walkDir(servicesDir).filter(isServiceFile)
    if (serviceFiles.length > 0) {
      checkModuleHasTest(name, testContents)
    }
  }

  if (violations.length > 0) {
    console.error(`Found ${violations.length} convention violation(s):\n`)
    violations.forEach(v => console.error(v))
    console.error('\n❌ Conventions check FAILED — fix violations before committing.')
    process.exit(1)
  }

  console.log(`Checked ${allTsFiles.length} TypeScript files across ${moduleDirs.length} modules.`)
  console.log('\n✅ Conventions check passed')
  process.exit(0)
}

main()
