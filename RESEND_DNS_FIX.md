# 🔧 Resend DNS Configuration Fix

**Issue:** TXT verified but MX and DMARC failing  
**Cause:** Records configured for subdomain but Resend checking root domain

---

## Current Setup (What You Have)

In AWS Route 53 for `drivedrop.us.com`:

```
send.drivedrop           MX    feedback-smtp.us-east-1.amazonses.com
send.drivedrop           TXT   v=spf1 include:amazonses.com
_dmarc.drivedrop         TXT   v=DMARC1; p=none;
```

## What Resend Is Looking For

If you added `drivedrop.us.com` in Resend, it's checking:

```
drivedrop.us.com         MX    feedback-smtp.us-east-1.amazonses.com
drivedrop.us.com         TXT   v=spf1 include:amazonses.com
_dmarc.drivedrop.us.com  TXT   v=DMARC1; p=none;
```

---

## ✅ Fix: Update Route 53 Records

### Step 1: Delete Current Records

In Route 53, delete these 3 records:
- `send.drivedrop` (MX)
- `send.drivedrop` (TXT)
- `_dmarc.drivedrop` (TXT)

### Step 2: Create New Records at Root Domain

**Record 1: MX Record**
```
Record name:  (leave empty or use @)
Type:         MX
Value:        10 feedback-smtp.us-east-1.amazonses.com
TTL:          300
```

**Record 2: TXT Record (SPF)**
```
Record name:  (leave empty or use @)
Type:         TXT
Value:        "v=spf1 include:amazonses.com ~all"
TTL:          300
```

**Record 3: TXT Record (DMARC)**
```
Record name:  _dmarc
Type:         TXT
Value:        "v=DMARC1; p=none;"
TTL:          300
```

### Step 3: Wait 5-10 Minutes

DNS changes should propagate quickly since nameservers are already updated.

### Step 4: Check Resend Dashboard

Click "Verify" button in Resend - all 3 should now pass.

---

## 🔍 Alternative: Check What Resend Expects

1. **In Resend Dashboard**, go to your domain
2. Click "DNS Records" or "Setup"
3. Look at the **exact record names** Resend shows
4. Match those exactly in Route 53

**Common patterns:**

| What Resend Shows | What to Put in Route 53 |
|-------------------|-------------------------|
| `drivedrop.us.com` | (leave empty) or `@` |
| `send.drivedrop.us.com` | `send` |
| `_dmarc.drivedrop.us.com` | `_dmarc` |

---

## 🧪 Test DNS Propagation

Open PowerShell and test:

```powershell
# Check MX record
nslookup -type=MX drivedrop.us.com

# Check TXT/SPF record
nslookup -type=TXT drivedrop.us.com

# Check DMARC record
nslookup -type=TXT _dmarc.drivedrop.us.com
```

**Expected results:**

```
# MX
drivedrop.us.com  MX preference = 10, mail exchanger = feedback-smtp.us-east-1.amazonses.com

# TXT/SPF
drivedrop.us.com  text = "v=spf1 include:amazonses.com ~all"

# DMARC
_dmarc.drivedrop.us.com  text = "v=DMARC1; p=none;"
```

---

## 🚨 If Still Failing

### Issue: Wrong Domain in Resend

If you accidentally added `send.drivedrop.us.com` instead of `drivedrop.us.com` in Resend:

**Fix:**
1. Remove `send.drivedrop.us.com` from Resend
2. Add `drivedrop.us.com` as a new domain
3. Follow DNS instructions Resend provides
4. Update Route 53 records to match

### Issue: SPF Record Conflict

If you already have an SPF record for the domain:

**Fix:**
```
# Merge them into one TXT record
OLD: "v=spf1 include:otherprovider.com ~all"
NEW: "v=spf1 include:otherprovider.com include:amazonses.com ~all"
```

---

## 📧 What This Fixes

Once all 3 records verify:
- ✅ Emails sent from `noreply@drivedrop.us.com`
- ✅ Password reset emails working
- ✅ Shipment notifications working
- ✅ No "via resend.dev" in email headers
- ✅ Better deliverability (not marked as spam)

---

## ⏱️ Expected Timeline

- DNS update in Route 53: Immediate
- Propagation to internet: 5-10 minutes
- Resend verification: 1-2 minutes after propagation
- **Total time: 10-15 minutes**

---

**Next:** Once verified, test sending an email from the app!
