import React, { useState, useCallback } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { useMutation, apiPost } from '../hooks/useApi';
import { useNavigation } from '../App';
import type { Agent, Tier, Category } from '../types';

interface CreateAgentPayload {
  name: string;
  description?: string;
  tier: Tier;
  category: Category;
  templateId?: string;
  model?: string;
  skills?: string[];
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: Category;
  defaultModel: string;
}

const templateOptions: TemplateOption[] = [
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews PRs for code quality, best practices, and bugs',
    icon: '🔍',
    category: 'innovation',
    defaultModel: 'claude-3-opus',
  },
  {
    id: 'test-writer',
    name: 'Test Writer',
    description: 'Generates comprehensive unit and integration tests',
    icon: '🧪',
    category: 'innovation',
    defaultModel: 'claude-3-opus',
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Scans code for vulnerabilities and security issues',
    icon: '🛡️',
    category: 'services',
    defaultModel: 'claude-3-opus',
  },
  {
    id: 'doc-generator',
    name: 'Doc Generator',
    description: 'Generates documentation from code and comments',
    icon: '📚',
    category: 'services',
    defaultModel: 'claude-3-sonnet',
  },
  {
    id: 'content-writer',
    name: 'Content Writer',
    description: 'Creates marketing copy and content for campaigns',
    icon: '✍️',
    category: 'entertainment',
    defaultModel: 'claude-3-opus',
  },
  {
    id: 'travel-planner',
    name: 'Travel Planner',
    description: 'Plans itineraries and travel recommendations',
    icon: '✈️',
    category: 'travel',
    defaultModel: 'claude-3-sonnet',
  },
];

const tierOptions: { value: Tier; label: string; description: string }[] = [
  { value: 'core', label: 'Core', description: 'Business-critical agents with highest priority' },
  { value: 'venture', label: 'Venture', description: 'Experimental agents for new initiatives' },
  { value: 'personal', label: 'Personal', description: 'Individual productivity agents' },
];

const modelOptions = [
  { value: 'claude-3-opus', label: 'Claude 3 Opus', description: 'Most capable, higher cost' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', description: 'Balanced performance' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fast and efficient' },
];

// Step indicator component
const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
  <div className="flex items-center gap-2 mb-6">
    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
      <React.Fragment key={step}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
            step === currentStep
              ? 'bg-rebel-red text-white'
              : step < currentStep
              ? 'bg-rebel-cyan text-white'
              : 'bg-rebel-gray-200 text-rebel-gray-500'
          }`}
        >
          {step < currentStep ? '✓' : step}
        </div>
        {step < totalSteps && (
          <div
            className={`h-0.5 w-8 transition-all ${
              step < currentStep ? 'bg-rebel-cyan' : 'bg-rebel-gray-200'
            }`}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

export const CreateAgent: React.FC = () => {
  const { navigate } = useNavigation();
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tier: 'venture' as Tier,
    model: 'claude-3-sonnet',
  });

  // Create mutation using useMutation hook
  const createMutation = useMutation<Agent, CreateAgentPayload>(
    useCallback((payload: CreateAgentPayload) => apiPost<Agent>('/agents', payload), [])
  );

  const handleTemplateSelect = (template: TemplateOption) => {
    setSelectedTemplate(template);
    setFormData((prev) => ({
      ...prev,
      name: template.name,
      description: template.description,
      model: template.defaultModel,
    }));
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    try {
      await createMutation.mutate({
        name: formData.name,
        description: formData.description,
        tier: formData.tier,
        category: selectedTemplate.category,
        templateId: selectedTemplate.id,
        model: formData.model,
      });
      navigate('/agents');
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div>
      <PageHeader
        title="Create Agent"
        subtitle={step === 1 ? 'Choose a template to get started' : 'Configure your agent'}
      />

      <StepIndicator currentStep={step} totalSteps={3} />

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templateOptions.map((template) => (
            <Card
              key={template.id}
              padding="lg"
              className="cursor-pointer hover:shadow-lg hover:border-rebel-red/30 transition-all"
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{template.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-rebel-navy mb-1">{template.name}</h3>
                  <p className="text-sm text-rebel-gray-500">{template.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Configuration */}
      {step === 2 && selectedTemplate && (
        <Card padding="lg">
          <CardHeader
            title="Agent Configuration"
            subtitle={`Based on ${selectedTemplate.name} template`}
          />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selected Template Badge */}
            <div className="flex items-center gap-3 p-3 bg-rebel-gray-50 rounded-lg">
              <span className="text-2xl">{selectedTemplate.icon}</span>
              <div>
                <p className="font-medium text-rebel-navy">{selectedTemplate.name}</p>
                <p className="text-sm text-rebel-gray-500">{selectedTemplate.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-auto text-sm text-rebel-gray-500 hover:text-rebel-red"
              >
                Change
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-rebel-navy mb-2">
                Agent Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-rebel-gray-200 rounded-lg focus:outline-none focus:border-rebel-cyan"
                placeholder="Enter agent name"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-rebel-navy mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 border border-rebel-gray-200 rounded-lg focus:outline-none focus:border-rebel-cyan resize-none"
                rows={3}
                placeholder="What does this agent do?"
              />
            </div>

            {/* Tier Selection */}
            <div>
              <label className="block text-sm font-medium text-rebel-navy mb-2">
                Tier
              </label>
              <div className="grid grid-cols-3 gap-3">
                {tierOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, tier: option.value }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      formData.tier === option.value
                        ? 'border-rebel-cyan bg-rebel-cyan/5'
                        : 'border-rebel-gray-200 hover:border-rebel-gray-300'
                    }`}
                  >
                    <p className={`font-medium ${formData.tier === option.value ? 'text-rebel-cyan' : 'text-rebel-navy'}`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-rebel-gray-500 mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-rebel-navy mb-2">
                Model
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                className="w-full px-4 py-2 border border-rebel-gray-200 rounded-lg focus:outline-none focus:border-rebel-cyan bg-white"
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Display */}
            {createMutation.error && (
              <div className="p-3 bg-rebel-red/10 border border-rebel-red/30 rounded-lg text-rebel-red text-sm">
                {createMutation.error.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-rebel-gray-100">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2 text-rebel-gray-600 hover:text-rebel-navy transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={createMutation.loading || !formData.name}
                className="px-6 py-2 bg-rebel-red text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createMutation.loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Creating...
                  </>
                ) : (
                  <>
                    🤖 Create Agent
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

export default CreateAgent;
