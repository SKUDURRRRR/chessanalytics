import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface PaymentTier {
  id: string
  name: string
  description: string
  price_monthly: number | null
  price_yearly: number | null
  import_limit: number | null
  analysis_limit: number | null
  features: string[]
}

export default function PricingPage() {
  const { user } = useAuth()
  const [tiers, setTiers] = useState<PaymentTier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTiers()
  }, [])

  const fetchTiers = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'
      const response = await fetch(`${API_URL}/api/v1/payment-tiers`)
      if (response.ok) {
        const data = await response.json()
        setTiers(data.tiers || [])
      }
    } catch (error) {
      console.error('Error fetching tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (amount: number | null) => {
    if (amount === null) return 'Contact us'
    return `$${amount.toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading pricing...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-400">
            Start free, upgrade when you're ready for unlimited access
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`bg-slate-900 border ${
                tier.id === 'pro_monthly' || tier.id === 'pro_yearly'
                  ? 'border-blue-500 ring-2 ring-blue-500'
                  : 'border-slate-700'
              } rounded-lg p-8 relative`}
            >
              {(tier.id === 'pro_monthly' || tier.id === 'pro_yearly') && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  POPULAR
                </div>
              )}

              <h2 className="text-2xl font-bold text-white mb-2">{tier.name}</h2>
              <p className="text-slate-400 text-sm mb-6">{tier.description}</p>

              <div className="mb-6">
                {tier.price_monthly !== null && tier.price_monthly > 0 ? (
                  <>
                    <span className="text-4xl font-bold text-white">
                      {formatPrice(tier.price_monthly)}
                    </span>
                    <span className="text-slate-400">/month</span>
                  </>
                ) : tier.price_yearly !== null && tier.price_yearly > 0 ? (
                  <>
                    <span className="text-4xl font-bold text-white">
                      {formatPrice(tier.price_yearly)}
                    </span>
                    <span className="text-slate-400">/year</span>
                    {tier.price_monthly !== null && (
                      <p className="text-sm text-green-400 mt-1">
                        Save ${((tier.price_monthly * 12) - tier.price_yearly).toFixed(2)}/year
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-4xl font-bold text-white">Free</span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start text-slate-300 text-sm">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {tier.id === 'free' ? (
                user ? (
                  <div className="text-center py-3 text-slate-400 font-semibold">
                    Current Plan
                  </div>
                ) : (
                  <a
                    href="/signup"
                    className="block w-full text-center px-4 py-3 bg-slate-700 text-white rounded-md hover:bg-slate-600 font-semibold"
                  >
                    Sign Up Free
                  </a>
                )
              ) : tier.id === 'enterprise' ? (
                <a
                  href="mailto:support@chessdata.app"
                  className="block w-full text-center px-4 py-3 bg-slate-700 text-white rounded-md hover:bg-slate-600 font-semibold"
                >
                  Contact Sales
                </a>
              ) : user ? (
                <a
                  href="/profile"
                  className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
                >
                  Upgrade Now
                </a>
              ) : (
                <a
                  href="/signup"
                  className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
                >
                  Get Started
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            All plans include access to chess analytics, opening analysis, and personality scores.
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Need help choosing? <a href="mailto:support@chessdata.app" className="text-blue-500 hover:text-blue-400">Contact us</a>
          </p>
        </div>
      </div>
    </div>
  )
}
