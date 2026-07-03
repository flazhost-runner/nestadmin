// CJS shim for uuid v14 (ESM-only) — uses Node.js built-in crypto
const { randomUUID } = require('crypto')

module.exports = {
  v4: randomUUID,
  v1: randomUUID,
  v3: randomUUID,
  v5: randomUUID,
  v6: randomUUID,
  v7: randomUUID,
  NIL: '00000000-0000-0000-0000-000000000000',
  validate: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),
  version: () => 4,
  parse: (uuid) => new Uint8Array(uuid.replace(/-/g, '').match(/.{1,2}/g).map(h => parseInt(h, 16))),
  stringify: (arr) => {
    const hex = [...arr].map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  },
}
