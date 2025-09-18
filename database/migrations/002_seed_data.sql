-- Migration: 002_seed_data
-- Description: Insert initial seed data for Agent Management System
-- Date: 2025-02-17

USE agent_management;

-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (username, email, password_hash, role, is_active) VALUES 
('admin', 'admin@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQj', 'admin', TRUE)
ON DUPLICATE KEY UPDATE 
    email = VALUES(email),
    role = VALUES(role),
    is_active = VALUES(is_active);

-- Insert demo operator user
-- Password: operator123 (hashed with bcrypt)
INSERT INTO users (username, email, password_hash, role, is_active) VALUES 
('operator', 'operator@example.com', '$2b$10$OpzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQj', 'operator', TRUE)
ON DUPLICATE KEY UPDATE 
    email = VALUES(email),
    role = VALUES(role),
    is_active = VALUES(is_active);

-- Insert demo viewer user
-- Password: viewer123 (hashed with bcrypt)
INSERT INTO users (username, email, password_hash, role, is_active) VALUES 
('viewer', 'viewer@example.com', '$2b$10$VwzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQj', 'viewer', TRUE)
ON DUPLICATE KEY UPDATE 
    email = VALUES(email),
    role = VALUES(role),
    is_active = VALUES(is_active);

-- Insert default agent templates
INSERT INTO agent_templates (name, description, config, version, created_by) VALUES 
(
    '基础聊天代理', 
    '基础的聊天代理模板，适用于一般对话场景',
    JSON_OBJECT(
        'model', 'gpt-3.5-turbo',
        'temperature', 0.7,
        'max_tokens', 1000,
        'timeout', 30,
        'retry_attempts', 3,
        'system_prompt', '你是一个有用的AI助手。'
    ),
    '1.0.0',
    1
),
(
    '数据分析代理', 
    '专门用于数据分析的代理模板，集成Python和数据分析工具',
    JSON_OBJECT(
        'model', 'gpt-4',
        'temperature', 0.3,
        'max_tokens', 2000,
        'timeout', 60,
        'retry_attempts', 2,
        'tools', JSON_ARRAY('python', 'pandas', 'numpy', 'matplotlib'),
        'system_prompt', '你是一个专业的数据分析师，擅长使用Python进行数据分析。'
    ),
    '1.0.0',
    1
),
(
    '代码助手代理',
    '专门用于代码生成和代码审查的代理模板',
    JSON_OBJECT(
        'model', 'gpt-4',
        'temperature', 0.2,
        'max_tokens', 3000,
        'timeout', 45,
        'retry_attempts', 3,
        'tools', JSON_ARRAY('code_interpreter', 'file_reader'),
        'system_prompt', '你是一个专业的编程助手，能够帮助用户编写、审查和优化代码。'
    ),
    '1.0.0',
    1
),
(
    '客服代理',
    '专门用于客户服务的代理模板，具有友好的交互风格',
    JSON_OBJECT(
        'model', 'gpt-3.5-turbo',
        'temperature', 0.8,
        'max_tokens', 1500,
        'timeout', 25,
        'retry_attempts', 3,
        'system_prompt', '你是一个友好专业的客服代表，致力于解决客户问题。'
    ),
    '1.0.0',
    1
)
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    config = VALUES(config),
    version = VALUES(version);

-- Insert sample agents for demonstration
INSERT INTO agents (name, description, status, config, template_id, created_by) VALUES 
(
    '演示聊天代理',
    '用于演示的基础聊天代理实例',
    'stopped',
    JSON_OBJECT(
        'model', 'gpt-3.5-turbo',
        'temperature', 0.7,
        'max_tokens', 1000,
        'timeout', 30,
        'retry_attempts', 3,
        'system_prompt', '你是一个有用的AI助手。',
        'port', 3001
    ),
    1,
    1
),
(
    '数据分析助手',
    '用于数据分析任务的代理实例',
    'stopped',
    JSON_OBJECT(
        'model', 'gpt-4',
        'temperature', 0.3,
        'max_tokens', 2000,
        'timeout', 60,
        'retry_attempts', 2,
        'tools', JSON_ARRAY('python', 'pandas', 'numpy'),
        'system_prompt', '你是一个专业的数据分析师。',
        'port', 3002
    ),
    2,
    1
)
ON DUPLICATE KEY UPDATE 
    description = VALUES(description),
    config = VALUES(config),
    template_id = VALUES(template_id);