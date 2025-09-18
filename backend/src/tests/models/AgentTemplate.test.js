const { AgentTemplate, User } = require('../../models');

describe('AgentTemplate Model', () => {
  let user;

  beforeAll(async () => {
    await AgentTemplate.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123'
    });
  });

  beforeEach(async () => {
    await AgentTemplate.destroy({ where: {}, force: true });
  });

  describe('Template Creation', () => {
    test('should create a template with valid data', async () => {
      const templateData = {
        name: 'Test Template',
        description: 'A test template',
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 1000
        },
        createdBy: user.id
      };

      const template = await AgentTemplate.create(templateData);

      expect(template.name).toBe('Test Template');
      expect(template.description).toBe('A test template');
      expect(template.isActive).toBe(true);
      expect(template.version).toBe('1.0.0');
      expect(template.config.model).toBe('gpt-3.5-turbo');
    });

    test('should set default values', async () => {
      const template = await AgentTemplate.create({
        name: 'Test Template',
        config: { model: 'gpt-3.5-turbo' }
      });

      expect(template.isActive).toBe(true);
      expect(template.version).toBe('1.0.0');
    });
  });

  describe('Template Validation', () => {
    test('should require name', async () => {
      await expect(AgentTemplate.create({
        config: { model: 'gpt-3.5-turbo' }
      })).rejects.toThrow();
    });

    test('should require config', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template'
      })).rejects.toThrow();
    });

    test('should validate config is an object', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: 'invalid config'
      })).rejects.toThrow();
    });

    test('should validate config has required model field', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: { temperature: 0.7 }
      })).rejects.toThrow();
    });

    test('should validate temperature range', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 3.0 // Invalid: > 2
        }
      })).rejects.toThrow();
    });

    test('should validate max_tokens range', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: {
          model: 'gpt-3.5-turbo',
          max_tokens: 50000 // Invalid: > 32000
        }
      })).rejects.toThrow();
    });

    test('should validate timeout range', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: {
          model: 'gpt-3.5-turbo',
          timeout: 500 // Invalid: > 300
        }
      })).rejects.toThrow();
    });

    test('should validate version format', async () => {
      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: { model: 'gpt-3.5-turbo' },
        version: 'invalid-version'
      })).rejects.toThrow();
    });

    test('should enforce unique active template names', async () => {
      await AgentTemplate.create({
        name: 'Test Template',
        config: { model: 'gpt-3.5-turbo' },
        isActive: true
      });

      await expect(AgentTemplate.create({
        name: 'Test Template',
        config: { model: 'gpt-4' },
        isActive: true
      })).rejects.toThrow();
    });

    test('should allow duplicate names if one is inactive', async () => {
      await AgentTemplate.create({
        name: 'Test Template',
        config: { model: 'gpt-3.5-turbo' },
        isActive: false
      });

      const template = await AgentTemplate.create({
        name: 'Test Template',
        config: { model: 'gpt-4' },
        isActive: true
      });

      expect(template.name).toBe('Test Template');
    });
  });

  describe('Instance Methods', () => {
    let template;

    beforeEach(async () => {
      template = await AgentTemplate.create({
        name: 'Test Template',
        description: 'Test template',
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 1000
        },
        version: '1.2.3',
        createdBy: user.id
      });
    });

    test('clone should create a copy with new name', async () => {
      const cloned = await template.clone('Cloned Template', user.id);

      expect(cloned.name).toBe('Cloned Template');
      expect(cloned.description).toBe('Cloned from Test Template');
      expect(cloned.config).toEqual(template.config);
      expect(cloned.version).toBe('1.0.0');
      expect(cloned.createdBy).toBe(user.id);
    });

    test('incrementVersion should increment patch version', async () => {
      await template.incrementVersion();
      expect(template.version).toBe('1.2.4');
    });

    test('getUsageCount should return 0 when no agents use template', async () => {
      const count = await template.getUsageCount();
      expect(count).toBe(0);
    });

    test('canDelete should return true when no agents use template', async () => {
      const canDelete = await template.canDelete();
      expect(canDelete).toBe(true);
    });
  });

  describe('Class Methods', () => {
    beforeEach(async () => {
      await AgentTemplate.bulkCreate([
        {
          name: 'Active Template 1',
          config: { model: 'gpt-3.5-turbo' },
          isActive: true,
          createdBy: user.id
        },
        {
          name: 'Active Template 2',
          config: { model: 'gpt-4' },
          isActive: true,
          createdBy: user.id
        },
        {
          name: 'Inactive Template',
          config: { model: 'gpt-3.5-turbo' },
          isActive: false,
          createdBy: user.id
        }
      ]);
    });

    test('findActive should return only active templates', async () => {
      const templates = await AgentTemplate.findActive();
      expect(templates).toHaveLength(2);
      expect(templates.every(t => t.isActive)).toBe(true);
    });

    test('findByName should return template by name', async () => {
      const template = await AgentTemplate.findByName('Active Template 1');
      expect(template).not.toBeNull();
      expect(template.name).toBe('Active Template 1');
    });

    test('findByName should return null for inactive template by default', async () => {
      const template = await AgentTemplate.findByName('Inactive Template');
      expect(template).toBeNull();
    });

    test('findByName should return inactive template when includeInactive is true', async () => {
      const template = await AgentTemplate.findByName('Inactive Template', true);
      expect(template).not.toBeNull();
      expect(template.name).toBe('Inactive Template');
    });

    test('validateConfig should validate template config', async () => {
      const validConfig = { model: 'gpt-3.5-turbo', temperature: 0.7 };
      await expect(AgentTemplate.validateConfig(validConfig)).resolves.not.toThrow();

      const invalidConfig = { temperature: 0.7 }; // Missing model
      await expect(AgentTemplate.validateConfig(invalidConfig)).rejects.toThrow();
    });
  });

  describe('Config Validation Edge Cases', () => {
    test('should accept valid temperature values', async () => {
      const template = await AgentTemplate.create({
        name: 'Test Template',
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.0
        }
      });
      expect(template.config.temperature).toBe(0.0);

      const template2 = await AgentTemplate.create({
        name: 'Test Template 2',
        config: {
          model: 'gpt-3.5-turbo',
          temperature: 2.0
        }
      });
      expect(template2.config.temperature).toBe(2.0);
    });

    test('should accept valid max_tokens values', async () => {
      const template = await AgentTemplate.create({
        name: 'Test Template',
        config: {
          model: 'gpt-3.5-turbo',
          max_tokens: 1
        }
      });
      expect(template.config.max_tokens).toBe(1);

      const template2 = await AgentTemplate.create({
        name: 'Test Template 2',
        config: {
          model: 'gpt-3.5-turbo',
          max_tokens: 32000
        }
      });
      expect(template2.config.max_tokens).toBe(32000);
    });

    test('should accept valid timeout values', async () => {
      const template = await AgentTemplate.create({
        name: 'Test Template',
        config: {
          model: 'gpt-3.5-turbo',
          timeout: 1
        }
      });
      expect(template.config.timeout).toBe(1);

      const template2 = await AgentTemplate.create({
        name: 'Test Template 2',
        config: {
          model: 'gpt-3.5-turbo',
          timeout: 300
        }
      });
      expect(template2.config.timeout).toBe(300);
    });
  });
});