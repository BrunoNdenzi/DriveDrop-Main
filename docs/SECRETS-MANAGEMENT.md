# DriveDrop Security & Secrets Management Guide

This document provides comprehensive guidelines for managing secrets, API keys, and sensitive configuration across the DriveDrop application.

## Table of Contents

1. [General Principles](#general-principles)
2. [Local Development](#local-development)
3. [CI/CD Pipeline Security](#cicd-pipeline-security)
4. [Production Deployment](#production-deployment)
5. [API Key Management](#api-key-management)
6. [Secrets Rotation Policy](#secrets-rotation-policy)
7. [Incident Response](#incident-response)

## General Principles

- **Never commit secrets** to version control
- **Principle of least privilege**: Grant minimal access required for each service
- **Defense in depth**: Multiple layers of protection for sensitive data
- **Regular rotation**: Change credentials on a defined schedule
- **Audit access**: Track and log who accesses sensitive credentials
- **Encryption**: Encrypt secrets at rest and in transit

## Local Development

### Setting Up Your Environment

1. Copy the example environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp mobile/.env.example mobile/.env
   ```

2. Generate secure values for secrets:
   ```bash
   # From the project root
   node scripts/generate-secrets.js
   ```

3. Use different credentials for development vs. production

4. Verify your environment setup:
   ```bash
   # Backend
   cd backend
   npm run verify:env
   
   # Mobile
   cd mobile
   npm run verify:env
   ```

### Using Environment-Specific Variables

For different environments, you can create multiple `.env` files:

- `.env.development` - Local development settings
- `.env.test` - For running automated tests
- `.env.staging` - For the staging environment
- `.env.production` - For production (keep this secure!)

Load the appropriate file based on `NODE_ENV`:

```js
// Load environment-specific variables
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: envFile });
```

## CI/CD Pipeline Security

### GitHub Actions

```yaml
# Example GitHub Actions workflow with secure secrets handling
name: Deploy API

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Set up environment variables securely
      - name: Set up environment
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          echo "Setting up secure environment..."
          # Don't echo the actual values!
```

### Recommended CI/CD Secret Management

1. **GitHub Environments**: Use environment-specific secrets
   - Configure protection rules for production environments
   - Require approvals before accessing production secrets

2. **Secret Scoping**: Limit access to specific branches/environments
   - Repository secrets: Available to all workflows
   - Environment secrets: Limited to specific environments

3. **Secret Masking**: Ensure secrets are masked in logs
   - GitHub Actions automatically masks secrets in logs
   - Add custom masking for derived values

## Production Deployment

### Recommended Secret Management Solutions

1. **AWS Secrets Manager**
   - Automatic rotation
   - Fine-grained access control
   - Integration with AWS services

2. **HashiCorp Vault**
   - Dynamic secrets
   - Secret leasing and revocation
   - Detailed audit logs

3. **Doppler**
   - SecretOps platform
   - Version control for secrets
   - Integration with CI/CD and cloud providers

### Implementation Example with AWS Secrets Manager

```javascript
// Backend code example for retrieving secrets
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecret(secretName) {
  try {
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    return JSON.parse(data.SecretString);
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw error;
  }
}

// Usage
async function initializeApp() {
  try {
    const dbCredentials = await getSecret('drivedrop/database');
    // Use the credentials securely
  } catch (error) {
    process.exit(1);
  }
}
```

## API Key Management

### Google Maps API

1. **API Key Restriction**:
   - Restrict by platform (Android, iOS, Web)
   - Restrict by application (Bundle ID/Package Name)
   - Restrict by IP address for backend usage

2. **Configuration in Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project
   - Navigate to "APIs & Services" > "Credentials"
   - Edit your API key to add restrictions

3. **Implementation Best Practices**:
   - Mobile: Store key in `.env` with `EXPO_PUBLIC_` prefix
   - Backend: Use key for server-side requests only
   - Set up usage quotas to prevent unexpected charges

### Stripe API

1. **Key Management**:
   - Mobile: Use only publishable key (`pk_*`) on the client
   - Backend: Keep secret key (`sk_*`) server-side only
   - Use webhook signatures to verify events

2. **Implementation Best Practices**:
   - Use test keys during development (`pk_test_*`, `sk_test_*`)
   - Process all payments through your backend API
   - Set up webhook endpoints with signature verification

```javascript
// Example Stripe webhook verification
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Handle the event
    // ...
    
    res.json({received: true});
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```

### AWS S3 & Storage Services

1. **Key Management**:
   - Use IAM roles instead of access keys when possible
   - Create dedicated IAM users with minimal permissions
   - Never expose AWS credentials in mobile apps

2. **Implementation Best Practices**:
   - Generate pre-signed URLs on the backend
   - Set appropriate CORS policies
   - Use bucket policies to restrict access

```javascript
// Example of generating pre-signed URLs for S3 uploads
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

function generatePresignedUrl(fileName, fileType) {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileName,
    ContentType: fileType,
    Expires: 60 * 5 // URL expires in 5 minutes
  };
  
  return s3.getSignedUrlPromise('putObject', params);
}
```

## Secrets Rotation Policy

### Rotation Schedule

| Secret Type | Rotation Frequency | Responsible Team |
|-------------|-------------------|------------------|
| JWT Signing Keys | 90 days | Backend Team |
| Database Credentials | 180 days | DevOps |
| API Keys (3rd party) | 365 days | Platform Team |
| Admin Credentials | 90 days | Security Team |

### Automated Rotation

For AWS resources, consider setting up automated rotation:

```bash
# AWS CLI example to update a secret
aws secretsmanager rotate-secret \
    --secret-id drivedrop/database \
    --rotation-lambda-arn arn:aws:lambda:us-west-2:123456789012:function:MyRotationFunction
```

## Incident Response

### If Credentials Are Compromised

1. **Immediate Actions**:
   - Revoke and rotate the compromised credentials immediately
   - Analyze logs to determine scope and impact
   - Block suspicious IP addresses or user accounts

2. **Documentation**:
   - Document the incident, including timeline and affected systems
   - Record actions taken to mitigate the issue
   - Update procedures to prevent recurrence

3. **Communication**:
   - Notify stakeholders as appropriate
   - Follow disclosure requirements if user data was compromised
   - Conduct a post-incident review

### Recovery Process

```bash
# Example script for emergency credential rotation
#!/bin/bash

# 1. Generate new credentials
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update in your secret manager
aws secretsmanager update-secret \
    --secret-id drivedrop/compromised-secret \
    --secret-string "$NEW_SECRET"

# 3. Update in your application
# (Depends on your deployment method)

# 4. Verify the update
echo "Credential rotated. Verifying application health..."
curl -s https://api.drivedrop.com/health
```

---

## Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Google API Security Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [AWS Security Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
- [Stripe Security Documentation](https://stripe.com/docs/security)
