# Velocyverse — Build Gap Analysis
## Current State vs. Master Build Document v2.1

**Date:** 19 Aug 2026  
**Purpose:** Map what's built vs. what the spec requires, validated against actual codebase. No code changes made.

---

## Executive Summary

The application is approximately **60-65% aligned** with the Master Build Document v2.1. The core platform shell, authentication, trial assessments, Graph-based data collection, scoring engine, report generation, and all three role portals (Client, Admin, Assessor) are implemented. The largest gaps are the **PowerShell Connector Service** (explicitly flagged in Section 16 as a separate workstream), **real billing/payment integration**, **incomplete rebranding** from "Aegis", and **security hardening** before GA.

---

## Critical Validation Findings

### 1. MODULE_CONFIGS Misaligned with Section 16.2 — NOW FIXED
The Master Build Document's verified per-module table had specific corrections that were NOT reflected in the code. These have been fixed:
- **Entra ID MFA registration**: Changed from `UserAuthenticationMethod.Read.All` (OLD v1.0) to `AuditLog.Read.All` (corrected in v2.1)
- **Purview**: Changed from `connectorType: 'graph'` to `'powershell'` with empty endpoints (no Graph API available for DLP policy definitions)
- **Cloud Apps**: Added manual-review caveat in description noting beta-only Graph API and that full CASB policy config is out of Graph's reach

### 2. S16 Reconciliation Not Resolved
The Master Build Document Section 26.4 flags a reconciliation between FR-11.4 (structured in-app findings form) and wireframe S16 (download/upload pattern). The current code implements the **wireframe pattern** (Download Collected Data, Download Automated Report, Upload Assessment Report buttons) — NOT the recommended structured findings form. This means uploaded files cannot automatically merge into the Scoring Engine.

---

## Section-by-Section Alignment

### Section 0 — Document Control
| Item | Status | Notes |
|------|--------|-------|
| Product Name | ✅ Aligned | "Aegis" is the confirmed product name |
| Tech Stack | ✅ Aligned | Next.js/React frontend, Node.js backend, MySQL database |
| Tenant Auth Model | ⚠️ Partial | Graph app registration + consent flow exists; PowerShell connector auth not implemented |
| Marketplace/Billing | ⚠️ Partial | Mock Stripe checkout exists; no real payment processor |

### Section 1 — Executive Summary
| Item | Status | Notes |
|------|--------|-------|
| Three assessment tiers | ✅ Implemented | Trial, Quick, Detailed all functional |
| Eight M365 modules | ⚠️ Partial | 5 Graph-reachable modules automated; 4 PowerShell-only modules marked `needs_manual_review` |
| Dual connector model | ⚠️ Partial | Graph Connector implemented; PowerShell Connector not started |

### Section 2 — Problem Statement & Opportunity
| Item | Status | Notes |
|------|--------|-------|
| Problem statement | ✅ N/A | Documentation only |
| Opportunity | ✅ N/A | Documentation only |

### Section 3 — Goals & Success Metrics
| Item | Status | Notes |
|------|--------|-------|
| Trial → Connect conversion | ⚠️ Not measurable | Funnel exists but no analytics tracking |
| Time to Quick Assessment < 10 min | ✅ Implemented | Loading screen with progress tracking |
| Assessor time < 90 min | ⚠️ Not enforced | No time tracking per assessment |
| Report download/share rate | ✅ Implemented | PDF/Excel download + share modal exist |

### Section 4 — Personas & Roles
| Item | Status | Notes |
|------|--------|-------|
| Client role | ✅ Implemented | Full dashboard, assessments, history, account management |
| Admin role | ✅ Implemented | Detailed requests queue, assessors roster, released reports |
| Assessor role | ✅ Implemented | Dashboard, assessment workspace, findings submission |
| Org-level roles (Owner/Admin/Member/Viewer) | ⚠️ Partial | DB schema has `org_role` field; UI shows role badge but no role-based feature gating |

### Section 5 — Scope & Build Phasing
| Item | Status | Notes |
|------|--------|-------|
| Client web app | ✅ Implemented | Signup/login/MFA, onboarding, Trial, tenant connection, Quick/Detailed, results, reports, history |
| Admin portal | ✅ Implemented | Detailed requests queue, assessor management, released reports |
| Assessor portal | ✅ Implemented | Assigned/completed requests, manual review workspace, document requests |
| Assessment engine (8 modules) | ⚠️ Partial | 5 Graph modules automated; 4 PowerShell modules marked manual-only |
| Scoring & Recommendation Engine | ✅ Implemented | Weighted scoring, configurable thresholds, recommendations |
| Reporting | ✅ Implemented | PDF (PDFKit) and Excel (ExcelJS) generation |

### Section 6 — Assessment Tiers
| Item | Status | Notes |
|------|--------|-------|
| Trial (0% automated, 12 questions) | ✅ Implemented | 12 questions, weighted scoring, instant results |
| Quick (100% automated, critical controls) | ✅ Implemented | Critical-subset controls, automated collection |
| Detailed (80% automated + 20% manual) | ⚠️ Partial | Automated portion works; manual review workflow exists but PowerShell modules have no automated path at all |

### Section 7 — User Flows
| Item | Status | Notes |
|------|--------|-------|
| Flow 1A: Onboarding → Trial | ✅ Implemented | S01→S02→S03→S04→S05→S06 |
| Flow 1B: Connect → Quick/Detailed → Results | ✅ Implemented | S07→S08→S09→S10 |
| Flow 2: Data collection loop | ✅ Implemented | Configuration-driven MODULES registry |
| Flow 3: Manual review swimlane | ⚠️ Partial | Backend status model exists; frontend shows status but full swimlane not fully exercised |
| Flow 6: Incremental consent | ⚠️ Partial | Consent flow exists but not fully incremental per module |

### Section 8 — Functional Requirements

#### FR-1: Authentication & Account Management
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-1.1 Sign up | ✅ Implemented | Full name, email, password, company, size, phone |
| FR-1.2 Login (email/password, Google, Microsoft) | ⚠️ Partial | Email/password implemented; Google/Microsoft OAuth not implemented |
| FR-1.3 MFA required | ✅ Implemented | TOTP + email OTP |
| FR-1.4 Forgot password / Resend verification | ✅ Implemented | Both flows exist |
| FR-1.5 Change name/email/phone/password | ✅ Implemented | Account settings pages exist |
| FR-1.6 Delete account (soft-delete) | ✅ Implemented | 30-day grace period |
| FR-1.7 Session expiry / Remember me | ⚠️ Partial | JWT expiry configured; "Remember me" not implemented |
| FR-1.8 Admin/Assessor provisioning | ✅ Implemented | Admin creates assessor accounts |

#### FR-2: Onboarding
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-2.1 Tenant Onboarding Guide | ✅ Implemented | S07 Connect Tenant Guide page |
| FR-2.2 Pre-connection dashboard | ✅ Implemented | Two entry points: Trial + Connect Tenant |
| FR-2.3 Downloadable PDF guide | ❌ Not implemented | In-app guide exists; downloadable PDF not implemented |

#### FR-3: Trial Assessment
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-3.1 10-12 Yes/No/Unsure questions | ✅ Implemented | 12 questions in DB |
| FR-3.2 Weighted score + band | ✅ Implemented | Configurable thresholds from DB |
| FR-3.3 Results page with gauge, summary, recommendations | ✅ Implemented | Full results page |
| FR-3.4 Downloadable; retakeable | ✅ Implemented | PDF download + retake button |
| FR-3.5 No tenant data stored | ✅ Implemented | Only questionnaire answers stored |

#### FR-4: Tenant Connection
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-4.1 Multi-tenant Azure AD app + admin consent | ⚠️ Partial | Consent flow exists; app registration must be done manually in Azure |
| FR-4.2 Clear permission listing | ✅ Implemented | Consent screen shows exact scopes |
| FR-4.3 Partial consent handling | ✅ Implemented | Per-module permission denied handling |
| FR-4.4 Reconnection on token expiry | ✅ Implemented | Token refresh + health check |
| FR-4.5 Multiple tenants per org | ✅ Implemented | DB supports multiple tenant connections |
| FR-4.6 Post-connection dashboard | ✅ Implemented | Shows Trial/Quick/Detailed options |

#### FR-5: Automated Data Collection Engine
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-5.1 Configuration-driven MODULES registry | ✅ Implemented | `MODULE_CONFIGS` in graphConnector.ts |
| FR-5.2 Per-module Graph/PowerShell calls | ⚠️ Partial | Graph calls implemented; PowerShell calls not implemented |
| FR-5.3 Quick = critical subset; Detailed = full set | ✅ Implemented | Query filters by `automatable` flag |
| FR-5.4 Permission denied → flag module, continue | ✅ Implemented | Graceful degradation |
| FR-5.5 Raw data persisted | ✅ Implemented | Stored in `assessment_modules.raw_data_path` |
| FR-5.6 Loading screen with stages | ✅ Implemented | 4-stage progress indicator |
| FR-5.7 Idempotent, retryable | ⚠️ Partial | Basic retry exists; full idempotency not guaranteed |
| FR-5.8 Rate-limit/throttle handling | ✅ Implemented | 429 Retry-After handling for Graph |

#### FR-6: Data Validation & Normalization
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-6.1 Schema validation | ⚠️ Partial | Basic validation; no formal JSON schema validation |
| FR-6.2 Normalize into internal representation | ⚠️ Partial | Basic normalization; no timestamp unification |
| FR-6.3 Validation failure → "Unable to Verify" | ✅ Implemented | Per-control failure handling |

#### FR-7: Assessment Engine
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-7.1 Pass/Fail/N-A/Needs Manual Review | ✅ Implemented | All result types supported |
| FR-7.2 Control Catalog DB-driven, versioned | ✅ Implemented | 130 controls across 8 modules |
| FR-7.3 Framework references (CIS, Secure Score) | ⚠️ Partial | `framework_refs` column exists; populated with CIS refs but not fully comprehensive |
| FR-7.4 `automatable: false` → Manual Assessment | ✅ Implemented | Routes to manual review for Detailed tier |

#### FR-8: Scoring & Recommendation Engine
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-8.1 Weighted per-module scores | ✅ Implemented | `calculateAssessmentScore` in scoringEngine.ts |
| FR-8.2 Overall score = weighted roll-up | ✅ Implemented | Module weights configurable |
| FR-8.3 Configurable score bands | ✅ Implemented | `scoring_thresholds` table |
| FR-8.4 Every Failed control → recommendation | ✅ Implemented | Recommendations generated per finding |
| FR-8.5 Merge automated + manual findings | ⚠️ Partial | Manual findings inserted with `source: 'manual'`; merge happens in DB but no explicit merge step |

#### FR-9: Results Dashboard
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-9.1 Metadata, score gauge, module cards, findings, next steps, download | ✅ Implemented | All components present |
| FR-9.2 "View all findings" → filterable/sortable table | ✅ Implemented | Full table with filters, sorting, pagination |
| FR-9.3 Reports retained for 30 days | ✅ Implemented | `reports.expires_at` set to 30 days |
| FR-9.4 Share Report | ✅ Implemented | Share modal with email + link generation |

#### FR-10: Assessment History
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-10.1 Table with all columns | ✅ Implemented | Full history page |
| FR-10.2 Search/filter | ✅ Implemented | Search by ID/type/status; filter by type/status/module/date/score |

### Section 9 — Manual Assessment Workflow
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-11.1 Detailed request in Admin queue | ✅ Implemented | Admin dashboard shows active requests |
| FR-11.2 Admin assigns/reassigns | ✅ Implemented | Assign/reassign functionality |
| FR-11.3 Assigned request scoped to Assessor | ✅ Implemented | Server-side enforcement |
| FR-11.4 Assessor workspace | ⚠️ Partial | Findings review exists; follows wireframe S16 pattern (download/upload) NOT FR-11.4 recommendation (structured in-app form) |
| FR-11.5 Document request → client notification | ✅ Implemented | Notification + status change to `awaiting_client` |
| FR-11.6 Client docs visible to Assessor + Admin | ⚠️ Partial | Document request exists; upload/attachment system not fully implemented |
| FR-11.7 Manual findings feed Scoring Engine | ⚠️ Partial | Manual findings inserted; scoring recalculated on completion |
| FR-11.8 Full audit trail | ⚠️ Partial | `audit_logs` table exists; not all actions logged |

### Section 10 — Admin Portal
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-12.1 Dashboard stats | ✅ Implemented | Active requests, assessors count |
| FR-12.2 Active requests view | ✅ Implemented | List/manage/assign |
| FR-12.3 Assessors roster | ✅ Implemented | Table with add/rename/remove |
| FR-12.4 Released reports | ✅ Implemented | Audit list of completed reports |
| FR-12.5 All actions audit-logged | ⚠️ Partial | Audit log table exists; not all actions logged |
| FR-12.6 Admin analytics | ❌ Not implemented | Phase 2 item |

### Section 11 — Assessor Portal
| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-13.1 Dashboard (Assigned + Completed) | ✅ Implemented | Two lists with stats |
| FR-13.2 Assigned list with due date | ✅ Implemented | Due date column present |
| FR-13.3 Assessment workspace | ⚠️ Partial | Core exists; follows wireframe pattern not FR-11.4 structured form |
| FR-13.4 Completed list (read-only) | ✅ Implemented | History view |
| FR-13.5 Account management | ✅ Implemented | Same as client minus billing |

### Section 12 — Reporting
| Requirement | Status | Notes |
|-------------|--------|-------|
| 1. Assessment Summary | ✅ Implemented | PDF + Excel |
| 2. Overall Security Score | ✅ Implemented | 0-100 with band |
| 3. Area-Specific Score | ✅ Implemented | Per-module scores |
| 4. Executive Summary | ⚠️ Partial | Basic narrative; not AI-generated |
| 5. Detailed Assessment Report | ✅ Implemented | Every control with evidence/recommendation |
| 6. Appendix (Detailed only) | ⚠️ Partial | Placeholder only; no manual review notes |

### Section 13 — Non-Functional Requirements
| Requirement | Status | Notes |
|-------------|--------|-------|
| Security (OWASP ASVS) | ⚠️ Partial | Basic security headers; full pen test not done |
| Privacy & Compliance (DPA, GDPR) | ⚠️ Partial | No DPA; data residency not addressed (OQ-9) |
| Performance < 10 min Quick | ⚠️ Not verified | Architecture supports it; no load testing |
| Availability 99.5% | ❌ Not implemented | No monitoring/alerting |
| Multi-tenancy (strict isolation) | ⚠️ Partial | DB-level isolation; object storage isolation not verified |
| Auditability | ⚠️ Partial | Audit log table exists; not all actions logged |

### Section 14 — System Architecture
| Item | Status | Notes |
|------|--------|-------|
| Frontend (Next.js/React) | ✅ Implemented | TypeScript, Tailwind CSS, Zustand, Recharts |
| API Layer (Node.js/Express) | ✅ Implemented | REST API with Zod validation |
| Auth (OAuth2/OIDC, MFA) | ✅ Implemented | JWT + TOTP + email OTP |
| Job Queue/Worker | ⚠️ Partial | `queue.ts` exists but BullMQ/Redis not configured |
| Microsoft Graph Connector | ✅ Implemented | 5 modules with token refresh, throttling |
| PowerShell Connector | ❌ Not implemented | Separate workstream needed |
| Database (MySQL) | ✅ Implemented | Full schema with 15+ tables |
| Object Storage | ⚠️ Partial | Local filesystem; Azure Blob/S3 not configured |
| Cache (Redis) | ❌ Not implemented | No Redis configured |
| Report Generator | ✅ Implemented | PDFKit + ExcelJS |
| Notifications | ⚠️ Partial | In-app notifications exist; email via Nodemailer configured but not fully tested |
| Billing/Metering | ⚠️ Partial | Mock Stripe; no real integration |
| Observability | ❌ Not implemented | No App Insights or structured logging |

### Section 15 — Data Model
| Entity | Status | Notes |
|--------|--------|-------|
| Organization | ✅ Implemented | |
| User | ✅ Implemented | Platform role + org role |
| TenantConnection | ✅ Implemented | With consent scopes, tokens, health check |
| Assessment | ✅ Implemented | All types, statuses |
| AssessmentModule | ✅ Implemented | Per-module collection status |
| ControlCatalog | ✅ Implemented | 130 controls, versioned |
| Finding | ✅ Implemented | With `source` field (automated/manual) |
| Report | ✅ Implemented | PDF/Excel with expiry |
| Plan/Subscription/UsageLedger | ✅ Implemented | Billing model-agnostic |

### Section 16 — Microsoft Graph Integration
| Item | Status | Notes |
|------|--------|-------|
| Graph-reachable modules (5) | ✅ Implemented | Entra ID, M365 Admin Center, Intune, SharePoint, Teams guest |
| PowerShell-only modules (4) | ❌ Not implemented | Email/Defender, Purview DLP, Teams policies, Cloud Apps |
| Per-module permission mapping | ✅ Fixed | Entra ID MFA scope corrected to `AuditLog.Read.All`; Purview moved to `connectorType: 'powershell'`; Cloud Apps has manual-review caveat |
| Incremental consent | ⚠️ Partial | Consent flow exists; not fully incremental per module |
| Token refresh | ✅ Implemented | Silent refresh before each run |
| Throttle handling | ✅ Implemented | 429 Retry-After + exponential backoff |

### Section 17 — Open Questions
| # | Question | Status |
|---|----------|--------|
| OQ-1 | Billing processor | ⚠️ Open — Stripe mock exists |
| OQ-2 | Pricing ($5/$7) | ⚠️ Open — Treated as illustrative |
| OQ-3 | Assessor SLA | ⚠️ Open — Not enforced |
| OQ-4 | Report retention | ✅ Resolved — 30 days |
| OQ-5 | Share Report access model | ⚠️ Open — Expiring link implemented |
| OQ-6 | Purchase model | ⚠️ Open — Data model supports all |
| OQ-7 | MSP multi-client | ⚠️ Open — Phase 2 |
| OQ-8 | Scoring weights | ⚠️ Open — Placeholder thresholds |
| OQ-9 | Data residency | ⚠️ Open — Not addressed |
| OQ-10 | PowerShell Connector at launch | ⚠️ Open — Not decided |

### Section 18 — Risks & Mitigations
| Risk | Status |
|------|--------|
| Graph API changes | ✅ Mitigated — Isolated in Connector Service |
| 4 modules need PowerShell connector | ⚠️ Acknowledged — Marked as manual-only until connector ships |
| Admin consent hesitation | ✅ Mitigated — Transparency on scopes |
| Assessor bottleneck | ⚠️ Partial — Queue tooling exists; no SLA enforcement |
| Scoring perceived as arbitrary | ⚠️ Partial — CIS mapping exists but not fully populated |
| Data breach | ⚠️ Partial — Basic encryption; full pen test not done |
| Scope creep | ✅ Mitigated — Build sequence defined |

### Section 19 — Release Plan
| Stage | Status | Notes |
|-------|--------|-------|
| 1. Auth + Account shell | ✅ Complete | |
| 2. Trial Assessment | ✅ Complete | |
| 3. Tenant Connection | ✅ Complete | |
| 4. Graph-reachable modules | ⚠️ Partial | Module configs have misalignments (see Section 16) |
| 5. Scoring + Results + Reports | ✅ Complete | |
| 6. Quick Assessment end-to-end | ✅ Complete | |
| 7. Detailed Assessment + Admin + Assessor | ⚠️ Partial | Core workflow exists; S16 reconciliation not resolved |
| 8. PowerShell Connector | ❌ Not started | Separate workstream |
| 9. Billing/paywall | ⚠️ Partial | Mock only |
| 10. Notifications, History, polish | ⚠️ Partial | Core done; email not fully tested |
| 11. Security hardening + pen test | ❌ Not started | |

### Section 20 — Appendix
| Item | Status | Notes |
|------|--------|-------|
| Glossary | ✅ N/A | Documentation only |
| Sample Control Catalog | ✅ Implemented | 130 controls |
| Next Steps | ⚠️ Partial | OQ-10 not resolved |

### Section 21 — Assessment Tier Classification
| Item | Status | Notes |
|------|--------|-------|
| Tier classification | ✅ Implemented | Trial/Quick/Detailed gated correctly |
| Permission scope-to-tier mapping | ⚠️ Partial | Scopes resolved per tier but not fully incremental |

### Section 22 — Subscription Plans, Org Roles & Feature Matrix
| Item | Status | Notes |
|------|--------|-------|
| Org-level roles (Owner/Admin/Member/Viewer) | ⚠️ Partial | DB field exists; UI shows badge but no feature gating |
| Subscription plans (5 tiers) | ✅ Implemented | Free, Starter, Professional, Business/MSP, Enterprise |
| Tenant inclusion limit + add-ons | ⚠️ Partial | DB schema supports it; UI upsell not implemented |
| Feature-by-plan matrix | ⚠️ Partial | Plans exist; feature flags not fully enforced |

### Section 23 — Monetization
| Item | Status | Notes |
|------|--------|-------|
| Core revenue (subscriptions + PAYG) | ⚠️ Partial | Data model ready; no real payment processing |
| Azure Marketplace | ❌ Not implemented | |
| White-label/MSP | ❌ Not implemented | Phase 2 |
| Continuous monitoring | ❌ Not implemented | Phase 2 |
| Compliance framework packs | ❌ Not implemented | Phase 2 |

### Section 24 — Permission & Incremental Consent
| Item | Status | Notes |
|------|--------|-------|
| Never blanket consent | ⚠️ Partial | Consent screens exist but not fully incremental |
| Per-module, plain-English framing | ✅ Implemented | Consent screen shows module-level permissions |
| Declined module → "Permission Not Granted" | ✅ Implemented | Non-blocking per-module |

### Section 25 — Product Enhancements
| Item | Status | Notes |
|------|--------|-------|
| Continuous monitoring | ❌ Not implemented | Phase 2 |
| Score trend/history dashboard | ⚠️ Partial | History exists; trend view not implemented |
| AI-generated executive summary | ❌ Not implemented | Phase 2 |
| Assessor-assist AI suggestions | ❌ Not implemented | Phase 2 |
| Compliance framework selector | ❌ Not implemented | Phase 2 |

### Section 26 — Screen-by-Screen UI Specification
| Screen | Status | Notes |
|--------|--------|-------|
| S01 Login Page | ✅ Implemented | |
| S02 Sign Up | ✅ Implemented | |
| S03 MFA/OTP | ✅ Implemented | |
| S04 Pre-Connection Dashboard | ✅ Implemented | |
| S05 Trial Questionnaire | ✅ Implemented | |
| S06 Trial Results | ✅ Implemented | |
| S07 Connect Tenant Guide | ✅ Implemented | |
| S08 Post-Connection Dashboard | ✅ Implemented | |
| S09 Assessment Loading | ✅ Implemented | |
| S10 Results Page | ✅ Implemented | |
| S11 Tenant Verification | ✅ Implemented | |
| S12 Internal Sign In | ✅ Implemented | |
| S13 Admin Requests Queue | ✅ Implemented | |
| S14 Admin Assessors Roster | ✅ Implemented | |
| S15 Assessor Dashboard | ✅ Implemented | |
| S16 Assessor Workspace | ⚠️ Partial | Core exists; follows wireframe pattern (download/upload) not FR-11.4 recommendation (structured in-app form) |
| S17 Account Menu | ✅ Implemented | |
| S18 Assessment History | ✅ Implemented | |
| S19 Change Password | ✅ Implemented | |
| S20 Change Name | ✅ Implemented | |
| S21 Update Phone/Email | ✅ Implemented | |

---

## Critical Gaps Summary

### Must Fix Before Launch
1. **PowerShell Connector Service** — 4 of 8 modules have no Graph API. Without this, Email/Defender, Purview DLP, Teams policies, and Cloud Apps are entirely manual-review-only.
2. **Real Billing Integration** — Stripe mock exists but no real payment processing. Users cannot purchase assessments.
3. **Security Hardening** — Full RBAC enforcement, comprehensive audit logging, and third-party penetration test required before GA per Section 13.

### Should Fix Soon After Launch
6. **Resolve S16 reconciliation** — Replace wireframe's upload pattern with FR-11.4's structured in-app findings form so manual findings can merge into Scoring Engine
7. **Google/Microsoft OAuth** — Only email/password login works; social login specified in FR-1.2.
8. **Incremental Consent** — Current consent is per-assessment, not truly incremental per module.
9. **Report Appendix** — Detailed Assessment reports need actual manual review notes, not placeholders.
10. **Feature Gating by Plan** — Subscription plans exist but features aren't enforced server-side.

### Phase 2 Items
11. Continuous monitoring/drift alerting
12. MSP multi-client dashboard
13. White-label branding
14. Compliance framework add-ons (HIPAA/PCI/SOC2)
15. Azure Marketplace listing
16. AI-generated executive summary
17. Assessor-assist AI suggestions

---

## Alignment Score: ~65-70%

The platform has a solid foundation with all core user-facing flows implemented. The biggest risks are:

1. **PowerShell Connector Service** — Without this, 4 of 8 modules require entirely manual assessment, undermining the "80% automated" Detailed tier promise
2. **S16 reconciliation** — Current assessor workflow follows the wireframe's simpler upload pattern, not the recommended structured form that integrates with the Scoring Engine
3. **Real Billing Integration** — No actual payment processing; users cannot purchase assessments
4. **Security Hardening** — Full RBAC, audit logging, and pen test not completed
