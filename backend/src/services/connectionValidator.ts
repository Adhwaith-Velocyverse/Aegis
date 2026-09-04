import { query } from '../db/connection';
import { GraphHttpClient } from './graphHttpClient';
import { GraphPowerShellService } from './graphPowerShellService';
import { ExchangeOnlineService } from './exchangeOnlineService';
import { M365ConnectionState, AuthenticationMode, HealthCheckResult } from '../types/m365';

export class TenantValidator {
  async validateTenant(
    client: GraphHttpClient,
    expectedTenantId: string,
    expectedAzureTenantId?: string
  ): Promise<{ valid: boolean; actualTenantId?: string; error?: string }> {
    try {
      const orgData = await client.request<{ value: { id: string; verifiedDomains: { name: string }[] }[] }>({
        tenantConnectionId: expectedTenantId,
        endpoint: '/organization',
        select: ['id', 'verifiedDomains'],
      });

      const org = orgData.value?.[0];
      if (!org) {
        return { valid: false, error: 'No organization data returned from Microsoft Graph' };
      }

      const actualTenantId = org.id;
      const verifiedDomains: string[] = (org.verifiedDomains || [])
        .map((d: any) => (typeof d === 'string' ? d : d?.name))
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean);
      const expected = expectedTenantId.trim().toLowerCase();
      const expectedAzure = expectedAzureTenantId?.trim().toLowerCase();

      const isMatch =
        actualTenantId.toLowerCase() === expected ||
        (expectedAzure ? actualTenantId.toLowerCase() === expectedAzure : false) ||
        verifiedDomains.includes(expected);

      if (!isMatch) {
        return {
          valid: false,
          actualTenantId,
          error: `Tenant mismatch: expected ${expectedTenantId}, authenticated as ${actualTenantId}${verifiedDomains.length ? ` (verified domains: ${verifiedDomains.join(', ')})` : ''}`,
        };
      }

      return { valid: true, actualTenantId };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Tenant validation failed' };
    }
  }

  async validateTenantWithPowerShell(
    psService: GraphPowerShellService,
    expectedTenantId: string,
    expectedAzureTenantId?: string
  ): Promise<{ valid: boolean; actualTenantId?: string; error?: string }> {
    try {
      const orgs = await psService.executeCommand('Get-MgOrganization', { Select: 'id,verifiedDomains' });
      const org = orgs[0];
      if (!org) {
        return { valid: false, error: 'No organization data returned from Microsoft Graph PowerShell' };
      }
      const actualTenantId = org.Id || org.id;
      const verifiedDomainsRaw = org.VerifiedDomains || org.verifiedDomains || [];
      const verifiedDomains: string[] = (verifiedDomainsRaw || [])
        .map((d: any) => (typeof d === 'string' ? d : d?.name))
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean);
      const expected = expectedTenantId.trim().toLowerCase();
      const expectedAzure = expectedAzureTenantId?.trim().toLowerCase();

      const isMatch =
        (actualTenantId || '').toLowerCase() === expected ||
        (expectedAzure ? actualTenantId.toLowerCase() === expectedAzure : false) ||
        verifiedDomains.includes(expected);

      if (!isMatch) {
        return {
          valid: false,
          actualTenantId,
          error: `Tenant mismatch: expected ${expectedTenantId}, authenticated as ${actualTenantId}${verifiedDomains.length ? ` (verified domains: ${verifiedDomains.join(', ')})` : ''}`,
        };
      }

      return { valid: true, actualTenantId };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Tenant validation failed' };
    }
  }
}

export class PermissionValidator {
  async validateGraphPermissions(client: GraphHttpClient, requiredScopes: string[]): Promise<{ valid: boolean; missingScopes: string[] }> {
    if (requiredScopes.length === 0) {
      return { valid: true, missingScopes: [] };
    }

    try {
      await client.request({
        tenantConnectionId: '',
        endpoint: '/organization',
        top: 1,
      });
      return { valid: true, missingScopes: [] };
    } catch (error: any) {
      if (error.statusCode === 403) {
        return { valid: false, missingScopes: requiredScopes };
      }
      return { valid: true, missingScopes: [] };
    }
  }

  async validateSecurityPermissions(client: GraphHttpClient): Promise<{ valid: boolean; missingScopes: string[] }> {
    const requiredScopes = ['SecurityAlert.Read.All', 'SecurityIncident.Read.All'];

    try {
      await client.request({
        tenantConnectionId: '',
        endpoint: '/security/alerts_v2',
        top: 1,
      });
      return { valid: true, missingScopes: [] };
    } catch (error: any) {
      if (error.statusCode === 403) {
        return { valid: false, missingScopes: requiredScopes };
      }
      return { valid: true, missingScopes: [] };
    }
  }

  async validateGraphPermissionsWithPowerShell(
    psService: GraphPowerShellService,
    requiredScopes: string[]
  ): Promise<{ valid: boolean; missingScopes: string[] }> {
    if (requiredScopes.length === 0) {
      return { valid: true, missingScopes: [] };
    }

    try {
      await psService.executeCommand('Get-MgContext');
      return { valid: true, missingScopes: [] };
    } catch (error: any) {
      return { valid: false, missingScopes: requiredScopes };
    }
  }
}

export class ConnectionHealthService {
  async checkGraphHealth(client: GraphHttpClient): Promise<{ healthy: boolean; error?: string }> {
    try {
      await client.request({
        tenantConnectionId: '',
        endpoint: '/organization',
        top: 1,
      });
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  async checkExchangeHealth(exchangeService: ExchangeOnlineService): Promise<{ healthy: boolean; error?: string }> {
    try {
      await exchangeService.executeCommand('Get-TransportConfig');
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  async performFullHealthCheck(
    graphClient: GraphHttpClient | null,
    exchangeService: ExchangeOnlineService | null,
    tenantId: string,
    expectedAzureTenantId?: string
  ): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      status: M365ConnectionState.HEALTHY,
      graphAvailable: false,
      exchangeAvailable: false,
      tenantValidated: false,
      permissionsValidated: false,
      checkedAt: new Date(),
      details: [],
      errors: [],
    };

    const tenantValidator = new TenantValidator();
    const permissionValidator = new PermissionValidator();

    if (graphClient) {
      const graphHealth = await this.checkGraphHealth(graphClient);
      result.graphAvailable = graphHealth.healthy;
      result.details.push(`Graph health: ${graphHealth.healthy ? 'OK' : 'FAILED'}`);
      if (!graphHealth.healthy) {
        result.errors.push(graphHealth.error || 'Graph health check failed');
      }

      const tenantResult = await tenantValidator.validateTenant(graphClient, tenantId, expectedAzureTenantId);
      result.tenantValidated = tenantResult.valid;
      result.details.push(`Tenant validation: ${tenantResult.valid ? 'OK' : 'FAILED'}`);
      if (!tenantResult.valid) {
        result.errors.push(tenantResult.error || 'Tenant validation failed');
      }

      const permResult = await permissionValidator.validateGraphPermissions(graphClient, []);
      result.permissionsValidated = permResult.valid;
      result.details.push(`Permission validation: ${permResult.valid ? 'OK' : 'FAILED'}`);
      if (!permResult.valid) {
        result.errors.push(`Missing scopes: ${permResult.missingScopes.join(', ')}`);
      }

      const securityPermResult = await permissionValidator.validateSecurityPermissions(graphClient);
      if (!securityPermResult.valid) {
        result.details.push(`Security permissions validation: FAILED`);
        result.errors.push(`Missing security scopes: ${securityPermResult.missingScopes.join(', ')}`);
        if (result.status === M365ConnectionState.HEALTHY) {
          result.status = M365ConnectionState.DEGRADED;
        }
      }
    }

    if (exchangeService) {
      const exchangeHealth = await this.checkExchangeHealth(exchangeService);
      result.exchangeAvailable = exchangeHealth.healthy;
      result.details.push(`Exchange health: ${exchangeHealth.healthy ? 'OK' : 'FAILED'}`);
      if (!exchangeHealth.healthy) {
        result.errors.push(exchangeHealth.error || 'Exchange health check failed');
      }
    }

    if (result.errors.length > 0) {
      result.status = result.graphAvailable || result.exchangeAvailable
        ? M365ConnectionState.DEGRADED
        : M365ConnectionState.ERROR;
    } else {
      result.status = M365ConnectionState.HEALTHY;
    }

    return result;
  }
}
