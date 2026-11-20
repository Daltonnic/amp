import { describe, expect, it } from 'vitest'
// @ts-expect-error — plain .mjs helper used by the Base44 import script
import { parseCsv } from '../../scripts/lib/csv.mjs'

describe('parseCsv (Base44 export import)', () => {
  it('parses headers and rows', () => {
    expect(parseCsv('id,title\n1,Hello\n2,World\n')).toEqual([
      { id: '1', title: 'Hello' },
      { id: '2', title: 'World' },
    ])
  })

  it('handles quoted commas, escaped quotes, CRLF and multi-line journal text', () => {
    const csv = 'id,content,created_by\r\n1,"Line one, with comma\nLine ""two""",a@b.com\r\n'
    expect(parseCsv(csv)).toEqual([
      { id: '1', content: 'Line one, with comma\nLine "two"', created_by: 'a@b.com' },
    ])
  })

  it('ignores blank lines and missing trailing newline', () => {
    expect(parseCsv('a,b\n\n1,2')).toEqual([{ a: '1', b: '2' }])
  })
})
