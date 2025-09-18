const { User } = require('../../models');
const bcrypt = require('bcrypt');

describe('User Model', () => {
  beforeEach(async () => {
    await User.destroy({ where: {}, force: true });
  });

  describe('User Creation', () => {
    test('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'password123',
        role: 'viewer'
      };

      const user = await User.create(userData);

      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('viewer');
      expect(user.isActive).toBe(true);
      expect(user.passwordHash).not.toBe('password123'); // Should be hashed
    });

    test('should hash password before saving', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'password123'
      });

      const isValidHash = await bcrypt.compare('password123', user.passwordHash);
      expect(isValidHash).toBe(true);
    });

    test('should not hash already hashed password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hashedPassword
      });

      expect(user.passwordHash).toBe(hashedPassword);
    });

    test('should set default role to viewer', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'password123'
      });

      expect(user.role).toBe('viewer');
    });

    test('should set default isActive to true', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'password123'
      });

      expect(user.isActive).toBe(true);
    });
  });

  describe('User Validation', () => {
    test('should require username', async () => {
      await expect(User.create({
        email: 'test@example.com',
        passwordHash: 'password123'
      })).rejects.toThrow();
    });

    test('should require email', async () => {
      await expect(User.create({
        username: 'testuser',
        passwordHash: 'password123'
      })).rejects.toThrow();
    });

    test('should require password', async () => {
      await expect(User.create({
        username: 'testuser',
        email: 'test@example.com'
      })).rejects.toThrow();
    });

    test('should validate email format', async () => {
      await expect(User.create({
        username: 'testuser',
        email: 'invalid-email',
        passwordHash: 'password123'
      })).rejects.toThrow();
    });

    test('should validate username length', async () => {
      await expect(User.create({
        username: 'ab', // Too short
        email: 'test@example.com',
        passwordHash: 'password123'
      })).rejects.toThrow();
    });

    test('should validate role enum', async () => {
      await expect(User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'password123',
        role: 'invalid_role'
      })).rejects.toThrow();
    });

    test('should enforce unique username', async () => {
      await User.create({
        username: 'testuser',
        email: 'test1@example.com',
        passwordHash: 'password123'
      });

      await expect(User.create({
        username: 'testuser',
        email: 'test2@example.com',
        passwordHash: 'password123'
      })).rejects.toThrow();
    });

    test('should enforce unique email', async () => {
      await User.create({
        username: 'testuser1',
        email: 'test@example.com',
        passwordHash: 'password123'
      });

      await expect(User.create({
        username: 'testuser2',
        email: 'test@example.com',
        passwordHash: 'password123'
      })).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'password123',
        role: 'operator'
      });
    });

    test('validatePassword should return true for correct password', async () => {
      const isValid = await user.validatePassword('password123');
      expect(isValid).toBe(true);
    });

    test('validatePassword should return false for incorrect password', async () => {
      const isValid = await user.validatePassword('wrongpassword');
      expect(isValid).toBe(false);
    });

    test('toJSON should exclude passwordHash', () => {
      const json = user.toJSON();
      expect(json.passwordHash).toBeUndefined();
      expect(json.username).toBe('testuser');
    });

    test('hasPermission should work correctly', () => {
      expect(user.hasPermission('viewer')).toBe(true);
      expect(user.hasPermission('operator')).toBe(true);
      expect(user.hasPermission('admin')).toBe(false);
    });

    test('updateLastLogin should update lastLogin timestamp', async () => {
      const beforeUpdate = user.lastLogin;
      await user.updateLastLogin();
      expect(user.lastLogin).not.toBe(beforeUpdate);
      expect(user.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('Class Methods', () => {
    beforeEach(async () => {
      await User.bulkCreate([
        {
          username: 'admin',
          email: 'admin@example.com',
          passwordHash: 'admin123',
          role: 'admin',
          isActive: true
        },
        {
          username: 'operator',
          email: 'operator@example.com',
          passwordHash: 'operator123',
          role: 'operator',
          isActive: true
        },
        {
          username: 'inactive',
          email: 'inactive@example.com',
          passwordHash: 'inactive123',
          role: 'viewer',
          isActive: false
        }
      ]);
    });

    test('findByCredentials should return user for valid credentials', async () => {
      const user = await User.findByCredentials('admin', 'admin123');
      expect(user).not.toBeNull();
      expect(user.username).toBe('admin');
    });

    test('findByCredentials should return null for invalid username', async () => {
      const user = await User.findByCredentials('nonexistent', 'admin123');
      expect(user).toBeNull();
    });

    test('findByCredentials should return null for invalid password', async () => {
      const user = await User.findByCredentials('admin', 'wrongpassword');
      expect(user).toBeNull();
    });

    test('findByCredentials should return null for inactive user', async () => {
      const user = await User.findByCredentials('inactive', 'inactive123');
      expect(user).toBeNull();
    });

    test('findActiveUsers should return only active users', async () => {
      const users = await User.findActiveUsers();
      expect(users).toHaveLength(2);
      expect(users.every(u => u.isActive)).toBe(true);
    });

    test('countByRole should return correct counts', async () => {
      const counts = await User.countByRole();
      expect(counts).toHaveLength(2); // Only active users
      
      const adminCount = counts.find(c => c.role === 'admin');
      const operatorCount = counts.find(c => c.role === 'operator');
      
      expect(adminCount.count).toBe('1');
      expect(operatorCount.count).toBe('1');
    });
  });
});