# Email Security Assessment - Exchange Online PowerShell & Graph API Commands Reference

This document lists all Exchange Online PowerShell cmdlets and Microsoft Graph API endpoints used during the Email Security (Microsoft Defender for Office 365 / Exchange Online) assessment.

## Base URL / Connection Endpoints

| Source | Endpoint / Connection | Used For |
| --- | --- | --- |
| Exchange Online PowerShell | Connection URI: `https://outlook.office365.com/PowerShell-LiveId` (EXO PS V3 module) | Anti-phishing, anti-spam, anti-malware, Safe Links, Safe Attachments policies, accepted domains, connectors, transport rules, mailbox/client settings |
| Microsoft Graph | `https://graph.microsoft.com/v1.0` | Users/groups for policy coverage calculation, admin role assignments, Defender alerts & incidents |

## Authentication

### Exchange Online PowerShell (App-Based Authentication)
Method: OAuth 2.0 client credentials (certificate-based) via the Exchange Online PowerShell V3 module
Connect command:
```powershell
Connect-ExchangeOnline -AppId <app-id> -CertificateThumbprint <thumbprint> -Organization <tenant>.onmicrosoft.com
```
The Azure AD app must hold the `Exchange.ManageAsApp` API permission **and** the app's service principal must be assigned an Exchange role (see *Required Permissions & Roles*).

### Microsoft Graph
Method: Client Credentials Flow (OAuth 2.0)
Scope: `https://graph.microsoft.com/.default`
Token URL: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`

---

## Quick Assessment Controls

The following controls are evaluated during a quick assessment. All controls can be automated.

### Anti-Phishing Policies

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 1 | Anti-phishing policy exists and enabled | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if at least one anti-phishing policy exists and is enabled. Fail if no anti-phishing policy exists or all anti-phishing policies are disabled. |
| 2 | All users are covered by at least one enabled MDO Anti-Phishing policy | `Get-AntiPhishPolicy`, `Get-AntiPhishRule` + Graph `/users`, `/groups/{id}/members` | EXO PowerShell + Graph `User.Read.All`, `GroupMember.Read.All` | Pass if every applicable user is covered by at least one enabled anti-phishing policy. Fail if any applicable user is not covered by an enabled policy. |

### Anti-Spam Policies

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 3 | Inbound anti-spam policy exists and enabled | `Get-HostedContentFilterPolicy`, `Get-HostedContentFilterRule` | EXO PowerShell | Pass if at least one inbound anti-spam policy exists, is enabled, and is assigned through an active inbound anti-spam rule. Fail if no enabled inbound anti-spam policy is found or if no active rule applies the policy. |
| 4 | All users are covered by at least one enabled inbound Anti-Spam policy | `Get-HostedContentFilterPolicy`, `Get-HostedContentFilterRule` + Graph `/users`, `/groups/{id}/members` | EXO PowerShell + Graph `User.Read.All`, `GroupMember.Read.All` | Pass if every applicable user is covered by at least one enabled inbound anti-spam policy. Fail if any applicable user is not covered by an enabled inbound anti-spam policy. |
| 5 | Outbound spam policy exists and enabled | `Get-HostedOutboundSpamFilterPolicy`, `Get-HostedOutboundSpamFilterRule` | EXO PowerShell | Pass if at least one outbound anti-spam policy exists and is enabled. Fail if no enabled outbound anti-spam policy is found. |
| 6 | Restriction placed on users who reach the message limit | `Get-HostedOutboundSpamFilterPolicy` | EXO PowerShell | Pass if the configured action for users who reach the outbound message limit is Block user from sending email (`ActionWhenThresholdReached = BlockUser`) in all applicable enabled outbound anti-spam policies. Fail if no restriction is configured (alert only). |

### Anti-Malware Policies

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 7 | Anti-malware policy exists and enabled | `Get-MalwareFilterPolicy`, `Get-MalwareFilterRule` | EXO PowerShell | Pass if at least one anti-malware policy exists, is enabled, and is assigned through an active anti-malware rule. Fail if no enabled anti-malware policy is found or if no active rule applies the policy. |
| 8 | All users are assigned at least one Anti-Malware policy | `Get-MalwareFilterPolicy`, `Get-MalwareFilterRule` + Graph `/users`, `/groups/{id}/members` | EXO PowerShell + Graph `User.Read.All`, `GroupMember.Read.All` | Pass if every applicable user is covered by at least one enabled anti-malware policy. Fail if any applicable user is not covered by an enabled anti-malware policy. |

### Safe Links

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 9 | Safe Links policy exists and enabled | `Get-SafeLinksPolicy`, `Get-SafeLinksRule` | EXO PowerShell | Pass if at least one Safe Links policy exists, is enabled, and is assigned through an active Safe Links rule. Fail if no enabled Safe Links policy is found or if no active rule applies the policy. |
| 10 | All applicable users are covered by at least one enabled Safe Links policy | `Get-SafeLinksPolicy`, `Get-SafeLinksRule` + Graph `/users`, `/groups/{id}/members` | EXO PowerShell + Graph `User.Read.All`, `GroupMember.Read.All` | Pass if every applicable user is covered by at least one enabled Safe Links policy. Fail if any applicable user is not covered by an enabled Safe Links policy. |

### Safe Attachments

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 11 | Safe Attachments policy exists and enabled | `Get-SafeAttachmentPolicy`, `Get-SafeAttachmentRule` | EXO PowerShell | Pass if at least one Safe Attachments policy exists, is enabled, and is assigned through an active Safe Attachments rule. Fail if no enabled Safe Attachments policy is found or if no active rule applies the policy. |
| 12 | All applicable users are covered by at least one enabled Safe Attachments policy | `Get-SafeAttachmentPolicy`, `Get-SafeAttachmentRule` + Graph `/users`, `/groups/{id}/members` | EXO PowerShell + Graph `User.Read.All`, `GroupMember.Read.All` | Pass if every applicable user is covered by at least one enabled Safe Attachments policy. Fail if any applicable user is not covered by an enabled Safe Attachments policy. |

### Permissions & Global Settings

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 13 | Directory Based Edge Blocking (DBEB) enabled for accepted domains | `Get-AcceptedDomain` | EXO PowerShell | Pass if DBEB is enabled for all applicable Authoritative accepted domains. Exclude Internal Relay and External Relay domains unless organizational policy requires otherwise. Fail if DBEB is disabled for any applicable Authoritative accepted domain. |
| 14 | Exchange Administrator role is assigned only to approved users and groups | Graph `/directoryRoles`, `/directoryRoles/{roleId}/members` | Graph `RoleManagement.Read.Directory` | Pass if the Exchange Administrator role is assigned to at least one user/group and membership contains only approved principals. Fail if the role has no assignment or contains unapproved members. |
| 15 | SMTP AUTH disabled globally | `Get-TransportConfig`, `Get-EXOCASMailbox` | EXO PowerShell | Pass if `SmtpClientAuthenticationDisabled = True` at the tenant level. Optionally report mailbox-level SMTP AUTH exceptions for review. Fail if SMTP AUTH is enabled globally. |
| 16 | POP and IMAP disabled | `Get-EXOCASMailbox` / `Get-CASMailbox` | EXO PowerShell (+ View-Only Recipients) | Pass if `PopEnabled = False` and `ImapEnabled = False` for all applicable Exchange Online mailboxes. Fail if either protocol is enabled for any applicable mailbox. |

### Connectors

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 17 | Inbound connectors require TLS encryption | `Get-InboundConnector` | EXO PowerShell | PASS: Every enabled inbound connector has `RequireTLS = True`. FAIL: One or more enabled inbound connectors have `RequireTLS = False`. |
| 18 | Outbound connectors require TLS encryption | `Get-OutboundConnector` | EXO PowerShell | PASS: Every enabled outbound connector has `RequireTLS = True`. FAIL: One or more enabled outbound connectors have `RequireTLS = False`. |

### Transport Rules

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| 19 | Transport rules are enabled where configured | `Get-TransportRule` | EXO PowerShell | PASS: At least one of the configured transport rules is enabled and operating in Enforce mode. FAIL: All configured transport rules are disabled or operating only in Test mode. |
| 20 | Transport rules prevent automatic forwarding to external recipients | `Get-TransportRule` | EXO PowerShell | PASS: At least one enabled transport rule blocks or rejects automatic forwarding to external recipients. FAIL: No enabled transport rule exists to prevent automatic forwarding. |
| 21 | Transport rules prepend warning banners for external emails | `Get-TransportRule` | EXO PowerShell | PASS: At least one enabled transport rule prepends a warning banner/disclaimer to messages received from external senders. FAIL: No enabled transport rule adds an external-sender warning banner. |

## Quick Assessment Informational Controls

The following informational controls are included in quick assessment - they display tenant information without pass/fail evaluation:

| # | Control | Commands Used | Required Permission |
| --- | --- | --- | --- |
| QI1 | Total number of mailboxes | `Get-EXOMailbox -ResultSize Unlimited` | EXO PowerShell (+ View-Only Recipients) |
| QI2 | Total number of user mailboxes | `Get-EXOMailbox -RecipientTypeDetails UserMailbox` | EXO PowerShell (+ View-Only Recipients) |
| QI3 | Total number of shared mailboxes | `Get-EXOMailbox -RecipientTypeDetails SharedMailbox` | EXO PowerShell (+ View-Only Recipients) |
| QI4 | Total number of alerts | Graph `/security/alerts_v2` | Graph `SecurityAlert.Read.All` |
| QI5 | Total number of incidents | Graph `/security/incidents` | Graph `SecurityIncident.Read.All` |
| QI6 | Tenant Allow/Block List items | `Get-TenantAllowBlockListItems` | EXO PowerShell |

---

## Detailed Assessment Controls

The following additional controls are evaluated during a detailed assessment (not included in quick assessment):

### Anti-Phishing Policies

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D1 | Mailbox Intelligence enabled | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if `EnableMailboxIntelligence = True` for all applicable enabled anti-phishing policies. Fail if Mailbox Intelligence is disabled in any applicable enabled policy. |
| D2 | User impersonation protection enabled and action is configured | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if user impersonation protection (`EnableTargetedUserProtection = True`) is enabled and users to protect are assigned in all applicable enabled policies. Fail if it is not enabled even in one policy. |
| D3 | Domain impersonation protection enabled and action is configured | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if domain impersonation protection (`EnableTargetedDomainsProtection` / `EnableOrganizationDomainsProtection = True`) is enabled and the protection action is configured (e.g., Quarantine, Junk, Redirect) in all applicable enabled policies. Fail if protection is disabled or no protection action is configured in any applicable policy. |
| D4 | Spoof Intelligence enabled and action is configured | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if Spoof Intelligence (`EnableSpoofIntelligence = True`) is enabled and a protection action is configured in all applicable enabled policies. Fail if Spoof Intelligence is disabled or no protection action is configured in any applicable policy. |
| D5 | Honor DMARC enabled | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if `HonorDmarcPolicy = True` for all applicable enabled anti-phishing policies. Fail if the setting is disabled in any applicable enabled policy. |
| D6 | Via Tag enabled | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if `EnableViaTag = True` for all applicable enabled anti-phishing policies. Fail if the setting is disabled in any applicable enabled policy. |
| D7 | Show "?" for unauthenticated senders enabled | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if `EnableUnauthenticatedSender = True` for all applicable enabled anti-phishing policies. Fail if the setting is disabled in any applicable enabled policy. |
| D8 | First Contact Safety Tip enabled | `Get-AntiPhishPolicy` | EXO PowerShell | Pass if First Contact Safety Tip (`EnableFirstContactSafetyTips = True`) is enabled for all applicable enabled anti-phishing policies. Fail if the setting is disabled in any applicable enabled policy. |

### Anti-Spam Policies (Inbound)

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D9 | Image links to remote websites enabled | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `IncreaseScoreWithImageLinks = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D10 | Numeric IP address in URL enabled | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `IncreaseScoreWithNumericIps = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D11 | URL redirect to other port enabled | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `IncreaseScoreWithRedirectToOtherPort = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D12 | Empty messages marked as spam | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamEmptyMessages = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D13 | Embedded tags in HTML marked as spam | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamEmbedTagsInHtml = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D14 | JavaScript or VBScript in HTML marked as spam | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamJavaScriptInHtml = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D15 | Form tags in HTML marked as spam | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamFormTagsInHtml = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D16 | Frame or iframe tags in HTML marked as spam | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamFramesInHtml = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D17 | Web bugs in HTML marked as spam | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamWebBugsInHtml = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D18 | SPF record hard fail enabled | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamSpfRecordHardFail = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D19 | Backscatter detection enabled | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass: `MarkAsSpamBackscatter = On` in all applicable enabled inbound anti-spam policies. Fail: the setting is Off in any applicable policy. |
| D20 | Spam action configured | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass if `SpamAction` is configured in all applicable enabled inbound anti-spam policies. Fail if no spam action is configured. |
| D21 | High Confidence Spam action configured | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass if `HighConfidenceSpamAction` is configured to quarantine in all applicable enabled inbound anti-spam policies (per Microsoft recommendations). Fail if any other / no action is configured. |
| D22 | Bulk email action configured | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass if `BulkSpamAction` is configured in all applicable enabled inbound anti-spam policies. Fail if no action is configured. |
| D23 | Phishing messages action configured | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass if `PhishSpamAction` is configured (e.g., Quarantine) in all applicable enabled inbound anti-spam policies. Fail if any other / no action is configured. |
| D24 | High Confidence Phishing action configured | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass if `HighConfidencePhishAction` is configured to quarantine in all applicable enabled inbound anti-spam policies. Fail if any other / no action is configured. |
| D25 | Zero-hour Auto Purge (ZAP) enabled | `Get-HostedContentFilterPolicy` | EXO PowerShell | Pass if ZAP = Enabled for all applicable enabled inbound anti-spam policies. Fail if ZAP is disabled in any applicable enabled policy. |

### Anti-Spam Policies (Outbound)

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D26 | Outbound spam policy enabled | `Get-HostedOutboundSpamFilterPolicy` | EXO PowerShell | Pass if at least one outbound anti-spam policy exists and is enabled. Fail if no enabled outbound anti-spam policy is found. |

### Anti-Malware Policies

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D27 | Zero-hour Auto Purge (ZAP) enabled for Anti-Malware | `Get-MalwareFilterPolicy` | EXO PowerShell | Pass if ZAP (`ZapEnabled = True`) is enabled for all applicable enabled anti-malware policies. Fail if ZAP is disabled in any applicable enabled policy. |
| D28 | Common attachment type filter enabled | `Get-MalwareFilterPolicy` | EXO PowerShell | Pass if Common attachment filter (`EnableFileFilter = True`) is enabled for all applicable enabled anti-malware policies. Fail if it is disabled in any applicable enabled policy. |
| D29 | Notify the admin about undelivered messages (internal / external) | `Get-MalwareFilterPolicy` | EXO PowerShell | Pass if administrator notifications for both internal and external malware-detected undelivered messages are enabled and a notification recipient is configured. Fail if either notification is disabled or no notification recipient is configured. |

### Safe Links

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D30 | Email URL scanning enabled | `Get-SafeLinksPolicy` | EXO PowerShell | Pass if Email URL scanning (Safe Links for email) = Enabled for all applicable enabled Safe Links policies. Fail if the setting is disabled in any applicable enabled policy. |
| D31 | Safe Links protection enabled for email messages sent within the organization | `Get-SafeLinksPolicy` | EXO PowerShell | Pass if Safe Links protection for internal email = Enabled for all applicable enabled Safe Links policies. Fail if the setting is disabled in any applicable enabled policy. |
| D32 | Real-time URL scanning enabled and wait for URL scanning to complete before delivery | `Get-SafeLinksPolicy` | EXO PowerShell | Pass if real-time URL scanning with "wait for scan completion before delivery" = Enabled for all applicable enabled Safe Links policies. Fail if the setting is disabled in any applicable enabled policy. |
| D33 | URL rewriting enabled | `Get-SafeLinksPolicy` | EXO PowerShell | Pass if URL rewriting is enabled for all applicable enabled Safe Links policies. Fail if URL rewriting is disabled in any applicable enabled policy. |
| D34 | Safe Links protection for Teams and Office 365 / M365 Apps enabled | `Get-SafeLinksPolicy` | EXO PowerShell | Pass if Safe Links protection for Microsoft Teams and Microsoft 365 Apps = Enabled for all applicable enabled Safe Links policies. Fail if either setting is disabled in any applicable enabled policy. |
| D35 | User click tracking enabled | `Get-SafeLinksPolicy` | EXO PowerShell | Pass if Track User Clicks = Enabled (i.e. `DoNotTrackUserClicks = False`) for all applicable enabled Safe Links policies. Fail if user click tracking is disabled in any applicable enabled policy. |

### Safe Attachments

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D36 | Dynamic Delivery enabled for unknown malware attachments | `Get-SafeAttachmentPolicy` | EXO PowerShell | Pass if the Safe Attachments action for unknown malware is configured as Dynamic Delivery (`Action = DynamicDelivery`) in all applicable enabled Safe Attachments policies. Fail if any applicable policy is configured with a different action. |

### Connectors

| # | Control | Commands Used | Required Permission | Validation Rule |
| --- | --- | --- | --- | --- |
| D37 | Inbound connectors restricted to trusted IP addresses or certificates | `Get-InboundConnector` | EXO PowerShell | PASS: Every enabled inbound connector is restricted by at least one trusted authentication method (trusted IP addresses and/or trusted TLS certificate). FAIL: One or more enabled inbound connectors do not use trusted IP address or certificate restrictions. |
| D38 | Partner connectors validate sender certificates or domains | `Get-InboundConnector` | EXO PowerShell | PASS: Every enabled Partner inbound connector validates the sending organization using a trusted TLS certificate and/or configured sender domains. FAIL: One or more enabled Partner inbound connectors do not validate sender certificates or configured domains. |
| D39 | SMTP relay connectors require authenticated and encrypted mail flow | `Get-InboundConnector`, `Get-OutboundConnector` | EXO PowerShell | PASS: Every enabled SMTP relay connector requires TLS and authenticates trusted sending systems using IP restrictions and/or TLS certificates. FAIL: One or more enabled SMTP relay connectors do not require TLS or lack trusted authentication restrictions. |

## Informational Controls (Detailed Assessment Only)

The following controls are informational only - they display tenant information without pass/fail evaluation:

### Mailbox & Group Information

| # | Control | Commands Used | Required Permission |
| --- | --- | --- | --- |
| I1 | Total number of mailboxes | `Get-EXOMailbox -ResultSize Unlimited` | EXO PowerShell (+ View-Only Recipients) |
| I2 | User mailboxes | `Get-EXOMailbox -RecipientTypeDetails UserMailbox` | EXO PowerShell (+ View-Only Recipients) |
| I3 | Shared mailboxes | `Get-EXOMailbox -RecipientTypeDetails SharedMailbox` | EXO PowerShell (+ View-Only Recipients) |
| I4 | Distribution lists | `Get-DistributionGroup` | EXO PowerShell (+ View-Only Recipients) |
| I5 | Dynamic distribution lists | `Get-DynamicDistributionGroup` | EXO PowerShell (+ View-Only Recipients) |
| I6 | Microsoft 365 Groups | `Get-UnifiedGroup` | EXO PowerShell (+ View-Only Recipients) |
| I7 | Mail-enabled security groups | `Get-DistributionGroup` (filter security groups) | EXO PowerShell (+ View-Only Recipients) |
| I8 | Resource mailboxes | `Get-EXOMailbox -RecipientTypeDetails RoomMailbox,EquipmentMailbox` | EXO PowerShell (+ View-Only Recipients) |

### Alerts, Incidents & Tenant Lists

| # | Control | Commands Used | Required Permission |
| --- | --- | --- | --- |
| I9 | Total number of alerts | Graph `/security/alerts_v2` | Graph `SecurityAlert.Read.All` |
| I10 | Open / Resolved / In-progress alerts | Graph `/security/alerts_v2?$filter=status eq '...'` | Graph `SecurityAlert.Read.All` |
| I11 | Total number of incidents | Graph `/security/incidents` | Graph `SecurityIncident.Read.All` |
| I12 | Open / Resolved / In-progress incidents | Graph `/security/incidents?$filter=status eq '...'` | Graph `SecurityIncident.Read.All` |
| I13 | Tenant Allow/Block List items | `Get-TenantAllowBlockListItems` | EXO PowerShell |
| I14 | Tenant Allow/Block List - URLs | `Get-TenantAllowBlockListItems -ListType Url` | EXO PowerShell |
| I15 | Tenant Allow/Block List - Senders | `Get-TenantAllowBlockListItems -ListType Sender` | EXO PowerShell |
| I16 | Tenant Allow/Block List - Domains | `Get-TenantAllowBlockListItems -ListType Domain` | EXO PowerShell |
| I17 | Tenant Allow/Block List - File hashes | `Get-TenantAllowBlockListItems -ListType FileHash` | EXO PowerShell |

### Configuration Information

| # | Control | Commands Used | Required Permission |
| --- | --- | --- | --- |
| I18 | List of all transport rules present | `Get-TransportRule` | EXO PowerShell |

---

## Quick Assessment Endpoints

For quick assessments, only these commands/endpoints are called:

| # | Command / Endpoint | Type | Purpose | Required Permission / Role |
| --- | --- | --- | --- | --- |
| 1 | `Connect-ExchangeOnline` | EXO PS | Establish app-based PowerShell session | `Exchange.ManageAsApp` + Exchange role |
| 2 | `Get-AntiPhishPolicy` | EXO PS | Get anti-phishing policy settings | View-Only Organization Management |
| 3 | `Get-AntiPhishRule` | EXO PS | Get anti-phishing policy assignments/scope | View-Only Organization Management |
| 4 | `Get-HostedContentFilterPolicy` | EXO PS | Get inbound anti-spam policy settings | View-Only Organization Management |
| 5 | `Get-HostedContentFilterRule` | EXO PS | Get inbound anti-spam policy assignments | View-Only Organization Management |
| 6 | `Get-HostedOutboundSpamFilterPolicy` | EXO PS | Get outbound anti-spam policy settings | View-Only Organization Management |
| 7 | `Get-HostedOutboundSpamFilterRule` | EXO PS | Get outbound anti-spam policy assignments | View-Only Organization Management |
| 8 | `Get-MalwareFilterPolicy` | EXO PS | Get anti-malware policy settings | View-Only Organization Management |
| 9 | `Get-MalwareFilterRule` | EXO PS | Get anti-malware policy assignments | View-Only Organization Management |
| 10 | `Get-SafeLinksPolicy` | EXO PS | Get Safe Links policy settings | View-Only Organization Management |
| 11 | `Get-SafeLinksRule` | EXO PS | Get Safe Links policy assignments | View-Only Organization Management |
| 12 | `Get-SafeAttachmentPolicy` | EXO PS | Get Safe Attachments policy settings | View-Only Organization Management |
| 13 | `Get-SafeAttachmentRule` | EXO PS | Get Safe Attachments policy assignments | View-Only Organization Management |
| 14 | `Get-AcceptedDomain` | EXO PS | Get accepted domains / domain type (DBEB) | View-Only Organization Management |
| 15 | `Get-TransportConfig` | EXO PS | Get org config incl. SMTP AUTH tenant setting | View-Only Organization Management |
| 16 | `Get-EXOCASMailbox` / `Get-CASMailbox` | EXO PS | Get POP/IMAP/SMTP AUTH mailbox settings | View-Only Recipients |
| 17 | `Get-InboundConnector` | EXO PS | Get inbound connector TLS/trust settings | View-Only Organization Management |
| 18 | `Get-OutboundConnector` | EXO PS | Get outbound connector TLS settings | View-Only Organization Management |
| 19 | `Get-TransportRule` | EXO PS | Get transport (mail flow) rules | View-Only Organization Management |
| 20 | `Get-EXOMailbox` | EXO PS | Count/list mailboxes by type | View-Only Recipients |
| 21 | `Get-TenantAllowBlockListItems` | EXO PS | List Tenant Allow/Block List entries | View-Only Organization Management |
| 22 | `/users`, `/groups/{id}/members` | Graph GET | Users & group membership for coverage calculation | `User.Read.All`, `GroupMember.Read.All` |
| 23 | `/directoryRoles`, `/directoryRoles/{roleId}/members` | Graph GET | Admin role assignments (Exchange Administrator) | `RoleManagement.Read.Directory` |
| 24 | `/security/alerts_v2` | Graph GET | Defender alerts (total count) | `SecurityAlert.Read.All` |
| 25 | `/security/incidents` | Graph GET | Defender incidents (total count) | `SecurityIncident.Read.All` |

## Detailed Assessment Endpoints

For detailed assessments, additional commands/endpoints are called beyond the quick assessment endpoints:

| # | Command / Endpoint | Type | Purpose | Required Permission / Role |
| --- | --- | --- | --- | --- |
| 26 | `Get-DistributionGroup` | EXO PS | List distribution / mail-enabled security groups | View-Only Recipients |
| 27 | `Get-DynamicDistributionGroup` | EXO PS | List dynamic distribution groups | View-Only Recipients |
| 28 | `Get-UnifiedGroup` | EXO PS | List Microsoft 365 Groups | View-Only Recipients |
| 29 | `/security/alerts_v2?$filter=status eq '...'` | Graph GET | Alerts by status (open/resolved/in-progress) | `SecurityAlert.Read.All` |
| 30 | `/security/incidents?$filter=status eq '...'` | Graph GET | Incidents by status (open/resolved/in-progress) | `SecurityIncident.Read.All` |
| 31 | `Get-TenantAllowBlockListItems -ListType Url/Sender/Domain/FileHash` | EXO PS | Tenant Allow/Block List entries by type | View-Only Organization Management |

---

## API Response Examples

### Get-AntiPhishPolicy
```
Name                          : Default
Enabled                       : True
AdminDisplayName              :
PhishThresholdLevel           : 2
EnableMailboxIntelligence     : True
EnableMailboxIntelligenceProtection : True
EnableOrganizationDomainsProtection : True
EnableTargetedDomainsProtection      : True
EnableTargetedUserProtection         : True
EnableSpoofIntelligence              : True
HonorDmarcPolicy              : True
EnableViaTag                  : True
EnableUnauthenticatedSender   : True
MailboxIntelligenceProtectionAction : Quarantine
TargetedUserProtectionAction         : Quarantine
TargetedDomainProtectionAction       : Quarantine
AuthenticationFailAction             : Quarantine
TargetedUsers                 : {}
TargetedDomains               : {}
ExcludedUsers                 : {}
ExcludedDomains               : {}
ExcludedGroups                : {}
IsDefault                     : True
Guid                          : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Get-HostedContentFilterPolicy
```
Name                                 : Default
IsDefault                            : True
EnableZAP                            : True
IncreaseScoreWithImageLinks          : On
IncreaseScoreWithNumericIps          : On
IncreaseScoreWithRedirectToOtherPort : On
MarkAsSpamEmptyMessages              : On
MarkAsSpamEmbedTagsInHtml            : On
MarkAsSpamJavaScriptInHtml           : On
MarkAsSpamFormTagsInHtml             : On
MarkAsSpamFramesInHtml               : On
MarkAsSpamWebBugsInHtml              : On
MarkAsSpamSpfRecordHardFail          : On
MarkAsSpamBackscatter                : On
SpamAction                           : MoveToJmf
HighConfidenceSpamAction             : Quarantine
BulkSpamAction                       : MoveToJmf
PhishSpamAction                      : Quarantine
HighConfidencePhishAction            : Quarantine
```

### Get-HostedOutboundSpamFilterPolicy
```
Name                            : Default
IsDefault                       : True
RecipientLimitExternalPerHour   : 500
RecipientLimitInternalPerHour   : 1000
RecipientLimitPerDay            : 5000
ActionWhenThresholdReached      : BlockUser
NotifyOutboundSpam              : True
NotifyOutboundSpamRecipients    : {secops@contoso.com}
BccSuspiciousOutboundMail       : True
BccSuspiciousOutboundRecipients : {secops@contoso.com}
```

### Get-MalwareFilterPolicy
```
Name                                   : Default
IsDefault                              : True
EnableFileFilter                       : True
ZapEnabled                             : True
Action                                 : DeleteAttachmentAndUseDefaultAlertText
EnableInternalSenderAdminNotifications : True
InternalSenderAdminAddress             : secops@contoso.com
EnableExternalSenderAdminNotifications : True
ExternalSenderAdminAddress             : secops@contoso.com
```

### Get-SafeLinksPolicy
```
Name                         : Default
IsEnabled                    : True
EnableSafeLinksForEmail      : True
EnableSafeLinksForTeams      : True
EnableSafeLinksForOfficeApps : True
DoNotRewriteUrls             : {}
DoNotTrackUserClicks         : False
DoNotAllowClickThrough       : False
```

### Get-SafeAttachmentPolicy
```
Name    : Default
Enable  : True
Action  : DynamicDelivery
```

### Get-AcceptedDomain
```
Name        DomainName      DomainType      Default
----        ----------      ----------      -------
contoso.com contoso.com     Authoritative   True
```

### Get-TransportConfig (SMTP AUTH)
```
SmtpClientAuthenticationDisabled : True
```

### Get-EXOCASMailbox (POP/IMAP)
```
Identity            PopEnabled  ImapEnabled
--------            ----------  -----------
user1@contoso.com        False        False
user2@contoso.com        False        False
```

### Get-InboundConnector
```
Name                    Enabled  ConnectorType  RequireTLS  RestrictDomainsToIPAddresses  TlsSenderCertificateName
----                    -------  -------------  ----------  ----------------------------  ------------------------
Partner - Contoso          True        Partner        True                          True        mail.contoso.com
OnPrem Relay               True      OnPremises        True                          True        mail.contoso.com
```

### Get-TransportRule
```
Name                          State    Mode
----                          -----    ----
Block Auto-Forward External   Enabled  Enforce
External Sender Warning       Enabled  Enforce
Test Rule                     Disabled Test
```

### GET /security/alerts_v2 (Graph)
```json
{
  "value": [
    {
      "id": "alert-id-guid",
      "title": "User restricted from sending email",
      "status": "new",
      "severity": "medium",
      "category": "DefenseEvasion",
      "createdDateTime": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### GET /security/incidents (Graph)
```json
{
  "value": [
    {
      "id": "incident-id-guid",
      "displayName": "Suspicious email forwarding activity",
      "status": "active",
      "severity": "medium",
      "createdDateTime": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Error Responses

### 403 Forbidden - Insufficient Graph Permissions
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

### Exchange Online PowerShell - Insufficient Role (RBAC)
```
Error:
Access is denied. The user or application "app-id" does not have the required
permissions to run "Get-AntiPhishPolicy". Required role: "View-Only Organization
Management" or higher.
```

### Exchange Online PowerShell - Authentication Failure
```
Connect-ExchangeOnline : AADSTS700016: Application with identifier 'xxxxxxxx-xxxx-xxxx-
xxxx-xxxxxxxxxxxx' was not found in the directory 'tenant.onmicrosoft.com' or the
application does not have the Exchange.ManageAsApp permission granted.
```

---

## Required Permissions & Roles

| Type | Permission / Role | Description |
| --- | --- | --- |
| Azure AD App (Application) | `Exchange.ManageAsApp` | Allows the app to connect to Exchange Online PowerShell |
| Exchange Role (assigned to app SP) | View-Only Organization Management (recommended least privilege) or Exchange Administrator | Read org-wide config: policies, connectors, transport rules, accepted domains |
| Exchange Role (assigned to app SP) | View-Only Recipients | Read mailboxes, CAS (POP/IMAP/SMTP AUTH) settings, groups |
| Graph (Application) | `User.Read.All` | Read users for policy coverage calculation |
| Graph (Application) | `GroupMember.Read.All` | Read group memberships for coverage calculation |
| Graph (Application) | `RoleManagement.Read.Directory` | Read admin role assignments (Exchange Administrator check) |
| Graph (Application) | `SecurityAlert.Read.All` | Read Microsoft Defender alerts (`/security/alerts_v2`) |
| Graph (Application) | `SecurityIncident.Read.All` | Read Microsoft Defender incidents (`/security/incidents`) |

---

## File Storage Location

After assessment, raw command/API responses are stored relative to the backend working directory:

```
assessment-data\{assessment-id}\email-security\
```

Each endpoint's raw response is stored as a JSON file within category subdirectories.

---

## Implementation Notes

### Backend Files

| File | Purpose |
| --- | --- |
| `backend/src/services/emailSecurityCollector.ts` | Collects Email security data via Exchange Online PowerShell and Microsoft Graph. Handles authentication, command execution, error categorization, and raw response persistence. |
| `backend/src/services/emailSecurityControlDefinitions.ts` | Defines all Email security controls (Quick, Detailed, Informational) with evaluation functions and validation rules. |
| `backend/src/services/emailSecurityEvaluator.ts` | Evaluates collected data against control definitions. Includes backward-compatible normalization for legacy `collection.json` formats. |
| `backend/src/services/assessmentEngine.ts` | Wires Email module into the generic assessment pipeline. Auth failures mark controls as `error` rather than `fail`. |

### Database

- `control_catalog` includes 80 Email controls (21 Quick + 6 QI + 39 Detailed + 18 Informational)
- `findings.result` ENUM supports `error` and `info` statuses

### Frontend Files

| File | Purpose |
| --- | --- |
| `frontend/src/app/results/[id]/email/page.tsx` | Dedicated Email Security module detail view with area-grouped findings, filtering, and evidence modals |
| `frontend/src/app/results/[id]/page.tsx` | Generic results page with clickable Email module card navigating to the detail view |

### Testing

Run Email evaluator tests:
```bash
cd backend && npm test
```

Tests cover:
- New flat data format and legacy nested `collection.json` format
- Pass/fail/info/error result paths
- All 80 control registry entries
- Edge cases (missing data, null configs, empty arrays)