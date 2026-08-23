/**
 * Timezone Utilities
 * Handle Philippines/Asia timezone (UTC+8)
 * Note: Asia/Manila and Asia/Taipei are both UTC+8
 */

/**
 * Get current date/time in Philippines/Asia timezone
 * This converts local time to proper UTC timestamp that represents PH time
 * 
 * IMPORTANT: Supabase stores timestamps in UTC
 * So we need to store the time AS IF it's UTC, but it actually represents PH time
 */
export function getPhilippinesDateTime(): string {
  // Create date object in Philippines timezone
  const phTime = new Date(new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila'
  }))
  
  return phTime.toISOString()
}

/**
 * Get current date in Philippines timezone (YYYY-MM-DD format)
 */
export function getPhilippinesDateString(): string {
  const phTime = new Date(new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila'
  }))
  
  const year = phTime.getFullYear()
  const month = String(phTime.getMonth() + 1).padStart(2, '0')
  const day = String(phTime.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Format timestamp to Philippines timezone display
 */
export function formatPhilippinesDateTime(timestamp: string | Date): string {
  const date = new Date(timestamp)
  
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * Format date only to Philippines timezone
 */
export function formatPhilippinesDate(timestamp: string | Date): string {
  const date = new Date(timestamp)
  
  return date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * Format time only to Philippines timezone
 */
export function formatPhilippinesTime(timestamp: string | Date): string {
  const date = new Date(timestamp)
  
  return date.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
