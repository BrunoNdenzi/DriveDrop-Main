# DriveDrop — Full Operations Overview
> **Purpose:** This document is the authoritative reference for training AI models, voice agents, and new team members on every aspect of DriveDrop's platform, workflows, and business operations.

---

## Table of Contents
1. [What Is DriveDrop?](#1-what-is-drivedrop)
2. [Platform Surfaces](#2-platform-surfaces)
3. [User Roles](#3-user-roles)
4. [Core Workflow — End-to-End Shipment Lifecycle](#4-core-workflow--end-to-end-shipment-lifecycle)
5. [Client Operations](#5-client-operations)
6. [Driver / Carrier Operations](#6-driver--carrier-operations)
7. [Broker Operations](#7-broker-operations)
8. [Admin Operations](#8-admin-operations)
9. [Pricing Engine](#9-pricing-engine)
10. [Payment System](#10-payment-system)
11. [AI Features — Benji & Automation](#11-ai-features--benji--automation)
12. [Documents & Compliance](#12-documents--compliance)
13. [Tracking & Communication](#13-tracking--communication)
14. [Carrier Acquisition Pipeline](#14-carrier-acquisition-pipeline)
15. [Commercial (B2B) Accounts](#15-commercial-b2b-accounts)
16. [Integrations](#16-integrations)
17. [Tech Stack Summary](#17-tech-stack-summary)
18. [Key URLs & Contacts](#18-key-urls--contacts)
19. [Glossary](#19-glossary)

---

## 1. What Is DriveDrop?

DriveDrop is a **vehicle transport marketplace** based in Charlotte, NC. It connects:
- **Clients** (car dealers, fleet owners, auction houses, private sellers) who need vehicles moved
- **Drivers / Carriers** (transport companies, independent operators) who haul the vehicles
- **Brokers** who coordinate shipments on behalf of multiple clients

DriveDrop eliminates the traditional broker middleman for direct loads, ensuring carriers retain a higher percentage of every haul. Clients get instant quotes, real-time tracking, and guaranteed insured transport.

**Core value propositions:**
- Direct shipper-to-carrier connections — no hidden broker commissions
- Guaranteed payment collected from the client **upfront** before the driver moves
- Free TMS (Transportation Management System) built into the driver app
- Free AI-powered route planner and multi-stop route optimization
- Real-time GPS tracking for customers so drivers aren't interrupted by status calls
- Digital Bill of Lading (BOL), photo inspections, and compliance documents

---

## 2. Platform Surfaces

| Surface | URL / Location | Who Uses It |
|---|---|---|
| **Public Website** | `https://www.drivedrop.us.com` | All visitors, landing page, quote tool |
| **Client Dashboard (Web)** | `https://www.drivedrop.us.com/dashboard/client` | Clients managing shipments |
| **Driver Dashboard (Web)** | `https://www.drivedrop.us.com/dashboard/driver` | Drivers managing jobs |
| **Admin Dashboard (Web)** | `https://www.drivedrop.us.com/dashboard/admin` | Admins / internal ops |
| **Broker Dashboard (Web)** | `https://www.drivedrop.us.com/dashboard/broker` | Broker accounts |
| **Mobile App (iOS/Android)** | React Native (Expo) | Clients and Drivers on the go |
| **Backend API** | Railway-hosted Express server (port 3001) | All dashboards and mobile app |
| **Driver Registration** | `https://www.drivedrop.us.com/drivers/register` | New carrier sign-ups |
| **Client Sign-Up** | `https://www.drivedrop.us.com/signup` | New client accounts |

---

## 3. User Roles

### 3.1 Client
A client is any person or organization that needs vehicles transported. They can be:
- **Private individuals** relocating a personal vehicle
- **Car dealerships** moving inventory or dealer trades
- **Fleet managers** moving company vehicles
- **Auction houses** dispatching purchased vehicles
- **Commercial accounts** (B2B) with API access and credit terms

Clients create shipments, pay via Stripe, and receive real-time tracking links.

### 3.2 Driver (Carrier)
A driver is a verified transport professional or company. They:
- Apply for and accept shipment jobs from the load board
- Use the free built-in TMS to manage their operation
- Complete pickup and delivery photo inspections
- Sign digital BOLs at pickup and delivery
- Get paid via the platform after successful delivery

All drivers go through a verified onboarding process requiring identity documents, driver's license, and insurance proof.

### 3.3 Broker
A broker coordinates shipments on behalf of clients. Brokers:
- Have a dedicated dashboard to post and manage loads
- Can receive loads programmatically via API (`dd_live_` API key)
- Operate under the `broker-signup` auth flow
- Can access bulk load posting tools

### 3.4 Admin
Internal operations team. Admins have full read/write access to:
- All shipments, users, and payments
- Driver application approval/rejection
- Pricing configuration
- Campaign management (carrier outreach)
- Live map of all active shipments
- AI dispatcher controls
- Reports and analytics

---

## 4. Core Workflow — End-to-End Shipment Lifecycle

### Step 1 — Quote & Booking (Client)
1. Client visits the website or opens the mobile app.
2. Enters **pickup address**, **delivery address**, **vehicle type**, and **pickup date**.
3. The pricing engine returns an **instant quote** (based on distance, vehicle type, delivery speed, fuel price, and surge).
4. Client creates an account (or logs in), confirms shipment details, and pays via Stripe.
5. Payment is held — the driver is **not paid yet**; funds are captured upfront from the client.

### Step 2 — Job Posting & Driver Matching
1. Once payment is confirmed, the shipment is posted to the **active load board**.
2. Nearby verified drivers receive a push notification about the new available load.
3. Drivers can view load details (vehicle, pickup/delivery locations, pay rate, distance) and **apply**.
4. Admin or the AI Dispatcher reviews applicants and assigns the best-matched driver.
5. The assigned driver is notified and the shipment status moves to `driver_assigned`.

### Step 3 — Pickup Verification
1. Driver navigates to the pickup location using the built-in route planner.
2. Upon arrival (GPS verified within 100m), driver marks **"Arrived"** in the app.
3. Driver completes a **pre-transport photo inspection** — photos of all four sides, VIN plate, odometer, and any pre-existing damage.
4. Driver and shipper sign the **digital Bill of Lading (BOL)** electronically.
5. If going to/from an auction house or secure facility, a **QR-code Gate Pass** is generated for access control.
6. Status updates to `in_transit` and the client receives a real-time tracking link.

### Step 4 — Transit
1. Client can track the vehicle in real-time via their dashboard or a shareable tracking link.
2. Driver receives Benji AI coaching — traffic warnings, fuel stop recommendations, FMCSA break reminders.
3. Status milestones: `driver_en_route` → `driver_arrived` → `picked_up` → `in_transit`.

### Step 5 — Delivery & Completion
1. Driver arrives at delivery address, completes the **delivery photo inspection**.
2. Driver and recipient sign the digital BOL at delivery.
3. Status updates to `delivered`.
4. Client confirms delivery and the shipment moves to `completed`.
5. Payment is released to the driver.
6. Both client and driver can leave reviews.
7. Digital BOL and inspection report are stored and accessible to all parties.

### Shipment Status Reference

| Status | Meaning |
|---|---|
| `pending` | Posted, awaiting driver assignment |
| `driver_assigned` | Driver matched, not yet departed |
| `driver_en_route` | Driver en route to pickup |
| `driver_arrived` | Driver at pickup location |
| `picked_up` | Vehicle loaded, in transit |
| `in_transit` | Moving toward delivery |
| `delivered` | Vehicle at destination |
| `completed` | Delivery confirmed, payment released |
| `cancelled` | Shipment cancelled |
| `disputed` | Under review |

---

## 5. Client Operations

### 5.1 Creating a Shipment
Clients have three ways to create a shipment:
- **Standard web form** — fill in pickup, delivery, vehicle info, dates
- **Natural Language (AI)** — type or speak in plain English: *"Ship my 2019 Ford F-150 from Charlotte to Atlanta next Tuesday"* — Benji AI parses the intent and pre-fills the form
- **Bulk CSV upload** — dealerships and fleet managers can upload a CSV with multiple vehicles at once

### 5.2 Vehicles
Clients can save vehicles to their profile for quick re-use. Supported types:
`sedan`, `suv`, `pickup`, `luxury`, `motorcycle`, `heavy`

### 5.3 Tracking
Every shipment generates a **real-time tracking page** clients can bookmark or share. No login required for the tracking page. Location is updated as the driver moves.

### 5.4 Messaging
Clients have an in-app messaging thread per shipment to communicate directly with the assigned driver.

### 5.5 Payments & Refunds
- All payments processed via **Stripe**.
- Payment is collected upfront at booking.
- Refund eligibility is calculated based on how soon before pickup cancellation occurs.
- Clients can add/remove payment methods from their profile.

### 5.6 Photo Comparison
After delivery, clients can view a side-by-side photo comparison of the vehicle at pickup vs. delivery to verify condition.

---

## 6. Driver / Carrier Operations

### 6.1 Registration & Onboarding
New drivers register at `https://www.drivedrop.us.com/drivers/register`. The multi-step application collects:
1. **Personal information** — full name, date of birth, address, phone, email
2. **License information** — license number, state, expiration, front/back photo upload
3. **Driving history** — accident/incident history
4. **Insurance proof** — provider, policy number, expiration, certificate upload

Applications are reviewed and approved/rejected by admin in the Admin Dashboard → Driver Applications section. Approval triggers a welcome email.

### 6.2 Load Board
Drivers see all available (unassigned) loads in their area. Loads display:
- Pickup and delivery addresses
- Vehicle details (year/make/model)
- Estimated pay
- Distance to pickup
- Estimated route distance

Drivers apply for loads they want; admin assigns from applicants.

### 6.3 Free TMS (Transportation Management System)
Every driver gets free access to a full TMS built into the DriveDrop platform. This includes:
- **Jobs dashboard** — all active, pending, and completed jobs in one view
- **Earnings tracker** — total earnings, per-job breakdown, history
- **Digital BOLs** — create, sign, store, and retrieve all bills of lading
- **Inspection reports** — photo inspection records with damage reports
- **Documents center** — uploaded CDL, insurance, compliance docs
- **Profile & compliance** — FMCSA DOT/MC info, ratings, verification status

### 6.4 Free AI Route Planner
The route planner (`/dashboard/driver/route-planner`) is a fully AI-powered tool:
- **Multi-stop TSP optimization** — nearest-neighbor algorithm with 2-opt improvement finds the most efficient order for multiple pickups/deliveries
- **Carolina corridor intelligence** — knows real traffic patterns on I-85, I-77, I-40, I-26, and I-95; Charlotte/Raleigh/Greensboro rush hour avoidance built-in
- **Fuel stop recommendations** — identifies optimal fuel stops; SC fuel is typically $0.20–0.30/gal cheaper than NC
- **FMCSA break scheduling** — automatically schedules required 30-minute breaks after 8 hours of drive time
- **Deadhead mile reduction** — minimizes empty miles between drops
- **Daily plan generation** — produces a full day plan with ETAs, fuel costs, and savings breakdown

### 6.5 Pickup Verification
Once assigned, the driver follows a structured verification workflow:
1. Mark **En Route** (triggers GPS tracking for the client)
2. Mark **Arrived** (GPS-verified within 100 meters of pickup address)
3. Complete **photo inspection** — required angles: front, rear, driver side, passenger side, VIN plate, interior/odometer, any pre-existing damage
4. Collect **digital signature** from the vehicle owner
5. **Gate Pass** generated automatically if picking up from an auction/secure facility

### 6.6 Active Job Management
During transit, drivers have access to:
- Turn-by-turn navigation integrated with Google Maps
- Real-time status updates that automatically notify the client
- In-app messaging with client
- Benji AI coaching while driving (load tips, traffic, weather, break alerts)

### 6.7 Earnings
The Earnings tab shows:
- Total earnings (lifetime, monthly, weekly)
- Per-job earnings with date and route
- Payment status per job
- Breakdown of platform fees (0% for the first 90 days if promo applied)

### 6.8 Invitations
Drivers can also receive direct invitations from admins to take a specific load — bypassing the open application process.

---

## 7. Broker Operations

### 7.1 Account Setup
Brokers sign up via `https://www.drivedrop.us.com/auth/broker-signup`. Broker accounts get:
- A dedicated broker dashboard
- API key (`dd_live_` prefix) for system-to-system load submission
- Credit limit configuration (admin-set)

### 7.2 Load Management
Brokers can:
- Post loads directly to the DriveDrop load board
- View all loads they've posted and their current status
- Receive real-time tracking updates for each load
- Access BOLs and inspection reports for completed loads

### 7.3 Broker Loads (Driver View)
Drivers can view a separate **"Broker Loads"** section in their dashboard that shows loads specifically posted by broker accounts, if enabled.

---

## 8. Admin Operations

### 8.1 Admin Dashboard Overview
The admin panel at `https://www.drivedrop.us.com/dashboard/admin` is the command center. Key sections:

| Section | Purpose |
|---|---|
| **Home / Overview** | Live KPIs — active shipments, revenue, driver count, open jobs |
| **Shipments** | View, filter, update, and manage all shipments |
| **Live Map** | Real-time map showing all active shipments and driver locations |
| **Users** | Manage client and driver accounts |
| **Driver Applications** | Review and approve/reject new driver onboarding applications |
| **Assignments** | View and manually manage driver-to-shipment assignments |
| **Pricing** | Configure base rates, surge multipliers, fuel adjustments, delivery-type multipliers |
| **BOL** | View all bills of lading across all shipments |
| **Leads** | Lead acquisition dashboard (FMCSA imports, manual entry) |
| **Contacts** | Carrier, broker, dealership, and shipper contact database |
| **Campaigns** | Email campaign management for carrier outreach |
| **Campaign Analytics** | Open rates, click rates, reply rates, unsubscribes per campaign |
| **Commercial** | B2B commercial account management |
| **Integrations** | Auction house / dealership data feed integrations |
| **AI Review** | Human review queue for low-confidence AI document extractions |
| **Reports** | Business analytics and export |
| **Settings** | Platform-wide configuration |

### 8.2 Pricing Configuration
Admins can adjust all pricing levers in real-time without code changes:
- **Base rates per mile** by vehicle type and distance band
- **Surge multiplier** — demand-based price increase
- **Fuel price per gallon** — affects operating cost calculation
- **Delivery type multipliers** — Expedited: 1.25×, Standard: 1.0×, Flexible: 0.95×
- **Bulk discount tiers** — 10% for 3–5 vehicles, 15% for 6–9, 20% for 10+
- **Minimum quote floor** — prevents underpricing on short routes
- All config changes logged with audit trail (who changed what and why)

### 8.3 AI Dispatcher
The AI Dispatcher automatically:
- Scores all available drivers for each unassigned shipment
- Considers driver location, rating, vehicle capacity, service area
- Generates optimal assignment recommendations
- Admin can review and apply recommendations with one click
- Estimated 30% efficiency gain vs. manual dispatch

### 8.4 Live Map
The admin map shows:
- All active shipments plotted as route lines
- Driver locations in real-time
- Shipment status color coding
- Click any shipment to see full details, assign/reassign driver

---

## 9. Pricing Engine

The DriveDrop pricing engine calculates quotes dynamically based on multiple factors:

### Distance Bands
| Band | Miles | Behavior |
|---|---|---|
| Short | ≤ 500 mi | Higher per-mile rate |
| Mid | 501–1,500 mi | Standard rate |
| Long | > 1,500 mi | Lower per-mile rate (efficiency gains) |
| Minimum enforced | 100 mi floor | Prevents unrealistic short-haul quotes |

### Vehicle Type Base Rates (per mile)
| Vehicle | Short | Mid | Long | Accident Recovery |
|---|---|---|---|---|
| Sedan | $1.80 | $0.95 | $0.60 | $2.50 |
| SUV | $2.00 | $1.05 | $0.70 | $2.75 |
| Pickup | $2.20 | $1.15 | $0.75 | $3.00 |
| Luxury | $3.00 | $1.80 | $1.25 | $4.00 |
| Motorcycle | $1.50 | $0.85 | $0.55 | $2.00 |
| Heavy | $3.50 | $2.25 | $1.80 | $4.50 |

### Cost Components (per mile, used for margin calculation)
- Fuel: $0.525
- Driver: $0.625
- Insurance: $0.15
- Maintenance: $0.275
- Tolls: $0.10

### Multipliers Applied
1. **Delivery Type** — Expedited (+25%), Standard (no change), Flexible (−5%)
2. **Surge** — Admin-configurable demand multiplier (default 1.0×)
3. **Fuel Adjustment** — Compares live fuel price to base ($3.70/gal) and adjusts accordingly
4. **Bulk Discount** — 10% / 15% / 20% for multi-vehicle loads
5. **Accident Recovery** — Flat surcharge applied on top of base rate

### Minimum Quotes
- Regular transport: $150 minimum
- Accident recovery: $80 minimum

---

## 10. Payment System

### 10.1 Stripe Integration
All client payments are processed via **Stripe**. The platform supports:
- Credit and debit cards
- Saved payment methods (add/remove from profile)
- Payment intents with metadata linking to shipments
- Refunds (admin-controlled, eligibility-checked)

### 10.2 Payment Flow
1. Client receives quote → creates shipment
2. Stripe Payment Intent created for the quoted amount
3. Client confirms payment → funds held (captured upfront)
4. Job posted to load board
5. Driver completes delivery
6. Payment released to driver (minus platform fee)

### 10.3 Split Payment
For some shipments, a split payment model is supported:
- Upfront deposit collected at booking
- Remaining balance captured after delivery confirmation

### 10.4 Refunds
- Admin can initiate refunds from the Shipments panel
- Refund eligibility checked automatically before allowing a refund
- Full refund if cancelled before driver dispatch; partial if in transit

---

## 11. AI Features — Benji & Automation

### 11.1 Benji — AI Assistant
**Benji** is DriveDrop's context-aware AI assistant powered by OpenAI GPT-4. Benji is available to all user types with role-specific knowledge:

**For Clients:**
- Creates shipments from natural language: *"Send my Tesla from Dallas to Miami next week"*
- Answers billing and tracking questions
- Assists with document uploads (AI extracts VIN, make, model from photos)
- Provides instant quotes

**For Drivers:**
- Recommends the best available loads based on driver location, history, and preferences
- Generates optimized daily haul plans with Carolina-specific traffic intelligence
- Provides fuel stop recommendations and savings breakdowns
- Issues FMCSA compliance reminders (break scheduling, HoS rules)
- Answers questions about BOL, inspections, platform features

**For Admins:**
- Powers the AI Dispatcher (automated optimal assignment suggestions)
- Answers operational questions and provides platform analytics on request

### 11.2 Natural Language Shipment Creation
Users can describe a shipment in plain English, voice, or even via email/SMS. The system:
1. Extracts: origin city/address, destination, vehicle year/make/model/VIN, pickup date
2. Handles fuzzy dates: "next Monday", "ASAP", "in 2 weeks"
3. Normalizes partial addresses: "Atlanta" → full geocoded address
4. Returns a confidence score
5. Pre-fills the booking form for user confirmation

### 11.3 AI Document Extraction
Clients can upload documents (Bill of Sale, title, insurance certificate, inspection report). The AI:
1. Runs OCR on the uploaded image/PDF
2. GPT-4 extracts structured data (VIN, vehicle info, seller/buyer details, dates)
3. Returns a **confidence score (0.00–1.00)**
4. High confidence (≥0.85): auto-approved and pre-fills shipment form
5. Low confidence (<0.85): sent to admin **Human Review Queue** for manual verification

### 11.4 AI Dispatcher (BenjiDispatcherService)
Runs automatically or on-demand to:
- Score all available drivers against all unassigned loads
- Factors: proximity to pickup, driver rating, vehicle type compatibility, historical performance
- Produces a ranked match list with confidence scores and match reasons
- Admin applies with one click; system updates shipment and notifies driver

### 11.5 Load Recommendation Engine (BenjiLoadRecommendationService)
Personalizes the load board for each driver:
- Scores every available load with a match score (0–100)
- Categorizes: Best Match, Good Match, Consider
- Returns personalized insights: *"This load matches your typical Charlotte → Atlanta corridor"*

### 11.6 AI Route Optimization (RouteOptimizationService)
Multi-stop route solver:
- **Algorithm:** TSP (Travelling Salesman Problem) solved with nearest-neighbor heuristic + 2-opt improvement
- **Carolina corridor database:** Highway-specific traffic patterns (I-85, I-77, I-40, I-26, I-95)
- **Outputs:** Optimized stop order, estimated arrival times, fuel costs, savings vs. naive order
- **Fuel intelligence:** Recommends cheapest fuel stops; accounts for SC vs. NC price difference
- **FMCSA compliance:** Auto-inserts required rest breaks in compliance with Hours of Service rules

---

## 12. Documents & Compliance

### 12.1 Bill of Lading (BOL)
The BOL is a **legally required** transport document (49 CFR Part 373). DriveDrop generates digital BOLs that:
- Auto-populate from shipment data (shipper, consignee, carrier, vehicle details)
- Include vehicle condition at pickup and delivery
- Capture digital signatures from all parties
- Are stored permanently and accessible as PDF

### 12.2 Vehicle Inspection Reports
Every shipment generates a structured inspection report:
- Required photos at pickup AND delivery (front, rear, both sides, VIN, odometer, any damage)
- Damage items catalogued by location, type, and severity
- Mandatory sign-off from driver
- Used for insurance claims if damage is disputed

### 12.3 Gate Passes
For pickups/deliveries at auction houses, dealerships, or secure facilities:
- QR-code-based gate pass generated per shipment
- Contains: driver identity, vehicle info, authorized time window, facility instructions
- Scanned at entry/exit for access control logging
- Valid only within the specified time window

### 12.4 Driver Documents
All drivers must maintain valid, uploaded copies of:
- Commercial Driver's License (front and back)
- Proof of insurance
- Any required FMCSA filings

---

## 13. Tracking & Communication

### 13.1 Real-Time GPS Tracking
- Driver location is broadcast in real-time via the mobile app
- Clients access tracking via a dedicated link (no login required)
- Admin sees all active drivers and shipments on the Live Map
- Status milestones trigger automatic client notifications

### 13.2 Push Notifications
Push notifications sent to drivers for:
- New load available in their area
- Direct invitation to a load
- Assignment confirmed
- Important status changes

Push notifications sent to clients for:
- Driver assigned
- Driver en route
- Driver arrived at pickup
- Vehicle picked up
- Vehicle delivered

### 13.3 In-App Messaging
Shipment-level messaging threads allow clients and drivers to communicate directly. The admin can monitor all conversations.

### 13.4 SMS (Twilio)
SMS notifications sent as fallback or for critical alerts. Managed via the Twilio integration.

### 13.5 Email (Brevo)
Transactional emails sent for:
- Account registration welcome
- Driver application approval/rejection
- Shipment confirmation
- Payment receipts
- Delivery confirmation
- Password reset

All emails sent from the `@drivedrop.us.com` domain.

---

## 14. Carrier Acquisition Pipeline

DriveDrop runs a dedicated outreach pipeline to recruit FMCSA-registered carriers as drivers.

### 14.1 Data Source
- **FMCSA CENSUS1 dataset** — 2+ million registered US carriers
- Filtered to NC and SC carriers
- Quality filters applied:
  - Must be authorized-for-hire
  - 3+ power units (fleet, not solo operators)
  - Not private fleets, government, postal, farms, food/dairy, petroleum, buses, medical, waste/utility companies
  - **Result: ~7,150 quality targets** from the dataset

### 14.2 Contact Enrichment
For each qualified carrier, the pipeline:
1. Looks up company email via **Apollo.io** (primary), **Snov.io** (secondary), **Hunter.io** (tertiary)
2. Verifies deliverability of found emails
3. Stores results in `carrier_contacts` table in Supabase

### 14.3 Email Campaign System
The campaign system manages outreach at scale:
- **Rate-limited** sending (daily quota enforced to protect sender reputation)
- **IP/domain warmup** — gradual daily volume increase to build deliverability
- Three email templates:
  - **Introduction** — first contact, highlights free TMS, route planner, guaranteed payments
  - **Follow-Up** — second touch if no response
  - **Special Offer** — 90-day 0% platform fee offer for new carriers
- All emails use `carrier@drivedrop.us.com` sender
- Unsubscribe links in every email (CAN-SPAM / GDPR compliant)
- Full event tracking: delivered, opened, clicked, bounced, unsubscribed

### 14.4 Contacts Database
The `carrier_contacts` table stores four contact types:
- `carrier` — FMCSA-sourced transport companies
- `broker` — freight brokers
- `dealership` — car dealerships
- `shipper` — direct shippers (fleet managers, private sellers)

Admin can manage all contact types via the **Contacts** tab in the admin dashboard (4 tabs: Carriers, Brokers, Dealerships, Shippers).

---

## 15. Commercial (B2B) Accounts

Commercial accounts are for high-volume clients such as large dealership groups, rental fleets, or logistics companies.

### Features
- **API access** — authenticated with a `dd_live_xxxxx` key; POST shipments programmatically
- **Credit limits** — admin sets a credit limit; commercial clients can post loads without prepaying each job
- **Usage tracking** — API call count, shipment volume, spend
- **Invoicing** — consolidated billing instead of per-shipment payments

### Account Setup
Admin creates a commercial account with:
- Company name, address, billing contact
- Credit limit
- Allowed API endpoints
- Auto-generates and hashes the API key (shown once on creation)

---

## 16. Integrations

### 16.1 Universal Auction Integration
DriveDrop connects to any auction house or dealership data feed via a configurable integration layer.

**Supported methods:**
- REST API (OAuth2, API Key, Basic Auth, JWT)
- SFTP file transfer
- Email with CSV attachment
- Manual CSV upload
- Webhook event listener

Each integration is configured with a **field mapping** (maps external fields to DriveDrop's standard fields) and a **sync frequency** (realtime, hourly, daily, or manual).

**Connected sources can include:**
- ADESA
- Manheim
- Copart
- Local independent auction houses
- Dealership inventory systems

### 16.2 Google Maps
Google Maps API powers:
- Address geocoding and validation
- Route distance and duration calculation
- Live driver location on the tracking page and admin map
- Driving directions in the mobile app

### 16.3 Stripe
- Payment processing, saved cards, refunds
- Webhook (`/api/v1/webhooks/stripe`) handles payment lifecycle events

### 16.4 Brevo
- Transactional email (welcome, receipts, BOL delivery)
- Outreach campaign email sending
- Delivery event webhooks track opens, clicks, bounces

### 16.5 Twilio
- SMS notifications for critical alerts and driver communication fallback

### 16.6 OpenAI (GPT-4)
- Powers Benji AI assistant
- Natural language shipment creation
- AI document extraction from uploaded files
- Load recommendation scoring explanations

---

## 17. Tech Stack Summary

| Layer | Technology |
|---|---|
| **Mobile App** | React Native (Expo), TypeScript |
| **Web Dashboard** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Backend API** | Express.js, TypeScript, deployed on Railway |
| **Database** | Supabase (PostgreSQL + PostGIS for geo queries) |
| **Auth** | Supabase Auth (JWT-based) |
| **Payments** | Stripe |
| **AI / NLP** | OpenAI GPT-4 (multiple service models per task) |
| **Email** | Brevo (transactional + outreach campaigns) |
| **SMS** | Twilio |
| **Maps** | Google Maps Platform (Geocoding, Directions, Places) |
| **File Storage** | Supabase Storage (photos, documents, BOLs) |
| **PDF Generation** | PDFKit (server-side BOL PDF generation) |
| **QR Codes** | `qrcode` library (gate passes) |

---

## 18. Key URLs & Contacts

| Resource | Value |
|---|---|
| **Website** | `https://www.drivedrop.us.com` |
| **Carrier Sign-Up** | `https://www.drivedrop.us.com/drivers/register` |
| **Client Sign-Up** | `https://www.drivedrop.us.com/signup` |
| **Broker Sign-Up** | `https://www.drivedrop.us.com/auth/broker-signup` |
| **Login** | `https://www.drivedrop.us.com/login` |
| **Terms of Service** | `https://www.drivedrop.us.com/terms` |
| **Privacy Policy** | `https://www.drivedrop.us.com/privacy` |
| **FCRA Notice** | `https://www.drivedrop.us.com/fcra` |
| **Outreach Email** | `carrier@drivedrop.us.com` |
| **Support Email** | `support@drivedrop.us.com` |
| **Admin Email** | `admin@drivedrop.us.com` |
| **HQ City** | Charlotte, NC |

---

## 19. Glossary

| Term | Definition |
|---|---|
| **BOL** | Bill of Lading — legally required transport document recording vehicle condition and chain of custody |
| **TMS** | Transportation Management System — software for managing logistics operations (DriveDrop provides this free to all carriers) |
| **Load Board** | The marketplace listing where drivers see and apply for available shipments |
| **Deadhead Miles** | Miles driven empty (without cargo) between jobs — the route optimizer minimizes these |
| **FMCSA** | Federal Motor Carrier Safety Administration — US agency that regulates commercial trucking; all carriers have a DOT number |
| **DOT Number** | Department of Transportation number — unique identifier for a registered US carrier |
| **MC Number** | Motor Carrier number — authority number for interstate commercial transport |
| **HOS / Hours of Service** | FMCSA regulations governing how many hours a commercial driver can operate before mandatory rest |
| **TSP** | Travelling Salesman Problem — the mathematical optimization problem the route planner solves |
| **2-opt** | An algorithm that improves an existing route by repeatedly swapping two route segments to reduce total distance |
| **Gate Pass** | QR-coded authorization document for entry to secured facilities (auction houses, dealerships) |
| **Surge Multiplier** | A dynamic price multiplier (default 1.0×) the admin can raise during peak demand periods |
| **Contact Type** | Classification of contacts in the outreach database: carrier, broker, dealership, shipper |
| **Warmup** | The process of gradually increasing outreach email send volume to build sender reputation with email providers |
| **Benji** | DriveDrop's AI assistant, context-aware across all user roles |
| **Carolina Corridor** | The major highway routes through NC and SC (I-85, I-77, I-40, I-26, I-95) that DriveDrop's route optimizer knows in detail |
| **Commercial Account** | B2B account with API access, credit limit, and consolidated billing |
| **Expedited Delivery** | Faster-than-standard delivery; priced at 1.25× standard rate |
| **Flexible Delivery** | No fixed delivery date; priced at 0.95× standard rate |

---

*Last updated: March 2026 — DriveDrop Operations Team*
