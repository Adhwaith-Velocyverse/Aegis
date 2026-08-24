# Microsoft 365 Connection Module - Permission Matrix

## Authentication Modes

| Mode | Description | Recommended For |
|------|-------------|-----------------|
| `APPLICATION` | App-only / certificate-based auth | Unattended backend automation, service principals |
| `DELEGATED` | Auth code + refresh token | Interactive admin consent flows |

## Capability → Microsoft Permission Mapping

### Identity / Entra ID

| Capability | Microsoft Permission | Type | Why Required |
|------------|---------------------|------|--------------|
| Read users | `User.Read.All` | Application | User inventory, guest identification, sync properties |
| Read groups | `Group.Read.All` | Application | Group inventory, membership |
| Read directory roles | `RoleManagement.Read.Directory` | Application | Directory role inventory, admin structure |
| Read PIM schedules | `RoleManagement.Read.Directory` | Application | Eligible/active role assignments |
| Read role management policies | `Policy.Read.All` | Application | PIM activation policies, MFA requirements |
| Read Conditional Access policies | `Policy.Read.ConditionalAccess` | Application | CA inventory, MFA enforcement |
| Read authentication methods | `Policy.Read.AuthenticationMethod` | Application | Authentication methods policy |
| Read access reviews | `AccessReview.Read.All` | Application | Guest access reviews, privileged role reviews |
| Read audit logs (sign-ins) | `AuditLog.Read.All` | Application | Sign-in log collection |
| Read audit logs (directory) | `AuditLog.Read.All` | Application | Directory audit log collection |
| Read provisioning logs | `AuditLog.Read.All` | Application | Provisioning log collection |
| Read identity protection | `IdentityRiskEvent.Read.All` | Application | Risk detections, identity protection |
| Read applications | `Application.Read.All` | Application | Application inventory |
| Read service principals | `Application.Read.All` | Application | Service principal inventory |
| Read organization | `Organization.Read.All` | Application | Tenant validation, health check |

### Email Security / Defender

| Capability | Microsoft Permission | Type | Why Required |
|------------|---------------------|------|--------------|
| Read anti-phishing policies | Exchange Administrator role | Application | Anti-phishing config via Exchange Online PowerShell |
| Read anti-spam policies | Exchange Administrator role | Application | Anti-spam config via Exchange Online PowerShell |
| Read anti-malware policies | Exchange Administrator role | Application | Anti-malware config via Exchange Online PowerShell |
| Read Safe Links policies | Exchange Administrator role | Application | Safe Links config via Exchange Online PowerShell |
| Read Safe Attachments policies | Exchange Administrator role | Application | Safe Attachments config via Exchange Online PowerShell |
| Read transport rules | Exchange Administrator role | Application | Transport rule inventory |
| Read connectors | Exchange Administrator role | Application | Inbound/outbound connector config |
| Read mailboxes | Exchange Administrator role | Application | Mailbox inventory, SMTP/POP/IMAP status |
| Read distribution groups | Exchange Administrator role | Application | Distribution group inventory |

### Least-Privilege Notes

- All Graph permissions above are **read-only** (`Read.All` or `Read`).
- No `Write`, `Create`, `Update`, `Delete`, or `Admin` permissions are requested.
- Exchange Online PowerShell uses app-only with `Exchange Administrator` role. In production, replace with a custom role with least-privileged cmdlet access.
- PowerShell execution is **allowlisted** — only the commands listed in `graphPowerShellService.ts` and `exchangeOnlineService.ts` are permitted.

## Phase 1 Workbook Compatibility

| Workbook Technique | Status | Implementation |
|-------------------|--------|----------------|
| `GET /identity/conditionalAccess/policies` | Implemented | `graphHttpClient.ts` + `graphConnector.ts` |
| `GET /identity/conditionalAccess/namedLocations` | Implemented | `graphHttpClient.ts` |
| `GET /policies/identitySecurityDefaultsEnforcementPolicy` | Implemented | `graphHttpClient.ts` |
| `GET /policies/authenticationMethodsPolicy/authenticationMethodConfigurations/*` | Implemented | `graphHttpClient.ts` |
| `GET /roleManagement/directory/roleEligibilitySchedules` | Implemented | `graphHttpClient.ts` |
| `GET /roleManagement/directory/roleAssignmentSchedules` | Implemented | `graphHttpClient.ts` |
| `GET /policies/roleManagementPolicies` | Implemented | `graphHttpClient.ts` |
| `GET /policies/roleManagementPolicies/{policyId}/rules` | Implemented | `graphHttpClient.ts` |
| `GET /directoryRoles` | Implemented | `graphHttpClient.ts` |
| `GET /directoryRoles/{role-id}/members` | Implemented | `graphHttpClient.ts` |
| `GET /identityGovernance/accessReviews/definitions` | Implemented | `graphHttpClient.ts` |
| `GET /users` | Implemented | `graphHttpClient.ts` |
| `GET /users/{user-id}` | Implemented | `graphHttpClient.ts` |
| `GET /users/{user-id}/memberOf` | Implemented | `graphHttpClient.ts` |
| `GET /groups` | Implemented | `graphHttpClient.ts` |
| `GET /auditLogs/signIns` | Implemented | `graphHttpClient.ts` |
| `GET /auditLogs/directoryAudits` | Implemented | `graphHttpClient.ts` |
| `GET /auditLogs/provisioning` | Implemented | `graphHttpClient.ts` |
| `GET /identityProtection/riskDetections` | Implemented | `graphHttpClient.ts` |
| `GET /applications` | Implemented | `graphHttpClient.ts` |
| `GET /servicePrincipals` | Implemented | `graphHttpClient.ts` |
| `GET /security/alerts_v2` | Implemented | `graphHttpClient.ts` |
| `GET /security/incidents` | Implemented | `graphHttpClient.ts` |
| `Connect-MgGraph` | Implemented | `graphPowerShellService.ts` |
| `Get-MgContext` | Implemented | `graphPowerShellService.ts` |
| `Get-MgUser` | Implemented | `graphPowerShellService.ts` |
| `Get-MgGroup` | Implemented | `graphPowerShellService.ts` |
| `Get-MgDirectoryRole` | Implemented | `graphPowerShellService.ts` |
| `Get-MgDirectoryRoleMember` | Implemented | `graphPowerShellService.ts` |
| `Get-MgPolicyAuthenticationMethodPolicy` | Implemented | `graphPowerShellService.ts` |
| `Get-MgBetaPolicyAuthenticationMethodPolicy` | Implemented | `graphPowerShellService.ts` |
| `Connect-ExchangeOnline` | Implemented | `exchangeOnlineService.ts` |
| `Get-AntiPhishPolicy` | Implemented | `exchangeOnlineService.ts` |
| `Get-AntiPhishRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-HostedContentFilterPolicy` | Implemented | `exchangeOnlineService.ts` |
| `Get-HostedContentFilterRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-HostedOutboundSpamFilterPolicy` | Implemented | `exchangeOnlineService.ts` |
| `Get-HostedOutboundSpamFilterRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-MalwareFilterPolicy` | Implemented | `exchangeOnlineService.ts` |
| `Get-MalwareFilterRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-SafeLinksPolicy` | Implemented | `exchangeOnlineService.ts` |
| `Get-SafeLinksRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-SafeAttachmentPolicy` | Implemented | `exchangeOnlineService.ts` |
| `Get-SafeAttachmentRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-AcceptedDomain` | Implemented | `exchangeOnlineService.ts` |
| `Get-TransportConfig` | Implemented | `exchangeOnlineService.ts` |
| `Get-CASMailbox` | Implemented | `exchangeOnlineService.ts` |
| `Get-EXOCASMailbox` | Implemented | `exchangeOnlineService.ts` |
| `Get-InboundConnector` | Implemented | `exchangeOnlineService.ts` |
| `Get-OutboundConnector` | Implemented | `exchangeOnlineService.ts` |
| `Get-TransportRule` | Implemented | `exchangeOnlineService.ts` |
| `Get-EXOMailbox` | Implemented | `exchangeOnlineService.ts` |
| `Get-DistributionGroup` | Implemented | `exchangeOnlineService.ts` |
| `Get-DynamicDistributionGroup` | Implemented | `exchangeOnlineService.ts` |
| `Get-UnifiedGroup` | Implemented | `exchangeOnlineService.ts` |
| `Get-TenantAllowBlockListItems` | Implemented | `exchangeOnlineService.ts` |
