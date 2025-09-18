-- Migration: 001_initial_schema
-- Description: Create initial database schema for Agent Management System
-- Date: 2025-02-17

-- Create database with proper charset
CREATE DATABASE IF NOT EXISTS agent_management 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE agent_management;

-- Users table
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
    
    -- Indexes for performance
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active),
    INDEX idx_created_at (created_at)
);

-- Agent templates table
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
    
    -- Foreign key constraints
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_name (name),
    INDEX idx_active (is_active),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at),
    
    -- Unique constraint for active templates with same name
    UNIQUE KEY uk_active_template_name (name, is_active)
);

-- Agents table
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
    
    -- Foreign key constraints
    FOREIGN KEY (template_id) REFERENCES agent_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_name (name),
    INDEX idx_status (status),
    INDEX idx_template_id (template_id),
    INDEX idx_created_by (created_by),
    INDEX idx_process_id (process_id),
    INDEX idx_port (port),
    INDEX idx_last_heartbeat (last_heartbeat),
    INDEX idx_created_at (created_at),
    
    -- Unique constraints
    UNIQUE KEY uk_agent_name (name),
    UNIQUE KEY uk_process_id (process_id),
    UNIQUE KEY uk_port (port)
);

-- Agent logs table
CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id INT NOT NULL,
    level ENUM('debug', 'info', 'warn', 'error', 'fatal') NOT NULL,
    message TEXT NOT NULL,
    context JSON,
    source VARCHAR(100),
    request_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Indexes for efficient log querying
    INDEX idx_agent_timestamp (agent_id, timestamp),
    INDEX idx_level_timestamp (level, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_source (source),
    INDEX idx_request_id (request_id),
    
    -- Composite indexes for common queries
    INDEX idx_agent_level_timestamp (agent_id, level, timestamp),
    INDEX idx_level_agent_timestamp (level, agent_id, timestamp)
);

-- Agent metrics table
CREATE TABLE IF NOT EXISTS agent_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id INT NOT NULL,
    cpu_usage DECIMAL(5,2) CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    memory_usage DECIMAL(10,2) CHECK (memory_usage >= 0),
    memory_limit DECIMAL(10,2),
    request_count INT DEFAULT 0 CHECK (request_count >= 0),
    error_count INT DEFAULT 0 CHECK (error_count >= 0),
    success_count INT DEFAULT 0 CHECK (success_count >= 0),
    response_time DECIMAL(8,2) CHECK (response_time >= 0),
    uptime_seconds BIGINT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Indexes for time-series data queries
    INDEX idx_agent_timestamp (agent_id, timestamp),
    INDEX idx_timestamp (timestamp),
    
    -- Composite indexes for analytics
    INDEX idx_agent_cpu_timestamp (agent_id, cpu_usage, timestamp),
    INDEX idx_agent_memory_timestamp (agent_id, memory_usage, timestamp),
    INDEX idx_agent_response_timestamp (agent_id, response_time, timestamp)
);

-- Sessions table for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_agent TEXT,
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_refresh_token_hash (refresh_token_hash),
    INDEX idx_expires_at (expires_at),
    INDEX idx_active (is_active),
    
    -- Unique constraint for active tokens
    UNIQUE KEY uk_active_token (token_hash, is_active)
);

-- Agent alerts table
CREATE TABLE IF NOT EXISTS agent_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id INT NOT NULL,
    alert_type ENUM('cpu_high', 'memory_high', 'error_rate_high', 'response_time_high', 'agent_down', 'custom') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    threshold_value DECIMAL(10,2),
    current_value DECIMAL(10,2),
    status ENUM('active', 'acknowledged', 'resolved') DEFAULT 'active',
    acknowledged_by INT,
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_agent_id (agent_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    
    -- Composite indexes
    INDEX idx_agent_status_created (agent_id, status, created_at),
    INDEX idx_severity_status_created (severity, status, created_at)
);