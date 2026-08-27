import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Request ID for tracing
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// Content type validation
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    // Only enforce Content-Type when there's a request body
    const hasBody = req.body && Object.keys(req.body).length > 0;
    if (hasBody) {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(415).json({
          success: false,
          error: 'Content-Type must be application/json',
        });
      }
    }
  }
  next();
};

// Request size limiting
export const requestSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large. Maximum size is 10MB.',
    });
  }
  next();
};

// SQL injection prevention - additional layer beyond parameterized queries
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  // Skip for OAuth callback - the code parameter contains special characters
  if (req.path.includes('/auth/callback') || req.path.includes('/consent')) {
    return next();
  }

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION\s+SELECT)/i,
    /(--|\#|\/\*)/,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
    /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  const hasSQLInjection = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

  if (hasSQLInjection) {
    console.warn('[Security] SQL injection blocked:', req.method, req.path, 'query:', JSON.stringify(req.query).substring(0, 200));
    return res.status(400).json({
      success: false,
      error: 'Invalid request format',
    });
  }

  next();
};

// NoSQL injection prevention
export const preventNoSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  // Skip for OAuth callback - the code parameter contains special characters
  if (req.path.includes('/auth/callback') || req.path.includes('/consent')) {
    return next();
  }

  const noSQLPatterns = [
    /\$where/,
    /\$regex/,
    /\$ne/,
    /\$gt/,
    /\$lt/,
    /\$exists/,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return noSQLPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  const hasNoSQLInjection = checkValue(req.body) || checkValue(req.query);

  if (hasNoSQLInjection) {
    console.warn('[Security] NoSQL injection blocked:', req.method, req.path, 'query:', JSON.stringify(req.query).substring(0, 200));
    return res.status(400).json({
      success: false,
      error: 'Invalid request format',
    });
  }

  next();
};

// Path traversal prevention
export const preventPathTraversal = (req: Request, res: Response, next: NextFunction) => {
  const pathPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e%2f/i,
    /%2e%2e\//i,
  ];

  const checkPath = (path: string): boolean => {
    return pathPatterns.some(pattern => pattern.test(path));
  };

  if (checkPath(req.path) || checkPath(req.url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid path',
    });
  }

  next();
};

// Command injection prevention
export const preventCommandInjection = (req: Request, res: Response, next: NextFunction) => {
  // Skip for OAuth callback - the code parameter contains special characters
  if (req.path.includes('/auth/callback') || req.path.includes('/consent')) {
    return next();
  }

  const commandPatterns = [
    /[;&|`$]/,
    /\$\(/,
    /\${/,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return commandPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  const hasCommandInjection = checkValue(req.body) || checkValue(req.query);

  if (hasCommandInjection) {
    console.warn('[Security] Command injection blocked:', req.method, req.path, 'query:', JSON.stringify(req.query).substring(0, 200));
    return res.status(400).json({
      success: false,
      error: 'Invalid request format',
    });
  }

  next();
};

// Input sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Remove any potential XSS characters from request body
  if (req.body) {
    sanitizeObject(req.body);
  }
  if (req.query) {
    const originalQuery = JSON.stringify(req.query);
    sanitizeObject(req.query);
    const sanitizedQuery = JSON.stringify(req.query);
    if (originalQuery !== sanitizedQuery) {
      console.warn('[Security] Input sanitized:', req.method, req.path, 'original:', originalQuery.substring(0, 200), 'sanitized:', sanitizedQuery.substring(0, 200));
    }
  }
  next();
}

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove script tags and event handlers
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Prevent parameter pollution
export function preventPollution(req: Request, res: Response, next: NextFunction) {
  const allowedParams = ['page', 'limit', 'type', 'status', 'search', 'sort', 'order'];

  for (const key in req.query) {
    if (!allowedParams.includes(key) && Array.isArray(req.query[key])) {
      console.warn('[Security] Parameter pollution blocked:', req.method, req.path, 'param:', key, 'value:', JSON.stringify(req.query[key]).substring(0, 100));
      return res.status(400).json({
        success: false,
        error: 'Parameter pollution detected',
      });
    }
  }

  next();
}

// Security headers
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}

// IP blocking for repeated failed attempts
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const BLOCK_THRESHOLD = 10;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

export const ipBlocking = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  const attempts = failedAttempts.get(ip);

  if (attempts) {
    // Check if block has expired
    if (now - attempts.lastAttempt > BLOCK_DURATION) {
      failedAttempts.delete(ip);
    } else if (attempts.count >= BLOCK_THRESHOLD) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please try again later.',
      });
    }
  }

  next();
};

export const recordFailedAttempt = (ip: string) => {
  const now = Date.now();
  const attempts = failedAttempts.get(ip);

  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = now;
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  }
};

export const clearFailedAttempts = (ip: string) => {
  failedAttempts.delete(ip);
};

// Sensitive data masking for logs
export const maskSensitiveData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken', 'mfaSecret'];
  const masked = { ...data };

  for (const field of sensitiveFields) {
    if (field in masked) {
      masked[field] = '***MASKED***';
    }
  }

  return masked;
};

// Validate Origin header for CSRF protection
export const validateOrigin = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000').split(',');

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      error: 'Origin not allowed',
    });
  }

  next();
};

// Prevent clickjacking
export const preventClickjacking = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

// MIME type sniffing prevention
export const preventMimeSniffing = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

// Cache control for sensitive endpoints
export const cacheControl = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// CSRF protection - validate Origin/Referer for state-changing requests
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
    
    if (origin) {
      const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed.trim()));
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          error: 'CSRF validation failed - origin not allowed',
        });
      }
    }
  }
  next();
};

// Double submit cookie pattern for CSRF (alternative approach)
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const validateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = (req as any).session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token validation failed',
    });
  }
  
  next();
};
