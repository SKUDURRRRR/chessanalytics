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
      totalTime: 0,
    }
  }

  const lowerTimeControl = timeControl.toLowerCase()
  if (['bullet', 'blitz', 'rapid', 'classical'].includes(lowerTimeControl)) {
    const category = lowerTimeControl as 'bullet' | 'blitz' | 'rapid' | 'classical'
    const displayName = category.charAt(0).toUpperCase() + category.slice(1)
    
    // Set approximate total times for pre-categorized controls
    let totalTime = 0
    switch (category) {
      case 'bullet':
        totalTime = 180 // 3 minutes
        break
      case 'blitz':
        totalTime = 600 // 10 minutes
        break
      case 'rapid':
        totalTime = 1800 // 30 minutes
        break
      case 'classical':
        totalTime = 3600 // 60 minutes
        break
    }
    
    return {
      category,
      displayName,
      totalTime,
    }
  }

  let totalTime = 0

  if (timeControl.includes('+')) {
    // Format: "base+increment" 
    const [base, increment] = timeControl
      .split('+')
      .map(value => Number(value))

    if (!Number.isFinite(base) || !Number.isFinite(increment)) {
      return {
        category: 'unknown',
        displayName: 'Unknown',
        totalTime: 0,
      }
    }

    // Determine if base is in minutes or seconds based on typical Lichess values
    // Lichess UI shows: 1+0, 3+0, 5+0, 10+0, 15+10, 30+0
    // Raw data might be: 60+0, 180+0, 300+0, 600+0, 900+10, 1800+0
    if (base >= 60 && base % 60 === 0 && base <= 1800) {
      // Looks like seconds format (60, 180, 300, 600, 900, 1800)
      // Convert to minutes for calculation
      const baseMinutes = base / 60
      const incrementSeconds = increment
      totalTime = baseMinutes * 60 + incrementSeconds * 40
    } else if (base <= 30) {
      // Looks like minutes format (1, 3, 5, 10, 15, 30)
      const baseMinutes = base
      const incrementSeconds = increment
      totalTime = baseMinutes * 60 + incrementSeconds * 40
    } else {
      // Fallback: assume seconds
      totalTime = base + increment * 40
    }
  } else if (!Number.isNaN(Number(timeControl))) {
    // Format: just a number
    const base = Number(timeControl)
    if (base >= 60 && base % 60 === 0 && base <= 1800) {
      // Seconds format, convert to minutes
      totalTime = base
    } else if (base <= 30) {
      // Minutes format
      totalTime = base * 60
    } else {
      // Fallback: assume seconds
      totalTime = base
    }
  } else {
    return {
      category: 'unknown',
      displayName: 'Unknown',
      totalTime: 0,
    }
  }

  // Categorize based on total time - aligned with Lichess boundaries
  // Lichess uses: Bullet (< 3 min), Blitz (3-8 min), Rapid (8-25 min), Classical (25+ min)
  if (totalTime < 180) {
    // Less than 3 minutes (e.g., 1+0, 2+1)
    return {
      category: 'bullet',
      displayName: 'Bullet',
      totalTime,
    }
  } else if (totalTime < 480) {
    // 3-8 minutes (e.g., 3+0, 3+2, 5+0, 5+3)
    // Lichess Blitz boundary is roughly 8 minutes (480 seconds)
    return {
      category: 'blitz',
      displayName: 'Blitz',
      totalTime,
    }
  } else if (totalTime < 1500) {
    // 8-25 minutes (e.g., 10+0, 10+5, 15+10)
    // Lichess Rapid boundary is roughly 25 minutes (1500 seconds)
    return {
      category: 'rapid',
      displayName: 'Rapid',
      totalTime,
    }
  } else {
    // 25+ minutes (e.g., 30+0, 30+20)
    return {
      category: 'classical',
      displayName: 'Classical',
      totalTime,
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
