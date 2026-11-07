export type Category = { id: string; name: string; color: string; archived?: boolean }
export type Expense = { id: string; amount: number; category: string; date: string; note: string; outsideBudget?: boolean }
export type Data = { expenses: Expense[]; categories: Category[]; budgets: Record<string, number>; currency: string; outsideCategories?: Category[] }
export const defaults: Data = { expenses: [], categories: ['Food & drinks', 'Transport', 'Shopping', 'Bills & utilities', 'Health', 'Entertainment', 'Other'].map((name, i) => ({ id: `cat-${i}`, name, color: ['#537b62', '#e6ae66', '#8d80b5', '#698fbb', '#d6847f', '#a4b879', '#9a9c9b'][i] })), budgets: {}, currency: 'LKR' }
export function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const sum = (items: Expense[]) => items.reduce((n, e) => n + Math.round(e.amount * 100), 0) / 100
export function shiftMonth(month: string, offset: number) { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export function csvCell(value: string | number) { return `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"` }

export const outsideCategories = [{ id: "outside-wedding", name: "Wedding Expenses", color: "#8d80b5" }, { id: "outside-learning", name: "Learning and Development", color: "#698fbb" }]
export const budgetExpenses = (expenses: Expense[]) => expenses.filter(e => !e.outsideBudget)

export function getOutsideCategories(data: Data): Category[] {
  const categories = data.outsideCategories ?? outsideCategories
  const known = new Set(categories.map(c => c.id))
  return [...categories, ...Array.from(new Set(data.expenses.filter(e => e.outsideBudget).map(e => e.category))).filter(id => !known.has(id)).map(id => ({ id, name: id, color: '#8d80b5' }))]
}
