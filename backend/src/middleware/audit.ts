import { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection';

export interface AuditLog {
  userId?: string;
  orgId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  status: 'success' | 'failure';
}

export const auditLog = async (log: AuditLog) => {
  try {
    const auditId = require('uuid').v4();
    await query(
      `INSERT INTO audit_logs (id, user_id, org_id, action, resource, resource_id, ip_address, user_agent, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        auditId,
        log.userId || null,
        log.orgId || null,
        log.action,
        log.resource,
        log.resourceId || null,
        log.ipAddress || null,
        log.userAgent || null,
        log.details ? JSON.stringify(log.details) : null,
        log.status,
      ]
    );
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    // Log successful requests
    auditLog({
      userId: (req as any).user?.userId,
      orgId: (req as any).orgUser?.orgId,
      action: req.method,
      resource: req.route?.path || req.path,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: res.statusCode < 400 ? 'success' : 'failure',
    }).catch(() => {});
    
    return originalSend.call(this, data);
  };
  
  next();
};
