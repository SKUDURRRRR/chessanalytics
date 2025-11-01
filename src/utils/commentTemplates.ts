/**
 * Enhanced Comment Templates for Chess Move Analysis
 *
 * This file provides diverse, insightful comment templates to avoid repetition
 * and provide more educational value to users.
 */

export interface CommentContext {
  classification: string;
  centipawnLoss: number | null;
  bestMoveSan: string | null;
  moveNumber: number;
  isUserMove: boolean;
  isOpeningMove: boolean;
}

// Optional richer context used by buildHumanComment
export interface HumanReasonContext extends CommentContext {
  tacticalInsights?: string[];
  positionalInsights?: string[];
  risks?: string[];
  benefits?: string[];
  fenBefore?: string;
  move?: string;  // The actual move played in SAN notation
  moveSan?: string;  // Alias for move (for clarity)
}

export const commentTemplates = {
  brilliant: {
    user: [
      "Brilliant! This is a masterful sacrifice that trades material for massive positional compensation and creates winning chances.",
      "Outstanding! You've found a brilliant tactical shot that even strong players might miss - this shows real chess mastery.",
      "Exceptional play! This kind of move creates mate threats and wins games through superior calculation.",
      "Spectacular! This move shows deep tactical understanding and the ability to calculate complex variations perfectly.",
      "Masterful! This demonstrates exceptional chess vision that creates immediate winning chances and could end the game."
    ],
    opponent: [
      "Your opponent played a brilliant move! This shows exceptional tactical vision and creates serious problems for you.",
      "Outstanding play by your opponent! This brilliant sacrifice creates winning chances and shows advanced chess mastery.",
      "Your opponent found a brilliant resource! This tactical shot demonstrates the kind of chess understanding that wins games.",
      "Exceptional move by your opponent! This brilliant combination shows deep tactical understanding and creates mate threats.",
      "Your opponent played masterfully! This brilliant move creates immediate winning chances and could be game-ending."
    ]
  },

  best: {
    user: [
      "Perfect! This is exactly what the position demands and shows excellent chess understanding.",
      "Excellent! You've found the strongest move available, maintaining your advantage with precise calculation.",
      "Well played! This demonstrates solid chess fundamentals and keeps your pieces optimally coordinated.",
      "Optimal! This move maintains your advantage while improving your position's flexibility and activity.",
      "Accurate! This is the kind of move that keeps you ahead by following sound positional principles."
    ],
    opponent: [
      "Your opponent played the best move available. This is solid, accurate play that maintains their position well.",
      "Strong move by your opponent. They found the optimal continuation and show good chess fundamentals.",
      "Your opponent played precisely. This demonstrates solid understanding and keeps their position healthy.",
      "Good play by your opponent. They're making accurate moves that maintain their position.",
      "Your opponent played optimally. This shows they understand the position well."
    ]
  },

  great: {
    user: [
      "Great move! This shows strong chess understanding and improves your position significantly.",
      "Excellent work! You're finding good moves consistently and demonstrating solid positional awareness.",
      "Well played! This kind of play will help you win more games by following sound chess principles.",
      "Strong move! This demonstrates good chess fundamentals and improves your piece coordination.",
      "Very good! This move enhances your position and shows you're thinking strategically about piece activity."
    ],
    opponent: [
      "Your opponent played a great move! This is very strong play that shows excellent chess understanding.",
      "Great play by your opponent! They found a move that improves their position significantly.",
      "Your opponent played excellently! This demonstrates strong tactical awareness and chess understanding.",
      "Very strong move by your opponent! This shows they're thinking strategically and positionally.",
      "Your opponent played well! This kind of move demonstrates good chess fundamentals."
    ]
  },

  excellent: {
    user: [
      "Excellent! This move strengthens your position by improving piece coordination and central control.",
      "Very well played! You've found a move that maintains your advantage while keeping your pieces active.",
      "Good move! This demonstrates solid positional understanding and keeps your position flexible.",
      "Solid play! This move follows sound chess principles and improves your piece activity.",
      "Well done! This move enhances your position by creating better piece coordination and central influence."
    ],
    opponent: [
      "Your opponent played an excellent move! This shows strong positional understanding and maintains their advantage.",
      "Excellent play by your opponent! They found a move that improves their piece coordination effectively.",
      "Your opponent played very well! This demonstrates good strategic thinking and positional awareness.",
      "Strong move by your opponent! This shows they understand the position and are playing with good principles.",
      "Your opponent played solidly! This kind of move demonstrates strong chess fundamentals and positional understanding."
    ]
  },

  good: {
    user: [
      "Good move! This maintains a solid position and shows reasonable chess understanding.",
      "Well played! You're making sound decisions that keep your position balanced and flexible.",
      "Solid! This demonstrates good chess fundamentals and helps develop your pieces effectively.",
      "Nice move! This keeps your position healthy while maintaining good piece coordination.",
      "Good choice! This move improves your position and shows understanding of basic chess principles."
    ],
    opponent: [
      "Your opponent made a good move. This maintains a solid position and shows reasonable chess understanding.",
      "Good play by your opponent. They're making solid decisions that keep their position balanced.",
      "Your opponent played well. This demonstrates good chess fundamentals and positional awareness.",
      "Solid move by your opponent. This shows they understand the position and are playing reasonably.",
      "Your opponent made a sound choice. This keeps their position healthy and shows strategic thinking."
    ]
  },

  acceptable: {
    user: [
      "This is a reasonable choice, though stronger options were available.",
      "Playable move, but there were better ways to improve your position.",
      "Solid choice, though the position could be handled more accurately.",
      "This works, but look for moves that create more threats or improve piece activity.",
      "Acceptable move, though stronger alternatives exist that could improve your position."
    ],
    opponent: [
      "Your opponent's move is acceptable, but not the strongest choice. Better options were available.",
      "Playable move by your opponent, though they could have improved their position more significantly.",
      "Your opponent made a reasonable choice, but there were stronger alternatives available.",
      "Solid move by your opponent, though the position could be handled more accurately.",
      "Your opponent's move works, but stronger options were available that could improve their position."
    ]
  },

  inaccuracy: {
    user: [
      "Inaccuracy. You lost position or created minor weaknesses. {bestMoveSan} improves your position.",
      "Not optimal. You weakened your position slightly. {bestMoveSan} maintains better coordination.",
      "This has issues. You lost control or created tactical problems. {bestMoveSan} is better."
    ],
    opponent: [
      "Opponent's move isn't optimal - they created weaknesses. Exploit this for advantage!",
      "Opponent made an inaccuracy. Find ways to improve your position!",
      "Not the best choice by opponent. Look for tactical opportunities!"
    ]
  },

  mistake: {
    user: [
      "This isn't right. This is a serious mistake; you likely lost material or created significant tactical problems that give your opponent a major advantage. {bestMoveSan} was the best move here.",
      "This has major drawbacks. You weakened your position and allowed tactical threats. {bestMoveSan} would maintain better control.",
      "This creates serious difficulties. You made a tactical error that costs material or position. {bestMoveSan} was better."
    ],
    opponent: [
      "Your opponent made a serious mistake! Look for tactical opportunities to exploit this weakness.",
      "Opponent blundered - they weakened their position significantly. Find ways to take advantage!",
      "This is a major error by your opponent. Look for winning tactical opportunities!"
    ]
  },

  blunder: {
    user: [
      "Major blunder! You hung material or allowed mate. {bestMoveSan} would avoid this disaster.",
      "Critical error - you lost a piece or created fatal weaknesses. {bestMoveSan} keeps your pieces safe.",
      "Significant blunder that weakens your king or loses material. Better moves were available."
    ],
    opponent: [
      "Opponent blundered catastrophically! Look for immediate winning combinations.",
      "Major error by your opponent - find the winning tactic!",
      "Opponent made a critical mistake. This creates a decisive opportunity to win!"
    ]
  }
};

export function getRandomComment(classification: string, isUserMove: boolean): string {
  const templates = commentTemplates[classification as keyof typeof commentTemplates];
  if (!templates) return "Move recorded.";

  const userTemplates = templates.user || [];
  const opponentTemplates = templates.opponent || [];

  const availableTemplates = isUserMove ? userTemplates : opponentTemplates;
  if (availableTemplates.length === 0) return "Move recorded.";

  return availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
}

export function buildEnhancedComment(context: CommentContext): string {
  // Delegate to the human-friendly builder to avoid centipawn jargon
  return buildHumanComment({ ...(context as any) })
}

// New: Human-friendly comment builder that avoids centipawns and adds reasons
export function buildHumanComment(context: HumanReasonContext): string {
  const {
    classification,
    bestMoveSan,
    isUserMove,
    isOpeningMove,
    tacticalInsights = [],
    positionalInsights = [],
    risks = [],
    benefits = [],
    fenBefore,
    move,
    centipawnLoss,
  } = context

  if (isOpeningMove) {
    // Generate more specific opening move explanations based on move number
    const moveNumber = context.moveNumber || 0
    if (moveNumber <= 3) {
      return 'Book move. This is a fundamental opening move that helps control the center and develop your position.'
    } else if (moveNumber <= 6) {
      return 'Book move. This follows established opening theory and helps develop your pieces effectively.'
    } else if (moveNumber <= 10) {
      return 'Book move. This is a well-known opening continuation that maintains good piece coordination.'
    } else {
      return 'Book move. This is a standard opening move that follows sound chess principles.'
    }
  }

  // Use position-specific analysis for blunders, mistakes, and brilliant moves
  if (fenBefore && move && isUserMove) {
    const safeBestMove = bestMoveSan || 'the best move'

    if (classification === 'blunder' && centipawnLoss && centipawnLoss > 50) {
      try {
        const { generateSpecificBlunderComment } = require('./positionSpecificComments')
        const specificComment = generateSpecificBlunderComment(fenBefore, move, safeBestMove, centipawnLoss)
        if (specificComment && specificComment.length > 10) {
          return specificComment
        }
      } catch (error) {
        console.warn('Error generating specific blunder comment:', error)
      }
    } else if (classification === 'mistake' && centipawnLoss && centipawnLoss > 30) {
      try {
        const { generateSpecificMistakeComment } = require('./positionSpecificComments')
        // Pass moveSan from context to prevent contradictory comments
        const moveSan = (context as HumanReasonContext).move || (context as HumanReasonContext).moveSan
        const specificComment = generateSpecificMistakeComment(fenBefore, move, safeBestMove, centipawnLoss, moveSan)
        console.log('Generated specific mistake comment:', specificComment)
        if (specificComment && specificComment.length > 10) {
          return specificComment
        }
      } catch (error) {
        console.warn('Error generating specific mistake comment:', error)
      }
    } else if (classification === 'brilliant') {
      try {
        const { generateSpecificBrilliantComment } = require('./positionSpecificComments')
        const specificComment = generateSpecificBrilliantComment(fenBefore, move)
        if (specificComment && specificComment.length > 10) {
          return specificComment
        }
      } catch (error) {
        console.warn('Error generating specific brilliant comment:', error)
      }
    }
  }

  let baseComment = getRandomComment(classification, isUserMove)
  console.log('Selected base comment:', baseComment)

  // Replace {bestMoveSan} placeholder with actual best move
  if (baseComment.includes('{bestMoveSan}')) {
    const safeBestMove = bestMoveSan || 'the best move'
    baseComment = baseComment.replace(/{bestMoveSan}/g, safeBestMove)
    console.log('Replaced bestMoveSan with:', safeBestMove)
  }

  const positives: string[] = []
  const negatives: string[] = []

  // Prioritize tactical and positional insights for educational value
  if (tacticalInsights.length) {
    tacticalInsights.slice(0, 2).forEach(insight => {
      if (insight && insight.trim()) positives.push(insight.trim())
    })
  }
  if (positionalInsights.length && positives.length < 3) {
    positionalInsights.slice(0, 2).forEach(insight => {
      if (insight && insight.trim() && positives.length < 3) positives.push(insight.trim())
    })
  }
  if (benefits.length && positives.length < 3) {
    benefits.slice(0, 1).forEach(benefit => {
      if (benefit && benefit.trim() && positives.length < 3) positives.push(benefit.trim())
    })
  }
  if (risks.length) {
    risks.slice(0, 2).forEach(risk => {
      if (risk && risk.trim()) negatives.push(risk.trim())
    })
  }

  const fmt = (items: string[]) => {
    const cleaned = items
      .map(s => (s || '').trim())
      .filter(Boolean)
      .map(s => {
        // Capitalize first letter if it's not already
        const capitalized = s.charAt(0).toUpperCase() + s.slice(1)
        // Remove trailing punctuation
        return /[.!?]$/.test(capitalized) ? capitalized.slice(0, -1) : capitalized
      })
    if (!cleaned.length) return ''
    // Limit to 1 insight for brevity
    return cleaned[0] + '.'
  }

  switch (classification) {
    case 'brilliant':
    case 'best':
    case 'great':
    case 'excellent':
    case 'good':
    case 'acceptable': {
      const why = fmt(positives)
      if (why) {
        // Ensure proper sentence structure
        if (baseComment.endsWith('.') || baseComment.endsWith('!') || baseComment.endsWith('?')) {
          baseComment += ' ' + why.charAt(0).toUpperCase() + why.slice(1)
        } else {
          baseComment += ' ' + why
        }
      }
      break
    }
    case 'inaccuracy':
    case 'mistake':
    case 'blunder': {
      const why = fmt(negatives.length ? negatives : risks.concat(tacticalInsights).slice(0, 1))
      if (why) {
        // Ensure proper sentence structure
        if (baseComment.endsWith('.') || baseComment.endsWith('!') || baseComment.endsWith('?')) {
          baseComment += ' ' + why.charAt(0).toUpperCase() + why.slice(1)
        } else {
          baseComment += ' ' + why
        }
      }
      break
    }
    default:
      break
  }

  if (bestMoveSan && (classification === 'mistake' || classification === 'blunder')) {
    if (isUserMove) baseComment += ` ${bestMoveSan} was better.`
    else baseComment += ` ${bestMoveSan} instead.`
  }

  return baseComment
}
