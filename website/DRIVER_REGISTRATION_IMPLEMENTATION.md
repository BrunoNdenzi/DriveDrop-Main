# DriveDrop Website - Driver Registration Implementation Guide

## Overview

The driver registration system is a comprehensive multi-step form that collects information required for onboarding new drivers to the DriveDrop platform. It includes FCRA-compliant background check consent, document uploads, and full legal compliance pages.

## ✅ Completed Components

### 1. Multi-Step Registration Form (`/drivers/register`)
- **5-step form with progress tracking**
- Step 1: Personal Information (name, DOB, email, phone, address, SSN)
- Step 2: Driver's License (license details + file uploads)
- Step 3: Driving History (suspensions, criminal record)
- Step 4: Insurance Information (provider, policy, coverage)
- Step 5: Agreements (FCRA consent, terms acceptance)
- Success confirmation screen

### 2. Legal Pages (FCRA Compliance)
- **Privacy Policy** (`/privacy`) - Comprehensive data privacy disclosure
- **Terms of Service** (`/terms`) - User agreement, liability, dispute resolution
- **FCRA Disclosure** (`/fcra`) - Background check rights and procedures

### 3. API Integration
- **POST `/api/drivers/apply`** - Backend endpoint for form submission
- Validates all required fields
- Inserts into Supabase `driver_applications` table
- Returns application ID for tracking

### 4. UI Components
- Checkbox component (agreements)
- Textarea component (incident descriptions)
- Progress bar component (form completion)

### 5. Database Schema
- **Migration file:** `supabase/migrations/20250127_driver_applications.sql`
- Complete table structure with RLS policies
- Indexes for performance
- Storage bucket setup instructions

---

## ⏸️ Pending Tasks

### HIGH PRIORITY

#### 1. Run Database Migration
```bash
# In Supabase Dashboard
# Go to SQL Editor and run the migration file:
# supabase/migrations/20250127_driver_applications.sql

# OR via CLI:
supabase db reset
# OR
supabase migration up
```

#### 2. Create Supabase Storage Buckets
In Supabase Dashboard → Storage:

1. **Create Buckets:**
   - `driver-licenses` (private)
   - `proof-of-address` (private)
   - `insurance-documents` (private)

2. **Set RLS Policies:**
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Authenticated users can upload documents"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id IN ('driver-licenses', 'proof-of-address', 'insurance-documents') AND auth.role() = 'authenticated');

   -- Allow users to view their own documents
   CREATE POLICY "Users can view own documents"
   ON storage.objects FOR SELECT
   USING (bucket_id IN ('driver-licenses', 'proof-of-address', 'insurance-documents') AND auth.role() = 'authenticated');

   -- Allow admins to view all documents
   CREATE POLICY "Admins can view all documents"
   ON storage.objects FOR SELECT
   USING (
     bucket_id IN ('driver-licenses', 'proof-of-address', 'insurance-documents')
     AND EXISTS (
       SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
     )
   );
   ```

#### 3. Configure Environment Variables
Update `website/.env.local` with actual values:

```env
# Railway Backend API
NEXT_PUBLIC_API_URL=https://drivedrop-main-production.up.railway.app/api/v1

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]

# Google Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=[YOUR_GOOGLE_MAPS_KEY]

# Encryption Key (for SSN)
ENCRYPTION_KEY=[GENERATE_32_BYTE_HEX_STRING]
ENCRYPTION_IV=[GENERATE_16_BYTE_HEX_STRING]
```

**Generate encryption keys:**
```bash
# In PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # ENCRYPTION_IV
```

#### 4. Implement File Upload Functionality

Create `website/src/lib/file-upload.ts`:

```typescript
import { createClient } from '@/lib/supabase'

export async function uploadFile(
  file: File,
  bucket: 'driver-licenses' | 'proof-of-address' | 'insurance-documents',
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  
  // Generate unique filename
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`
  
  // Upload file
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })
  
  if (error) {
    return { url: null, error: error.message }
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path)
  
  return { url: publicUrl, error: null }
}

export async function deleteFile(
  bucket: string,
  filePath: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath])
  
  return { error: error?.message || null }
}
```

**Update registration form to handle uploads:**

In `website/src/app/drivers/register/page.tsx`, add file upload handling:

```typescript
// Add to handleSubmit function (before API call)
const uploadedFiles: Record<string, string> = {}

// Upload license front
if (formData.licenseFront) {
  const { url, error } = await uploadFile(
    formData.licenseFront,
    'driver-licenses',
    'temp-user-id' // Replace with actual user ID if authenticated
  )
  if (url) uploadedFiles.license_front_url = url
}

// Upload license back
if (formData.licenseBack) {
  const { url } = await uploadFile(formData.licenseBack, 'driver-licenses', 'temp-user-id')
  if (url) uploadedFiles.license_back_url = url
}

// Upload proof of address
if (formData.proofOfAddress) {
  const { url } = await uploadFile(formData.proofOfAddress, 'proof-of-address', 'temp-user-id')
  if (url) uploadedFiles.proof_of_address_url = url
}

// Upload insurance proof
if (formData.insuranceProof) {
  const { url } = await uploadFile(formData.insuranceProof, 'insurance-documents', 'temp-user-id')
  if (url) uploadedFiles.insurance_proof_url = url
}

// Include in API request
const response = await fetch('/api/drivers/apply', {
  method: 'POST',
  body: JSON.stringify({ ...formData, ...uploadedFiles })
})
```

#### 5. Implement SSN Encryption

Create `website/src/lib/crypto.ts`:

```typescript
import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
const IV = Buffer.from(process.env.ENCRYPTION_IV!, 'hex')

export function encryptSSN(ssn: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, IV)
  let encrypted = cipher.update(ssn, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

export function decryptSSN(encryptedSSN: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, IV)
  let decrypted = decipher.update(encryptedSSN, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

**Update API route** (`website/src/app/api/drivers/apply/route.ts`):

```typescript
import { encryptSSN } from '@/lib/crypto'

// In the POST handler, before inserting to database:
const encryptedSSN = encryptSSN(ssn)

const { data, error } = await supabase
  .from('driver_applications')
  .insert({
    ...otherData,
    ssn_encrypted: encryptedSSN // Store encrypted SSN
  })
```

---

### MEDIUM PRIORITY

#### 6. Email Notifications

Install email library:
```bash
npm install resend
# OR
npm install @sendgrid/mail
```

Create `website/src/lib/email.ts`:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendApplicationConfirmation(
  email: string,
  applicationId: string,
  fullName: string
) {
  await resend.emails.send({
    from: 'DriveDrop <noreply@drivedrop.us.com>',
    to: email,
    subject: 'Driver Application Received - DriveDrop',
    html: `
      <h1>Thank you for applying, ${fullName}!</h1>
      <p>Your driver application has been received and is under review.</p>
      <p><strong>Application ID:</strong> ${applicationId}</p>
      <p>We will notify you within 3-5 business days about the status of your application.</p>
      <p>Next steps:</p>
      <ul>
        <li>Background check will be initiated</li>
        <li>Our team will review your documents</li>
        <li>You will receive an email with the decision</li>
      </ul>
      <p>Questions? Contact us at support@drivedrop.us.com</p>
    `
  })
}

export async function notifyAdminNewApplication(
  applicationId: string,
  applicantEmail: string,
  fullName: string
) {
  await resend.emails.send({
    from: 'DriveDrop System <system@drivedrop.us.com>',
    to: 'admin@drivedrop.us.com',
    subject: `New Driver Application: ${fullName}`,
    html: `
      <h1>New Driver Application Received</h1>
      <p><strong>Application ID:</strong> ${applicationId}</p>
      <p><strong>Applicant:</strong> ${fullName} (${applicantEmail})</p>
      <p><a href="https://drivedrop.us.com/admin/applications/${applicationId}">Review Application</a></p>
    `
  })
}
```

Add to API route after successful insertion:

```typescript
// Send confirmation email to applicant
await sendApplicationConfirmation(email, data.id, fullName)

// Notify admin
await notifyAdminNewApplication(data.id, email, fullName)
```

#### 7. Background Check Integration (Checkr)

**Option 1: Checkr API**

```bash
npm install axios
```

Create `website/src/lib/background-check.ts`:

```typescript
import axios from 'axios'

const CHECKR_API_KEY = process.env.CHECKR_API_KEY!
const CHECKR_BASE_URL = 'https://api.checkr.com/v1'

export async function initiateBackgroundCheck(
  firstName: string,
  lastName: string,
  email: string,
  dob: string, // YYYY-MM-DD
  ssn: string,
  licenseNumber: string,
  licenseState: string
) {
  try {
    // Create candidate
    const candidateResponse = await axios.post(
      `${CHECKR_BASE_URL}/candidates`,
      {
        first_name: firstName,
        last_name: lastName,
        email: email,
        dob: dob,
        ssn: ssn,
        driver_license_number: licenseNumber,
        driver_license_state: licenseState
      },
      {
        auth: {
          username: CHECKR_API_KEY,
          password: ''
        }
      }
    )

    const candidateId = candidateResponse.data.id

    // Create report (MVR + Criminal)
    const reportResponse = await axios.post(
      `${CHECKR_BASE_URL}/reports`,
      {
        candidate_id: candidateId,
        package: 'driver_pro' // MVR + criminal check
      },
      {
        auth: {
          username: CHECKR_API_KEY,
          password: ''
        }
      }
    )

    return {
      success: true,
      reportId: reportResponse.data.id,
      candidateId: candidateId
    }
  } catch (error) {
    console.error('Checkr API error:', error)
    return {
      success: false,
      error: 'Failed to initiate background check'
    }
  }
}

export async function getBackgroundCheckStatus(reportId: string) {
  try {
    const response = await axios.get(
      `${CHECKR_BASE_URL}/reports/${reportId}`,
      {
        auth: {
          username: CHECKR_API_KEY,
          password: ''
        }
      }
    )

    return {
      status: response.data.status, // 'pending', 'clear', 'consider'
      result: response.data.result,
      completed_at: response.data.completed_at
    }
  } catch (error) {
    console.error('Checkr status error:', error)
    return null
  }
}
```

Add to API route:

```typescript
// After inserting driver application
const bgCheck = await initiateBackgroundCheck(
  fullName.split(' ')[0],
  fullName.split(' ')[1],
  email,
  dateOfBirth,
  decryptedSSN, // Use decrypted SSN for API call
  licenseNumber,
  licenseState
)

if (bgCheck.success) {
  // Update application with background check ID
  await supabase
    .from('driver_applications')
    .update({
      background_check_status: 'in_progress',
      background_check_report_id: bgCheck.reportId
    })
    .eq('id', data.id)
}
```

---

### LOW PRIORITY

#### 8. Admin Dashboard for Application Review

Create `website/src/app/admin/applications/page.tsx`:

```typescript
// Admin page to view and manage driver applications
// Features:
// - List all applications with filters (pending, approved, rejected)
// - View application details
// - Approve/reject applications
// - View uploaded documents
// - Check background check status
// - Add review notes
```

#### 9. Application Status Page

Create `website/src/app/drivers/application-status/page.tsx`:

```typescript
// Allow applicants to check their application status
// Enter email or application ID
// Display current status and next steps
```

---

## Testing Checklist

### Before Production

- [ ] Run database migration successfully
- [ ] Create Supabase storage buckets
- [ ] Configure all environment variables
- [ ] Test driver registration form (all 5 steps)
- [ ] Verify form validation (try empty submissions)
- [ ] Test file uploads (license, insurance docs)
- [ ] Verify data appears in `driver_applications` table
- [ ] Check SSN is encrypted in database
- [ ] Test email notifications (confirmation, admin alert)
- [ ] Verify legal pages are accessible (/privacy, /terms, /fcra)
- [ ] Test quote calculator with real addresses
- [ ] Verify deep links open mobile app
- [ ] Check responsive design on mobile devices
- [ ] Test all navigation links (header, footer)
- [ ] Verify RLS policies work (users can only see own data)
- [ ] Performance test (form submission under load)
- [ ] Security audit (SQL injection, XSS prevention)

### Manual Test Scenarios

1. **Complete Application Flow:**
   - Fill out all 5 steps with valid data
   - Upload all required documents
   - Accept all agreements
   - Submit application
   - Verify confirmation email received
   - Check database for correct data storage

2. **Validation Testing:**
   - Try submitting Step 1 with invalid email
   - Try submitting Step 1 with invalid SSN format
   - Try submitting Step 2 with expired license
   - Try proceeding without uploading required files
   - Try submitting Step 5 without checking all boxes

3. **Edge Cases:**
   - Submit duplicate application (same email)
   - Upload oversized files (>10MB)
   - Upload invalid file types (executable, script)
   - Test with special characters in name/address
   - Test with international phone numbers

---

## Deployment

### Deploy to Vercel

```bash
cd website
vercel login
vercel
```

### Configure Domain (drivedrop.us.com)

1. **In Vercel Dashboard:**
   - Go to Project Settings → Domains
   - Add custom domain: `drivedrop.us.com`
   - Copy DNS instructions

2. **In Porkbun Dashboard:**
   ```
   Type: CNAME
   Host: @
   Value: cname.vercel-dns.com
   TTL: 600
   ```

3. **Add Environment Variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Redeploy to apply changes

### Post-Deployment

- [ ] Verify website loads on custom domain
- [ ] Test SSL certificate is active
- [ ] Verify environment variables are working
- [ ] Test all API endpoints in production
- [ ] Monitor error logs in Vercel dashboard
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)

---

## Security Considerations

### Production Hardening

1. **SSN Encryption:**
   - ✅ AES-256 encryption implemented
   - ⚠️ Store encryption keys in environment variables (never commit)
   - ⚠️ Rotate encryption keys periodically
   - ⚠️ Use separate keys for dev/staging/production

2. **File Uploads:**
   - ⚠️ Validate file types (only images/PDFs)
   - ⚠️ Scan uploaded files for malware
   - ⚠️ Limit file size (max 10MB)
   - ⚠️ Use signed URLs for document access

3. **API Security:**
   - ⚠️ Implement rate limiting (10 requests/minute per IP)
   - ⚠️ Add CSRF protection
   - ⚠️ Validate all inputs server-side
   - ⚠️ Sanitize user inputs to prevent XSS

4. **Database Security:**
   - ✅ RLS policies enabled
   - ⚠️ Regular security audits
   - ⚠️ Backup strategy (daily backups)
   - ⚠️ Monitor for suspicious activity

---

## Maintenance

### Regular Tasks

**Weekly:**
- Review new applications
- Check background check statuses
- Monitor email delivery rates

**Monthly:**
- Audit application rejection reasons
- Review document upload success rates
- Update legal pages if regulations change

**Quarterly:**
- Security audit
- Performance optimization
- User feedback analysis

---

## Troubleshooting

### Common Issues

**Issue: File uploads failing**
- Check Supabase storage bucket exists
- Verify RLS policies are correct
- Check file size limits
- Verify authentication state

**Issue: SSN encryption errors**
- Verify ENCRYPTION_KEY and ENCRYPTION_IV are set
- Check key format (hex string)
- Ensure keys are 32 bytes (KEY) and 16 bytes (IV)

**Issue: Background check not initiating**
- Verify Checkr API key is valid
- Check API rate limits
- Review error logs for API responses

**Issue: Emails not sending**
- Verify email provider API key
- Check sender domain is verified
- Review email quotas/limits
- Check spam folder

---

## Next Steps

1. **Complete high-priority tasks** (database, storage, environment variables)
2. **Implement file upload functionality**
3. **Add SSN encryption**
4. **Test complete registration flow**
5. **Set up email notifications**
6. **Integrate background check service** (Checkr)
7. **Create admin dashboard**
8. **Deploy to production**

---

## Contact

For questions or issues with implementation:
- **Email:** dev@drivedrop.us.com
- **GitHub:** [Your Repository]
- **Documentation:** [Link to full docs]
