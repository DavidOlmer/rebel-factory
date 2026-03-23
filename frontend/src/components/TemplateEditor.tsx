import { useState } from 'react'
import { Code, Copy, Check, RefreshCw } from 'lucide-react'

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export default function TemplateEditor({ value, onChange, readOnly = false }: TemplateEditorProps) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleChange = (newValue: string) => {
    onChange(newValue)
    // Basic YAML validation
    try {
      // Check for common YAML errors
      const lines = newValue.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('\t')) {
          throw new Error(`Tab character on line ${i + 1}. Use spaces instead.`)
        }
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid YAML')
    }
  }

  const handleFormat = () => {
    // Basic formatting: normalize indentation
    const lines = value.split('\n')
    const formatted = lines
      .map(line => line.replace(/\t/g, '  '))
      .join('\n')
    onChange(formatted)
  }

  const lineCount = value.split('\n').length

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">agent.yaml</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFormat}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Format"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex">
        {/* Line Numbers */}
        <div className="flex-shrink-0 py-4 px-3 bg-gray-900/50 text-right select-none">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="text-gray-600 text-sm font-mono leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Area */}
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            className={`w-full h-80 p-4 bg-transparent text-gray-100 font-mono text-sm leading-6 resize-none focus:outline-none ${
              readOnly ? 'cursor-not-allowed opacity-70' : ''
            }`}
            style={{ tabSize: 2 }}
          />
        </div>
      </div>

      {/* Error Bar */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30">
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 bg-gray-800/50 text-xs text-gray-500">
        <span>YAML</span>
        <span>{lineCount} lines</span>
      </div>
    </div>
  )
}
