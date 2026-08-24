# Penetration Test Checklist - Velocyverse

## 1. Authentication & Authorization

### 1.1 Brute Force Protection
- [ ] Test login endpoint with 100+ failed attempts from same IP
- [ ] Verify rate limiting kicks in after 5 failed attempts (15 min window)
- [ ] Test account lockout after 10 failed attempts (15 min block)
- [ ] Verify IP blocking clears after successful login
- [ ] Test with multiple IPs (distributed brute force)

### 1.2 JWT Token Security
- [ ] Verify JWT tokens expire after 7 days (or 30 days with "Remember me")
- [ ] Test token blacklist on logout
- [ ] Verify blacklisted tokens are rejected
- [ ] Test token refresh mechanism
- [ ] Verify refresh tokens have proper expiration
- [ ] Test with expired tokens
- [ ] Test with tampered tokens (modified payload)
- [ ] Test with tokens signed with wrong secret

### 1.3 Session Management
- [ ] Verify session expires after 30 minutes of inactivity
- [ ] Test "Remember me" extends session to 30 days
- [ ] Verify session is invalidated on password change
- [ ] Test concurrent session limits (if implemented)
- [ ] Verify session fixation protection

### 1.4 Password Security
- [ ] Test password complexity requirements (8+ chars, uppercase, lowercase, number, special char)
- [ ] Verify passwords are hashed with bcrypt (12 rounds)
- [ ] Test password reset token expiration
- [ ] Verify password reset tokens are single-use
- [ ] Test password change requires current password
- [ ] Verify old passwords are not accepted after change

### 1.5 Multi-Factor Authentication
- [ ] Test MFA enrollment flow
- [ ] Verify MFA is required when enabled
- [ ] Test MFA bypass attempts
- [ ] Verify MFA codes expire after 5 minutes
- [ ] Test MFA code reuse prevention
- [ ] Test MFA backup codes (if implemented)

## 2. Input Validation & Injection

### 2.1 SQL Injection
- [ ] Test all endpoints with SQL injection payloads:
  - `' OR '1'='1`
  - `'; DROP TABLE users; --`
  - `UNION SELECT * FROM users`
  - `1' AND 1=1--`
- [ ] Verify parameterized queries are used everywhere
- [ ] Test with encoded SQL injection payloads
- [ ] Test with time-based blind SQL injection

### 2.2 NoSQL Injection
- [ ] Test with NoSQL injection payloads:
  - `{"$where": "1==1"}`
  - `{"$ne": null}`
  - `{"$gt": ""}`
- [ ] Verify input sanitization prevents NoSQL injection

### 2.3 XSS (Cross-Site Scripting)
- [ ] Test all input fields with XSS payloads:
  - `<script>alert('XSS')</script>`
  - `<img src=x onerror=alert('XSS')>`
  - `javascript:alert('XSS')`
  - `<svg onload=alert('XSS')>`
- [ ] Test stored XSS in user profiles, comments, etc.
- [ ] Test reflected XSS in search parameters
- [ ] Verify CSP headers are set correctly
- [ ] Test with encoded XSS payloads

### 2.4 Command Injection
- [ ] Test with command injection payloads:
  - `; ls -la`
  - `| cat /etc/passwd`
  - `$(whoami)`
  - `` `id` ``
- [ ] Verify input sanitization prevents command injection

### 2.5 Path Traversal
- [ ] Test with path traversal payloads:
  - `../../../etc/passwd`
  - `..\\..\\..\\windows\\system32\\config\\sam`
  - `%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd`
- [ ] Verify file access is restricted to allowed directories

### 2.6 SSRF (Server-Side Request Forgery)
- [ ] Test with internal network addresses:
  - `http://localhost:8080`
  - `http://127.0.0.1:3000`
  - `http://169.254.169.254` (AWS metadata)
- [ ] Test with file protocol:
  - `file:///etc/passwd`
- [ ] Verify URL validation for external requests

## 3. Business Logic

### 3.1 Authorization Bypass
- [ ] Test accessing other users' data by changing IDs
- [ ] Test accessing admin endpoints with regular user token
- [ ] Test horizontal privilege escalation
- [ ] Test vertical privilege escalation
- [ ] Test accessing resources without proper ownership

### 3.2 Rate Limiting
- [ ] Test rate limiting on all endpoints
- [ ] Verify rate limits are per-IP
- [ ] Test rate limit bypass with different headers
- [ ] Test rate limit bypass with X-Forwarded-For

### 3.3 Resource Exhaustion
- [ ] Test with extremely large payloads
- [ ] Test with deeply nested JSON
- [ ] Test with many concurrent requests
- [ ] Test file upload size limits
- [ ] Test database query complexity

## 4. Data Protection

### 4.1 Sensitive Data Exposure
- [ ] Verify passwords are never returned in API responses
- [ ] Verify MFA secrets are never returned
- [ ] Verify API keys are never returned
- [ ] Check for sensitive data in error messages
- [ ] Verify sensitive data is encrypted at rest
- [ ] Check for sensitive data in logs

### 4.2 PII Handling
- [ ] Verify PII is masked in logs
- [ ] Test data export functionality
- [ ] Verify data deletion is complete
- [ ] Test data export includes only authorized data

### 4.3 Encryption
- [ ] Verify encryption key is not hardcoded
- [ ] Verify TLS 1.2+ is enforced
- [ ] Test encryption of sensitive fields
- [ ] Verify encryption keys are rotated

## 5. API Security

### 5.1 CORS
- [ ] Test CORS with unauthorized origins
- [ ] Verify credentials are not exposed to unauthorized origins
- [ ] Test CORS with wildcard origins
- [ ] Verify CORS headers are properly set

### 5.2 Content Security Policy
- [ ] Verify CSP header is set
- [ ] Test CSP bypass techniques
- [ ] Verify unsafe-inline/unsafe-eval are minimized

### 5.3 HTTP Security Headers
- [ ] Verify X-Content-Type-Options: nosniff
- [ ] Verify X-Frame-Options: DENY
- [ ] Verify X-XSS-Protection: 1; mode=block
- [ ] Verify Strict-Transport-Security
- [ ] Verify Referrer-Policy
- [ ] Verify Permissions-Policy

### 5.4 HTTP Methods
- [ ] Test that only allowed methods are accepted
- [ ] Verify OPTIONS method returns proper CORS headers
- [ ] Test with uncommon HTTP methods (TRACE, TRACK, etc.)

## 6. Microsoft Graph Integration

### 6.1 Token Security
- [ ] Verify access tokens are encrypted at rest
- [ ] Verify tokens are not logged
- [ ] Test token refresh mechanism
- [ ] Verify expired tokens are handled gracefully

### 6.2 Scope Validation
- [ ] Verify only consented scopes are used
- [ ] Test with insufficient scopes
- [ ] Test scope escalation attempts

### 6.3 Error Handling
- [ ] Test with invalid tokens
- [ ] Test with expired tokens
- [ ] Test with revoked permissions
- [ ] Verify errors don't expose sensitive information

## 7. Frontend Security

### 7.1 Client-Side Validation
- [ ] Test that client-side validation can be bypassed
- [ ] Verify server-side validation is always enforced
- [ ] Test with modified JavaScript

### 7.2 Storage Security
- [ ] Verify tokens are not stored in localStorage (if applicable)
- [ ] Verify sensitive data is not stored in cookies without HttpOnly
- [ ] Test session storage security

### 7.3 Clickjacking
- [ ] Test if application can be embedded in iframe
- [ ] Verify X-Frame-Options header

## 8. Infrastructure

### 8.1 Server Configuration
- [ ] Verify unnecessary ports are closed
- [ ] Verify server software is up to date
- [ ] Test for default credentials
- [ ] Verify directory listing is disabled

### 8.2 Database Security
- [ ] Verify database is not directly accessible from internet
- [ ] Test database user privileges
- [ ] Verify sensitive data is encrypted
- [ ] Test database backup security

### 8.3 Dependencies
- [ ] Run `npm audit` to check for vulnerable dependencies
- [ ] Verify all dependencies are up to date
- [ ] Test for known CVEs in dependencies

## 9. Denial of Service

### 9.1 Rate Limiting
- [ ] Test rate limiting effectiveness
- [ ] Test distributed rate limiting
- [ ] Verify rate limiting doesn't affect legitimate users

### 9.2 Resource Exhaustion
- [ ] Test with large file uploads
- [ ] Test with long-running requests
- [ ] Test with many concurrent connections
- [ ] Verify connection limits

## 10. Compliance

### 10.1 Logging
- [ ] Verify all security events are logged
- [ ] Verify logs include IP addresses
- [ ] Verify logs include user IDs
- [ ] Verify logs are tamper-proof
- [ ] Verify log retention policy

### 10.2 Audit Trail
- [ ] Verify all sensitive actions are audited
- [ ] Verify audit logs cannot be modified
- [ ] Test audit log export

### 10.3 Data Retention
- [ ] Verify data retention policies are enforced
- [ ] Test data deletion after retention period
- [ ] Verify soft-deleted data is purged after grace period
