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
}

export const commentTemplates = {
  brilliant: {
    user: [
      "🌟 Brilliant! This move demonstrates exceptional tactical vision and shows advanced chess understanding.",
      "🌟 Outstanding! You've found a move that even strong players might miss - this shows real chess mastery.",
      "🌟 Exceptional play! This kind of move separates strong players from average ones and wins games.",
      "🌟 Spectacular! This move shows deep chess knowledge and the ability to calculate complex variations.",
      "🌟 Masterful! This demonstrates the kind of chess understanding that wins tournaments."
    ],
    opponent: [
      "🌟 Your opponent played a brilliant move! This shows exceptional tactical vision and advanced chess understanding.",
      "🌟 Outstanding play by your opponent! Study this position carefully to understand the sophisticated tactics involved.",
      "🌟 Your opponent found a brilliant resource! This demonstrates the kind of chess mastery that wins games.",
      "🌟 Exceptional move by your opponent! This shows deep tactical understanding and calculation ability.",
      "🌟 Your opponent played masterfully! This is the kind of move that separates strong players from average ones."
    ]
  },
  
  best: {
    user: [
      "✅ Perfect! This is exactly what the position demands and shows excellent chess understanding.",
      "✅ Excellent! You've found the strongest move available and kept your position on track.",
      "✅ Well played! This demonstrates solid chess fundamentals and tactical awareness.",
      "✅ Optimal! This move maintains your advantage and shows precise calculation.",
      "✅ Accurate! This is the kind of move that keeps you ahead in the position."
    ],
    opponent: [
      "✅ Your opponent played the best move available. This is solid, accurate play that maintains their position well.",
      "✅ Strong move by your opponent. They found the optimal continuation and show good chess fundamentals.",
      "✅ Your opponent played precisely. This demonstrates solid understanding and keeps their position healthy.",
      "✅ Good play by your opponent. They're making accurate moves that maintain their position.",
      "✅ Your opponent played optimally. This shows they understand the position well."
    ]
  },
  
  great: {
    user: [
      "🎯 Great move! This shows strong chess understanding and improves your position significantly.",
      "🎯 Excellent work! You're finding good moves consistently and demonstrating tactical awareness.",
      "🎯 Well played! This kind of play will help you win more games and shows chess mastery.",
      "🎯 Strong move! This demonstrates good chess fundamentals and positional understanding.",
      "🎯 Very good! This move improves your position and shows you're thinking strategically."
    ],
    opponent: [
      "🎯 Your opponent played a great move! This is very strong play that shows excellent chess understanding.",
      "🎯 Great play by your opponent! They found a move that improves their position significantly.",
      "🎯 Your opponent played excellently! This demonstrates strong tactical awareness and chess understanding.",
      "🎯 Very strong move by your opponent! This shows they're thinking strategically and positionally.",
      "🎯 Your opponent played well! This kind of move demonstrates good chess fundamentals."
    ]
  },
  
  excellent: {
    user: [
      "⭐ Excellent! This shows good chess fundamentals and maintains your position well.",
      "⭐ Very well played! You're making solid decisions that demonstrate chess understanding.",
      "⭐ Good move! This keeps your position healthy and shows strategic thinking.",
      "⭐ Solid play! This demonstrates positional awareness and good chess principles.",
      "⭐ Well done! This move improves your position and shows tactical awareness."
    ],
    opponent: [
      "⭐ Your opponent played an excellent move! This is nearly optimal play that shows strong chess fundamentals.",
      "⭐ Excellent play by your opponent! They found a move that maintains their position well.",
      "⭐ Your opponent played very well! This demonstrates good tactical awareness and chess understanding.",
      "⭐ Strong move by your opponent! This shows they understand the position and are playing accurately.",
      "⭐ Your opponent played solidly! This kind of move demonstrates good chess fundamentals."
    ]
  },
  
  good: {
    user: [
      "👍 Good move! This maintains a solid position and shows reasonable chess understanding.",
      "👍 Well played! You're making sound decisions that keep your position balanced.",
      "👍 Solid! This demonstrates good chess fundamentals and positional awareness.",
      "👍 Nice move! This keeps your position healthy and shows strategic thinking.",
      "👍 Good choice! This move improves your position and demonstrates chess understanding."
    ],
    opponent: [
      "👍 Your opponent made a good move. This maintains a solid position and shows reasonable chess understanding.",
      "👍 Good play by your opponent. They're making solid decisions that keep their position balanced.",
      "👍 Your opponent played well. This demonstrates good chess fundamentals and positional awareness.",
      "👍 Solid move by your opponent. This shows they understand the position and are playing reasonably.",
      "👍 Your opponent made a sound choice. This keeps their position healthy and shows strategic thinking."
    ]
  },
  
  acceptable: {
    user: [
      "📖 This is a reasonable choice, though stronger options were available.",
      "📖 Playable move, but there were better ways to improve your position.",
      "📖 Solid choice, though the position could be handled more accurately.",
      "📖 This works, but look for moves that create more threats or improve piece activity.",
      "📖 Acceptable move, though stronger alternatives exist that could improve your position."
    ],
    opponent: [
      "📖 Your opponent's move is acceptable, but not the strongest choice. Better options were available.",
      "📖 Playable move by your opponent, though they could have improved their position more significantly.",
      "📖 Your opponent made a reasonable choice, but there were stronger alternatives available.",
      "📖 Solid move by your opponent, though the position could be handled more accurately.",
      "📖 Your opponent's move works, but stronger options were available that could improve their position."
    ]
  },
  
  inaccuracy: {
    user: [
      "⚠️ This move has some issues - look for moves that improve your position more significantly.",
      "⚠️ Not quite optimal - consider moves that create more threats or improve piece activity.",
      "⚠️ This weakens your position slightly - look for stronger alternatives next time.",
      "⚠️ This isn't the best choice - look for moves that maintain your advantage better.",
      "⚠️ This move has problems - consider all your options and look for stronger continuations."
    ],
    opponent: [
      "⚠️ Your opponent's move isn't optimal. Look for ways to exploit this weakness and improve your position.",
      "⚠️ Your opponent made an inaccuracy. This gives you an opportunity to gain an advantage.",
      "⚠️ Your opponent's move has issues. Look for ways to exploit this and improve your position.",
      "⚠️ Not the best choice by your opponent. This creates opportunities for you to gain an edge.",
      "⚠️ Your opponent's move isn't optimal. Look for tactical opportunities to exploit this weakness."
    ]
  },
  
  mistake: {
    user: [
      "❌ This creates problems for your position - take more time to calculate before moving.",
      "❌ This isn't the right approach - look for tactical opportunities and better moves.",
      "❌ This move has drawbacks - consider all your opponent's possible responses.",
      "❌ This weakens your position - look for moves that maintain your advantage better.",
      "❌ This creates difficulties - take more time to calculate and look for stronger alternatives."
    ],
    opponent: [
      "❌ Your opponent's move creates significant difficulties for them. Look for tactical opportunities to exploit this mistake.",
      "❌ Your opponent made a mistake! This creates tactical opportunities for you to gain a significant advantage.",
      "❌ Your opponent's move has problems. Look for ways to take advantage of their error and improve your position.",
      "❌ This is a mistake by your opponent. Look for tactical opportunities to exploit this and gain an advantage.",
      "❌ Your opponent's move creates difficulties. This could be a turning point - look for winning tactics."
    ]
  },
  
  blunder: {
    user: [
      "💥 This is a major error - always check for hanging pieces and calculate threats.",
      "💥 Serious mistake - take your time and look for the best move available.",
      "💥 This creates major problems - learn from this and avoid similar errors.",
      "💥 This is a significant error - always check for tactical threats before moving.",
      "💥 Major blunder - take more time to calculate and avoid hanging pieces."
    ],
    opponent: [
      "💥 Your opponent made a serious mistake that could be game-changing. Look for winning combinations and decisive tactics.",
      "💥 Your opponent blundered! This creates a major tactical opportunity - look for immediate winning chances.",
      "💥 This is a major error by your opponent. Look for ways to exploit this and potentially win the game.",
      "💥 Your opponent made a serious mistake. This could be game-changing - look for winning tactics immediately.",
      "💥 Your opponent blundered badly! This creates a major opportunity - look for decisive tactical combinations."
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

export function buildEnhancedComment(context: CommentContext): string {\n  // Delegate to the human-friendly builder to avoid centipawn jargon\n  return buildHumanComment({ ...(context as any) })\n}\n

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
  } = context

  if (isOpeningMove) {
    return 'Book move.'
  }

  let baseComment = getRandomComment(classification, isUserMove)

  const positives: string[] = []
  const negatives: string[] = []
  if (tacticalInsights.length) positives.push(tacticalInsights[0])
  if (positionalInsights.length && positives.length < 2) positives.push(positionalInsights[0])
  if (benefits.length && positives.length < 2) positives.push(benefits[0])
  if (risks.length) negatives.push(risks[0])

  const fmt = (items: string[]) => {
    const cleaned = items
      .map(s => (s || '').trim())
      .filter(Boolean)
      .map(s => (/[.!?]$/.test(s) ? s.slice(0, -1) : s))
    if (!cleaned.length) return ''
    if (cleaned.length === 1) return cleaned[0] + '.'
    return cleaned.slice(0, 2).join('; ') + '.'
  }

  switch (classification) {
    case 'brilliant':
    case 'best':
    case 'great':
    case 'excellent':
    case 'good':
    case 'acceptable': {
      const why = fmt(positives)
      if (why) baseComment += ' ' + why
      break
    }
    case 'inaccuracy':
    case 'mistake':
    case 'blunder': {
      const why = fmt(negatives.length ? negatives : risks.concat(tacticalInsights).slice(0, 2))
      if (why) baseComment += ' ' + why
      break
    }
    default:
      break
  }

  if (bestMoveSan && (classification === 'mistake' || classification === 'blunder')) {
    if (isUserMove) baseComment += ` Better was ${bestMoveSan}.`
    else baseComment += ` They could have tried ${bestMoveSan} instead.`
  }

  return baseComment
}
