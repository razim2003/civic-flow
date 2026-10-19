import type { Category, Department } from './complaint'

const serviceOrder = ['Road maintenance', 'Waste management', 'Water supply', 'Sanitation', 'Public transport']
export function categoryLabel(name: string) {
  return ['other', 'other public services'].includes(name.trim().toLowerCase()) ? 'Other' : name
}

/** Keep real database IDs/routes; never fabricate options for missing setup data. */
export function availableCategories(categories: Category[], departments: Department[]) {
  const activeDepartments = new Set(departments.filter((department) => department.is_active).map((department) => department.id))
  const rank = (name: string) => {
    if (categoryLabel(name) === 'Other') return Number.MAX_SAFE_INTEGER
    const index = serviceOrder.indexOf(name)
    return index < 0 ? serviceOrder.length : index
  }
  return categories.filter((category) => category.is_active && activeDepartments.has(category.department_id))
    .sort((first, second) => rank(first.name) - rank(second.name) || first.name.localeCompare(second.name))
}
