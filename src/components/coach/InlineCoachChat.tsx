/**
 * InlineCoachChat - Inline chat panel for Coach Tal.
 * Rendered as part of the page layout (not a floating widget).
 * Used on the Coach Dashboard for the integrated board+chat experience.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatMessage, ChatPositionContext, CoachChatResponse } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useAuth } from '../../contexts/AuthContext'
import { TalCoachIcon } from '../ui/TalCoachIcon'

const SUGGESTIONS = [
  'Why was this bad?',
  'Best continuation?',
  'Explain this opening',
]

interface InlineCoachChatProps {
  positionContext: ChatPositionContext | null
}

export function InlineCoachChat({ positionContext }: InlineCoachChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = async (text?: string) => {
    const messageText = (text || inputValue).trim()
    if (!messageText || isLoading || !user || !positionContext) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      positionContext: { ...positionContext },
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role === 'coach' ? 'coach' : 'user',
        content: m.content,
      }))

      const response: CoachChatResponse = await CoachingService.chatWithCoach(
        messageText,
        positionContext,
        conversationHistory,
        user.id
      )

      const coachMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'coach',
        content: response.response,
        timestamp: Date.now(),
      }

      setMessages(prev => [...prev, coachMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <TalCoachIcon size={24} />
        <span className="text-[13px] font-medium text-white">Coach Tal</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-[5px] h-[5px] rounded-full bg-emerald-400" />
          <span className="text-[10px] text-gray-600">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <div className="mb-3 flex justify-center">
              <TalCoachIcon size={48} />
            </div>
            <p className="text-gray-400 text-sm font-medium mb-1">Ask Coach Tal</p>
            <p className="text-gray-600 text-xs">
              Ask about any move or position in this game.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[88%] rounded-lg px-3 py-2 text-[11px] leading-relaxed"
              style={{
                background: msg.role === 'user'
                  ? 'rgba(59,130,246,0.15)'
                  : 'rgba(255,255,255,0.04)',
                color: msg.role === 'user' ? '#93c5fd' : '#d1d5db',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2 text-sm text-gray-500"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* scroll anchor */}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && !isLoading && (
        <div
          className="px-4 py-2 flex flex-wrap gap-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-[10px] text-gray-500 rounded px-2 py-1 transition-colors hover:text-gray-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="px-4 py-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div
          className="flex items-center rounded-md px-3 py-2"
          style={{
            background: '#1c1d20',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this position..."
            maxLength={500}
            disabled={isLoading || !user || !positionContext}
            className="flex-1 bg-transparent text-[11px] text-white placeholder-gray-600 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputValue.trim() || isLoading || !user || !positionContext}
            className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors ml-2"
            title="Send"
          >
            <span
              className="text-[11px] rounded px-1.5 py-0.5"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              &#8593;
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
