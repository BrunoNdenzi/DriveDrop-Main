# 🚀 Commercial Expansion API Testing Guide

## ⚠️ IMPORTANT: Correct Backend Port
**Backend API**: `http://localhost:3001/api/v1/`  
**Frontend UI**: `http://localhost:3000/`

Don't confuse them! The API is on port **3001**, not 3000.

---

## 📍 API Endpoints for Postman Testing

### 1. Commercial Accounts API

#### Create Commercial Account
```
POST http://localhost:3001/api/v1/commercial/accounts
Content-Type: application/json

{
  "company_name": "Test Auction House",
  "contact_name": "John Doe",
  "contact_email": "john@testauction.com",
  "contact_phone": "555-1234",
  "account_type": "auction_house",
  "monthly_volume_estimate": 100
}
```

#### Get All Commercial Accounts
```
GET http://localhost:3001/api/v1/commercial/accounts
```

#### Get Account by ID
```
GET http://localhost:3001/api/v1/commercial/accounts/{account_id}
```

#### Update Account
```
PATCH http://localhost:3001/api/v1/commercial/accounts/{account_id}
Content-Type: application/json

{
  "verification_status": "verified"
}
```

#### Generate API Key
```
POST http://localhost:3001/api/v1/commercial/accounts/{account_id}/keys
Content-Type: application/json

{
  "name": "Production API Key"
}
```

#### Get API Usage Stats
```
GET http://localhost:3001/api/v1/commercial/accounts/{account_id}/usage
```

---

### 2. Integrations API

#### Create Integration
```
POST http://localhost:3001/api/v1/integrations
Content-Type: application/json

{
  "commercial_account_id": "{account_id}",
  "integration_name": "Copart Integration",
  "integration_type": "api",
  "configuration": {
    "api_url": "https://api.copart.com/v1",
    "auth_type": "api_key",
    "auth_credentials": {
      "api_key": "test_key_123"
    }
  },
  "field_mapping": {
    "vin": "vehicle_vin",
    "year": "vehicle_year",
    "make": "vehicle_make",
    "model": "vehicle_model"
  },
  "sync_frequency": "daily"
}
```

#### Get All Integrations
```
GET http://localhost:3001/api/v1/integrations
```

#### Test Integration
```
POST http://localhost:3001/api/v1/integrations/{integration_id}/test
```

#### Sync Integration
```
POST http://localhost:3001/api/v1/integrations/{integration_id}/sync
```

#### Get Integration Logs
```
GET http://localhost:3001/api/v1/integrations/{integration_id}/logs?limit=50
```

---

### 3. Bill of Lading (BOL) API

#### Create BOL
```
POST http://localhost:3001/api/v1/bol
Content-Type: application/json

{
  "shipment_id": "{shipment_id}",
  "shipper_info": {
    "name": "Test Auction House",
    "address": "123 Auction St, Los Angeles, CA 90001",
    "phone": "555-1234"
  },
  "consignee_info": {
    "name": "ABC Dealership",
    "address": "456 Dealer Ave, New York, NY 10001",
    "phone": "555-5678"
  },
  "vehicle_info": {
    "year": 2020,
    "make": "Toyota",
    "model": "Camry",
    "vin": "1HGBH41JXMN109186"
  }
}
```

#### Get All BOLs
```
GET http://localhost:3001/api/v1/bol
```

#### Get BOL by ID
```
GET http://localhost:3001/api/v1/bol/{bol_id}
```

#### Add Vehicle Condition
```
POST http://localhost:3001/api/v1/bol/{bol_id}/condition
Content-Type: application/json

{
  "inspection_type": "pickup",
  "condition_notes": "Excellent condition, no damage",
  "damage_items": []
}
```

#### Add Signature
```
POST http://localhost:3001/api/v1/bol/{bol_id}/signature
Content-Type: application/json

{
  "signature_type": "pickup",
  "signature_url": "https://example.com/signature.png",
  "signed_by": "John Doe",
  "signed_at": "2025-12-27T10:00:00Z"
}
```

#### Download BOL PDF
```
GET http://localhost:3001/api/v1/bol/{bol_id}/pdf
```

---

### 4. AI Dispatcher API

#### Run Optimization
```
POST http://localhost:3001/api/v1/dispatcher/optimize
```

#### Apply Optimization
```
POST http://localhost:3001/api/v1/dispatcher/{optimization_id}/apply
```

#### Reject Optimization
```
POST http://localhost:3001/api/v1/dispatcher/{optimization_id}/reject
Content-Type: application/json

{
  "reason": "Manual override - driver preference"
}
```

#### Get Statistics
```
GET http://localhost:3001/api/v1/dispatcher/statistics?days=30
```

---

### 5. Webhooks API

#### Create Webhook
```
POST http://localhost:3001/api/v1/webhooks
Content-Type: application/json

{
  "commercial_account_id": "{account_id}",
  "url": "https://your-server.com/webhooks/drivedrop",
  "events": [
    "shipment.picked_up",
    "shipment.delivered",
    "bol.issued"
  ]
}
```

#### Update Webhook
```
PATCH http://localhost:3001/api/v1/webhooks/{webhook_id}
Content-Type: application/json

{
  "active": true,
  "events": ["shipment.picked_up", "shipment.in_transit", "shipment.delivered"]
}
```

#### Test Webhook
```
POST http://localhost:3001/api/v1/webhooks/{webhook_id}/test
```

#### Get Webhook Logs
```
GET http://localhost:3001/api/v1/webhooks/{webhook_id}/logs?limit=50
```

#### Get Webhook Stats
```
GET http://localhost:3001/api/v1/webhooks/{webhook_id}/stats?days=7
```

#### Delete Webhook
```
DELETE http://localhost:3001/api/v1/webhooks/{webhook_id}
```

---

## 🎨 Admin UI Pages (Accessible in Navigation)

After restarting the frontend, you'll see these new links in the admin sidebar:

1. **Commercial Accounts**: http://localhost:3000/dashboard/admin/commercial
2. **Integrations**: http://localhost:3000/dashboard/admin/integrations
3. **BOL Management**: http://localhost:3000/dashboard/admin/bol
4. **AI Review Queue**: http://localhost:3000/dashboard/admin/ai-review

---

## 🔄 Restart Instructions

### Restart Backend
```bash
# Stop current backend (Ctrl+C)
cd backend
npm run dev
```

### Restart Frontend
```bash
# Stop current frontend (Ctrl+C)
cd website
npm run dev
```

After restarting:
- ✅ All 5 API route modules will be registered
- ✅ Navigation links will appear in admin sidebar
- ✅ APIs accessible at `http://localhost:3001/api/v1/`
- ✅ UI accessible at `http://localhost:3000/dashboard/admin/`

---

## 📝 Quick Test Workflow

1. **Create Commercial Account** (POST /commercial/accounts)
2. **Generate API Key** (POST /commercial/accounts/{id}/keys)
3. **Create Integration** (POST /integrations)
4. **Test Integration** (POST /integrations/{id}/test)
5. **Check UI**: Navigate to http://localhost:3000/dashboard/admin/integrations

---

## 🐛 Troubleshooting

### API returns 404
- ✅ Make sure you're using port **3001** (not 3000)
- ✅ Restart the backend server
- ✅ Check: http://localhost:3001/api/v1/ (should show welcome message)

### Navigation links not showing
- ✅ Restart the frontend server
- ✅ Hard refresh browser (Ctrl+Shift+R)
- ✅ Check browser console for errors

### Database errors
- ✅ Make sure you ran all 3 migrations in Supabase
- ✅ Check Supabase connection in backend .env

---

Ready to test! 🚀
