// Number formatting utilities
export function formatScore(score: number): string {
  // Handle NaN, undefined, or null values
  if (isNaN(score) || score === null || score === undefined) {
    return '0.0'
  }
  return (Math.round(score * 10) / 10).toString()
}

export function formatPercentage(value: number): string {
  // Handle NaN, undefined, or null values
  if (isNaN(value) || value === null || value === undefined) {
    return '0%'
  }
  return `${Math.round(value * 10) / 10}%`
}

export function formatInteger(value: number): number {
  // Handle NaN, undefined, or null values
  if (isNaN(value) || value === null || value === undefined) {
    return 0
  }
  return Math.round(value)
}
