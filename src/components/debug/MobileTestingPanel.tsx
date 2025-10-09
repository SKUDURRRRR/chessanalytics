// Mobile testing panel for development and QA
import { useState, useEffect } from 'react'
import { mobileTesting } from '../../utils/mobileTesting'

interface MobileTestingPanelProps {
  className?: string
}

export function MobileTestingPanel({ className = '' }: MobileTestingPanelProps) {
  const [report, setReport] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [performance, setPerformance] = useState<{
    loadTime: number
    renderTime: number
    memoryUsage?: number
  } | null>(null)

  const generateReport = async () => {
    setIsGenerating(true)
    
    try {
      // Generate basic report
      const basicReport = mobileTesting.generateReport()
      
      // Measure performance
      const perf = await mobileTesting.measurePerformance()
      setPerformance(perf)
      
      // Combine reports
      const fullReport = `${basicReport}

Performance Metrics:
==================
Load Time: ${perf.loadTime.toFixed(2)}ms
Render Time: ${perf.renderTime.toFixed(2)}ms
${perf.memoryUsage ? `Memory Usage: ${(perf.memoryUsage / 1024 / 1024).toFixed(2)}MB` : ''}`
      
      setReport(fullReport)
    } catch (error) {
      setReport(`Error generating report: ${error}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const simulateDevice = (device: 'iphone' | 'android' | 'tablet' | 'desktop') => {
    mobileTesting.simulateDevice(device)
    // Regenerate report after viewport change
    setTimeout(generateReport, 100)
  }

  const copyReport = () => {
    navigator.clipboard.writeText(report)
  }

  useEffect(() => {
    // Generate initial report
    generateReport()
  }, [])

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-lg shadow-black/40 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Mobile Testing Panel</h3>
        <div className="flex gap-2">
          <button
            onClick={generateReport}
            disabled={isGenerating}
            className="btn-touch-sm rounded-full border border-sky-400/40 bg-sky-500/10 text-sky-200 hover:border-sky-300/60 hover:bg-sky-500/20 disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Refresh'}
          </button>
          {report && (
            <button
              onClick={copyReport}
              className="btn-touch-sm rounded-full border border-white/10 bg-white/10 text-slate-200 hover:border-white/30 hover:bg-white/20"
            >
              Copy Report
            </button>
          )}
        </div>
      </div>

      {/* Device Simulation */}
      <div className="mb-6">
        <h4 className="mb-3 text-sm font-semibold text-white">Simulate Device</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => simulateDevice('iphone')}
            className="btn-touch-sm rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            📱 iPhone
          </button>
          <button
            onClick={() => simulateDevice('android')}
            className="btn-touch-sm rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            🤖 Android
          </button>
          <button
            onClick={() => simulateDevice('tablet')}
            className="btn-touch-sm rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            📱 Tablet
          </button>
          <button
            onClick={() => simulateDevice('desktop')}
            className="btn-touch-sm rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            💻 Desktop
          </button>
        </div>
      </div>

      {/* Quick Tests */}
      <div className="mb-6">
        <h4 className="mb-3 text-sm font-semibold text-white">Quick Tests</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
            <span className="text-sm text-slate-200">Touch Targets</span>
            <span className={`text-xs font-medium ${
              mobileTesting.validateTouchTargets().valid ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {mobileTesting.validateTouchTargets().valid ? '✅ Pass' : '❌ Issues'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
            <span className="text-sm text-slate-200">Horizontal Scroll</span>
            <span className={`text-xs font-medium ${
              !mobileTesting.checkHorizontalScroll().hasHorizontalScroll ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {!mobileTesting.checkHorizontalScroll().hasHorizontalScroll ? '✅ Clean' : '❌ Issues'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      {performance && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold text-white">Performance</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
              <div className="text-slate-400">Load Time</div>
              <div className="font-semibold text-sky-300">{performance.loadTime.toFixed(0)}ms</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
              <div className="text-slate-400">Render Time</div>
              <div className="font-semibold text-emerald-300">{performance.renderTime.toFixed(0)}ms</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
              <div className="text-slate-400">Memory</div>
              <div className="font-semibold text-purple-300">
                {performance.memoryUsage ? `${(performance.memoryUsage / 1024 / 1024).toFixed(1)}MB` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Report */}
      {report && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Full Report</h4>
          <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-300">
            {report}
          </pre>
        </div>
      )}
    </div>
  )
}
