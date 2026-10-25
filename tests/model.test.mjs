import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sum, shiftMonth, csvCell } from '../src/model.ts'

test('money totals avoid floating point drift', () => {
  assert.equal(sum([{ amount: 0.1 }, { amount: 0.2 }]), 0.3)
  assert.equal(sum([{ amount: 1299.99 }, { amount: 0.01 }]), 1300)
  assert.equal(sum([]), 0)
})
test('month navigation handles calendar year boundaries', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2024-03', -1), '2024-02')
})
test('CSV quotes delimiters, embedded quotes, and formula prefixes', () => {
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('a"b'), '"a""b"')
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"')
  assert.equal(csvCell(123.45), '"123.45"')
})
