# Health Endpoints Documentation

## Overview

The DriveDrop backend provides health check endpoints for monitoring, load balancer health checks, and debugging connectivity issues.

## Available Endpoints

### Basic Health Check
- **URL**: `GET /health` or `GET /api/health`
- **Access**: Public (no authentication required)
- **Purpose**: Basic server liveness check

**Response Example:**
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "timestamp": "2025-07-28T11:30:00.000Z",
    "service": "DriveDrop API",
    "environment": "development"
  }
}
```

### Database Health Check
- **URL**: `GET /health/db`
- **Access**: Public (no authentication required)
- **Purpose**: Verify database connectivity and performance

**Response Example:**
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "database": "Supabase",
    "responseTime": "45ms",
    "timestamp": "2025-07-28T11:30:00.000Z"
  }
}
```

## Usage Examples

### Using curl (Windows PowerShell)
```powershell
# Basic health check
curl http://localhost:3000/health

# Database health check
curl http://localhost:3000/health/db
```

### Using Node.js fetch
```javascript
const response = await fetch('http://localhost:3000/api/health');
const health = await response.json();
console.log(health);
```

### Using PowerShell Invoke-RestMethod
```powershell
$health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET
Write-Output $health
```

## Response Format

All health endpoints follow the standard API response format:

```json
{
  "success": boolean,
  "data": {
    "status": "OK" | "ERROR",
    "timestamp": "ISO8601 timestamp",
    ...additional fields
  },
  "error": null | { "message": "error description" }
}
```

## Status Codes

- **200 OK**: Service is healthy and operational
- **500 Internal Server Error**: Service or database connectivity issues
- **404 Not Found**: Endpoint not found (check server is running)

## Monitoring Integration

These endpoints can be used with:
- Load balancers (AWS ALB, Azure Load Balancer, etc.)
- Container orchestration (Docker, Kubernetes)
- Monitoring services (Uptime Robot, Pingdom, etc.)
- Custom monitoring scripts

## Troubleshooting

### Connection Refused
- Server is not running
- Wrong port or URL
- Firewall blocking the connection

### 404 Not Found
- Server is running but health routes are not properly mounted
- Check backend/src/index.ts for route configuration

### 500 Database Error
- Supabase connection issues
- Check environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)
- Verify network connectivity to Supabase

## Testing Scripts

Use the provided testing scripts to verify health endpoints:
- `test-health-only.js` - Node.js script
- `test-health.bat` - Windows batch file
- `test-health.ps1` - PowerShell script
- `test-health-curl.ps1` - curl-based PowerShell script
