import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateTemplate } from '../src/services/agent.service';
import type { CreateAgent } from '../src/types';

describe('Agent Service', () => {
  describe('validateTemplate', () => {
    it('should validate a complete template', () => {
      const template: CreateAgent = {
        name: 'TestBot',
        creature: 'Wolf',
        emoji: '🐺',
        description: 'A test bot',
        systemPrompt: 'You are a helpful assistant',
        skills: ['coding', 'research'],
        model: 'claude-sonnet-4-20250514',
      };

      const result = validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should error on missing required fields', () => {
      const template = {
        name: '',
        creature: '',
        emoji: '',
      } as CreateAgent;

      const result = validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Creature type is required');
      expect(result.errors).toContain('Emoji is required');
    });

    it('should warn on missing optional fields', () => {
      const template: CreateAgent = {
        name: 'TestBot',
        creature: 'Wolf',
        emoji: '🐺',
        skills: [],
        model: 'claude-sonnet-4-20250514',
      };

      const result = validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('No system prompt defined - agent may lack direction');
      expect(result.warnings).toContain('No skills defined - agent capabilities may be limited');
    });

    it('should warn on unknown model', () => {
      const template: CreateAgent = {
        name: 'TestBot',
        creature: 'Wolf',
        emoji: '🐺',
        systemPrompt: 'Test',
        skills: ['test'],
        model: 'unknown-model',
      };

      const result = validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Unknown model: unknown-model');
    });

    it('should error on invalid emoji', () => {
      const template: CreateAgent = {
        name: 'TestBot',
        creature: 'Wolf',
        emoji: 'this is way too long for an emoji',
        skills: [],
        model: 'claude-sonnet-4-20250514',
      };

      const result = validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Emoji should be a single emoji character');
    });

    it('should warn on long name', () => {
      const template: CreateAgent = {
        name: 'A'.repeat(60),
        creature: 'Wolf',
        emoji: '🐺',
        systemPrompt: 'Test',
        skills: ['test'],
        model: 'claude-sonnet-4-20250514',
      };

      const result = validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Name is quite long - consider shortening');
    });
  });
});
