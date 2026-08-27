# Velocyverse - Microsoft 365 Security Assessment Platform

Velocyverse is a comprehensive Microsoft 365 security posture assessment platform that provides automated security assessments, scoring, and reporting for M365 tenants.

## Architecture

### Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Zustand, Recharts
- **Backend**: Node.js, Express, TypeScript, MySQL, BullMQ, Redis
- **Authentication**: JWT, MSAL Node (Microsoft Graph OAuth)
- **Reports**: PDFKit, ExcelJS

### Monorepo Structure
```
aegis/
├── frontend/          # Next.js frontend application
├── backend/           # Express.js backend API
├── shared/            # Shared TypeScript types and interfaces
└── package.json       # Root package.json with workspaces
```

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Redis (for BullMQ)
- Azure AD App Registration (for Microsoft Graph integration)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**

   Copy `backend/.env.example` to `backend/.env` and configure:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=aegis_np

   # JWT
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRY=7d

   # Azure AD / Microsoft Graph
   AZURE_TENANT_ID=your-tenant-id
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   AZURE_REDIRECT_URI=http://localhost:3001/auth/callback

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Email (Nodemailer)
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-email-password

   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

3. **Set up database**
   ```bash
   cd backend
   npx tsx src/db/migrate.ts
   npx tsx src/db/seed.ts
   npx tsx src/db/seed-controls.ts
   ```

4. **Start Redis**
   ```bash
   redis-server
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts both frontend (port 3000) and backend (port 3001).

## Azure AD Configuration

### Multi-Tenant App Registration Setup

This application uses a multi-tenant Azure AD app registration to connect to customer Microsoft 365 tenants.

#### Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name**: `Velocyverse` (or your preferred name)
   - **Supported account types**: `Accounts in any organizational directory (Any Azure AD directory - Multitenant)`
   - **Redirect URI**: `http://localhost:3001/auth/callback` (for development)
   - **Production Redirect URI**: `https://your-domain.com/auth/callback`

#### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions (all are read-only):

| Permission | Purpose |
|------------|---------|
| `User.Read` | Read user profile information |
| `Directory.Read.All` | Read directory data (users, groups, roles) |
| `Group.Read.All` | Read group memberships |
| `Policy.Read.All` | Read authentication and conditional access policies |
| `RoleManagement.Read.Directory` | Read role assignments |
| `UserAuthenticationMethod.Read.All` | Read MFA methods |
| `Organization.Read.All` | Read organization settings |
| `SecurityEvents.Read.All` | Read security alerts and events |
| `InformationProtectionPolicy.Read.All` | Read DLP and sensitivity labels |
| `DeviceManagementConfiguration.Read.All` | Read Intune device configurations |
| `DeviceManagementManagedDevices.Read.All` | Read managed device status |
| `TeamSettings.Read.All` | Read Teams settings |
| `Sites.Read.All` | Read SharePoint sites |
| `SharePointTenantSettings.Read.All` | Read SharePoint tenant settings |

4. Click **Grant admin consent for [Your Organization]**

#### Step 3: Create Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Add a description and set expiry
3. **Copy the secret value immediately** - you won't be able to see it again
4. Add to your `.env` file:
   ```env
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   AZURE_TENANT_ID=your-tenant-id
   AZURE_REDIRECT_URI=http://localhost:3001/auth/callback
   ```

#### Step 4: Configure Redirect URIs

Add the following redirect URIs in **Authentication** → **Platform configurations**:

**Development:**
- `http://localhost:3001/auth/callback`
- `http://localhost:3000/auth/callback`

**Production:**
- `https://your-domain.com/auth/callback`
- `https://www.your-domain.com/auth/callback`

#### Step 5: Token Configuration (Optional but Recommended)

1. Go to **Token configuration** → **Add optional claim**
2. Add `email` and `upn` claims for better user identification

### Incremental Consent Strategy

The application uses incremental consent to request permissions per module:

1. **Tier Assessment**: Zero Graph permissions required
2. **Quick Assessment**: Critical-subset scopes only (Entra ID, M365 Admin Center, Email)
3. **Detailed Assessment**: Full scope set, requested per module

Users can select which modules to include, and only the scopes for selected modules are requested.

### Consent Denial Handling

If a user denies consent for specific modules:
- The affected module is marked as "Permission Not Granted"
- The assessment continues for remaining modules
- Users can retry consent for specific modules from the dashboard

### Token Refresh & Revocation

- Access tokens are cached and refreshed automatically using refresh tokens
- Token refresh happens silently before each data collection run
- If refresh fails (token revoked/expired), the connection is marked as "Needs Attention"
- Users are prompted to reconnect from the Tenant Connection Verification page

## Security Features

### Implemented Security Measures

1. **Authentication & Authorization**
   - JWT-based authentication with secure token storage
   - Role-based access control (client, admin, assessor)
   - MSAL integration for Microsoft Graph OAuth flows
   - Encrypted token storage (AES-256-GCM)

2. **Rate Limiting**
   - General API: 100 requests per 15 minutes
   - Auth endpoints: 5 requests per 15 minutes
   - Assessment endpoints: 10 requests per minute

3. **Input Validation**
   - Zod schema validation for all inputs
   - XSS prevention via input sanitization
   - Parameter pollution prevention

4. **Security Headers**
   - Helmet.js for security headers
   - CSP (Content Security Policy)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff

5. **Database Security**
   - Parameterized queries to prevent SQL injection
   - Encrypted sensitive data storage
   - Foreign key constraints for data integrity

### Penetration Test Preparation

#### Areas to Test

1. **Authentication**
   - Test JWT token validation
   - Test role-based access control
   - Test session management
   - Test password reset flows

2. **Authorization**
   - Test horizontal privilege escalation (user A accessing user B's data)
   - Test vertical privilege escalation (client accessing admin endpoints)
   - Test resource ownership validation

3. **Input Validation**
   - Test SQL injection in all endpoints
   - Test XSS in user inputs
   - Test CSRF tokens
   - Test file upload validation (if implemented)

4. **API Security**
   - Test rate limiting effectiveness
   - Test CORS configuration
   - Test HTTP method enforcement
   - Test error message information disclosure

5. **Data Protection**
   - Test sensitive data encryption at rest
   - Test data exposure in API responses
   - Test audit logging completeness

#### Test Credentials
```
Email: test@example.com
Password: password123
Role: client
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/oauth` - OAuth login

### Assessments
- `GET /api/assessments/history` - Get assessment history
- `GET /api/assessments/:id` - Get assessment details
- `GET /api/assessments/:id/modules` - Get assessment modules
- `GET /api/assessments/:id/findings` - Get assessment findings
- `POST /api/assessments/trial/start` - Start trial assessment
- `POST /api/assessments/trial/:id/submit` - Submit trial assessment
- `POST /api/assessments/:type/start` - Start quick/detailed assessment
- `GET /api/assessments/trial/questions` - Get trial questions

### Tenants
- `GET /api/tenants` - Get tenant connections
- `POST /api/tenants/connect` - Initiate tenant connection
- `GET /api/tenants/callback` - OAuth callback
- `POST /api/tenants/verify/:id` - Verify tenant connection
- `DELETE /api/tenants/:id` - Disconnect tenant

### Reports
- `GET /api/reports/:id/pdf` - Generate PDF report
- `GET /api/reports/:id/excel` - Generate Excel report
- `GET /api/reports/assessment/:assessmentId` - Get reports list

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/requests` - Get detailed assessment requests
- `POST /api/admin/requests/:id/assign` - Assign assessor
- `GET /api/admin/assessors` - Get assessors
- `POST /api/admin/assessors` - Add assessor
- `DELETE /api/admin/assessors/:id` - Remove assessor

### Assessor
- `GET /api/assessor/dashboard` - Assessor dashboard
- `GET /api/assessor/assessment/:id` - Get assessment details
- `POST /api/assessor/assessment/:id/findings` - Submit findings
- `POST /api/assessor/assessment/:id/request-docs` - Request documents

### Billing
- `GET /api/billing/subscription` - Get current subscription
- `GET /api/billing/plans` - Get available plans
- `GET /api/billing/usage` - Get usage ledger
- `POST /api/billing/upgrade` - Upgrade subscription
- `POST /api/billing/cancel` - Cancel subscription
- `GET /api/billing/history` - Get billing history

## Database Schema

### Core Tables
- `organizations` - Organization/tenant information
- `users` - User accounts with role-based access
- `tenant_connections` - Microsoft 365 tenant connections
- `subscriptions` - Subscription plans and billing
- `usage_ledger` - Usage tracking for billing

### Assessment Tables
- `assessments` - Assessment records
- `assessment_modules` - Per-module assessment data
- `control_catalog` - Security control definitions
- `findings` - Assessment findings/results
- `reports` - Generated reports

### Detailed Assessment Tables
- `detailed_assessment_requests` - Manual review requests
- `assessors` - Assessor profiles

### Supporting Tables
- `trial_questionnaires` - Trial assessment questions
- `trial_answers` - Trial assessment answers
- `subscription_plans` - Available subscription plans
- `audit_log` - Audit trail
- `notifications` - User notifications

## Assessment Modules

1. **Entra ID** - Identity and access management
2. **M365 Admin Center** - Admin center configuration
3. **Purview** - Data governance and compliance
4. **Email** - Exchange Online security
5. **Intune** - Device management
6. **Cloud Apps** - Cloud App Security
7. **Teams** - Teams security settings
8. **SharePoint** - SharePoint security

## Scoring Engine

- Weighted scoring based on control severity
- Per-module and overall scores
- Score bands: Poor (<40), Fair (40-69), Good (70-89), Excellent (90+)
- Automated and manual finding sources

## Known Limitations

1. **MSAL Integration**: Currently uses mock tokens for development. Real Microsoft Graph integration requires Azure AD app registration.
2. **Control Catalog**: 61 controls implemented. Full catalog should have 312+ controls.
3. **Payment Processing**: Billing endpoints are implemented but payment gateway integration (Stripe/PayPal) is not included.
4. **Worker Process**: BullMQ worker runs in the same process. For production, run as a separate process.
5. **File Storage**: Reports are stored locally. Production should use S3 or similar.

## Production Deployment

### Environment Variables
- Use strong JWT secrets (64+ characters)
- Enable HTTPS only
- Configure proper CORS origins
- Set up email service (SMTP or SendGrid)
- Configure Redis for production
- Set up database backups

### Recommended Stack
- **Hosting**: AWS, Azure, or GCP
- **Database**: RDS or Cloud SQL with automated backups
- **Cache**: ElastiCache or Cloud Memorystore
- **Storage**: S3 or Azure Blob Storage
- **Monitoring**: Application Insights or CloudWatch
- **CI/CD**: GitHub Actions or Azure DevOps

## License

Proprietary - All rights reserved
