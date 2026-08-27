import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { query } from '../db/connection';
import { getAccessTokenForTenant } from './msalAuth';
import { AuthenticationError } from '../types/m365';
import { maskPII } from './encryption';

const GRAPH_BASE_URL_V1 = 'https://graph.microsoft.com/v1.0';
const GRAPH_BASE_URL_BETA = 'https://graph.microsoft.com/beta';

export enum GraphErrorType {
  AUTH_ERROR = 'auth_error',
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  PERMISSION_DENIED = 'permission_denied',
  THROTTLE = 'throttle',
  TENANT_VALIDATION_ERROR = 'tenant_validation_error',
}

export interface GraphError {
  type: GraphErrorType;
  message: string;
  statusCode?: number;
  operation: string;
  endpoint: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface GraphRequestOptions {
  tenantConnectionId: string;
  endpoint: string;
  method?: 'GET';
  queryParams?: Record<string, string>;
  select?: string[];
  filter?: string;
  top?: number;
  expand?: string[];
  headers?: Record<string, string>;
}

export interface GraphPageResult {
  data: any;
  nextLink?: string;
  done: boolean;
}

export class GraphHttpClient {
  private accessToken: string;
  private tenantId: string;
  private clientV1: AxiosInstance;
  private clientBeta: AxiosInstance;
  private maxRetries: number;

  constructor(accessToken: string, tenantId: string, maxRetries = 3) {
    this.accessToken = accessToken;
    this.tenantId = tenantId;
    this.maxRetries = maxRetries;
    this.clientV1 = axios.create({
      baseURL: GRAPH_BASE_URL_V1,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    this.clientBeta = axios.create({
      baseURL: GRAPH_BASE_URL_BETA,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private getClient(endpoint: string): AxiosInstance {
    // Use beta client if endpoint starts with /beta/
    if (endpoint.startsWith('/beta/')) {
      return this.clientBeta;
    }
    return this.clientV1;
  }

  private getCleanEndpoint(endpoint: string): string {
    // Remove /beta/ prefix since it's handled by the base URL
    if (endpoint.startsWith('/beta/')) {
      return endpoint.substring(5); // Remove '/beta'
    }
    return endpoint;
  }

  async request<T = any>(options: GraphRequestOptions): Promise<T> {
    const {
      endpoint,
      method = 'GET',
      queryParams,
      select,
      filter,
      top,
      expand,
      headers,
    } = options;

    const client = this.getClient(endpoint);
    const cleanEndpoint = this.getCleanEndpoint(endpoint);

    let url = cleanEndpoint;
    const params: Record<string, string> = { ...queryParams };

    if (select) params['$select'] = select.join(',');
    if (filter) params['$filter'] = filter;
    if (top) params['$top'] = String(top);
    if (expand) params['$expand'] = expand.join(',');

    // Manually construct query string to avoid encoding $ character
    const paramParts = Object.entries(params).map(([key, value]) => `${key}=${value}`);
    const queryString = paramParts.join('&');
    const fullUrl = queryString ? `${cleanEndpoint}?${queryString}` : cleanEndpoint;

    let lastError: any;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<T> = await client.request({
          url: fullUrl,
          method,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            ...headers,
          },
        });
        return response.data;
      } catch (error: any) {
        lastError = error;
        const graphError = this.classifyError(error, endpoint);
        if (!graphError.retryable || attempt === this.maxRetries - 1) {
          throw graphError;
        }
        const delay = graphError.retryAfter
          ? graphError.retryAfter * 1000
          : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw this.classifyError(lastError, endpoint);
  }

  async paginatedRequest<T = any>(options: GraphRequestOptions & { maxPages?: number }): Promise<T[]> {
    const maxPages = options.maxPages || 50;
    let results: T[] = [];
    let nextLink: string | undefined = options.endpoint;
    let pageCount = 0;

    while (nextLink && pageCount < maxPages) {
      pageCount++;
      let url: string = nextLink;
      let isNextLink = nextLink.startsWith('http');

      if (!isNextLink) {
        const params: Record<string, string> = { ...options.queryParams };
        if (options.select) params['$select'] = options.select.join(',');
        if (options.filter) params['$filter'] = options.filter;
        if (options.top) params['$top'] = String(options.top);
        if (options.expand) params['$expand'] = options.expand.join(',');
        // Manually construct query string to avoid encoding $ character
        const paramParts = Object.entries(params).map(([key, value]) => `${key}=${value}`);
        const qs = paramParts.join('&');
        url = qs ? `${nextLink}?${qs}` : nextLink;
      }

      let lastError: any;
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const client = this.getClient(options.endpoint);
          const response: AxiosResponse<any> = await client.get(url, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
          });
          const data: any = response.data;
          const pageResults = data.value || [];
          results = results.concat(pageResults);
          nextLink = data['@odata.nextLink'];
          break;
        } catch (error: any) {
          lastError = error;
          const graphError = this.classifyError(error, options.endpoint);
          if (!graphError.retryable || attempt === this.maxRetries - 1) {
            throw graphError;
          }
          const delay = graphError.retryAfter
            ? graphError.retryAfter * 1000
            : Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return results;
  }

  private classifyError(error: any, endpoint: string): GraphError {
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers?.['retry-after'];
      let retryAfter: number | undefined;
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader);
        if (!isNaN(parsed)) {
          retryAfter = parsed;
        } else {
          const retryDate = new Date(retryAfterHeader);
          retryAfter = Math.max(1, Math.floor((retryDate.getTime() - Date.now()) / 1000));
        }
      }
      return {
        type: GraphErrorType.THROTTLE,
        message: `Rate limited on ${endpoint}. Retry after ${retryAfter || 'exponential backoff'} seconds`,
        statusCode: 429,
        operation: endpoint,
        endpoint,
        retryable: true,
        retryAfter,
      };
    }

    if (error.response?.status === 401) {
      return {
        type: GraphErrorType.AUTH_ERROR,
        message: 'Authentication failed - token may be expired or revoked',
        statusCode: 401,
        operation: endpoint,
        endpoint,
        retryable: false,
      };
    }

    if (error.response?.status === 403) {
      return {
        type: GraphErrorType.PERMISSION_DENIED,
        message: 'Insufficient permissions to access this resource',
        statusCode: 403,
        operation: endpoint,
        endpoint,
        retryable: false,
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        type: GraphErrorType.TIMEOUT,
        message: 'Request timed out',
        operation: endpoint,
        endpoint,
        retryable: true,
      };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        type: GraphErrorType.NETWORK_ERROR,
        message: 'Network error - unable to reach Microsoft Graph',
        operation: endpoint,
        endpoint,
        retryable: true,
      };
    }

    return {
      type: GraphErrorType.API_ERROR,
      message: error.message || 'Unknown API error',
      statusCode: error.response?.status || 500,
      operation: endpoint,
      endpoint,
      retryable: false,
    };
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request<{ value: any[] }>({
        tenantConnectionId: this.tenantId,
        endpoint: '/organization',
        top: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export async function getGraphClient(tenantConnectionId: string): Promise<GraphHttpClient | null> {
  try {
    const accessToken = await getAccessTokenForTenant(tenantConnectionId);
    const connections = await query(
      'SELECT tenant_id FROM tenant_connections WHERE id = ?',
      [tenantConnectionId]
    );
    if (connections.length === 0) return null;

    return new GraphHttpClient(accessToken, (connections[0] as any).tenant_id);
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      console.error(`Graph authentication failed for ${tenantConnectionId}: ${error.message}`);
    } else {
      console.error(`Failed to get access token for Graph client ${tenantConnectionId}:`, error);
    }
    return null;
  }
}

export function maskToken(token: string): string {
  if (!token || token.length <= 12) return '***';
  return token.substring(0, 6) + '...' + token.substring(token.length - 4);
}
