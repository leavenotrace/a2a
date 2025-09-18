# Database Setup Guide

This directory contains the database schema and migration scripts for the Agent Management System.

## Quick Start

### Option 1: Using Migrations (Recommended)

1. Install dependencies:
```bash
cd backend
npm install mysql2 dotenv
```

2. Configure your database connection in `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=agent_management
```

3. Run migrations:
```bash
# Run all pending migrations
node database/migrate.js up

# Check migration status
node database/migrate.js status

# Rollback last migration
node database/migrate.js down
```

### Option 2: Using init.sql (Quick Setup)

```bash
mysql -u root -p < database/init.sql
```

## Migration System

The migration system provides version control for your database schema changes.

### Migration Files

- `001_initial_schema.sql` - Creates all tables with proper indexes and constraints
- `002_seed_data.sql` - Inserts initial data (users, templates, sample agents)

### Migration Commands

```bash
# Run all pending migrations
node database/migrate.js up

# Show current migration status
node database/migrate.js status

# Rollback the last migration
node database/migrate.js down
```

## Database Schema

### Tables Overview

1. **users** - System users with role-based access
2. **agent_templates** - Reusable configuration templates
3. **agents** - Agent instances with their configurations
4. **agent_logs** - Detailed logging for all agent activities
5. **agent_metrics** - Performance metrics and monitoring data
6. **user_sessions** - JWT token management
7. **agent_alerts** - Alert and notification system

### Key Features

- **Proper Indexing**: Optimized for common query patterns
- **Foreign Key Constraints**: Data integrity enforcement
- **JSON Configuration**: Flexible agent configuration storage
- **Audit Trail**: Created/updated timestamps on all tables
- **Soft Deletes**: Users and templates can be deactivated
- **Performance Monitoring**: Comprehensive metrics collection

### Default Data

The system comes with:
- Default admin user (username: `admin`, password: `admin123`)
- Demo operator user (username: `operator`, password: `operator123`)
- Demo viewer user (username: `viewer`, password: `viewer123`)
- Sample agent templates for different use cases
- Demo agent instances

## Database Maintenance

### Backup

```bash
# Full backup
mysqldump -u root -p agent_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only
mysqldump -u root -p --no-data agent_management > schema_backup.sql
```

### Restore

```bash
mysql -u root -p agent_management < backup_file.sql
```

### Log Rotation

The `agent_logs` table can grow large. Consider implementing log rotation:

```sql
-- Delete logs older than 30 days
DELETE FROM agent_logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Archive old metrics (keep last 90 days)
DELETE FROM agent_metrics WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

## Performance Considerations

### Indexes

All tables include appropriate indexes for:
- Primary key lookups
- Foreign key relationships
- Common query patterns (status, timestamps, etc.)
- Composite indexes for complex queries

### Query Optimization

- Use `LIMIT` for large result sets
- Filter by `agent_id` when querying logs/metrics
- Use time-based partitioning for large log tables
- Consider read replicas for reporting queries

## Security

- All passwords are hashed using bcrypt
- Foreign key constraints prevent orphaned records
- Input validation should be implemented at the application layer
- Use prepared statements to prevent SQL injection

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check database credentials in `.env`
2. **Migration Failed**: Check MySQL version compatibility (requires 5.7+)
3. **Permission Denied**: Ensure database user has CREATE/ALTER privileges
4. **JSON Column Issues**: Requires MySQL 5.7+ for JSON data type

### Debug Mode

Enable SQL logging in your application to debug query issues:

```javascript
// In your Sequelize config
{
  logging: console.log, // Enable SQL logging
  benchmark: true       // Show query execution time
}
```