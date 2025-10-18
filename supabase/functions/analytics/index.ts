// Simple Analytics Function - One function, everything you need
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getAllowedOrigins(): string[] {
  const rawOrigins = Deno.env.get('ALLOWED_ORIGINS')
  if (!rawOrigins) {
    return ['http://localhost:3000', 'http://localhost:5173']
  }
  return rawOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

const allowedOrigins = getAllowedOrigins()

function buildCorsHeaders(requestOrigin: string | null) {
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

interface AnalyticsRequest {
  userId: string
  platform?: string
  fromDate?: string
  toDate?: string
  color?: 'white' | 'black'
}

interface AnalyticsResponse {
  totalGames: number
  wins: number
  losses: number
  draws: number
  openings: Array<{
    opening: string
    games: number
    wins: number
  }>
}

Deno.serve(async req => {
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    const { data: authData, error: userError } = await supabase.auth.getUser()

    if (userError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { userId, platform, fromDate, toDate, color }: AnalyticsRequest = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build simple query
    let query = supabase.from('games').select('*').eq('user_id', userId)

    if (platform) query = query.eq('platform', platform)
    if (fromDate) query = query.gte('played_at', fromDate)
    if (toDate) query = query.lte('played_at', toDate)

    const { data: games, error } = await query

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          openings: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Simple calculations
    const totalGames = games.length
    const wins = games.filter(g => g.result === 'win').length
    const losses = games.filter(g => g.result === 'loss').length
    const draws = games.filter(g => g.result === 'draw').length

    // Group by opening
    const openingGroups = games.reduce((acc, game) => {
      const opening = game.opening || 'Unknown'
      if (!acc[opening]) {
        acc[opening] = { games: 0, wins: 0 }
      }
      acc[opening].games++
      if (game.result === 'win') acc[opening].wins++
      return acc
    }, {})

    // Convert to array
    const openings = Object.entries(openingGroups)
      .map(([opening, stats]) => ({
        opening,
        games: stats.games,
        wins: stats.wins,
      }))
      .sort((a, b) => b.wins - a.wins) // Sort by wins
      .slice(0, 10) // Top 10 openings

    const result: AnalyticsResponse = {
      totalGames,
      wins,
      losses,
      draws,
      openings,
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
