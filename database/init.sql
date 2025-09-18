-- Agent Management System Database Initialization
-- This file is deprecated. Use the migration system instead:
-- node database/migrate.js up

-- For quick setup, you can still use this file, but migrations are recommended
-- 创建数据库
CREATE DATABASE IF NOT EXISTS agent_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE agent_management;

-- Note: This schema is simplified. For full schema with all indexes and constraints,
-- use the migration system: node database/migrate.js up

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'operator', 'viewer') DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- 代理模板表
CREATE TABLE IF NOT EXISTS agent_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name)
);

-- 代理表
CREATE TABLE IF NOT EXISTS agents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status ENUM('stopped', 'running', 'error', 'starting', 'stopping') DEFAULT 'stopped',
    config JSON NOT NULL,
    template_id INT,
    process_id INT,
    port INT,
    last_heartbeat TIMESTAMP NULL,
    error_message TEXT,
    restart_count INT DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES agent_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    UNIQUE KEY uk_agent_name (name)
);

-- 代理日志表
CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id INT NOT NULL,
    level ENUM('debug', 'info', 'warn', 'error', 'fatal') NOT NULL,
    message TEXT NOT NULL,
    context JSON,
    source VARCHAR(100),
    request_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    INDEX idx_agent_timestamp (agent_id, timestamp),
    INDEX idx_level_timestamp (level, timestamp)
);

-- 代理性能指标表
CREATE TABLE IF NOT EXISTS agent_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id INT NOT NULL,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(10,2),
    memory_limit DECIMAL(10,2),
    request_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    response_time DECIMAL(8,2),
    uptime_seconds BIGINT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    INDEX idx_agent_timestamp (agent_id, timestamp)
);

-- 插入默认管理员用户 (密码: admin123)
INSERT INTO users (username, email, password_hash, role, is_active) VALUES 
('admin', 'admin@example.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQj', 'admin', TRUE)
ON DUPLICATE KEY UPDATE username = username;

-- 插入示例代理模板
INSERT INTO agent_templates (name, description, config, version, created_by) VALUES 
('基础聊天代理', '基础的聊天代理模板', '{"model": "gpt-3.5-turbo", "temperature": 0.7, "max_tokens": 1000}', '1.0.0', 1),
('数据分析代理', '专门用于数据分析的代理模板', '{"model": "gpt-4", "temperature": 0.3, "max_tokens": 2000, "tools": ["python", "pandas"]}', '1.0.0', 1)
ON DUPLICATE KEY UPDATE name = name;