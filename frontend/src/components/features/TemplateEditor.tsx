import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { Template, Category } from '../../types';

interface TemplateEditorProps {
  template?: Template;
  onSave: (template: Partial<Template>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const categories: { value: Category | string; label: string; icon: string }[] = [
  { value: 'rebelgroup', label: 'Rebel Group', icon: '🔥' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'services', label: 'Services', icon: '⚙️' },
  { value: 'innovation', label: 'Innovation', icon: '💡' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--rebel-gray-200)',
  borderRadius: 'var(--radius-md)',
  padding: '0.625rem 0.875rem',
  fontSize: 'var(--text-base)',
  fontFamily: 'var(--font-body)',
  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
  outline: 'none',
  backgroundColor: 'var(--rebel-white)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  marginBottom: 'var(--space-1)',
  color: 'var(--rebel-navy)',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 'var(--space-4)',
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<string>(template?.category || 'rebelgroup');
  const [systemPrompt, setSystemPrompt] = useState(template?.system_prompt || '');
  const [variables, setVariables] = useState<string[]>(template?.variables || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }
    
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!systemPrompt.trim()) {
      newErrors.systemPrompt = 'System prompt is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      system_prompt: systemPrompt.trim(),
      variables: variables.filter(Boolean),
    });
  };

  const handleVariablesChange = (value: string) => {
    const parsed = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    setVariables(parsed);
  };

  // Extract variables from system prompt
  const extractVariables = () => {
    const matches = systemPrompt.match(/\{\{([^}]+)\}\}/g);
    if (matches) {
      const extracted = matches.map(m => m.replace(/[{}]/g, '').trim());
      const unique = [...new Set([...variables, ...extracted])];
      setVariables(unique);
    }
  };

  return (
    <Card padding="lg">
      <form onSubmit={handleSubmit}>
        <h2 style={{ 
          fontSize: 'var(--text-xl)', 
          fontWeight: 700, 
          color: 'var(--rebel-navy)',
          marginBottom: 'var(--space-6)',
        }}>
          {template ? 'Edit Template' : 'Create Template'}
        </h2>

        {/* Name */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              ...inputStyle,
              borderColor: errors.name ? 'var(--rebel-red)' : undefined,
            }}
            placeholder="e.g., Customer Support Agent"
          />
          {errors.name && (
            <span style={{ color: 'var(--rebel-red)', fontSize: 'var(--text-sm)', marginTop: '4px', display: 'block' }}>
              {errors.name}
            </span>
          )}
        </div>

        {/* Category */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={inputStyle}
          >
            {categories.map(c => (
              <option key={c.value} value={c.value}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{
              ...inputStyle,
              height: '80px',
              resize: 'vertical',
              borderColor: errors.description ? 'var(--rebel-red)' : undefined,
            }}
            placeholder="What does this template do? What's it best used for?"
          />
          {errors.description && (
            <span style={{ color: 'var(--rebel-red)', fontSize: 'var(--text-sm)', marginTop: '4px', display: 'block' }}>
              {errors.description}
            </span>
          )}
        </div>

        {/* System Prompt */}
        <div style={fieldStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>System Prompt *</label>
            <button
              type="button"
              onClick={extractVariables}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--rebel-teal)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Extract Variables
            </button>
          </div>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            style={{
              ...inputStyle,
              height: '200px',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              resize: 'vertical',
              borderColor: errors.systemPrompt ? 'var(--rebel-red)' : undefined,
            }}
            placeholder={`You are a helpful assistant for {{company_name}}.

Your role is to {{task_description}}.

Always respond in a {{tone}} manner.`}
          />
          {errors.systemPrompt && (
            <span style={{ color: 'var(--rebel-red)', fontSize: 'var(--text-sm)', marginTop: '4px', display: 'block' }}>
              {errors.systemPrompt}
            </span>
          )}
          <p style={{ color: 'var(--rebel-gray-500)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            Use {'{{variable_name}}'} syntax for dynamic values
          </p>
        </div>

        {/* Variables */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Variables</label>
          <input
            type="text"
            value={variables.join(', ')}
            onChange={e => handleVariablesChange(e.target.value)}
            style={inputStyle}
            placeholder="company_name, task_description, tone"
          />
          <p style={{ color: 'var(--rebel-gray-500)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            Comma-separated list of variable names (without brackets)
          </p>
          {variables.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {variables.map((v, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    backgroundColor: 'var(--rebel-teal-light, #E8F5F3)',
                    color: 'var(--rebel-teal)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {`{{${v}}}`}
                  <button
                    type="button"
                    onClick={() => setVariables(variables.filter((_, idx) => idx !== i))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 2px',
                      color: 'var(--rebel-teal)',
                      fontSize: '14px',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 'var(--space-3)', 
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--rebel-gray-200)',
        }}>
          <Button variant="ghost" onClick={onCancel} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {template ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
