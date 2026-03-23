import { describe, it, expect } from 'vitest';
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  CreateSprintSchema,
  AgentIdSchema,
} from '../src/types';

describe('Zod Schemas', () => {
  describe('CreateAgentSchema', () => {
    it('should parse valid agent data', () => {
      const data = {
        name: 'TestBot',
        creature: 'Wolf',
        emoji: '🐺',
        description: 'A test bot',
      };

      const result = CreateAgentSchema.parse(data);

      expect(result.name).toBe('TestBot');
      expect(result.creature).toBe('Wolf');
      expect(result.skills).toEqual([]);
      expect(result.model).toBe('claude-sonnet-4-20250514');
    });

    it('should reject empty name', () => {
      const data = {
        name: '',
        creature: 'Wolf',
        emoji: '🐺',
      };

      expect(() => CreateAgentSchema.parse(data)).toThrow();
    });

    it('should reject name over 100 chars', () => {
      const data = {
        name: 'A'.repeat(101),
        creature: 'Wolf',
        emoji: '🐺',
      };

      expect(() => CreateAgentSchema.parse(data)).toThrow();
    });
  });

  describe('UpdateAgentSchema', () => {
    it('should allow partial updates', () => {
      const data = { name: 'UpdatedName' };
      const result = UpdateAgentSchema.parse(data);
      
      expect(result.name).toBe('UpdatedName');
      expect(result.creature).toBeUndefined();
    });

    it('should allow empty update', () => {
      const data = {};
      const result = UpdateAgentSchema.parse(data);
      
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('CreateSprintSchema', () => {
    it('should parse valid sprint data', () => {
      const data = {
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Sprint 1',
        description: 'First sprint',
      };

      const result = CreateSprintSchema.parse(data);

      expect(result.title).toBe('Sprint 1');
      expect(result.tasks).toEqual([]);
    });

    it('should parse sprint with tasks', () => {
      const data = {
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Sprint 1',
        tasks: [
          { title: 'Task 1', status: 'pending' },
          { title: 'Task 2', status: 'done' },
        ],
      };

      const result = CreateSprintSchema.parse(data);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].status).toBe('pending');
    });

    it('should reject invalid agentId', () => {
      const data = {
        agentId: 'not-a-uuid',
        title: 'Sprint 1',
      };

      expect(() => CreateSprintSchema.parse(data)).toThrow();
    });
  });

  describe('AgentIdSchema', () => {
    it('should parse valid UUID', () => {
      const data = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const result = AgentIdSchema.parse(data);
      
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should reject invalid UUID', () => {
      const data = { id: 'invalid' };
      
      expect(() => AgentIdSchema.parse(data)).toThrow();
    });
  });
});
