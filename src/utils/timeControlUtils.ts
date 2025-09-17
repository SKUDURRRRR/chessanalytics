// Time Control Utilities - Convert time formats to categories
export interface TimeControlInfo {
  category: 'bullet' | 'blitz' | 'rapid' | 'classical' | 'unknown'
  displayName: string
  totalTime: number // in seconds
}

export function parseTimeControl(timeControl: string): TimeControlInfo {
  if (!timeControl || timeControl === 'unknown') {
    return {
      category: 'unknown',
      displayName: 'Unknown',
      totalTime: 0
    }
  }

  // Handle different time control formats
  let totalTime = 0

  // Format: "900+10" (seconds + increment)
  if (timeControl.includes('+')) {
    const [time, increment] = timeControl.split('+').map(Number)
    totalTime = time + (increment * 40) // Estimate 40 moves average
  }
  // Format: "15+10" (minutes + increment)
  else if (timeControl.includes('+') && timeControl.split('+')[0] < 100) {
    const [time, increment] = timeControl.split('+').map(Number)
    totalTime = (time * 60) + (increment * 40) // Convert minutes to seconds
  }
  // Format: "900" (seconds only)
  else if (!isNaN(Number(timeControl))) {
    const time = Number(timeControl)
    // If it's less than 100, assume it's minutes
    totalTime = time < 100 ? time * 60 : time
  }
  // Format: "15" (minutes only)
  else {
    const time = Number(timeControl)
    totalTime = time * 60
  }

  // Categorize based on total time
  if (totalTime <= 180) { // 3 minutes or less
    return {
      category: 'bullet',
      displayName: 'Bullet',
      totalTime
    }
  } else if (totalTime <= 600) { // 10 minutes or less
    return {
      category: 'blitz',
      displayName: 'Blitz',
      totalTime
    }
  } else if (totalTime <= 1800) { // 30 minutes or less
    return {
      category: 'rapid',
      displayName: 'Rapid',
      totalTime
    }
  } else { // More than 30 minutes
    return {
      category: 'classical',
      displayName: 'Classical',
      totalTime
    }
  }
}

export function getTimeControlCategory(timeControl: string): string {
  return parseTimeControl(timeControl).displayName
}

export function getTimeControlIcon(category: string): string {
  switch (category.toLowerCase()) {
    case 'bullet':
      return '⚡'
    case 'blitz':
      return '🔥'
    case 'rapid':
      return '⏱️'
    case 'classical':
      return '♔'
    default:
      return '❓'
  }
}

export function getTimeControlColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'bullet':
      return 'text-red-600'
    case 'blitz':
      return 'text-orange-600'
    case 'rapid':
      return 'text-blue-600'
    case 'classical':
      return 'text-purple-600'
    default:
      return 'text-gray-600'
  }
}
