import React, { useState, useCallback } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { TemplateCard } from '../components/features/TemplateCard';
import { TemplateEditor } from '../components/features/TemplateEditor';
import { useApi, apiPost, apiPut, useMutation } from '../hooks/useApi';
import type { Template, Category } from '../types';

type FilterCategory = Category | 'all';

const categoryTabs: { value: FilterCategory; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📁' },
  { value: 'rebelgroup', label: 'Rebel Group', icon: '🔥' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'services', label: 'Services', icon: '⚙️' },
  { value: 'innovation', label: 'Innovation', icon: '💡' },
];

// Loading skeleton
const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="flex gap-1 mb-6 border-b border-rebel-gray-200 pb-1 overflow-x-auto">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-10 w-24 bg-rebel-gray-200 rounded" />
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-44 bg-rebel-gray-200 rounded-lg" />
      ))}
    </div>
  </div>
);

// Error state
const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="text-rebel-red text-4xl mb-4">⚠️</div>
    <p className="text-rebel-red font-medium mb-2">Error loading templates</p>
    <p className="text-rebel-gray-500 text-sm mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-rebel-navy text-white rounded-md hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    )}
  </div>
);

// Success toast notification
const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: 'var(--rebel-teal)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1000,
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <span>✓</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '0 4px',
          fontSize: '18px',
        }}
      >
        ×
      </button>
    </div>
  );
};

export const Templates: React.FC = () => {
  const { data: templates, loading, error, refetch } = useApi<Template[]>('/templates');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  // Create mutation
  const createMutation = useMutation<Template, Partial<Template>>(
    useCallback((data: Partial<Template>) => apiPost<Template>('/templates', data), [])
  );

  // Update mutation
  const updateMutation = useMutation<Template, { id: string; data: Partial<Template> }>(
    useCallback(({ id, data }) => apiPut<Template>(`/templates/${id}`, data), [])
  );

  const handleCreateClick = () => {
    setSelectedTemplate(undefined);
    setEditorMode('create');
  };

  const handleEditClick = (template: Template) => {
    setSelectedTemplate(template);
    setEditorMode('edit');
  };

  const handleCancel = () => {
    setEditorMode('closed');
    setSelectedTemplate(undefined);
  };

  const handleSave = async (data: Partial<Template>) => {
    try {
      if (editorMode === 'edit' && selectedTemplate) {
        await updateMutation.mutate({ id: selectedTemplate.id, data });
        setToast('Template updated successfully!');
      } else {
        await createMutation.mutate(data);
        setToast('Template created successfully!');
      }
      setEditorMode('closed');
      setSelectedTemplate(undefined);
      refetch();
    } catch (err) {
      console.error('Failed to save template:', err);
      setToast('Failed to save template. Please try again.');
    }
  };

  const isSaving = createMutation.loading || updateMutation.loading;

  // Show editor overlay
  if (editorMode !== 'closed') {
    return (
      <div>
        <PageHeader
          title="Templates"
          subtitle={editorMode === 'create' ? 'Create a new template' : `Editing: ${selectedTemplate?.name}`}
        />
        <div style={{ maxWidth: '800px' }}>
          <TemplateEditor
            template={selectedTemplate}
            onSave={handleSave}
            onCancel={handleCancel}
            loading={isSaving}
          />
        </div>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Templates"
          subtitle="Loading templates..."
          action={{
            label: 'Create Template',
            icon: '+',
            onClick: handleCreateClick,
          }}
        />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Templates"
          subtitle="Error loading templates"
          action={{
            label: 'Create Template',
            icon: '+',
            onClick: handleCreateClick,
          }}
        />
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  const allTemplates = templates || [];
  
  const filteredTemplates = allTemplates.filter((template) => {
    if (activeCategory === 'all') return true;
    return template.category === activeCategory;
  });

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Reusable agent configurations for Rebel Group sectors"
        action={{
          label: 'Create Template',
          icon: '+',
          onClick: handleCreateClick,
        }}
      />

      {/* Category Tabs */}
      <div className="flex gap-1 mb-6 border-b border-rebel-gray-200 pb-1 overflow-x-auto">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveCategory(tab.value)}
            className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap bg-transparent border-none cursor-pointer transition-all -mb-px ${
              activeCategory === tab.value
                ? 'font-semibold text-rebel-red border-b-2 border-rebel-red'
                : 'font-normal text-rebel-gray-600 border-b-2 border-transparent hover:text-rebel-navy'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.value !== 'all' && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeCategory === tab.value
                  ? 'bg-rebel-red/10'
                  : 'bg-rebel-gray-100'
              }`}>
                {allTemplates.filter(t => t.category === tab.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => handleEditClick(template)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-rebel-gray-500">
          <p className="text-lg mb-2">
            No templates in this category
          </p>
          <p className="text-sm mb-4">
            Create the first one!
          </p>
          <button
            onClick={handleCreateClick}
            className="px-4 py-2 bg-rebel-red text-white rounded-md hover:opacity-90 transition-opacity"
          >
            + Create Template
          </button>
        </div>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
};
