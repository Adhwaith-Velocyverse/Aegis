# Velocyverse — Comprehensive Feature-Enriched Todo List

> **Source**: `Velocyverse_MasterBuildDoc_v2.docx` (PRD v2.0)  
> **Current State**: Basic application skeleton with core database schema, partial backend routes, and initial frontend pages  
> **Build Sequence**: Follows PRD Section 5.3 recommended order — each stage produces a working, demoable slice

---

## Stage 1: Auth + Account Shell + Empty Dashboards
**Goal**: Identity & org context foundation — everything else depends on this  
**Size**: M

### 1.1 Authentication & Account Management
- [ ] **FR-1.1** Sign-up form: Full Name, Email, Password (min 8 chars), Company Name, Company Size (dropdown), Phone Number with country selector
  - [ ] Email validation (real, deliverable address check)
  - [ ] Warning note discouraging personal email addresses ("Kindly enter your tenant's mail id")
  - [ ] ToS/Privacy Policy consent checkbox
  - [ ] Server-side validation with Zod
- [ ] **FR-1.2** Login with Email/Password, Google OAuth, Microsoft OAuth
  - [ ] Email/Password login (already partially implemented)
  - [ ] Google OAuth integration (placeholder → real OAuth flow)
  - [ ] Microsoft OAuth integration (MSAL already in place, needs wiring)
  - [ ] Combined Login/Sign Up toggle on single screen (S01)
- [ ] **FR-1.3** MFA required at login for all roles (Client, Admin, Assessor)
  - [ ] TOTP authenticator app support (QR code generation, secret storage)
  - [ ] Email OTP as secondary option
  - [ ] SMS OTP as secondary option (requires Twilio/similar)
  - [ ] 6-digit OTP input with auto-advancing boxes (S03)
  - [ ] Delivery confirmation with masked destination
  - [ ] Countdown timer for OTP expiry
  - [ ] Resend OTP link
  - [ ] MFA enrollment during signup (optional) or forced on first login
- [ ] **FR-1.4** Forgot password flow
  - [ ] "Forgot password?" link on login page
  - [ ] Password reset email with tokenized link
  - [ ] Reset password form (new password + confirm)
  - [ ] "Resend verification email" flow
- [ ] **FR-1.5** Account settings: Change Name, Email, Phone Number, Password
  - [ ] Change Name page (S20) — first/last name inputs, propagation note
  - [ ] Update Phone Number page (S21) — with verification-code notice
  - [ ] Update Email page (S21) — with verification-link notice
  - [ ] Change Password page (S19) — current + new + confirm, complexity rules panel
- [ ] **FR-1.6** Account deletion (soft-delete with grace/recovery period)
  - [ ] Delete Account option in account menu (S17)
  - [ ] Confirmation dialog with warning
  - [ ] Grace period (e.g., 30 days) before permanent deletion
  - [ ] Cascade anonymization of associated assessment data per retention policy
- [ ] **FR-1.7** Session management
  - [ ] Configurable inactivity window (e.g., 30 min)
  - [ ] "Remember me" extends session lifetime
  - [ ] Session expiry handling with graceful redirect to login
- [ ] **FR-1.8** Admin/Assessor account provisioning
  - [ ] Admin creates Admin/Assessor accounts (not self-service)
  - [ ] Same login/MFA mechanism for all roles
  - [ ] Role-specific dashboard routing post-login
  - [ ] Internal Sign In page (S12) — simplified login for Admin/Assessor

### 1.2 Organization & Role Model
- [ ] **Section 22.1** Organization-level roles (Owner, Admin, Member, Viewer)
  - [ ] Org Role field on User model (already in types)
  - [ ] Server-side enforcement of org role permissions
  - [ ] Owner: everything + manage subscription/billing, delete org, transfer ownership
  - [ ] Admin: connect tenants, run assessments, invite/remove users, view reports
  - [ ] Member: run assessments, view results/reports
  - [ ] Viewer: view dashboards and completed reports only
- [ ] Organization creation during signup (already implemented)
- [ ] Organization settings page (name, size, etc.)

### 1.3 Empty Role-Aware Dashboards
- [ ] **Client Dashboard** (pre-connection state, S04)
  - [ ] Two entry point cards: "Start Trial Assessment" and "Connect Your Tenant"
  - [ ] Benefit bullets for each option
  - [ ] Footer link to more info
- [ ] **Admin Dashboard** (S13)
  - [ ] Welcome header
  - [ ] Summary cards: Active Detailed Requests, Assessors count, Change Password
  - [ ] Quick action buttons
  - [ ] Left nav: Dashboard, Assessment Requests, Assessors, Change Password
- [ ] **Assessor Dashboard** (S15)
  - [ ] Welcome header
  - [ ] Summary cards: Assigned Requests, Completed Requests, Change Password
  - [ ] Assigned Assessment Requests table
- [ ] Account Menu / User Actions Dropdown (S17)
  - [ ] Assessment History, Change Password, Change Name, Phone Number, Email
  - [ ] Delete Account (destructive)
  - [ ] Sign Out
  - [ ] Scoped per org role (e.g., only Owner sees billing)

### 1.4 Security Foundation
- [ ] JWT authentication with secure token storage
- [ ] Role-based access control (RBAC) at API layer (not just UI)
- [ ] Rate limiting on auth endpoints (5 requests per 15 min)
- [ ] Password complexity enforcement
- [ ] Helmet.js security headers
- [ ] CORS configuration
- [ ] Input validation with Zod on all endpoints

---

## Stage 2: Trial Assessment
**Goal**: Fastest path to end-to-end demoable flow; validates scoring UI patterns early  
**Size**: S  
**Dependency**: OQ-8 (scoring thresholds) should be finalized before this ships

### 2.1 Trial Questionnaire
- [ ] **FR-3.1** 10–12 Yes/No/Unsure questions covering highest-signal controls
  - [ ] MFA enforcement
  - [ ] Defender for Office 365
  - [ ] Admin account separation
  - [ ] Conditional Access
  - [ ] Intune device management
  - [ ] Disk encryption
  - [ ] Privileged access hygiene
  - [ ] Password policy
  - [ ] Audit logging
  - [ ] DLP
  - [ ] Backup
  - [ ] Security awareness training
  - [ ] Seed trial_questionnaires table with all questions
  - [ ] Progress indicator (X / 12 Completed) + duplicate top-right progress bar (S05)
  - [ ] Info banner reminding user to answer all questions
  - [ ] Confidentiality note
  - [ ] Submit Assessment button
  - [ ] Footer CTA teasing full automated assessment

### 2.2 Trial Scoring Engine
- [ ] **FR-3.2** Weighted scoring formula (0–100) with qualitative band
  - [ ] Weight per question (from control catalog weight)
  - [ ] Score calculation: Yes = full weight, No = 0, Unsure = half weight
  - [ ] Qualitative bands: Poor (<40), Fair (40–69), Good (70–89), Excellent (90–100)
  - [ ] Configurable thresholds (not hard-coded)
- [ ] Store trial answers in trial_answers table
- [ ] Assessment record created with type='trial', status='completed'

### 2.3 Trial Results Page
- [ ] **FR-3.3** Results page (S06)
  - [ ] Status banner ("Trial Assessment Completed")
  - [ ] Score gauge (0–100 with qualitative band)
  - [ ] Score Summary panel (counts of Yes/Unsure/No)
  - [ ] Full Question Summary table with per-question answer
  - [ ] Key Recommendations list (derived from "No"/"Unsure" answers)
  - [ ] "Need Help Improving Your Score?" panel
  - [ ] Prominent "Connect the Tenant to the Tool" CTA banner
  - [ ] Download Results action
  - [ ] Retake Assessment action
- [ ] **FR-3.4** Download and retake functionality
- [ ] **FR-3.5** No tenant connection required; stores no M365 data

---

## Stage 3: Tenant Connection Flow + Microsoft Graph Integration
**Goal**: Highest technical risk — de-risk early  
**Size**: L  
**Dependency**: Requires actual Azure AD app registration + Azure subscription

### 3.1 Azure AD Multi-Tenant App Registration
- [ ] Provision Azure AD multi-tenant app registration
- [ ] Configure API permissions (read-only scopes per Section 16)
- [ ] Grant admin consent for all scopes
- [ ] Create client secret
- [ ] Configure redirect URIs (production + dev)
- [ ] Document Azure AD setup in README

### 3.2 Tenant Connection Flow
- [ ] **FR-4.1** Multi-tenant Azure AD app registration with admin-consent
- [ ] **FR-4.2** Pre-consent permission disclosure
  - [ ] In-app screen before consent redirect stating exact permissions requested
  - [ ] Plain-English description per module (not Graph scope names)
  - [ ] Explicit "read-only" confirmation
- [ ] **FR-4.3** Consent denial/partial grant handling
  - [ ] Affected module(s) clearly flagged
  - [ ] User can retry consent from dashboard
- [ ] **FR-4.4** Reconnection/health status
  - [ ] Tenant Connection Verification page (S11) for returning users
  - [ ] Connection status visible: Connected / Needs Attention / Disconnected
  - [ ] Automatic silent health check on dashboard load
  - [ ] Token refresh handling
  - [ ] Revocation detection (specific auth error → prompt reconnect)
- [ ] **FR-4.5** Multi-tenant support per org
  - [ ] One org can connect multiple tenants (data model already supports this)
  - [ ] UI for managing multiple tenant connections (Phase 2, but data model ready)
- [ ] **FR-4.6** Post-connection dashboard update
  - [ ] Success banner ("The tool successfully connected to your tenant")
  - [ ] Three assessment-type cards: Trial / Quick / Detailed (S08)
  - [ ] Price-tagged CTA buttons (Free / $5 / $7)
  - [ ] Help footer link

### 3.3 Incremental Consent Strategy
- [ ] **Section 24** Permission & Incremental Consent Strategy
  - [ ] Trial: zero Graph permissions
  - [ ] Quick: critical-subset scopes only, requested per module
  - [ ] Detailed: full scope set, incremental delta from Quick
  - [ ] Diff against TenantConnection.consented_scopes before requesting
  - [ ] Per-module consent screens with plain-English descriptions
  - [ ] Non-blocking per module (decline → module marked 'Permission Not Granted')

### 3.4 Connect Tenant / User Guide Page
- [ ] **S07** Connect Tenant / User Guide
  - [ ] "Download the User Guide" hero panel with PDF download CTA
  - [ ] Three benefit tiles: Secure Connection, Step-by-Step, Save Time
  - [ ] "Need help connecting your tenant?" support banner
  - [ ] Contact Support button

### 3.5 Graph Connector Service Enhancement
- [ ] Token refresh logic (silent refresh before each collection run)
- [ ] Throttling/429 Retry-After handling with exponential backoff
- [ ] Scope validation per module before collection
- [ ] Error classification (auth error vs. API error vs. network error)
- [ ] Connection health check endpoint

---

## Stage 4: Automated Data Collection Engine (All 8 Modules)
**Goal**: Validates full automated pipeline before adding manual workflow complexity  
**Size**: XL  
**Dependency**: Section 16 scopes validated against live Graph docs

### 4.1 Configuration-Driven Pipeline
- [ ] **FR-5.1** Module registry (MODULES list) — not hard-coded per-module logic
  - [ ] Entra ID, M365 Admin Center, Purview, Email, Intune, Cloud Apps, Teams, SharePoint
  - [ ] Module configuration: name, scopes, endpoints, critical-control subset
  - [ ] Add/module modules without structural rework
- [ ] **FR-5.2** Graph API calls per module using only consented scopes
- [ ] **FR-5.3** Quick vs. Detailed control subsets
  - [ ] Quick: critical-control subset per module
  - [ ] Detailed: full control set per module
- [ ] **FR-5.4** Permission-denied / failure handling
  - [ ] Module flagged 'Permission Not Granted' / 'Collection Failed'
  - [ ] Assessment continues for remaining modules (partial assessment allowed)
  - [ ] Dependent controls marked 'Not Applicable' rather than 'Failed'
- [ ] **FR-5.5** Raw data persistence
  - [ ] Store collected JSON in object storage (Azure Blob / S3)
  - [ ] Path stored in assessment_modules.raw_data_path
  - [ ] Traceability for audit and potential re-scoring
- [ ] **FR-5.6** Loading/progress screen (S09)
  - [ ] Illustration + headline
  - [ ] Percentage progress bar
  - [ ] 4-stage checklist: Initializing → Collecting Data → Analyzing Data → Preparing Results
  - [ ] Status pills: Completed / In Progress / Pending
  - [ ] "Please do not close this window" notice
  - [ ] Detailed variant: Assessment Owner contact block
- [ ] **FR-5.7** Idempotent, safely retryable data collection
- [ ] **FR-5.8** Rate limiting / throttling handling (respect 429 Retry-After)

### 4.2 Per-Module Data Collection
- [ ] **Entra ID**: MFA state, Conditional Access policies, privileged roles, guest access, password policy, sign-in risk
- [ ] **M365 Admin Center**: Tenant-wide config, license posture, general settings
- [ ] **Purview**: DLP policies, sensitivity labels, retention policies, audit log config
- [ ] **Email**: Anti-phishing/anti-malware, external forwarding, mailbox audit, Safe Links/Safe Attachments
- [ ] **Intune**: Device compliance, encryption, enrollment, app protection
- [ ] **Cloud Apps**: Discovered/sanctioned apps, risky app/session policies
- [ ] **Teams**: Meeting/external access, guest access, security settings
- [ ] **SharePoint**: External/anonymous sharing, site-level permissions

### 4.3 Data Validation & Normalization
- [ ] **FR-6.1** Validate raw Graph responses against expected schemas per module
- [ ] **FR-6.2** Normalize into consistent internal representation
  - [ ] Unify differing Graph API versions/response shapes
  - [ ] Normalize timestamps
  - [ ] Dedupe overlapping signals from multiple endpoints
- [ ] **FR-6.3** Graceful degradation — specific control marked 'Unable to Verify' rather than failing entire module

### 4.4 BullMQ Worker Integration
- [ ] Assessment runs as background jobs (not blocking request/response)
- [ ] Queue configuration (BullMQ + Redis)
- [ ] Worker process for long-running assessments
- [ ] Job status tracking (pending → processing → completed/failed)
- [ ] Retry logic for transient failures
- [ ] Progress updates via WebSocket or polling

---

## Stage 5: Scoring & Recommendation Engine + Results Dashboard + Report Export
**Goal**: Shared by Quick and Detailed — build once, reuse  
**Size**: L  
**Dependency**: OQ-8 (scoring weights)

### 5.1 Assessment Engine
- [ ] **FR-7.1** Evaluate normalized data against Control Catalog
  - [ ] Pass / Fail / Not Applicable / Needs Manual Review per control
  - [ ] Supporting evidence captured per control
- [ ] **FR-7.2** Control Catalog is database-driven, versioned
  - [ ] Controls can be added/updated/re-weighted without code deployment
  - [ ] Version field for catalog iterations
- [ ] **FR-7.3** Framework references per control (CIS, NIST, ISO, Microsoft Secure Score)
- [ ] **FR-7.4** Non-automatable controls routed to Manual Assessment Workflow (Detailed) or excluded (Quick)

### 5.2 Scoring & Recommendation Engine
- [ ] **FR-8.1** Per-module score = weighted pass rate of applicable controls (0–100)
- [ ] **FR-8.2** Overall score = weighted roll-up of module scores (tunable weighting scheme)
- [ ] **FR-8.3** Configurable score bands (Poor/Fair/Good/Excellent thresholds)
- [ ] **FR-8.4** Human-readable recommendations for every Failed control
  - [ ] Ranked by severity for Top Findings / Key Recommendations views
- [ ] **FR-8.5** Detailed Assessment: merge automated + Assessor manual findings
  - [ ] Unified result set before final scoring
  - [ ] Finding.source preserved internally for audit/traceability

### 5.3 Results Dashboard
- [ ] **FR-9.1** Results Dashboard (S10)
  - [ ] Assessment metadata: type, tenant, completion date/time, duration, controls assessed count
  - [ ] Overall Security Score gauge with qualitative band + interpretation text
  - [ ] Per-module score cards (Entra, Email, Purview, Intune, Cloud Apps, Teams, SharePoint, M365 Admin Center)
  - [ ] Results Overview donut (Passed/Failed/Not Applicable)
  - [ ] Top Findings list with severity tags and counts
  - [ ] Next Steps panel
  - [ ] Download Report (PDF/Excel) and Share Report actions
  - [ ] Assessment Owner block (for Detailed)
- [ ] **FR-9.2** "View all findings" — full filterable/sortable control-level results table
  - [ ] Columns: pass/fail, severity, module, description, recommendation
  - [ ] Filter by module, severity, result
  - [ ] Sort by any column
- [ ] **FR-9.3** Report retention (30 days default, configurable)
  - [ ] UI shows remaining availability
  - [ ] Archive or re-generation after expiry
- [ ] **FR-9.4** Share Report
  - [ ] Generate shareable link or send via email
  - [ ] Access control: expiring link vs. requires login (OQ-5 — flag for design decision)

### 5.4 Report Generation
- [ ] **Section 12** Reporting Specification
  - [ ] PDF export (print-ready, proper pagination, headers/footers, no cut-off tables)
  - [ ] Excel export (one sheet per section or structured Findings sheet with filterable columns)
- [ ] Report sections:
  1. Assessment Summary (tenant, type, date, duration, controls assessed, assessor name)
  2. Overall Security Score (0–100, band, plain-English interpretation)
  3. Area-Specific Security Score (per-module with Passed/Failed/N-A counts)
  4. Executive Summary (2 short paragraphs per area: positives + negatives/improvements)
  5. Detailed Assessment Report (every control: name, module, result, severity, evidence, recommendation)
  6. Appendix — Detailed tier only (manual review notes, supporting documents, assessor sign-off)
- [ ] PDF generation (PDFKit or Puppeteer HTML-to-PDF)
- [ ] Excel generation (ExcelJS)
- [ ] Report storage in object storage
- [ ] Report expiry tracking

### 5.5 Assessment History
- [ ] **FR-10.1** Assessment History page (S18)
  - [ ] Table: Request ID, Type, Client/Tenant Name, Requested On, Completed On, Status, Overall Score
  - [ ] Action: View Report (completed) or Continue (in-progress Detailed)
- [ ] **FR-10.2** Search (by request ID or name) and filtering by type/status
- [ ] Pagination

---

## Stage 6: Quick Assessment End-to-End
**Goal**: Glue of stages 3–5 for the 100%-automated path  
**Size**: M  
**Dependency**: Stages 3–5 stable

### 6.1 Quick Assessment Flow
- [ ] Start Quick Assessment from post-connection dashboard (S08)
- [ ] Create assessment record with type='quick'
- [ ] Create assessment_modules for all 8 modules
- [ ] Trigger background job for data collection
- [ ] Show Assessment Loading Screen (S09) with real-time progress
- [ ] On completion: navigate to Results Dashboard (S10)
- [ ] Download PDF/Excel report
- [ ] Share report

### 6.2 Quick Assessment Specifics
- [ ] Only critical-control subset evaluated (not full catalog)
- [ ] Faster execution than Detailed (target: <10 minutes end-to-end)
- [ ] No manual review step — all controls automated or marked N-A

---

## Stage 7: Detailed Assessment + Admin Portal + Assessor Portal
**Goal**: The differentiator — manual-review workflow  
**Size**: XL  
**Dependency**: Stages 3–5 stable; OQ-3 (SLA)

### 7.1 Detailed Assessment Request Flow
- [ ] Start Detailed Assessment from post-connection dashboard
- [ ] Create assessment record with type='detailed'
- [ ] Create assessment_modules for all 8 modules
- [ ] Run automated data collection (full control catalog)
- [ ] Assessment Engine determines if manual review needed
- [ ] If manual review needed: create detailed_assessment_requests record, status='unassigned'
- [ ] Assessment status set to 'pending' (not 'completed')
- [ ] Client sees status = "In Progress" in Assessment History

### 7.2 Admin Portal
- [ ] **FR-12.1** Admin Dashboard (S13)
  - [ ] Summary cards: Active Detailed Requests, Assessors, Change Password
  - [ ] Quick links: View Requests, Manage Assessors, Change Password
- [ ] **FR-12.2** Active Detailed Requests view
  - [ ] Table: Request ID, Client Name, Tenant Name, Assessment Type, Requested On, Status, Assigned Assessor
  - [ ] Actions: View Details, Assign Assessor, Assign to Myself, Access Assessment Data, View Report, Release Report
  - [ ] Search and pagination
- [ ] **FR-12.3** Assessors Roster (S14)
  - [ ] Table: Assessor Name, Email, Phone, Status, Added On
  - [ ] Actions: Rename, Change Email/Phone, Remove
  - [ ] Add Assessor button + form
- [ ] **FR-12.4** Released Reports view
  - [ ] Audit list of completed/released Detailed Assessment reports
- [ ] **FR-12.5** Admin actions audit-logged
- [ ] **FR-12.6** (Phase 2) Admin-level analytics: conversion funnel, volume, average turnaround

### 7.3 Assessor Portal
- [ ] **FR-13.1** Assessor Dashboard (S15)
  - [ ] Assigned Assessment Requests count, Completed Assessment Requests count
  - [ ] Assigned requests table: Request ID, Client Name, Tenant Name, Assessment Type, Requested On, Status, Due Date
  - [ ] Start Assessment action per row
- [ ] **FR-13.2** Assigned requests list with SLA indicator
- [ ] **FR-13.3** Assessor Assessment Page / Workspace (S16)
  - [ ] Request metadata bar (Request ID, Status, Requested On)
  - [ ] Client Information panel (Contact Details, Organization Details)
  - [ ] Assessment Resources panel:
    - [ ] Download Collected Data
    - [ ] Download Automated Assessment Report
    - [ ] Structured findings form (one entry per non-automatable control)
    - [ ] Upload supporting documents per finding
  - [ ] Automated findings organized by module/control
  - [ ] Manual finding entry: result + evidence + notes per non-automatable control
  - [ ] Request supporting documents from client
  - [ ] Mark review complete
- [ ] **FR-13.4** Completed Assessment Requests (read-only historical list)
- [ ] **FR-13.5** Account management (Change Password, Change Name, Phone, Email, Delete Account)

### 7.4 Manual Assessment Workflow (Detailed Tier)
- [ ] **Section 9** Manual Assessment Workflow
- [ ] **FR-11.1** Every Detailed Assessment needing manual review appears in Admin queue
- [ ] **FR-11.2** Admin assigns request to Active Assessor; reassignment supported
- [ ] **FR-11.3** Assigned request appears in Assessor's list; disappears from others
- [ ] **FR-11.4** Assessor workspace with automated findings + manual finding entry
- [ ] **FR-11.5** Request supporting documents triggers client notification + upload surface
- [ ] **FR-11.6** Client-submitted docs visible only to assigned Assessor and Admins
- [ ] **FR-11.7** On submission: manual findings merged into Scoring Engine, assessment → Completed, client notified
- [ ] **FR-11.8** Full audit trail: every status transition timestamped and attributable

### 7.5 Status Model Implementation
- [ ] Unassigned → Assigned → In Review → Awaiting Client → Completed
- [ ] Status transition rules enforced server-side
- [ ] Timestamp and user attribution for each transition

### 7.6 Document Request Loop
- [ ] Assessor requests documents from client
- [ ] Client receives notification (in-app + email)
- [ ] Client uploads documents / responds to questionnaire
- [ ] Assessor reviews and can request follow-up documents
- [ ] Loop continues until Assessor has enough information

---

## Stage 8: Billing / Paywall Integration
**Goal**: Monetization enforcement  
**Size**: M  
**Dependency**: OQ-1, OQ-2, OQ-6 must be resolved first

### 8.1 Subscription Plans
- [ ] **Section 22.2** Five-tier plan structure
  - [ ] Free: Trial only, unlimited seats
  - [ ] Starter (PAYG): $0/mo + pay-per-assessment ($5 Quick / $7 Detailed), 1 tenant
  - [ ] Professional: e.g., $99/mo, up to 5 tenants, 10 Quick + 2 Detailed credits/month
  - [ ] Business/MSP: e.g., $299/mo, up to 5 tenants + add-ons, 30 Quick + 8 Detailed credits/month
  - [ ] Enterprise: Custom pricing, unlimited tenants/credits
- [ ] Seed subscription_plans table
- [ ] Plan feature flags (report formats, retention, scheduled re-assessment, trend view, etc.)

### 8.2 Subscription Management
- [ ] Organization subscribes to a plan on signup (Free tier default)
- [ ] Upgrade/downgrade flow
- [ ] Billing status tracking (active, past_due, canceled)
- [ ] Current period start/end tracking

### 8.3 Usage Ledger
- [ ] **Section 22.5** UsageLedger entity
  - [ ] Append-only ledger of credit grants and consumption
  - [ ] One entry per assessment run or tenant-slot use
  - [ ] "How many Quick credits left this month" = simple sum query
  - [ ] Clean audit trail for billing disputes

### 8.4 Tenant Inclusion Limits & Add-Ons
- [ ] **Section 22.3** Tenant slot gating
  - [ ] Server-side check: Subscription.included_tenant_slots + Subscription.addon_tenant_slots
  - [ ] Connecting 6th+ tenant triggers upsell modal: "Add another tenant for $X/mo"
  - [ ] Add-on tenant slots billed on same cycle (prorated)
  - [ ] Tenant slots releasable on disconnect (subject to minimum commitment)
  - [ ] Enterprise plans negotiate directly (no add-on metering)

### 8.5 Paywall / Feature Gating
- [ ] Server-side enforcement of plan limits before allowing assessment start
- [ ] UI shows locked/disabled assessment cards for unavailable tiers
- [ ] Credit consumption on assessment completion
- [ ] Overage handling (PAYG rate for beyond-plan usage)
- [ ] Plan exhaustion notifications

### 8.6 Billing Integration (OQ-1)
- [ ] Pluggable billing component (Stripe / Azure Marketplace metering)
- [ ] Payment method collection
- [ ] Invoice generation
- [ ] Billing history page

---

## Stage 9: Notifications, Assessment History Polish, Account Management Edge Cases, Share Report
**Goal**: Lower-risk polish items  
**Size**: M  
**Dependency**: OQ-5 for Share Report specifically

### 9.1 Notifications
- [ ] In-app notification bell (implied by wireframes)
- [ ] Email notifications:
  - [ ] Assessment complete (Quick/Detailed)
  - [ ] Detailed Assessment status changes
  - [ ] Document requested by Assessor
  - [ ] Assessment assigned to Assessor
  - [ ] Consent revocation detected
  - [ ] Plan/credit exhaustion
  - [ ] Password changed
  - [ ] Email changed
- [ ] Notification preferences per user
- [ ] Notifications table with read/unread status

### 9.2 Assessment History Enhancements
- [ ] Advanced filtering (by date range, score range, module)
- [ ] Sort by any column
- [ ] Bulk actions (download multiple reports)
- [ ] In-progress Detailed Assessment "Continue" flow
- [ ] Status semantics info banner

### 9.3 Account Management Edge Cases
- [ ] Email change with verification link
- [ ] Phone number change with verification code
- [ ] Password change with current password verification
- [ ] Account deletion with confirmation and grace period
- [ ] Session invalidation on password change
- [ ] MFA reset flow (admin-assisted)

### 9.4 Share Report
- [ ] **OQ-5** Share Report access model decision (public-with-expiry vs. authenticated)
- [ ] Generate shareable link with expiry
- [ ] Send report via email
- [ ] Revoke shared link
- [ ] Access logging for shared reports

---

## Stage 10: Security Hardening + Penetration Test Prep
**Goal**: Must pass before GA  
**Size**: L

### 10.1 Security Hardening
- [ ] **NFR 13.1** OWASP ASVS practices minimum
- [ ] All Microsoft Graph permissions read-only / least-privilege
- [ ] Access tokens/refresh tokens encrypted at rest (Azure Key Vault / secrets manager)
- [ ] RBAC enforced at API layer (structural inability, not just UI-hidden)
- [ ] Strong password policy enforcement
- [ ] Rate limiting on all sensitive endpoints
- [ ] Full audit logging:
  - [ ] Consent grants/revocations
  - [ ] Data collection runs
  - [ ] Admin actions
  - [ ] Assessor actions
  - [ ] Report access/downloads
- [ ] Audit log table with IP address, user agent, timestamp
- [ ] HTTPS enforcement
- [ ] CSP headers
- [ ] SQL injection prevention (parameterized queries — already in place)
- [ ] XSS prevention
- [ ] CSRF protection

### 10.2 Data Protection
- [ ] **NFR 13.2** Data Processing Agreement / Privacy Policy
- [ ] Data residency commitment (OQ-9 — legal review needed)
- [ ] GDPR-style right to erasure (cascading deletion of raw data)
- [ ] SOC 2 Type II readiness considerations

### 10.3 Performance & Scalability
- [ ] **NFR 13.3** Quick Assessment < 10 minutes end-to-end
- [ ] Horizontal scalability for data collection (queue/worker model)
- [ ] Microsoft Graph throttling handled gracefully
- [ ] Assessment runs resumable/retryable on transient failure

### 10.4 Availability & Reliability
- [ ] **NFR 13.4** 99.5%+ uptime target
- [ ] Health check endpoints
- [ ] Graceful degradation

### 10.5 Multi-Tenancy (Platform)
- [ ] **NFR 13.5** Strict data isolation between Orgs at DB and storage layer
- [ ] Row-level security or application-level enforcement
- [ ] No cross-org data leakage

### 10.6 Auditability
- [ ] **NFR 13.6** Every score explainable — exact evidence collected per control
- [ ] Finding.source (automated/manual) preserved
- [ ] ControlCatalog versioning for reproducibility

### 10.7 Penetration Test
- [ ] Third-party penetration test before GA
- [ ] Test authentication flows
- [ ] Test authorization (horizontal + vertical privilege escalation)
- [ ] Test input validation (SQLi, XSS, CSRF)
- [ ] Test API security (rate limiting, CORS, method enforcement)
- [ ] Test data protection (encryption, exposure)
- [ ] Test audit logging completeness

---

## Product Enhancements (Post-GA / Phase 2)
**Goal**: High-leverage features that reuse existing infrastructure  
**Reference**: Section 25

### 25.1 High Leverage (Reuses Existing Infrastructure)
- [ ] Continuous monitoring & drift alerts
  - [ ] Run assessment pipeline on schedule/webhook
  - [ ] Diff against last result
  - [ ] Notify on configuration drift
- [ ] Score trend / history dashboard
  - [ ] Trend chart across multiple assessments
  - [ ] Already-captured data, just visualization
- [ ] AI-generated executive summary narrative
  - [ ] LLM drafts plain-English summary from structured Finding data
  - [ ] Reduces Assessor manual report-writing effort
- [ ] Assessor-assist suggestions
  - [ ] AI-suggested findings for non-automatable controls
  - [ ] Based on automated data already collected
- [ ] Compliance framework selector in report UI
  - [ ] Toggle to view Findings mapped to different framework (HIPAA, PCI-DSS, SOC 2, ISO 27001, NIST CSF)

### 25.2 Medium Leverage
- [ ] Integrations: push findings to Jira/ServiceNow/Slack/Teams
- [ ] MSP multi-client dashboard
  - [ ] Aggregate risk view across all tenants
  - [ ] Average score, worst-performing tenant, overdue re-assessments
- [ ] Notification/alerting engine enhancements
- [ ] Public API for programmatic assessment triggering

### 25.3 Lower Near-Term Priority
- [ ] Peer/industry benchmarking
- [ ] One-click auto-remediation (write-scope Graph permissions — separate initiative)
- [ ] Certification badge program
- [ ] Cyber-insurance partnerships
- [ ] API / embedded assessment licensing
- [ ] Anonymized benchmark data product

---

## Open Questions to Resolve
**Reference**: Section 17

| ID | Question | Impact | Status |
|----|----------|--------|--------|
| OQ-1 | Billing via Azure Marketplace metering, Stripe, or both? | Billing integration design | ⚠️ Blocking Stage 8 |
| OQ-2 | Are $5 (Quick) / $7 (Detailed) prices final or illustrative? | Pricing/paywall UI | ⚠️ Blocking Stage 8 |
| OQ-3 | Assessor SLA (target turnaround time)? | Client expectations, alerting | ⚠️ Blocking Stage 7 |
| OQ-4 | Exact retention period for reports/raw data? Is 30 days hard deletion or download-availability? | Storage lifecycle, compliance | ⚠️ Blocking Stage 5 |
| OQ-5 | Share Report — public-with-expiry link vs. requires login? | Security/compliance vs. ease of sharing | ⚠️ Blocking Stage 9 |
| OQ-6 | One-time purchase, subscription, or credit-based? | Organization/billing data model | ⚠️ Blocking Stage 8 |
| OQ-7 | MSP / multi-client management in near-term phase? | Data model ready, UI not | Deferred to Phase 2 |
| OQ-8 | Exact scoring formula weights and score-band thresholds? | Product credibility | ⚠️ Blocking Stage 2 |
| OQ-9 | Data residency commitment (EU processing claim)? | Legal/compliance exposure | ⚠️ Needs legal review |

---

## Current Implementation Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | All tables from Section 15 + Section 22.5 |
| Control Catalog Seed | ⚠️ Partial | 61 controls seeded; target is 312+ |
| Trial Questionnaire Seed | ❌ Missing | Need 10–12 questions |
| Auth Routes | ⚠️ Partial | Signup/login working; MFA, OAuth, password reset missing |
| Tenant Connection | ⚠️ Partial | OAuth callback exists; incremental consent, health check missing |
| Graph Connector | ⚠️ Partial | Basic collection; throttling, token refresh, validation missing |
| Assessment Engine | ⚠️ Partial | Basic evaluation; sophisticated rule engine missing |
| Scoring Engine | ⚠️ Partial | Basic scoring; weighted roll-up, configurable bands missing |
| Admin Routes | ⚠️ Partial | Basic CRUD; queue management, audit logging missing |
| Assessor Routes | ⚠️ Partial | Basic CRUD; workflow, document request missing |
| Billing Routes | ⚠️ Partial | Endpoints exist; payment gateway, usage ledger logic missing |
| Frontend Pages | ⚠️ Partial | ~8 pages built; 21 screens specified, many missing or incomplete |
| Reports (PDF/Excel) | ⚠️ Partial | Libraries included; generation logic incomplete |
| Notifications | ⚠️ Partial | Table exists; email + in-app notification logic missing |
| BullMQ Worker | ⚠️ Partial | Queue configured; worker process separate from API |
| Security Middleware | ⚠️ Partial | Rate limiting, Helmet in place; full RBAC, audit logging missing |

---

## Recommended Execution Order

1. **Stage 1** — Auth + Account Shell (foundation)
2. **Stage 2** — Trial Assessment (fastest demoable flow)
3. **Stage 3** — Tenant Connection + Graph Integration (highest technical risk)
4. **Stage 4** — Automated Data Collection Engine (core pipeline)
5. **Stage 5** — Scoring + Results Dashboard + Reports (shared value)
6. **Stage 6** — Quick Assessment End-to-End (glue stages 3–5)
7. **Stage 7** — Detailed Assessment + Admin/Assessor Portals (differentiator)
8. **Stage 8** — Billing/Paywall (monetization)
9. **Stage 9** — Notifications + Polish (lower-risk, can parallel with Stage 7)
10. **Stage 10** — Security Hardening + Pen Test (pre-GA)

---

*Last updated: 2026-08-14*  
*Source: Velocyverse_MasterBuildDoc_v2.docx — PRD v2.0*
