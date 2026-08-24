# Velocyverse — M365 Environment Security Assessment Automation Platform
## Master Build Document — v2.1
**Status:** Master build document, Microsoft Graph permissions verified against live documentation, ready to hand to Kilo AI
**Date:** 11 Aug 2026 · **Classification:** Internal / Confidential

This is a single self-contained build spec. Companion assets (diagrams, wireframe screenshots) are in `assets/diagrams/` and `assets/screens/` alongside this file — see Section 26 for the full screen index.

---

## 0. Document Control

| Field | Detail |
|---|---|
| Product Name | Velocyverse — M365 Automation & Security Assessment Tool |
| Document Owner | Product / Founder |
| Status | v2.1 — Master build document, Graph permissions verified, ready for Kilo AI |
| Intended Audience | Engineering (Kilo AI agent + human reviewers), Design, Founder/Stakeholders |
| Related Artifacts | This document is self-contained — no other files required to begin the build |
| Build Scope (confirmed) | Full platform in first build: Client, Admin, and Assessor roles; Trial, Quick, and Detailed assessment tiers |
| Primary Tech Stack (confirmed) | Next.js/React frontend, Node.js backend, MySQL database |
| Tenant Auth Model (confirmed) | Multi-tenant Azure AD (Entra ID) app registration, admin-consent, read-only Microsoft Graph — **plus a second PowerShell-based connector, see Section 16** |
| Marketplace / Billing | Open decision — see Section 17 (Open Questions) |

### Change Log
| Version | Date | Notes |
|---|---|---|
| 1.0 | 10 Aug 2026 | Initial comprehensive draft, derived from wireframes + flow diagram + stakeholder answers |
| 1.1 | 10 Aug 2026 | Added Sections 21–25: assessment tier permission mapping, subscription plans + org roles + feature matrix, monetization opportunities, incremental consent strategy, enhancement recommendations |
| 2.0 | 11 Aug 2026 | Added Section 26: complete screen-by-screen UI specification (21 unique screens). Flagged a reconciliation needed on the Assessor manual-review workflow (FR-11.4 vs. wireframe S16). |
| 2.1 | 11 Aug 2026 | **Verified Microsoft Graph API permissions in Section 16 against current Microsoft documentation.** Key finding: 4 of 8 modules have no Graph API and require a separate PowerShell connector — changed Section 14 architecture, added a new top risk in Section 18, corrected the MFA reporting permission. |
| 2.2 (this file) | 11 Aug 2026 | Converted to Markdown for direct ingestion by Kilo AI; added Section 27 Build Checklist reference (see companion file `Velocyverse_BUILD_CHECKLIST.md`). |

---

## 1. Executive Summary

Velocyverse is a SaaS platform that automates security posture assessment of a customer's Microsoft 365 environment. A customer connects their M365 tenant (via a multi-tenant, admin-consented Azure AD app **plus a PowerShell-based connector for modules Graph can't reach, see Section 16**) and Velocyverse pulls configuration data across eight core M365 surfaces — Microsoft Entra ID, the M365 Admin Center, Microsoft Purview, Email/Exchange Online (incl. Defender for Office 365), Intune, Cloud Apps (Defender for Cloud Apps), Teams, and SharePoint — evaluates that data against a structured control catalog, and produces a scored, prioritized security assessment report.

Three assessment tiers of increasing depth and decreasing automation share:
- **Trial** — free, 0% automated, 10–12 question self-reported checklist, produces an estimated score.
- **Quick** — 100% automated, covers critical controls across all reachable modules.
- **Detailed** — 80% automated + 20% expert-reviewed manual assessment, compliance-grade output. Routes the residual controls to an internal Assessor via an Admin-managed assignment queue.

This document covers the full platform: Client, Admin, and Assessor experiences, all three assessment tiers, the assessment/scoring engine, and the underlying integration layer (now split into two connector types — see Section 16).

---

## 2. Problem Statement & Opportunity

### 2.1 The Problem
Organizations running Microsoft 365 frequently have security misconfigurations they are unaware of — MFA not enforced tenant-wide, no Conditional Access policies, legacy authentication enabled, DLP not configured, audit logging disabled, admin accounts not separated from daily-use accounts. Discovering these gaps today requires either a manual internal audit (slow, requires M365 security specialists) or an expensive third-party assessment engagement (consulting-led, low repeatability).

### 2.2 The Opportunity
- **Self-serve automated first pass**: most manual M365 security audit checks can be pulled programmatically and evaluated against a known-good baseline (CIS Microsoft 365 Foundations Benchmark, Microsoft Secure Score, NIST/ISO mappings).
- **Tiered depth matches buyer intent**: free Trial builds trust pre-purchase; Quick gives a fast automated read; Detailed adds expert review for compliance/insurance/board-reporting needs.
- **Recurring revenue**: cheap to re-run once built — supports both one-off paid assessments and a recurring re-assessment motion.

### 2.3 Why Now
Microsoft Graph and the Graph Security API expose most (but — per Section 16's verified research — not all) configuration signals needed via delegated-permission APIs, and Azure Marketplace provides a natural distribution channel directly to the ICP.

---

## 3. Goals & Success Metrics

### 3.1 Product Goals
1. Credible security score in under 2 minutes with zero setup (Trial).
2. Fully automated control-level assessment across all reachable M365 modules in minutes, not days (Quick).
3. Compliance-grade assessment blending automation with human expert review, with full traceability of automated vs. manual findings (Detailed).
4. Efficient Admin/Assessor queue-and-review workflow so Detailed Assessments scale without 1:1 headcount-to-customer ratio.
5. A report genuinely useful to hand to a CISO, auditor, or insurer.

### 3.2 Success Metrics (initial targets — validate with stakeholder)
| Metric | Target | Notes |
|---|---|---|
| Trial → Tenant Connection conversion | ≥ 25% | Primary activation funnel |
| Tenant Connection → Paid Assessment conversion | ≥ 40% | Quick + Detailed combined |
| Time to complete Quick Assessment | < 10 min | Start click → Results Dashboard |
| Time to complete Detailed Assessment | < 3 business days | Includes Assessor SLA |
| Assessor time per Detailed Assessment | < 90 min | Manual-portion effort target |
| Report download/share rate | ≥ 80% of completed assessments | Proxy for perceived value |
| Repeat-assessment rate (90 days) | ≥ 20% | Recurring-usage viability |
| Data-collection success rate per module | ≥ 95% | Excludes tenant-denied scope cases |

---

## 4. Personas & Roles

### 4.1 Client / End User ("User")
IT Admin, MSP engineer, vCISO, or founder/ops lead at an SMB running M365. Logs into a Velocyverse account (separate identity from the M365 tenant), then connects one or more client tenants.
- **Goals**: understand security posture quickly, get actionable remediation guidance, produce a shareable report.
- **Key actions**: sign up/login, run Trial, connect tenant, run Quick/Detailed, view results, download/share report, view history, manage account.

### 4.2 Admin (Platform/Internal Admin)
Internal Velocyverse staff operating the Detailed Assessment pipeline and Assessor workforce. Not customer-facing.
- **Goals**: keep the Detailed queue moving, ensure every request is assigned to a qualified Assessor, manage the Assessor roster.
- **Key actions**: view/manage active Detailed requests, assign to Assessors, manage Assessors, view released reports.

### 4.3 Assessor (Internal Subject-Matter Expert)
Internal or vetted contractor M365 security specialist performing the manual 20% of a Detailed Assessment.
- **Goals**: efficiently work through assigned requests, get what's needed from the client without excessive back-and-forth, produce defensible findings.
- **Key actions**: view assigned/completed requests, collect additional data, request supporting documents, record findings.

### 4.4 Role Summary
| Role | Access Surface | Cannot Do |
|---|---|---|
| Client/User | Own org's dashboard, tenant connections, assessments, reports | See other orgs' data; assign Assessors; access Admin/Assessor portals |
| Admin | All Detailed requests, Assessor roster, released reports | Directly edit a client's raw assessment data; impersonate a client without audit trail |
| Assessor | Only requests assigned to them | See unassigned requests; manage other Assessors; access Admin functions |

**Also see Section 22.1** — org-level roles (Owner/Admin/Member/Viewer) within a Client Organization, added in v1.1.

---

## 5. Scope & Build Phasing

Confirmed: full platform in the first build — Client, Admin, Assessor roles; all three tiers.

### 5.1 In Scope (First Build)
- Client web app: signup/login/MFA, onboarding, Trial, tenant connection, Quick, Detailed request, Results Dashboard, PDF/Excel report, history, account management.
- Admin portal: Detailed request queue, Assessor management, released reports.
- Assessor portal: assigned/completed requests, manual data collection workflow, document request workflow, findings entry.
- Assessment engine across all 8 M365 modules (**see Section 16 for verified per-module access reality**).
- Integration layer: Microsoft Graph Connector (5 modules) + PowerShell Connector (4 modules) — see Section 14, 16.
- Scoring & Recommendation Engine.
- Reporting per Section 12.

### 5.2 Explicitly Out of Scope for First Build
- Native mobile apps (web-responsive only).
- Continuous/scheduled re-assessment automation (on-demand only at first).
- Localization.
- White-label / MSP multi-client management (likely Phase 2).
- SSO/SCIM for enterprise buyer identity federation.

### 5.3 Recommended Build Sequence
| Stage | Deliverable | Why this order |
|---|---|---|
| 1 | Auth + Account shell (signup/login/MFA, profile, org model) + empty dashboard | Everything else depends on identity & org context |
| 2 | Trial Assessment (self-contained, no Graph needed) | Fastest end-to-end demoable flow |
| 3 | Tenant Connection + Graph app registration + consent handling | Highest technical risk — de-risk early |
| 4 | Quick Assessment (Graph-reachable modules first: Entra, Intune, M365 Admin Center, SharePoint, Teams guest policy — see Section 16.3) | Validates full automated pipeline before adding manual complexity |
| 5 | Scoring & Recommendation Engine + Results Dashboard + Report export | Shared by Quick and Detailed — build once |
| 6 | Detailed Assessment + Admin portal + Assessor portal | Depends on 4–5 |
| 7 | **PowerShell Connector Service** (Email/Defender, Purview DLP, Teams tenant policies) — own workstream, own estimate | See Section 16.1/16.3 — do not fold into "more Graph work" |
| 8 | Polish: notifications, history, account edge cases, billing hook-up | Lower risk |

---

## 6. Assessment Tiers — Detailed Specification

### 6.1 Comparison Overview
| | Trial | Quick | Detailed |
|---|---|---|---|
| Automation | 0% (self-reported) | 100% automated | 80% automated + 20% manual |
| Tenant connection required? | No | Yes | Yes |
| Input | 12-question wizard | Live pull, critical-subset controls | Live pull, full control set + Assessor review |
| Output | Estimated score + recommendations | Full scored report | Full, expert-reviewed, audit-ready report |
| Turnaround | Instant | Minutes | Up to a few business days |
| Price (wireframe, unconfirmed) | Free | $5 | $7 |

### 6.2 Trial Assessment
10–12 question guided wizard (MFA, Defender for O365, admin separation, Conditional Access, Intune, disk encryption, privileged access hygiene, password policy, audit logging, DLP, backup, security awareness training). Yes/No/Unsure. Weighted 0–100 score with qualitative band (Poor/Fair/Good/Excellent — confirm thresholds with stakeholder). No tenant connection or permissions required — purely self-reported; report must state this is an estimate. Always ends with a CTA to connect the tenant.

### 6.3 Quick Assessment
Fully automated. Pulls a curated "critical" control subset across reachable modules, runs through Assessment Engine + Scoring Engine, produces the full Results Dashboard (overall score, per-module scores, top findings with severity, next steps, PDF/Excel download). Minutes, no human involvement.

### 6.4 Detailed Assessment
Automated collection runs the full control catalog (not just critical subset) — the "80% automated" portion. The remaining ~20% needs human judgment (e.g., "is this Conditional Access exception justified?") and routes to the Manual Assessment Workflow (Section 9). **Note per Section 16: the automatable/non-automatable split is now also driven by which modules are Graph-reachable — 4 modules currently have no automated path at all and their controls should be marked `automatable: false` until the PowerShell connector ships.**

See Section 21 for exactly how tier classification maps to permission footprint, Section 22 for subscription gating, Section 24 for incremental consent.

---

## 7. User Flows

Diagrams referenced below are in `assets/diagrams/`.

- **Diagram 1A** (`flow1a_onboarding.png`): Launch → Login/MFA → Onboarding → Trial Assessment.
- **Diagram 1B** (`flow1b_connect_run.png`): Tenant Connection (consent) → Quick/Detailed execution → Results → Report.
- **Diagram 2** (`flow2_data_collection.png`): Per-module automated data collection loop with permission-denied handling. Implement as a configuration-driven loop over a MODULES registry, not 8 hand-coded blocks.
- **Diagram 3** (`flow3_manual_swimlane.png`): Detailed Assessment manual workflow swimlane (Client/System/Admin/Assessor).
- **Diagram 6** (`flow6_incremental_consent.png`): Incremental, tier-aware consent resolution.

### 7.1 Scenario Walkthroughs (screen refs map to Section 26)
**Scenario 1 — New user, Trial then Quick**: S01 Login → S02 Sign Up → S01 Login → S03 MFA → S04 Pre-Connection Dashboard → S05 Trial Questions → S06 Trial Results → S07 Connect Guide → S08 Post-Connection Dashboard → S09 Loading → S10 Results.

**Scenario 2 — Returning user, Detailed**: S01 Login → S03 MFA → S11 Tenant Verification → S08 Dashboard → S09 Loading (Detailed variant) → [manual review if needed] → S10 Results.

**Scenario 3 — Admin assigns Detailed**: S12 Internal Sign In → S03 MFA → S13 Admin Requests Queue → S14 Assessors Roster (assign).

**Scenario 4 — Assessor manual review**: S12 Internal Sign In → S03 MFA → S15 Assessor Dashboard → S16 Start Assessment Workspace (**see reconciliation note in Section 26.4**).

**Scenario 5 — Account/misc**: S17 Account Menu → S18 Assessment History / S19 Change Password / S20 Change Name / S21 Update Phone/Email.

---

## 8. Functional Requirements

### 8.1 Authentication & Account Management
| ID | Requirement |
|---|---|
| FR-1.1 | Sign up with Full Name, Email, Password, Company Name, Company Size, Phone Number. Validate email deliverability; warn against personal email addresses. |
| FR-1.2 | Login with Email/Password, Google OAuth, or Microsoft OAuth. |
| FR-1.3 | MFA required at login for all roles. TOTP minimum; email/SMS OTP as secondary. |
| FR-1.4 | "Forgot password" and "Resend verification email" flows supported. |
| FR-1.5 | Users can change Name, Email, Phone, Password from account settings. |
| FR-1.6 | Users can delete their account (soft-delete with grace period recommended). |
| FR-1.7 | Sessions expire after configurable inactivity; "Remember me" extends lifetime. |
| FR-1.8 | Admin/Assessor accounts provisioned by an Admin (not self-service), same login/MFA mechanism, routed to role-specific dashboards. |

### 8.2 Onboarding
| ID | Requirement |
|---|---|
| FR-2.1 | First-time users see a Tenant Onboarding Guide after signup. |
| FR-2.2 | Pre-connection dashboard presents exactly two entry points: "Start Trial Assessment" and "Connect Your Tenant." |
| FR-2.3 | Downloadable PDF guide for tenant connection, plus in-app guided steps. |

### 8.3 Trial Assessment
| ID | Requirement |
|---|---|
| FR-3.1 | 10–12 Yes/No/Unsure questions covering highest-signal control areas. |
| FR-3.2 | Weighted score (0–100) + qualitative band. |
| FR-3.3 | Results page: score gauge, answer summary, per-question breakdown, Key Recommendations, CTA to connect tenant. |
| FR-3.4 | Results downloadable; trial retakeable. |
| FR-3.5 | No tenant connection or M365 data stored — only questionnaire answers. |

### 8.4 Tenant Connection
| ID | Requirement |
|---|---|
| FR-4.1 | Multi-tenant Azure AD app registration; Global Admin completes admin-consent for read-only Graph scopes (Section 16). **Plus: a second grant step for the PowerShell Connector's Entra role assignment, see Section 16.4.** |
| FR-4.2 | Clearly state exact permissions requested and read-only nature before consent. |
| FR-4.3 | If consent denied/partial, flag affected module(s) clearly; allow retry anytime. |
| FR-4.4 | Support reconnection/re-authorization on token expiry/revocation; show connection status (Connected/Needs Attention/Disconnected). |
| FR-4.5 | One Org can connect multiple client tenants (data model supports future MSP use, even if UI doesn't yet). |
| FR-4.6 | On success, dashboard updates to post-connection state (Quick/Detailed available, Trial still available). |

### 8.5 Automated Data Collection Engine
| ID | Requirement |
|---|---|
| FR-5.1 | Configuration-driven pipeline over a MODULES registry — not hard-coded per module. |
| FR-5.2 | Per module: call relevant Graph **or PowerShell** endpoints (per Section 16.2) using only consented scopes/roles. |
| FR-5.3 | Quick executes critical-subset calls; Detailed executes the full control set. |
| FR-5.4 | Missing scope/failed call → flag module "Permission Not Granted"/"Collection Failed," continue other modules, dependent controls → "Not Applicable." |
| FR-5.5 | Raw collected data persisted per assessment/module for traceability/audit/re-scoring. |
| FR-5.6 | Loading screen shows stage-by-stage progress (Initializing → Collecting → Analyzing → Preparing Results) with %. |
| FR-5.7 | Idempotent, safely retryable collection. |
| FR-5.8 | Rate-limit/throttle handling for Graph (429 Retry-After) **and PowerShell throttling (different mechanism — see Microsoft's EXO/Compliance PowerShell throttling docs at implementation time).** |

### 8.6 Data Validation & Normalization
| ID | Requirement |
|---|---|
| FR-6.1 | Validate raw responses against expected schemas per module before Assessment Engine. |
| FR-6.2 | Normalize into consistent internal representation (unify API versions, timestamps, dedupe). |
| FR-6.3 | Validation failure on one data point → mark that control "Unable to Verify," don't fail the whole module. |

### 8.7 Assessment Engine
| ID | Requirement |
|---|---|
| FR-7.1 | Evaluate normalized data against Control Catalog → Pass/Fail/N-A/Needs Manual Review per control, with evidence. |
| FR-7.2 | Control Catalog externalized (DB-driven, versioned) — not hard-coded. |
| FR-7.3 | Each control maps to framework references (CIS, Secure Score, etc.). |
| FR-7.4 | Controls tagged `automatable: false` (or ambiguous automated result) route to Manual Assessment for Detailed; for Quick, simply excluded/Not Applicable. |

### 8.8 Scoring & Recommendation Engine
| ID | Requirement |
|---|---|
| FR-8.1 | Each control has weight + severity; module score = weighted pass rate of applicable controls (0–100). |
| FR-8.2 | Overall score = weighted roll-up of module scores (tunable, not hard-coded). |
| FR-8.3 | Score bands configurable, not hard-coded. |
| FR-8.4 | Every Failed control generates a human-readable recommendation; ranked by severity. |
| FR-8.5 | For Detailed: merge automated + Assessor-submitted manual findings into one result set before scoring; retain `source` field for audit. |

### 8.9 Results Dashboard
| ID | Requirement |
|---|---|
| FR-9.1 | Shows: metadata, overall score gauge, per-module score cards, Results Overview donut, Top Findings, Next Steps, Download Report (PDF/Excel). |
| FR-9.2 | "View all findings" → full filterable/sortable control-level table. |
| FR-9.3 | Reports retained/viewable for a defined window (30 days per wireframe — confirm as policy). |
| FR-9.4 | "Share Report" — access model (expiring link vs. requires login) is Open Question OQ-5. |

### 8.10 Assessment History
| ID | Requirement |
|---|---|
| FR-10.1 | Table: Request ID, Type, Client/Tenant, Requested/Completed On, Status, Score, Action (View Report / Continue). |
| FR-10.2 | Search by request ID/name; filter by type/status. |

---

## 9. Manual Assessment Workflow (Detailed Tier)

### 9.1 Trigger
When a Detailed Assessment's automated pass completes, the Engine determines if any evaluated controls are `automatable: false` or returned "Needs Manual Review." If so → status `Pending Manual Review`, request created in Admin queue as `Unassigned`.

### 9.2 Requirements
| ID | Requirement |
|---|---|
| FR-11.1 | Every Detailed Assessment needing manual review appears in Admin's Active Detailed Requests queue. |
| FR-11.2 | Admin can assign to any Active Assessor; reassignment supported. |
| FR-11.3 | Assigned request appears only in that Assessor's view. |
| FR-11.4 | Assessor workspace shows: (a) automated findings by module/control, (b) a way to record a manual finding per non-automatable control (result + evidence + notes), (c) a way to request supporting documents from client, (d) mark review complete. **⚠️ See Section 26.4 reconciliation — the actual wireframe (S16) uses a simpler download/upload pattern instead. Decide before building: structured in-app entry (recommended, merges cleanly into scoring) vs. wireframe's upload pattern (faster to build, needs extra parsing step to feed the Scoring Engine).** |
| FR-11.5 | Requesting docs triggers client notification + upload/questionnaire surface; can loop until sufficient. |
| FR-11.6 | Client-submitted docs visible only to assigned Assessor + Admins. |
| FR-11.7 | On submission, manual findings feed Scoring Engine, merge with automated results, status → Completed, client notified. |
| FR-11.8 | Full audit trail of every status transition, timestamped, attributable. |

### 9.3 Status Model
| Status | Meaning | Who transitions it |
|---|---|---|
| Unassigned | Automated pass done, awaiting assignment | System → Admin |
| Assigned | Assessor identified, not started | Admin |
| In Review | Assessor actively working | Assessor |
| Awaiting Client | Docs/info requested, waiting | Assessor / Client |
| Completed | Findings submitted, merged, report available | Assessor → System |

---

## 10. Admin Portal Requirements
| ID | Requirement |
|---|---|
| FR-12.1 | Dashboard: Active Detailed Requests count, Assessors count, quick links. |
| FR-12.2 | Active Detailed Requests view: list/manage, assign/reassign Assessor. |
| FR-12.3 | Assessors view: table (Name, Email, Phone, Status, Added On), Add/Rename/Change Email-Phone/Remove. |
| FR-12.4 | Released Reports view: audit list of completed/released reports. |
| FR-12.5 | All admin actions audit-logged. |
| FR-12.6 | *(Phase 2)* Admin analytics: funnel, volume, avg. turnaround. |

## 11. Assessor Portal Requirements
| ID | Requirement |
|---|---|
| FR-13.1 | Dashboard shows Assigned + Completed Assessment Requests. |
| FR-13.2 | Assigned list: request ID, client name, assigned date, due/SLA indicator. |
| FR-13.3 | Assessment workspace implements Section 9.2 (FR-11.4). |
| FR-13.4 | Completed list: read-only history. |
| FR-13.5 | Same account-management surface as Clients minus billing/org settings. |

---

## 12. Reporting Specification

### 12.1 Report Sections
| Section | Contents |
|---|---|
| 1. Assessment Summary | Tenant Name, Type, Date, Duration, Controls Assessed, Owner |
| 2. Overall Security Score | 0–100, band, plain-English interpretation |
| 3. Area-Specific Score | Per-module score + Passed/Failed/N-A counts |
| 4. Executive Summary | 2 paragraphs per area: Positives / Negatives & Improvements, plain business language |
| 5. Detailed Assessment Report | Every control: name, module, Pass/Fail/N-A, severity, evidence, Suggested Improvement |
| 6. Appendix (Detailed only) | Manual review notes, supporting docs referenced, Assessor sign-off |

### 12.2 Export & Sharing
- PDF: print-ready pagination, headers/footers.
- Excel: usable working file — filterable Findings sheet minimum (Module, Control, Result, Severity, Recommendation).
- Retention window (30 days per wireframe) shown clearly in UI.
- Share Report: access model is Open Question OQ-5.

---

## 13. Non-Functional Requirements

**Security**: OWASP ASVS minimum; pen test before GA. Least-privilege scopes only (never write/modify Graph scopes). Encrypt tokens at rest (Key Vault/secrets manager). RBAC enforced server-side, not just UI. MFA everywhere; rate-limit login. Full audit logging (consent, collection runs, admin/assessor actions, report access).

**Privacy & Compliance**: DPA for customer M365 config data. Signup screen currently references "processing outside the EU" — data residency must be a deliberate, accurate commitment (OQ-9). Support GDPR-style erasure. Design for SOC 2 Type II readiness from day one.

**Performance & Scalability**: Quick Assessment full pipeline < 10 min typical. Horizontally scalable collection (queue/worker). Graceful Graph/PowerShell throttling handling.

**Availability**: 99.5%+ uptime target at GA. Resumable/retryable assessment runs.

**Multi-Tenancy** (platform, not M365): strict data isolation between Orgs at DB + storage layer.

**Auditability**: every score must be explainable back to exact evidence collected.

---

## 14. System Architecture

Confirmed stack: Next.js/React frontend, Node.js backend, MySQL database. **Updated per Section 16: automated tenant data collection requires two distinct connector types, not one.**

![Architecture Diagram](assets/diagrams/flow4_architecture.png)

### 14.1 Component Notes
| Component | Notes |
|---|---|
| Frontend | Next.js/React (TypeScript). Single codebase, role-based routing for Client/Admin/Assessor portals — share components (score gauges, tables, report viewers). |
| API Layer | Node.js (NestJS recommended, or Express). REST or GraphQL. |
| Auth | OAuth2/OIDC, MFA-capable — managed provider recommended (Azure AD B2C, Auth0) over building from scratch. |
| Job Queue / Worker | BullMQ + Redis, or Azure Service Bus. Assessment runs are long-running, must not block request/response cycle. |
| **Microsoft Graph Connector** | Handles Entra ID, Intune, M365 Admin Center, SharePoint, Teams guest policy ONLY. Standard OAuth app-registration + admin consent. See Section 16.2. |
| **PowerShell Connector (NEW — was missing from v1.0)** | Handles Exchange Online / Security & Compliance / Microsoft Teams PowerShell access for Email/Defender policy config, Purview DLP config, full Teams tenant policies. Auth: app-only certificate + scoped Entra ID role assignment — NOT a Graph OAuth scope. Different execution model (PowerShell remoting / newer REST-backed V3 EXO module). **Build as its own workstream with its own auth, error-handling, throttling design — do not assume Graph Connector code is reusable.** |
| Database | MySQL — users, orgs, tenant connections, assessments, findings, control catalog, reports metadata. |
| Object Storage | Azure Blob (or S3-compatible) — raw JSON payloads, generated PDF/Excel, uploaded supporting docs. |
| Cache | Redis — sessions, rate limits, reduce redundant calls within one run. |
| Report Generator | HTML-to-PDF pipeline (Puppeteer or similar) + ExcelJS for Excel, from the same underlying findings data. |
| Notifications | Email at minimum (assessment complete, doc requested, assessment assigned); in-app bell implied by wireframes. |
| Billing/Metering | Pluggable — Azure Marketplace metering vs. Stripe is Open Question OQ-1. |
| Observability | App Insights/logging + explicit audit-log table distinct from operational logs. |

---

## 15. Data Model

Core entities (illustrative — refine exact columns/types during implementation):

![Core ERD](assets/diagrams/flow5_erd.png)

### 15.1 Entity Notes
| Entity | Purpose |
|---|---|
| Organization | Velocyverse customer account (paying entity). Owns Users, TenantConnections, Assessments. |
| User | Platform login, role: client/admin/assessor. Also carries `org_role` (Owner/Admin/Member/Viewer, Section 22.1). |
| TenantConnection | One connected client M365 tenant: Azure tenant ID, app-registration/consent record, granted scopes, connection health. **Should also track the PowerShell Connector's Entra role-assignment grant, separate from Graph scopes (Section 16.4).** |
| Assessment | One run of a given type for an Org (and, for quick/detailed, a TenantConnection). Status, overall score, assigned Assessor (Detailed). |
| AssessmentModule | One per M365 module within an Assessment: collection status, module score, raw data pointer. |
| ControlCatalog | Versioned master list of all controls: module, description, weight, severity, framework refs, `automatable` flag. |
| Finding | Result of evaluating one ControlCatalog entry within one AssessmentModule: pass/fail/n-a, severity, evidence, recommendation, `source` (automated/manual). |
| Report | Generated PDF/Excel artifact for a completed Assessment: storage pointer, expiry. |

### 15.2 Billing/Subscription Entities (added v1.1)

![Billing ERD](assets/diagrams/flow7_billing_erd.png)

- **Plan**: catalog of purchasable plans — price, included tenant slots (default 5), included assessment credits per period, seat limit, feature flags.
- **Subscription**: an Org's current plan enrollment, purchased add-on tenant slots, billing status, current period.
- **UsageLedger**: append-only ledger of credit grants/consumption — makes "credits left this month" a simple sum query, clean audit trail for billing disputes.

### 15.3 Notable Design Decisions
- ControlCatalog is first-class and versioned — evolves independently of assessment logic (FR-7.2).
- `Finding.source` preserves audit trail for Detailed Assessment defensibility.
- TenantConnection modeled separately from Assessment to support reuse across multiple assessments over time.

---

## 16. Microsoft Graph Integration Details (VERIFIED — v2.1)

**This section was rewritten after actually checking Microsoft's current documentation, not left as a placeholder.**

### 16.1 Key Finding: Not All Modules Are Reachable via Microsoft Graph Alone

Four of the eight modules cannot be fully read through standard Microsoft Graph app permissions the way the original draft assumed:

- **Email / Defender for Office 365** (anti-phishing, anti-malware, Safe Links, Safe Attachments, anti-spam policy config) — **has no Microsoft Graph API at all.** Confirmed via an open Microsoft feature request (Feb 2026) asking Microsoft to add one — it doesn't exist yet. Only readable via Exchange Online PowerShell / Security & Compliance PowerShell (`*-AntiPhishPolicy`, `*-SafeLinksPolicy`, `*-SafeAttachmentPolicy` cmdlets).
- **Purview DLP policy configuration** — no Graph endpoint to list/read DLP policy objects. The Graph Purview APIs that exist (`/security/dataSecurityAndGovernance`) are for runtime policy *evaluation* (compute protection scope for a piece of content right now), not reading back policy *definitions*. Requires Security & Compliance PowerShell (`Get-DlpCompliancePolicy` / `Get-DlpComplianceRule`).
- **Teams tenant-wide policies** (external access, meeting, messaging) — not exposed via Graph. Only directory-level guest access (`policies/authorizationPolicy`) is Graph-accessible. Full Teams policy config requires the Microsoft Teams PowerShell module.
- **Defender for Cloud Apps** — has a Graph API, but it's **beta-only**, uses `CloudApp-Discovery.Read.All`, and covers only Cloud Discovery (Shadow IT app inventory) — not sanctioned/risky app access and session policies, which live in a separate Defender portal API outside Graph.

**Practical implication**: a single "Microsoft Graph Connector Service" cannot alone deliver automated data collection for Email, Purview DLP, or full Teams/Cloud Apps coverage. The architecture (Section 14) now has a second connector: an Exchange Online / Security & Compliance / Teams PowerShell Connector Service, authenticated via app-only certificate + Entra role assignment (e.g., Exchange Administrator or a custom scoped role), not a Graph OAuth consent screen. **This is a materially different auth and execution model and should be scoped as its own engineering workstream.**

### 16.2 Corrected Per-Module Table

| Module | Data Needed | Verified Access Path & Permission |
|---|---|---|
| Entra ID — Conditional Access | CA policy configuration | **Microsoft Graph.** Least-privileged: `Policy.Read.All` (application permission). Confirmed current Aug 2026. |
| Entra ID — MFA registration | Tenant-wide MFA/SSPR/passwordless registration status | **Microsoft Graph**, `/reports/authenticationMethods/userRegistrationDetails`. Least-privileged: `AuditLog.Read.All` — **correction from v1.0**, which specified the higher-privileged `UserAuthenticationMethod.Read.All` (only actually needed for reading each user's individual auth methods in detail, not the aggregate report). |
| Entra ID — privileged roles, guest settings | Role assignments, external collaboration/guest policy | **Microsoft Graph.** `RoleManagement.Read.Directory`; guest policy via `Policy.Read.All` (`policies/authorizationPolicy`). |
| M365 Admin Center | License/subscription posture, tenant org profile | **Microsoft Graph.** `Organization.Read.All`. Confirmed correct. |
| Purview — DLP configuration | DLP policy/rule definitions | **NOT available via Graph.** Requires Security & Compliance PowerShell (app-only cert auth). No Graph alternative exists today. |
| Email / Defender for O365 | Anti-phishing, anti-malware, Safe Links, Safe Attachments, anti-spam config | **NOT available via Graph** (confirmed via open Microsoft feature request, Feb 2026). Requires Exchange Online PowerShell. |
| Intune | Device compliance policies, config profiles | **Microsoft Graph.** `DeviceManagementConfiguration.Read.All`. Confirmed correct. |
| Intune — managed devices | Device inventory, compliance state, encryption status | **Microsoft Graph.** `DeviceManagementManagedDevices.Read.All`. |
| Cloud Apps (Defender for Cloud Apps) | Discovered/Shadow IT app inventory | **Microsoft Graph, beta only.** `CloudApp-Discovery.Read.All`. Full CASB policy config out of Graph's reach — treat as reduced-scope or manual-review item. |
| Teams — guest access (directory level) | Tenant-wide guest invite policy | **Microsoft Graph.** `Policy.Read.All` (`policies/authorizationPolicy`). |
| Teams — tenant policies (meeting/external/messaging) | Teams-specific policy config | **NOT available via Graph.** Requires Microsoft Teams PowerShell module. |
| SharePoint | Tenant-wide sharing/external collaboration settings | **Microsoft Graph.** `SharePointTenantSettings.Read.All`. Confirmed correct, but coverage is partial — only a subset of the 100+ settings in the full SPO admin center / `Set-SPOTenant` are exposed. |

### 16.3 Recommended Response
1. Treat Entra ID, Intune, M365 Admin Center, SharePoint (partial), Teams guest policy (directory-level only) as the **"clean Graph" module set** — buildable with a single Graph Connector Service and standard admin-consent, as originally planned.
2. Treat Email/Defender policy config, Purview DLP config, full Teams tenant policies, Cloud Apps beyond Discovery as a **second integration workstream** requiring the PowerShell Connector Service, with its own auth design and its own incremental-consent equivalent (request only the Entra role/scope needed per module, not a blanket Exchange Administrator grant).
3. Re-evaluate the Control Catalog's `automatable` flag for controls in the PowerShell-only modules — it may be more pragmatic for an early release to mark these `automatable: false` (routed to Assessor review) rather than blocking launch on the second connector, then automate later.
4. This does NOT change the Quick/Detailed tier classification (Section 21) — it changes which specific controls can realistically be `automatable: true` today.

### 16.4 Consent & Token Handling
1. Single multi-tenant Azure AD app registration for the Graph-reachable modules; Global Admin does one-time admin consent covering Section 16.2's scopes.
2. Store refresh tokens encrypted; Graph Connector handles silent refresh before each run.
3. Detect revocation specifically (not generic failure) — update TenantConnection status, prompt reconnection.
4. Support incremental/least-privilege consent evolution without forcing full re-onboarding.
5. **For PowerShell-only modules: the equivalent "consent" is assigning the app's service principal a scoped Entra ID role** (custom role limited to needed read cmdlets, not the broad built-in Exchange Administrator role) — present with the same plain-English, per-module framing as Graph consent (Section 24.4), even though the grant mechanism differs.

---

## 17. Open Questions & Assumptions

| # | Question | Why it matters | Assumption in this doc |
|---|---|---|---|
| OQ-1 | Billing: Azure Marketplace metering, standalone processor (Stripe), or both? | Changes Billing integration design and whether $5/$7 pricing is Velocyverse- or Marketplace-enforced | Billing treated as pluggable; no processor hard-wired |
| OQ-2 | Are the $5/$7 prices final or illustrative? | Affects pricing/paywall UI, Marketplace SKU setup | Treated as illustrative pending confirmation |
| OQ-3 | Assessor SLA (target turnaround)? | Client-facing expectations, internal alerting | "Up to a few business days" placeholder |
| OQ-4 | Exact report/data retention period — hard deletion or just download-availability? | Storage lifecycle, compliance messaging | Treated as stated 30-day policy |
| OQ-5 | Share Report — login required or expiring public link? | Security/compliance vs. ease of sharing | No assumption — flagged for design decision |
| OQ-6 | Purchase model: one-time, subscription, or credit-based? | Billing/Organization data model | Data model is billing-model-agnostic |
| OQ-7 | MSP/multi-client management in scope near-term? | Data model already supports it, UI doesn't | Explicitly out of first build, flagged Phase 2 |
| OQ-8 | Exact scoring formula weights and score-band thresholds | Product credibility — needs security SME input | Placeholder thresholds suggested |
| OQ-9 | Data residency commitment (signup screen references "outside the EU") | Legal/compliance exposure if inaccurate | Flagged only — needs legal review |
| **OQ-10 (new)** | **Does the first build include the PowerShell Connector Service, or launch with only the 5 Graph-reachable modules and route the other 4 modules' controls to manual review?** | **Directly affects Stage 7 timeline and Detailed Assessment automation coverage at launch (Section 16.3)** | **Not assumed — flagged as the most consequential near-term scope decision from the v2.1 research** |

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Microsoft Graph permission/API changes break data collection | High — silently wrong/missing findings undermine credibility | Isolate Graph calls in Connector Service; contract tests; monitor Graph changelog |
| **4 modules require a separate PowerShell connector with different auth (confirmed by direct research, not hypothetical)** | **High — underestimating this doubles integration engineering surface, could block automated coverage for ~4 of 8 modules at launch** | **Build Graph-reachable modules first (Section 16.3); scope PowerShell Connector as its own workstream with its own estimate; mark affected controls manual-only until it ships** |
| Customers hesitate to grant broad admin-consent to a new vendor | High — blocks Trial → Connect funnel | Transparency on exact scopes/read-only nature; security/trust page; SME questionnaire for enterprise |
| Assessor bottleneck as Detailed volume grows | Medium — SLA breaches | Admin queue/assignment tooling from day one; track turnaround; minimize Assessor time per request |
| Scoring perceived as arbitrary vs. Microsoft's Secure Score | Medium — undermines trust | Map to CIS/NIST/ISO explicitly; SME validates weighting |
| Sensitive tenant config data breach | Critical — existential | Encryption at rest/transit, least-privilege scopes, server-side RBAC, pen test before GA |
| Scope creep from "full platform" stalling demoable progress | Medium — delivery risk | Recommended build sequence (Section 5.3) keeps a working slice always available |

---

## 19. Release Plan

| Stage | Epic | Size | Key Dependencies |
|---|---|---|---|
| 1 | Auth, account, Org/User data model, empty dashboards | M | None |
| 2 | Trial Assessment | S | OQ-8 scoring thresholds should be finalized |
| 3 | Tenant Connection: Graph app registration, consent flow, status UI | L | Requires actual Azure AD app registration + subscription |
| 4 | Automated Data Collection — Graph-reachable modules (Entra, Intune, M365 Admin Center, SharePoint, Teams guest) + Control Catalog seed data | L | Section 16.2 scopes |
| 5 | Scoring & Recommendation Engine, Results Dashboard, PDF/Excel Report | L | OQ-8 |
| 6 | Quick Assessment end-to-end | M | Stages 3–5 |
| 7 | Detailed Assessment: manual-review routing, Admin queue, Assessor workspace, doc request loop | XL | Stages 3–5; OQ-3 |
| 8 | **PowerShell Connector Service** (Email/Defender, Purview DLP, Teams tenant policies) | **XL** | **OQ-10 — decide if this ships at launch or Phase 2** |
| 9 | Billing/paywall integration | M | OQ-1, OQ-2, OQ-6 |
| 10 | Notifications, History polish, account edge cases, Share Report | M | OQ-5 |
| 11 | Security hardening + third-party pen test | L | Should run before GA regardless |

---

## 20. Appendix

### 20.1 Glossary
- **Tenant**: A customer's M365/Entra ID environment — distinct from a "Velocyverse Organization" (platform account).
- **Admin Consent**: Microsoft OAuth flow where a tenant's Global Admin grants app access to specified Graph scopes org-wide.
- **Control**: A single discrete security check evaluated Pass/Fail/N-A.
- **Control Catalog**: Full versioned library of all Controls.
- **Finding**: Result of evaluating one Control within one Assessment.
- **Automatable Control**: Resolvable from API data alone, no human judgment needed.
- **Graph Security API**: Microsoft Graph surface for security-relevant signals (alerts, secure scores, threat data).

### 20.2 Sample Control Catalog Entries (illustrative — full catalog is a separate SME-owned deliverable)
| Module | Control | Automatable |
|---|---|---|
| Entra ID | MFA enforced for all users (incl. privileged roles) | Yes |
| Entra ID | Legacy authentication protocols disabled | Yes |
| Entra ID | Conditional Access exceptions business-justified/documented | No — manual review |
| Email | Anti-phishing policy enabled tenant-wide | **Currently No — PowerShell connector required (Section 16)** |
| Email | External email forwarding restricted/monitored | **Currently No — PowerShell connector required** |
| Purview | DLP policy scope matches sensitive-data footprint | No — manual review (and PowerShell-dependent) |
| Intune | Device encryption (BitLocker) enforced by compliance policy | Yes |
| SharePoint | Anonymous/external sharing restricted to approved use cases | No — manual review (context-dependent) |

### 20.3 Next Steps
1. Resolve OQ-1, OQ-2, OQ-6 before Stage 9; **resolve OQ-10 before Stage 8**.
2. Get a security SME to validate/expand the Control Catalog and scoring weights (OQ-8).
3. Provision the Azure AD multi-tenant app registration early (Stage 3) — may involve Microsoft review lead time.
4. This document is the sole input needed to begin the Kilo AI build — see companion `Velocyverse_BUILD_CHECKLIST.md` for the actionable task breakdown.

---

## 21. Assessment Tier Classification & Permission Scope-to-Tier Mapping

### 21.1 Tier Classification
| Tier | Classification | What it evaluates | Graph/PowerShell footprint |
|---|---|---|---|
| Trial | Checklist-based self-assessment | 10–12 Yes/No/Unsure from memory, nothing verified | None — zero permissions requested |
| Quick | High-level automated assessment | Critical-control subset per Graph-reachable module | Critical-subset read-only scopes, per module actually included |
| Detailed | Full/deep automated + manual review | Entire control catalog per module + ~20% needing human judgment | Full read-only scope set + PowerShell connector where applicable (Section 16) |

### 21.2 Why This Matters for Consent Design
Because Quick and Detailed request different depths of access, and Trial requests none, permission requests must be resolved dynamically per action, never bundled upfront. See Section 24.

### 21.3 Tier Availability by Subscription
Gated by plan — see Section 22.2/22.4. E.g., Free tier may be Trial-only; Starter/PAYG can run Quick+Detailed pay-per-use; Professional+ include monthly credit allowances.

---

## 22. Subscription Plans, Organization Roles & Feature Matrix

### 22.1 Organization-Level Roles (new in v1.1)
| Org Role | Can do | Cannot do |
|---|---|---|
| Owner | Everything Admin can + manage subscription/billing, purchase add-ons, delete Org, transfer ownership | N/A — top of hierarchy (exactly one per Org) |
| Admin | Connect/disconnect tenants (within plan limits), run any assessment tier available, invite/remove Members and Viewers, view all reports | Change subscription plan, view/edit billing, delete Org |
| Member | Run assessments (within credit limits), view results/reports for accessible tenants | Connect/disconnect tenants, manage users, view billing |
| Viewer | View dashboards and completed reports only | Run assessments, connect tenants, manage users, view billing |

This is additive to Section 4 — Admin/Assessor (Section 4.2–4.3) remain unchanged internal Velocyverse roles.

### 22.2 Subscription Plans (proposed — prices illustrative, pending OQ-2)
| Plan | Price | Tenants included | Assessment credits | Seats | Notable features |
|---|---|---|---|---|---|
| Free | $0 | 0 (Trial needs none) | Unlimited Trial | 1 | Trial only |
| Starter (PAYG) | $0/mo + pay-per-assessment | 1 | Pay $5 Quick / $7 Detailed per run | 3 | No monthly commitment |
| Professional | ~$99/mo | Up to 5 | ~10 Quick + 2 Detailed/mo, overage at PAYG rate | 10 | Scheduled monthly re-assessment, 90-day retention, trend view |
| Business/MSP | ~$299/mo | Up to 5 + add-ons | ~30 Quick + 8 Detailed/mo | Unlimited | White-label, priority Assessor SLA, API access, MSP dashboard |
| Enterprise | Custom | Custom | Custom/unlimited | Unlimited | SSO/SCIM, continuous monitoring, custom framework mapping, dedicated CSM |

### 22.3 Tenant Inclusion Limit & Add-On Pricing (confirmed mechanic)
**Every paid plan includes a maximum of 5 tenants by default.** Connecting a 6th+ tenant is a paid add-on (illustrative $15–$25/tenant/month), not a hard block.
1. TenantConnection creation gated **server-side** against `Subscription.included_tenant_slots + Subscription.addon_tenant_slots` (Section 22.5 data model).
2. Exceeding the limit → upsell modal ("Add another tenant for $X/mo," self-serve checkout) — a direct low-friction expansion-revenue moment.
3. Add-on slots billed on the same cycle as the base subscription (prorated), releasable if a tenant is disconnected, subject to a minimum commitment period.
4. Enterprise negotiates tenant count directly, not via the add-on metering path.

### 22.4 Feature-by-Plan Matrix
| Feature | Free | Starter | Professional | Business/MSP | Enterprise |
|---|---|---|---|---|---|
| Trial Assessment | ✓ Unlimited | ✓ Unlimited | ✓ Unlimited | ✓ Unlimited | ✓ Unlimited |
| Quick Assessment | — | Pay-per-run | Included credits + overage | Included credits + overage | Unlimited |
| Detailed Assessment | — | Pay-per-run | Included credits + overage | Included credits + overage | Unlimited |
| Tenants included | 0 | 1 | 5 | 5 (+add-ons) | Custom |
| Additional tenant add-on | — | Available | Available | Available | Negotiated |
| Report formats | PDF (Trial) | PDF+Excel | PDF+Excel | PDF+Excel+white-label | PDF+Excel+white-label |
| Report retention | N/A | 30 days | 90 days | 90 days | Custom/indefinite |
| Scheduled re-assessment | — | — | Monthly (Quick) | Monthly + configurable | Continuous monitoring |
| Trend/history dashboard | — | — | ✓ | ✓ | ✓ + benchmarking |
| MSP multi-client dashboard | — | — | — | ✓ | ✓ |
| API access | — | — | — | ✓ | ✓ |
| Priority Assessor SLA | — | Standard | Standard | Priority (48h) | Dedicated SLA |
| Compliance framework mapping | CIS default | CIS default | CIS default | CIS + 1 additional | Custom/multiple |
| SSO/SCIM | — | — | — | — | ✓ |

**Note**: the Role × Feature boundary (22.1) applies within any plan — a Viewer on Enterprise still can't run assessments. Plan gates *what the Org can do*; Org Role gates *what this person within the Org can do*.

### 22.5 Data Model Additions
See `flow7_billing_erd.png` (Section 15.2): **Plan**, **Subscription**, **UsageLedger** entities. `User` gains an `org_role` field alongside the existing platform-level `role` field.

---

## 23. Monetization & Revenue Opportunities

### 23.1 Core Revenue
- Recurring subscriptions (Section 22.2).
- Pay-as-you-go per-assessment ($5 Quick / $7 Detailed per wireframes).
- Add-on tenant slots beyond plan limit (Section 22.3) — low-friction expansion revenue.
- Add-on seats and assessment credit packs.

### 23.2 Additional Opportunities
| Opportunity | Description | Fit |
|---|---|---|
| Azure Marketplace transactable listing | Enterprise buyers pay via Azure bill, draw down MACC spend | High — natural next step from the existing entry point |
| White-label / MSP reseller program | MSPs rebrand reports, run assessments across client tenants under one login | High — persona research flags MSPs; data model already supports it |
| Continuous monitoring / drift alerting add-on | Watch for config drift, alert near-real-time — reuses existing pipeline on a schedule | High — strong upsell, low incremental build cost |
| Compliance framework add-on packs | HIPAA/PCI/SOC2/ISO report views beyond default CIS mapping | Medium-high — cheap once ControlCatalog.framework_refs populated |
| Remediation-as-a-service / partner marketplace | Velocyverse's own paid remediation via Assessors, or referral marketplace | Medium — higher-touch, but Assessor role already exists |
| Cyber-insurance partnerships | Referral fees or insurer-subsidized assessments as underwriting input | Medium — needs BD, leverages existing deliverable |
| "Verified Secure" trust badge/certification | Paid annual renewable badge for score threshold, like a SOC 2 badge | Medium — cheap to build, needs legal care |
| API/embedded assessment licensing | License engine to other GRC/MSP tools, usage-based pricing | Lower near-term — engine is already API-shaped internally |
| Anonymized benchmark data product | "Average SMB in your industry scores X" — needs volume + consent design first | Lower near-term |

### 23.3 Suggested Sequencing
Launch with core subscriptions + PAYG + tenant add-ons only. Continuous monitoring and compliance framework packs are next-highest-leverage (reuse existing infrastructure almost entirely). Marketplace-transactable billing resolves alongside OQ-1. Everything else waits for stable core + real usage volume.

---

## 24. Permission & Incremental Consent Strategy

**Core principle: never request every Graph permission in one blanket consent screen.** Request only what the specific action the user just took actually needs, at the moment they take it.

### 24.1 Algorithm
1. Trial requests zero permissions (Section 21.1).
2. First Quick Assessment → resolve minimum scope set for Quick's critical-control subset across covered modules, request only those.
3. Later Detailed Assessment upgrade → diff full Detailed requirement against what's already consented, request only the incremental delta — never re-prompt for already-granted scopes.
4. Within either tier, scopes requested grouped by module with plain-English description of exactly what's enabled.
5. Declined module → marked "Permission Not Granted," assessment proceeds without it (non-blocking, per-module).

![Incremental Consent Flow](assets/diagrams/flow6_incremental_consent.png)

### 24.2 Technical Mechanism
- Microsoft's OAuth2/OIDC admin-consent flow natively supports incremental consent — a `scope` parameter submitted to `/adminconsent` (or `/authorize` with `prompt=consent`) containing only the permissions needed for that step. Previously granted scopes remain granted.
- System of record: `TenantConnection.consented_scopes` — always diff against this stored value, not what the UI last showed (admin could modify consent directly in their own Entra admin center).
- Detect revocation specifically (auth error on a previously-working call), don't treat as generic failure.
- These are org-wide "Application" permissions requiring Global Admin approval each time — incremental consent minimizes the size/frequency of each ask, not the need for admin approval.
- **For the 4 PowerShell-only modules (Section 16): the equivalent mechanism is an Entra role assignment to the app's service principal, not a Graph scope — apply the same per-module, plain-English framing.**

### 24.3 Practical Sequencing
| Step | When | What's requested |
|---|---|---|
| 1 | User runs Trial | Nothing |
| 2 | First "Connect Your Tenant" for Quick | Critical-subset scopes for Quick's covered modules, per-module screens |
| 3 | First Detailed Assessment upgrade | Only incremental delta beyond what Quick already granted |
| 4 | Future new module/control needing a new scope | Only that new scope, next time it's actually used — never a forced mass re-consent |

### 24.4 UX Recommendation
Before each consent redirect, show an in-app screen (not just Microsoft's native consent screen) stating plainly: what module is connecting, what specific data will be read, confirmation of read-only. Matches existing wireframe's "Secure and read-only connection" messaging — apply consistently at every incremental step.

---

## 25. Product Enhancement Recommendations (Beyond Confirmed Scope)

**Not required for first build** — flagged because several reuse infrastructure already planned almost for free.

### 25.1 High Leverage
- **Continuous monitoring & drift alerts** — reuses Graph connector, Control Catalog, Assessment Engine on a schedule/webhook. Strong subscription upsell.
- **Score trend/history dashboard** — largely a query/viz feature on data already captured.
- **AI-generated executive summary narrative** — LLM drafts the Executive Summary section from structured Finding data.
- **Assessor-assist suggestions** — AI-suggested findings for non-automatable controls based on automated data already collected, Assessor reviews/confirms rather than writing from scratch. Cuts Assessor time toward the <90 min target.
- **Compliance framework selector in report UI** — ControlCatalog.framework_refs already exists; mostly a presentation-layer feature once populated.

### 25.2 Medium Leverage
- Integrations: push findings to Jira/ServiceNow/Slack/Teams.
- MSP multi-client dashboard: aggregate risk view across managed tenants.
- Notification/alerting engine: completion, status changes, consent revocation, credit exhaustion.
- Public API for programmatic assessment triggering (CI/CD security gate).

### 25.3 Lower Near-Term Priority
- Peer/industry benchmarking — needs real volume + careful anonymization design.
- One-click auto-remediation — needs write-scope Graph permissions, much higher trust bar, deliberate safety/rollback design. Treat as a distinct future initiative.
- Certification badge program, cyber-insurance partnerships — gated by BD/legal, not engineering.

### 25.4 Recommendation
Do not build Section 25 in the first release. It exists so the architecture (module-driven Control Catalog, isolated connector services, ledger-based usage tracking, source-tagged Findings) doesn't need rework later — several data model choices (Finding.source, ControlCatalog.framework_refs, UsageLedger) exist specifically because they're cheap now, expensive to retrofit.

---

## 26. Complete Screen-by-Screen UI Specification

Every screen in the source wireframes, deduplicated into 21 unique templates (shared templates like Login/MFA/Password appear identically across Client/Admin/Assessor and are documented once). Images are in `assets/screens/`.

### 26.0 Screen Index
| ID | Screen Name | Portal | Appears In |
|---|---|---|---|
| S01 | Login Page | Client | Scenario 1 (entry), Scenario 2 (entry) |
| S02 | Sign Up / Client Information Page | Client | Scenario 1 |
| S03 | MFA / OTP Verification | Client/Admin/Assessor (shared) | All scenarios, post-login |
| S04 | Pre-Connection Dashboard | Client | Scenario 1 |
| S05 | Trial Assessment Questionnaire | Client | Scenario 1 |
| S06 | Trial Assessment Results | Client | Scenario 1 |
| S07 | Connect Tenant / User Guide | Client | Scenario 1 |
| S08 | Post-Connection Dashboard (Choose Assessment Type) | Client | Scenario 1, 2 |
| S09 | Assessment Loading Screen | Client | Scenario 1 (Quick), Scenario 2 (Detailed variant) |
| S10 | Assessment Results Page | Client | Scenario 1 (Quick), Scenario 2 (Detailed) — shared template |
| S11 | Tenant Connection Verification | Client | Scenario 2 |
| S12 | Internal Sign In | Admin/Assessor (shared) | Scenario 3, 4 |
| S13 | Admin Dashboard — Detailed Requests Queue | Admin | Scenario 3 |
| S14 | Admin Dashboard — Assessors Roster | Admin | Scenario 3 |
| S15 | Assessor Dashboard | Assessor | Scenario 4 |
| S16 | Assessor Start Assessment Workspace | Assessor | Scenario 4 |
| S17 | Account Menu / User Actions Dropdown | Client (+ Admin/Assessor equivalent) | Scenario 5 |
| S18 | Assessment History Page | Client | Scenario 5 |
| S19 | Change Password Page | Client/Admin/Assessor (shared) | Scenario 5 |
| S20 | Change Name Page | Client | Scenario 5 |
| S21 | Update Phone Number / Email Page | Client/Assessor (shared) | Scenario 5 |

### 26.1 Scenario 1 Screens — New User: Trial → Connect → Quick Assessment

**S01 — Login Page**
![S01](assets/screens/S01_LoginPage.png)
Entry point for all client users. Combined Login/Sign Up toggle.
- **Elements**: Log in / Sign up toggle, Email, Password (show/hide), Remember me, Forgot password?, Resend verification email, Log in button, Log in with Google, Log in with Microsoft. Note warns to use tenant email, not personal.
- **Refs**: FR-1.1, FR-1.2, FR-1.4. Diagram 1A step 2.

**S02 — Sign Up / Client Information Page**
![S02](assets/screens/S02_SignUpPage.png)
Account creation form.
- **Elements**: Full Name, Email, Password (min 8 chars), Company Name, Company Size (dropdown), Phone with country selector, Create account button, ToS/Privacy consent (currently references "outside the EU" — OQ-9).
- **Refs**: FR-1.1. Diagram 1A step 2.

**S03 — MFA / OTP Verification**
![S03](assets/screens/S03_MFA_OTP.png)
Shown after login/signup for all roles (shared template).
- **Elements**: 6-digit OTP input, delivery confirmation (phone+email, masked), expiry countdown, Resend OTP, Verify & Continue, Back to Sign In.
- **Refs**: FR-1.3. Diagram 1A step 3; MFA step in Scenarios 2/3/4.

**S04 — Pre-Connection Dashboard**
![S04](assets/screens/S04_PreConnectionDashboard.png)
First screen for a user with no tenant connected.
- **Elements**: Two cards — "Start Your Trial Assessment Now" and "Connect Your Tenant to the Tool," each with 3 benefit bullets + CTA.
- **Refs**: FR-2.2. Diagram 1A steps 4–5.

**S05 — Trial Assessment Questionnaire**
![S05](assets/screens/S05_TrialQuestionnaire.png)
The 12-question checklist (Section 21.1: zero permissions).
- **Elements**: Progress indicator, 12 questions each Yes/No/Unsure, confidentiality note, Submit Assessment.
- **Refs**: FR-3.1. Diagram 1A step 6.

**S06 — Trial Assessment Results**
![S06](assets/screens/S06_TrialResults.png)
Instant results.
- **Elements**: Status banner, score gauge, Score Summary panel, Question Summary table, Key Recommendations, "Need Help?" panel, "Connect the Tenant" CTA banner. Download/Retake actions.
- **Refs**: FR-3.2, FR-3.3, FR-3.4. Diagram 1A step 7.

**S07 — Connect Tenant / User Guide**
![S07](assets/screens/S07_ConnectTenantGuide.png)
Bridges Trial (or direct Connect) into the tenant-connection technical flow.
- **Elements**: "Download the User Guide" hero, 3 benefit tiles, support banner with Contact Support.
- **Refs**: FR-2.3. Diagram 1B step 2.

**S08 — Post-Connection Dashboard — Choose Assessment Type**
![S08](assets/screens/S08_PostConnectionDashboard.png)
Main hub once tenant connection succeeds.
- **Elements**: Success banner, three assessment-type cards (Trial/Quick/Detailed) with icon, description, 3 bullets, price-tagged CTA (Free/$5/$7).
- **Refs**: FR-4.6. Diagram 1B post-consent state; Section 6.1; Section 22.4 gates which cards are enabled per plan.

**S09 — Assessment Loading Screen**
![S09](assets/screens/S09_AssessmentLoading.png)
Shown while Quick/Detailed pipeline runs. Detailed variant (`S09b_DetailedLoadingWithOwner.png`) adds an Assessment Owner contact block.
- **Elements**: Illustration, % progress bar, 4-stage checklist (Initializing → Collecting → Analyzing → Preparing Results) with status pills, "don't close window" notice.
- **Refs**: FR-5.6. Diagram 1B; Diagram 2.
- **Note**: The Detailed variant's Assessment Owner card is the wireframe's only pre-manual-review hint that a human will be involved — recommend keeping this to set expectations.

**S10 — Assessment Results Page**
![S10](assets/screens/S10_AssessmentResults.png)
Core results view, shared by Quick and Detailed (same template — populated example shows a Detailed Assessment).
- **Elements**: Status banner, metadata row, Overall Security Score gauge, per-module score cards, Results Overview donut, Top Findings with severity, Next Steps, Download Report (PDF/Excel), Share Report, Assessment Owner block.
- **Refs**: FR-9.1, FR-9.2, FR-9.4. Section 12. Diagram 1B final step.

### 26.2 Scenario 2 Screens — Returning User: Detailed Assessment

Reuses S01, S03, S08, S09, S10. Only one screen is unique to this path:

**S11 — Tenant Connection Verification**
![S11](assets/screens/S11_TenantConnectionVerification.png)
Re-validates an existing connection is still healthy for a returning user.
- **Elements**: Circular progress illustration, 3-step checklist (Authenticating → Retrieving tenant info → Finalizing connection), "please wait" notice.
- **Refs**: FR-4.4. Recommend this runs automatically/silently on dashboard load, falling back to this visible screen only when re-auth is actually required.

### 26.3 Scenario 3 Screens — Admin Assigns a Detailed Assessment

**S12 — Internal Sign In**
![S12](assets/screens/S12_InternalSignIn.png)
Simplified login for Admin and Assessor portals (no self-service signup, no social login).
- **Elements**: Email, Password, Remember Me, Sign In, Forgot Password.
- **Refs**: FR-1.8.

**S13 — Admin Dashboard — Detailed Requests Queue**
![S13](assets/screens/S13_AdminDetailedRequestsQueue.png)
Admin's operational home for the Detailed Assessment pipeline.
- **Elements**: Summary cards (Active Detailed Requests, Assessors, Change Password), Active Detailed Assessment Requests table with per-row Actions menu (View Details, Assign Assessor, Assign to Myself, Access Assessment Data, View Report, Release Report), search, pagination.
- **Refs**: FR-12.1, FR-12.2, FR-11.2, FR-11.3. Section 9.3.

**S14 — Admin Dashboard — Assessors Roster**
![S14](assets/screens/S14_AdminAssessorsRoster.png)
Assessor workforce management.
- **Elements**: Left nav, summary cards, Assessors table (Name, Email, Phone, Status, Added On) with Rename/Change Email-Phone/Remove, Add Assessor.
- **Refs**: FR-12.3.

### 26.4 Scenario 4 Screens — Assessor Performs Manual Review

Reuses S12, S03.

**S15 — Assessor Dashboard**
![S15](assets/screens/S15_AssessorDashboard.png)
Assessor's home — scoped to only their own assigned requests (enforced server-side per NFR).
- **Elements**: Summary cards, Assigned Assessment Requests table (Request ID, Client, Tenant, Type, Requested On, Status, Due Date), Start Assessment action.
- **Refs**: FR-13.1, FR-13.2. Due Date column implies SLA tracking (OQ-3).

**S16 — Assessor Start Assessment Workspace**
![S16](assets/screens/S16_AssessorStartAssessment.png)
The Assessor's working screen — **most important screen to reconcile against Section 9**.
- **Elements**: Request metadata bar, Client Information panel, Assessment Resources panel (Download Collected Data, Download Automated Assessment Report, Upload Assessment Report).
- **Refs**: FR-11.4 through FR-11.7.
- **⚠️ RECONCILIATION NEEDED**: This wireframe shows a download/offline-review/upload pattern, simpler to build than the structured in-app "record a finding per non-automatable control" workspace specified in FR-11.4. The offline-upload pattern is faster to ship but the uploaded file isn't structured data — it can't automatically merge into the Scoring Engine (FR-11.7) or preserve the `Finding.source` audit trail (Section 15) without an extra parsing/re-entry step. **Recommendation**: keep Download Collected Data / Download Automated Report as-is, but replace "Upload Assessment Report" with a structured findings form (one entry per non-automatable control, matching FR-11.4), optionally still allowing a supporting document attachment per finding for audit backup. **Decide this before building S16** — it changes both the UI and the Assessor's day-to-day workflow.

### 26.5 Scenario 5 Screens — Account & Miscellaneous

**S17 — Account Menu / User Actions Dropdown**
![S17](assets/screens/S17_AccountMenuDropdown.png)
Account dropdown from the top-right avatar on any authenticated Client screen.
- **Elements**: Assessment History, Change Password, Change Name, Phone Number, Email, Delete Account (destructive), Sign Out.
- **Refs**: FR-1.5, FR-1.6, FR-10.1. Section 22.1 — each org role should see a menu scoped to what they're permitted (e.g., only Owner sees billing).

**S18 — Assessment History Page**
![S18](assets/screens/S18_AssessmentHistory.png)
Full list of past/in-progress assessments.
- **Elements**: Table (Request ID, Type pill, Client, Requested/Completed On, Status, Score, Action), search, filter, pagination, status-semantics info banner.
- **Refs**: FR-10.1, FR-10.2.

**S19 — Change Password Page**
![S19](assets/screens/S19_ChangePassword.png)
Standard password-change form, identical across Client/Admin/Assessor.
- **Elements**: Current/New/Confirm Password (show/hide), User Tips panel (complexity rules), Cancel, Update Password.
- **Refs**: FR-1.5.

**S20 — Change Name Page**
![S20](assets/screens/S20_ChangeName.png)
Profile-field update.
- **Elements**: Current Name card, New First/Last Name inputs, propagation note, Cancel, Update Name.
- **Refs**: FR-1.5.

**S21 — Update Phone Number / Email Page**
![S21](assets/screens/S21_UpdatePhoneEmail.png)
Combined contact-detail update (phone + email stacked).
- **Elements**: Current/New Phone with verification-code notice, Update Phone Number; Current/New Email with verification-link notice, Update Email.
- **Refs**: FR-1.5.

---

*End of master document. See `Velocyverse_BUILD_CHECKLIST.md` for the actionable task breakdown.*
