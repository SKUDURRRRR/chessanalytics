/**
 * CoachChatPanel - Intercom-style floating chat widget for Coach Tal.
 * Renders as a fixed FAB button (bottom-right) that opens a chat popup.
 * Reads position context from CoachChatContext - only visible when context is set.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChatMessage, CoachChatResponse } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachChat } from '../../contexts/CoachChatContext'
import { TalCoachIcon } from '../ui/TalCoachIcon'

const SUGGESTIONS: Record<string, string[]> = {
  puzzle: ['Give me a hint', 'What pattern should I look for?', 'What pieces matter most here?'],
  play: ['What should I focus on?', 'Is my king safe?', 'What is my opponent planning?'],
  analysis: ['Why was this move bad?', 'What was the idea here?', 'How could I improve?'],
  'game-review': ['Why was this move bad?', 'Show me the best continuation', 'How do I avoid this pattern?'],
}

export function CoachChatPanel() {
  const { user } = useAuth()
  const { positionContext } = useCoachChat()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevContextTypeRef = useRef<string | null>(null)

  // Clear chat when context type changes (switching between play/puzzle/analysis)
  useEffect(() => {
    const newType = positionContext?.contextType ?? null
    if (prevContextTypeRef.current !== null && prevContextTypeRef.current !== newType) {
      setMessages([])
      setError(null)
    }
    prevContextTypeRef.current = newType
  }, [positionContext?.contextType])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setUnreadCount(0)
    }
  }, [isOpen])

  // Don't render if no position context (not on a relevant page)
  if (!positionContext) return null

  const sendMessage = async (text?: string) => {
    const messageText = (text || inputValue).trim()
    if (!messageText || isLoading || !user) return

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

      if (!isOpen) {
        setUnreadCount(prev => prev + 1)
      }
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

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  const suggestions = SUGGESTIONS[positionContext.contextType] || SUGGESTIONS.play

  const widget = (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat popup */}
      {isOpen && (
        <div className="w-[360px] max-h-[520px] rounded-2xl border border-sky-400/30 bg-slate-900 shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-900/80 to-blue-900/80 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <TalCoachIcon size={30} />
              <div>
                <div className="text-white font-semibold text-sm leading-tight">Coach Tal</div>
                <div className="text-sky-300/70 text-xs">
                  {positionContext.contextType === 'puzzle' ? 'Puzzle mode' :
                   positionContext.contextType === 'play' ? 'Live game' : 'Game review'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
                  title="Clear chat"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[340px]">
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-6">
                <div className="mb-3">
                  <TalCoachIcon size={48} />
                </div>
                <p className="text-slate-300 text-sm font-medium mb-1">Ask Coach Tal</p>
                <p className="text-slate-500 text-xs">
                  {positionContext.contextType === 'puzzle'
                    ? 'Stuck? I\'ll guide you with hints, not answers.'
                    : positionContext.contextType === 'play'
                      ? 'Ask about your position, strategy, or plans.'
                      : 'Ask about any move or position in this game.'}
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'coach' && (
                  <div className="flex-shrink-0 mr-2 mt-1">
                    <TalCoachIcon size={22} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3 py-2 text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-sky-600/40 rounded-2xl rounded-br-sm text-white'
                      : 'bg-slate-800/80 border border-white/5 rounded-2xl rounded-bl-sm text-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex-shrink-0 mr-2 mt-1">
                  <div className="animate-pulse">
                    <TalCoachIcon size={22} />
                  </div>
                </div>
                <div className="bg-slate-800/80 border border-white/5 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-slate-400">
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

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 0 && !isLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="text-xs px-2.5 py-1 rounded-full border border-sky-500/30 text-sky-300 hover:bg-sky-500/10 hover:border-sky-400/50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-white/10 bg-slate-900/50">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Coach Tal..."
                maxLength={500}
                disabled={isLoading || !user}
                className="flex-1 bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isLoading || !user}
                className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl px-3 py-2 transition-colors"
                title="Send"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`group relative w-14 h-14 rounded-full shadow-lg shadow-black/40 flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-slate-800 border border-white/20 scale-90'
            : 'bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 hover:scale-105 hover:shadow-sky-500/25'
        }`}
        title={isOpen ? 'Close chat' : 'Chat with Coach Tal'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <TalCoachIcon size={32} />
        )}

        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  )

  return createPortal(widget, document.body)
}
