import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrgAuthRequest extends Request {
  orgUser?: {
    userId: string;
    orgId: string;
    role: OrgRole;
  };
}

export const requireOrgRole = (allowedRoles: OrgRole[]) => {
  return async (req: OrgAuthRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Check if user has org context
      if (!decoded.orgId || !decoded.orgRole) {
        return res.status(403).json({ error: 'No organization access' });
      }

      const userRole = decoded.orgRole as OrgRole;
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: userRole
        });
      }

      req.orgUser = {
        userId: decoded.userId,
        orgId: decoded.orgId,
        role: userRole
      };

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

export const requireOrgOwner = () => requireOrgRole(['owner']);
export const requireOrgAdmin = () => requireOrgRole(['owner', 'admin']);
export const requireOrgMember = () => requireOrgRole(['owner', 'admin', 'member']);
