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


test('outside-budget records stay separate while legacy expenses remain budgeted', async () => {
  const { budgetExpenses } = await import('../src/model.ts')
  const expenses = [
    { id: 'legacy', amount: 120, date: '2026-11-01' },
    { id: 'regular', amount: 80, date: '2026-11-02', outsideBudget: false },
    { id: 'wedding', amount: 50000, date: '2026-11-02', outsideBudget: true },
    { id: 'learning', amount: 10000, date: '2026-10-02', outsideBudget: true },
  ]
  const restored = JSON.parse(JSON.stringify(expenses))
  assert.deepEqual(budgetExpenses(restored).map(e => e.id), ['legacy', 'regular'])
  assert.equal(sum(budgetExpenses(restored)), 200)
  assert.equal(sum(restored.filter(e => e.outsideBudget)), 60000)
  assert.equal(sum(budgetExpenses(restored).filter(e => e.date.startsWith('2026-10'))), 0)
  restored[2].outsideBudget = false
  assert.equal(sum(budgetExpenses(restored)), 50200)
})


test('outside categories preserve custom and archived categories across saved data', async () => {
  const { getOutsideCategories, defaults } = await import('../src/model.ts')
  const legacy = { ...structuredClone(defaults), expenses: [{ category: 'Courses', outsideBudget: true }] }
  const migrated = getOutsideCategories(legacy)
  assert.equal(migrated.find(c => c.id === 'Courses').name, 'Courses')
  assert.ok(migrated.some(c => c.name === 'Wedding Expenses'))
  const saved = { ...legacy, outsideCategories: [...migrated.map(c => c.id === 'Courses' ? { ...c, archived: true } : c), { id: 'custom', name: 'Home renovation', color: '#698fbb' }] }
  const restored = getOutsideCategories(JSON.parse(JSON.stringify(saved)))
  assert.equal(restored.filter(c => c.id === 'Courses').length, 1)
  assert.equal(restored.find(c => c.id === 'Courses').archived, true)
  assert.equal(restored.find(c => c.id === 'custom').name, 'Home renovation')
  assert.equal(saved.categories.some(c => c.id === 'custom'), false)
})
