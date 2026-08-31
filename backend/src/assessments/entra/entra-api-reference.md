# Entra ID Assessment - Graph API Commands Reference

This document lists all Microsoft Graph API endpoints used during the Entra ID security assessment.

## Base URL
```
https://graph.microsoft.com/v1.0
```

## Authentication
- **Method**: Client Credentials Flow (OAuth 2.0)
- **Scope**: `https://graph.microsoft.com/.default`
- **Token URL**: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`

---

## Quick Assessment Controls

The following controls are evaluated during a quick assessment:

### Authentication & MFA Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| 1 | All users required to perform MFA (Security Defaults or CA) | `/policies/identitySecurityDefaultsEnforcementPolicy`, `/identity/conditionalAccess/policies` | Policy.Read.All |
| 2 | MFA enforced for privileged users | `/identity/conditionalAccess/policies`, `/directoryRoles` | Policy.Read.All, RoleManagement.Read.Directory |
| 3 | Legacy authentication blocked | `/identity/conditionalAccess/policies` | Policy.Read.All |
| 4 | Self-Service Password Reset (SSPR) enabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| 5 | Password Protection Smart Lockout configured | `/policies/authenticationMethodsPolicy` | Policy.Read.All |

### Conditional Access Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| 6 | Conditional Access policies configured | `/identity/conditionalAccess/policies` | Policy.Read.All |
| 7 | CA requires MFA for administrators | `/identity/conditionalAccess/policies` | Policy.Read.All |
| 8 | CA requires MFA for high-risk sign-ins | `/identity/conditionalAccess/policies` | Policy.Read.All |
| 9 | High user risk requires password reset | `/identity/conditionalAccess/policies` | Policy.Read.All |
| 10 | Access from high-risk locations blocked | `/identity/conditionalAccess/policies`, `/identity/conditionalAccess/namedLocations` | Policy.Read.All |
| 11 | Token Protection enabled | `/identity/conditionalAccess/policies` | Policy.Read.All |

### Privileged Access Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| 12 | Privileged Identity Management (PIM) enabled | `/roleManagement/directory/roleEligibilitySchedules` | RoleManagement.Read.Directory |
| 13 | Just-In-Time (JIT) activation configured | `/roleManagement/directory/roleAssignmentSchedules` | RoleManagement.Read.Directory |
| 14 | PIM activation requires MFA | `/policies/roleManagementPolicies?$count=true&$top=999` | RoleManagement.Read.Directory | ConsistencyLevel: eventual |
| 15 | Global Administrator accounts <= 5 | `/directoryRoles`, `/directoryRoles/{roleId}/members` | RoleManagement.Read.Directory |

### Identity Governance Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| 16 | Guest accounts follow least privilege | `/users?$filter=userType eq 'Guest'`, `/directoryRoles` | User.Read.All, RoleManagement.Read.Directory |
| 17 | Cloud-native administrator accounts used | `/users`, `/directoryRoles/{roleId}/members` | User.Read.All, RoleManagement.Read.Directory |
| 18 | Access Reviews configured for privileged roles | `/identityGovernance/accessReviews/definitions` | AccessReview.Read.All |

---

## Quick Assessment Informational Controls

The following informational controls are included in quick assessment - they display tenant information without pass/fail evaluation:

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| QI1 | Total number of users | `/users?$count=true` | User.Read.All |
| QI2 | Total number of guest users | `/users?$filter=userType eq 'Guest'&$count=true` | User.Read.All |
| QI3 | Total number of Microsoft 365 Groups | `/groups?$filter=groupTypes/any(c:c eq 'Unified')&$count=true` | GroupMember.Read.All |
| QI4 | Total number of licensed users | `/users?$filter=assignedLicenses/$count ne 0&$count=true` | User.Read.All |
| QI5 | Total number of unlicensed users | `/users?$filter=assignedLicenses/$count eq 0&$count=true` | User.Read.All |
| QI6 | Total number of Administrative Units | `/directory/administrativeUnits?$count=true&$top=999` | AdministrativeUnit.Read.All | ConsistencyLevel: eventual |
| QI7 | Total number of risky users | `/identityProtection/riskDetections?$filter=riskState eq 'atRisk'&$count=true` | IdentityRiskEvent.Read.All |
| QI8 | Total number of privileged administrator accounts | `/directoryRoles` + `/directoryRoles/{roleId}/members` | RoleManagement.Read.Directory |
| QI9 | Total number of Conditional Access policies | `/identity/conditionalAccess/policies?$count=true` | Policy.Read.All |
| QI10 | Total number of users protected by MFA | `/reports/authenticationMethods/userRegistrationDetails` | UserAuthenticationMethod.Read.All |
| QI11 | Total number of users without MFA | `/reports/authenticationMethods/userRegistrationDetails` | UserAuthenticationMethod.Read.All |
| QI12 | List of Conditional Access policies and configurations | `/identity/conditionalAccess/policies` | Policy.Read.All |
| QI13 | Current Microsoft Entra Identity Secure Score | `/security/secureScores?$top=1` | SecurityEvents.Read.All |

---

## Detailed Assessment Controls

The following additional controls are evaluated during a detailed assessment (not included in quick assessment):

### Authentication & MFA Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| D1 | Microsoft Authenticator enabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| D2 | FIDO2 Security Keys enabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| D3 | Passkeys (FIDO2) enabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| D4 | Temporary Access Pass (TAP) enabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| D5 | SMS Authentication disabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| D6 | Voice Call Authentication disabled | `/policies/authenticationMethodsPolicy` | Policy.Read.All |

### Conditional Access Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| D7 | Named Locations configured | `/identity/conditionalAccess/namedLocations` | Policy.Read.All |
| D8 | Sign-in frequency session controls configured | `/identity/conditionalAccess/policies` | Policy.Read.All |

### Access Review Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| D9 | Access Review for guest users configured | `/identityGovernance/accessReviews/definitions` | AccessReview.Read.All |
| D10 | Access Reviews have recurring schedule | `/identityGovernance/accessReviews/definitions` | AccessReview.Read.All |
| D11 | Access Reviews have reminder notifications | `/identityGovernance/accessReviews/definitions` | AccessReview.Read.All |
| D12 | Non-responders automatically handled | `/identityGovernance/accessReviews/definitions` | AccessReview.Read.All |

### Monitoring & Logging Controls

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| D13 | Sign-in logs available | `/auditLogs/signIns?$top=1` | AuditLog.Read.All |
| D14 | Directory audit logs available | `/auditLogs/directoryAudits?$top=1` | AuditLog.Read.All |
| D15 | Provisioning logs available | `/auditLogs/provisioning?$top=1` | AuditLog.Read.All |
| D16 | Identity Protection risk detections available | `/identityProtection/riskDetections?$top=1` | IdentityRiskEvent.Read.All |

---

## Informational Controls (Detailed Assessment Only)

The following controls are informational only - they display tenant information without pass/fail evaluation:

### User & Group Information

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| I1 | Total number of users | `/users?$count=true` | User.Read.All |
| I2 | Total number of member users | `/users?$filter=userType eq 'Member'&$count=true` | User.Read.All |
| I3 | Total number of guest users | `/users?$filter=userType eq 'Guest'&$count=true` | User.Read.All |
| I4 | Total number of Microsoft 365 Groups | `/groups?$filter=groupTypes/any(c:c eq 'Unified')&$count=true` | GroupMember.Read.All |
| I5 | Total number of Dynamic Microsoft 365 Groups | `/groups?$filter=groupTypes/any(c:c eq 'Unified') and membershipRule ne null&$count=true` | GroupMember.Read.All |
| I6 | Total number of Device Groups | `/groups?$filter=securityEnabled eq true and mailEnabled eq false&$count=true` | GroupMember.Read.All |
| I7 | Total number of licensed users | `/users?$filter=assignedLicenses/$count ne 0&$count=true` | User.Read.All |
| I8 | Total number of unlicensed users | `/users?$filter=assignedLicenses/$count eq 0&$count=true` | User.Read.All |
| I9 | Total number of active users | `/users?$filter=accountEnabled eq true&$count=true` | User.Read.All |
| I10 | Total number of inactive (disabled) users | `/users?$filter=accountEnabled eq false&$count=true` | User.Read.All |
| I11 | Total number of licensed inactive users | `/users?$filter=accountEnabled eq false and assignedLicenses/$count ne 0&$count=true` | User.Read.All |

### Administrative & Security Information

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| I12 | Total number of Administrative Units | `/administrativeUnits?$count=true` | AdministrativeUnit.Read.All |
| I13 | Total number of risky users | `/identityProtection/riskDetections?$filter=riskState eq 'atRisk'&$count=true` | IdentityRiskEvent.Read.All |
| I14 | Total number of risky sign-ins | `/auditLogs/signIns?$filter=riskState eq 'atRisk'&$count=true` | AuditLog.Read.All |
| I15 | Total number of privileged administrator accounts | `/directoryRoles` + `/directoryRoles/{roleId}/members` | RoleManagement.Read.Directory |
| I16 | List of administrator roles and assigned users | `/directoryRoles` + `/directoryRoles/{roleId}/members` | RoleManagement.Read.Directory |
| I17 | Total number of Conditional Access policies | `/identity/conditionalAccess/policies?$count=true` | Policy.Read.All |
| I18 | Total number of users protected by MFA | `/reports/authenticationMethods/userRegistrationDetails` | UserAuthenticationMethod.Read.All |
| I19 | Total number of users without MFA | `/reports/authenticationMethods/userRegistrationDetails` | UserAuthenticationMethod.Read.All |
| I20 | Total number of privileged users without MFA | `/reports/authenticationMethods/userRegistrationDetails` + `/directoryRoles` | UserAuthenticationMethod.Read.All, RoleManagement.Read.Directory |

### Application Information

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| I21 | Total number of App Registrations | `/applications?$count=true` | Application.Read.All |
| I22 | Total number of Enterprise Applications | `/servicePrincipals?$count=true` | Application.Read.All |
| I23 | Total number of Enterprise Applications using SSO | `/servicePrincipals?$filter=ssoUrl ne null&$count=true&$top=999` | Application.Read.All | ConsistencyLevel: eventual |
| I24 | Total number of application credentials nearing expiration | `/applications` | Application.Read.All |

### Configuration Information

| # | Control | Endpoints Used | Required Permission |
|---|---------|----------------|---------------------|
| I25 | List of Conditional Access policies and configurations | `/identity/conditionalAccess/policies` | Policy.Read.All |
| I26 | Authentication methods configured in the tenant | `/policies/authenticationMethodsPolicy` | Policy.Read.All |
| I27 | Current Microsoft Entra Identity Secure Score | `/secureScores?$top=1` | SecurityEvents.Read.All |

---

## Quick Assessment Endpoints

For quick assessments, only these endpoints are called:

| # | Endpoint | Method | Purpose | Required Permission |
|---|----------|--------|---------|---------------------|
| 1 | `/policies/authenticationMethodsPolicy` | GET | Get MFA/SSPR policy and lockout settings | Policy.Read.All |
| 2 | `/policies/identitySecurityDefaultsEnforcementPolicy` | GET | Check if Security Defaults is enabled | Policy.Read.All |
| 3 | `/identity/conditionalAccess/policies` | GET | List all Conditional Access policies | Policy.Read.All |
| 4 | `/identity/conditionalAccess/namedLocations` | GET | List named locations for CA policies | Policy.Read.All |
| 5 | `/directoryRoles` | GET | List all directory roles | RoleManagement.Read.Directory |
| 6 | `/directoryRoles/{roleId}/members` | GET | Get members of specific roles | RoleManagement.Read.Directory |
| 7 | `/roleManagement/directory/roleEligibilitySchedules` | GET | Get PIM role eligibility schedules | RoleManagement.Read.Directory |
| 8 | `/roleManagement/directory/roleAssignmentSchedules` | GET | Get PIM role assignment schedules | RoleManagement.Read.Directory |
| 9 | `/policies/roleManagementPolicies?$count=true&$top=999` | GET | Get role management policies | RoleManagement.Read.Directory | ConsistencyLevel: eventual |
| 10 | `/users?$filter=userType eq 'Guest'` | GET | List guest users | User.Read.All |
| 11 | `/identityGovernance/accessReviews/definitions` | GET | List access review definitions | AccessReview.Read.All |

---

## Detailed Assessment Endpoints

For detailed assessments, additional endpoints are called beyond the quick assessment endpoints:

| # | Endpoint | Method | Purpose | Required Permission |
|---|----------|--------|---------|---------------------|
| 12 | `/reports/authenticationMethods/userRegistrationDetails` | GET | Get user MFA registration status | UserAuthenticationMethod.Read.All |
| 13 | `/auditLogs/signIns?$top=1` | GET | Check sign-in logs accessibility | AuditLog.Read.All |
| 14 | `/auditLogs/directoryAudits?$top=1` | GET | Check directory audit logs | AuditLog.Read.All |
| 15 | `/auditLogs/provisioning?$top=1` | GET | Check provisioning logs | AuditLog.Read.All |
| 16 | `/identityProtection/riskDetections?$top=1` | GET | Check Identity Protection | IdentityRiskEvent.Read.All |
| 17 | `/users?$count=true` | GET | Count all users | User.Read.All |
| 18 | `/users?$filter=userType eq 'Member'&$count=true` | GET | Count member users | User.Read.All |
| 19 | `/users?$filter=userType eq 'Guest'&$count=true` | GET | Count guest users | User.Read.All |
| 20 | `/users?$filter=assignedLicenses/$count ne 0&$count=true` | GET | Count licensed users | User.Read.All |
| 21 | `/users?$filter=assignedLicenses/$count eq 0&$count=true` | GET | Count unlicensed users | User.Read.All |
| 22 | `/users?$filter=accountEnabled eq true&$count=true` | GET | Count active users | User.Read.All |
| 23 | `/users?$filter=accountEnabled eq false&$count=true` | GET | Count inactive users | User.Read.All |
| 24 | `/groups?$filter=groupTypes/any(c:c eq 'Unified')&$count=true` | GET | Count M365 Groups | GroupMember.Read.All |
| 25 | `/directory/administrativeUnits?$count=true&$top=999` | GET | Count Administrative Units | AdministrativeUnit.Read.All | ConsistencyLevel: eventual |
| 26 | `/applications?$count=true` | GET | Count App Registrations | Application.Read.All |
| 27 | `/servicePrincipals?$count=true` | GET | Count Enterprise Applications | Application.Read.All |
| 28 | `/secureScores?$top=1` | GET | Get Identity Secure Score | SecurityEvents.Read.All |

---

## API Response Examples

### GET /policies/authenticationMethodsPolicy
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#policies/authenticationMethodsPolicy",
  "policyMigrationState": "migrationComplete",
  "registrationEnforcement": {
    "authenticationMethodsRegistrationCampaign": {
      "state": "default",
      "includeTargets": [],
      "excludeTargets": []
    }
  },
  "reportSuspiciousActivitySettings": {
    "state": "default"
  },
  "authenticationMethodConfigurations": [
    {
      "@odata.type": "#microsoft.graph.smsAuthenticationMethodConfiguration",
      "id": "Sms",
      "state": "enabled",
      "includeTargets": [
        {
          "targetType": "group",
          "id": "all_users"
        }
      ]
    }
  ]
}
```

### GET /policies/identitySecurityDefaultsEnforcementPolicy
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#policies/identitySecurityDefaultsEnforcementPolicy",
  "id": "SecurityDefaults",
  "displayName": "Security Defaults",
  "description": "Basic security settings recommended by Microsoft.",
  "isEnabled": true
}
```

### GET /identity/conditionalAccess/policies
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#identity/conditionalAccess/policies",
  "value": [
    {
      "id": "policy-guid-here",
      "displayName": "Require MFA for all users",
      "createdDateTime": "2024-01-15T10:00:00Z",
      "modifiedDateTime": "2024-01-15T10:00:00Z",
      "state": "enabled",
      "conditions": {
        "applications": {
          "includeApplications": ["All"]
        },
        "users": {
          "includeUsers": ["All"],
          "excludeUsers": []
        },
        "clientAppTypes": ["all"]
      },
      "grantControls": {
        "operator": "OR",
        "builtInControls": ["mfa"]
      }
    }
  ]
}
```

### GET /identity/conditionalAccess/namedLocations
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#identity/conditionalAccess/namedLocations",
  "value": [
    {
      "id": "location-guid",
      "displayName": "Corporate Network",
      "ipRanges": [
        {
          "@odata.type": "#microsoft.graph.iPv4CidrRange",
          "cidrAddress": "10.0.0.0/8"
        }
      ],
      "isTrusted": true
    }
  ]
}
```

### GET /directoryRoles
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#directoryRoles",
  "value": [
    {
      "id": "role-guid",
      "displayName": "Global Administrator",
      "roleTemplateId": "62e90394-69f5-4237-9190-012177145e10",
      "description": "Can manage all aspects of Azure AD and Microsoft services."
    }
  ]
}
```

### GET /directoryRoles/{roleId}/members
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#directoryRoles/members",
  "value": [
    {
      "id": "user-guid",
      "displayName": "Admin User",
      "userPrincipalName": "admin@contoso.com",
      "mail": "admin@contoso.com"
    }
  ]
}
```

### GET /roleManagement/directory/roleEligibilitySchedules
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#roleManagement/directory/roleEligibilitySchedules",
  "value": [
    {
      "id": "schedule-guid",
      "roleDefinitionId": "62e90394-69f5-4237-9190-012177145e10",
      "principalId": "user-guid",
      "directoryScopeId": "/",
      "memberType": "Direct",
      "status": "Provisioned"
    }
  ]
}
```

### GET /roleManagement/directory/roleAssignmentSchedules
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#roleManagement/directory/roleAssignmentSchedules",
  "value": [
    {
      "id": "schedule-guid",
      "roleDefinitionId": "62e90394-69f5-4237-9190-012177145e10",
      "principalId": "user-guid",
      "directoryScopeId": "/",
      "memberType": "Direct",
      "status": "Provisioned",
      "startDateTime": "2024-01-15T10:00:00Z",
      "endDateTime": "2024-01-16T10:00:00Z"
    }
  ]
}
```

### GET /policies/roleManagementPolicies
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#policies/roleManagementPolicies",
  "value": [
    {
      "id": "policy-guid",
      "displayName": "Global Administrator",
      "roleDefinitionId": "62e90394-69f5-4237-9190-012177145e10",
      "rules": [
        {
          "@odata.type": "#microsoft.graph.unifiedRoleManagementPolicyExpirationRule",
          "id": "Expiration_Admin_Eligibility",
          "isExpirationRequired": true,
          "maximumDuration": "P365D"
        },
        {
          "@odata.type": "#microsoft.graph.unifiedRoleManagementPolicyEnablementRule",
          "id": "Enablement_Admin_Eligibility",
          "enabledRules": ["Mfa"]
        }
      ]
    }
  ]
}
```

### GET /users?$filter=userType eq 'Guest'
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users",
  "value": [
    {
      "id": "user-guid",
      "displayName": "Guest User",
      "userPrincipalName": "guest_external.com#EXT#@contoso.com",
      "userType": "Guest",
      "mail": "guest@external.com",
      "createdDateTime": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### GET /identityGovernance/accessReviews/definitions
```json
{
  "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#identityGovernance/accessReviews/definitions",
  "value": [
    {
      "id": "review-guid",
      "displayName": "Global Administrator Access Review",
      "descriptionForReviewers": "Review Global Administrator assignments",
      "scope": {
        "@odata.type": "#microsoft.graph.principalResourceMembershipsScope",
        "principalScopes": [
          {
            "@odata.type": "#microsoft.graph.groupMembers",
            "groupId": "role-guid"
          }
        ],
        "resourceScopes": [
          {
            "@odata.type": "#microsoft.graph.directoryScope",
            "id": "/"
          }
        ]
      },
      "reviewers": [
        {
          "query": "/users/reviewer-guid",
          "queryType": "MicrosoftGraph"
        }
      ],
      "settings": {
        "recurrenceType": "quarterly",
        "autoApplyDecisionsEnabled": true,
        "defaultDecision": "Deny"
      }
    }
  ]
}
```

---

## Error Responses

### 403 Forbidden - Insufficient Permissions
```json
{
  "error": {
    "code": "Unauthorized",
    "message": "Insufficient permissions to access this resource",
    "innerError": {
      "date": "2024-01-15T10:00:00Z",
      "request-id": "request-guid",
      "client-request-id": "client-request-guid"
    }
  }
}
```

### 400 Bad Request
```json
{
  "error": {
    "code": "BadRequest",
    "message": "Request failed with status code 400",
    "innerError": {
      "date": "2024-01-15T10:00:00Z",
      "request-id": "request-guid",
      "client-request-id": "client-request-guid"
    }
  }
}
```

---

## Required Azure AD App Permissions

| Permission Type | Permission | Description |
|-----------------|------------|-------------|
| Application | Policy.Read.All | Read all CA policies and authentication methods policy |
| Application | RoleManagement.Read.Directory | Read Azure AD role management |
| Application | User.Read.All | Read all users (for guest account checks) |
| Application | UserAuthenticationMethod.Read.All | Read all users' authentication methods |
| Application | AuditLog.Read.All | Read audit log data |
| Application | AccessReview.Read.All | Read access reviews |
| Application | IdentityRiskEvent.Read.All | Read identity risk events |

---

## File Storage Location

After assessment, raw API responses are stored in:
```
E:\Tool\version-1\backend\assessment-data\{assessment-id}\
```

Each module has its own subdirectory with JSON files for each API endpoint.
