import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Wand2, Code, Shield, FileText, Gauge, ArrowRight } from 'lucide-react'
import TemplateEditor from '../components/TemplateEditor'
import { useCreateAgent } from '../hooks/useApi'

const templates = [
  {
    id: 'reviewer',
    name: 'Code Reviewer',
    description: 'Reviews PRs for code quality, best practices, and bugs',
    icon: Code,
    color: 'text-blue-400 bg-blue-500/20',
    yaml: `name: CodeReviewer
template: reviewer
config:
  model: claude-3-opus
  maxTokens: 4096
  reviewDepth: thorough
  checkStyle: true
  checkSecurity: true
  checkPerformance: true`,
  },
  {
    id: 'tester',
    name: 'Test Writer',
    description: 'Generates comprehensive unit and integration tests',
    icon: Gauge,
    color: 'text-green-400 bg-green-500/20',
    yaml: `name: TestWriter
template: tester
config:
  model: claude-3-opus
  maxTokens: 4096
  testFramework: vitest
  coverage: 80
  includeEdgeCases: true`,
  },
  {
    id: 'security',
    name: 'Security Scanner',
    description: 'Scans code for vulnerabilities and security issues',
    icon: Shield,
    color: 'text-red-400 bg-red-500/20',
    yaml: `name: SecurityScanner
template: security
config:
  model: claude-3-opus
  maxTokens: 4096
  scanDependencies: true
  checkOWASP: true
  severityThreshold: medium`,
  },
  {
    id: 'docs',
    name: 'Doc Generator',
    description: 'Generates documentation from code and comments',
    icon: FileText,
    color: 'text-purple-400 bg-purple-500/20',
    yaml: `name: DocGenerator
template: docs
config:
  model: claude-3-opus
  maxTokens: 4096
  format: markdown
  includeExamples: true
  generateAPI: true`,
  },
]

export default function CreateAgent() {
  const navigate = useNavigate()
  const createAgent = useCreateAgent()
  const [step, setStep] = useState<'select' | 'configure'>('select')
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null)
  const [yaml, setYaml] = useState('')

  const handleSelectTemplate = (template: typeof templates[0]) => {
    setSelectedTemplate(template)
    setYaml(template.yaml)
    setStep('configure')
  }

  const handleCreate = async () => {
    if (!selectedTemplate) return

    try {
      // Parse YAML to get name
      const nameMatch = yaml.match(/name:\s*(.+)/)
      const name = nameMatch?.[1] || selectedTemplate.name

      await createAgent.mutateAsync({
        name,
        template: selectedTemplate.id,
        config: {},
      })
      navigate('/agents')
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Create Agent</h1>
        <p className="text-gray-400 mt-1">
          {step === 'select' ? 'Choose a template to get started' : 'Configure your agent'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === 'select' ? 'text-red-400' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'select' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'
          }`}>
            1
          </div>
          <span className="font-medium">Select Template</span>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-600" />
        <div className={`flex items-center gap-2 ${step === 'configure' ? 'text-red-400' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'configure' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'
          }`}>
            2
          </div>
          <span className="font-medium">Configure</span>
        </div>
      </div>

      {step === 'select' ? (
        /* Template Selection */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-red-500/50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${template.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-red-400 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-gray-400 mt-1">{template.description}</p>
                  </div>
                  <Wand2 className="w-5 h-5 text-gray-600 group-hover:text-red-400 transition-colors" />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        /* Configuration Step */
        <div className="space-y-6">
          {/* Selected Template Info */}
          {selectedTemplate && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${selectedTemplate.color}`}>
                <selectedTemplate.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-400">{selectedTemplate.description}</p>
              </div>
              <button
                onClick={() => setStep('select')}
                className="text-gray-400 hover:text-white text-sm"
              >
                Change
              </button>
            </div>
          )}

          {/* YAML Editor */}
          <TemplateEditor value={yaml} onChange={setYaml} />

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => setStep('select')}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={createAgent.isPending}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              <Bot className="w-5 h-5" />
              {createAgent.isPending ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
