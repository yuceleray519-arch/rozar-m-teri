import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Also fetch the DB user to check roles
    const dbUsers = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
    if (dbUsers.length > 0) {
      req.dbUser = dbUsers[0];
    } else {
      // Auto-register if not found? 
      // Let's create it.
      const email = decodedToken.email || '';
      const role = email === 'admin@rozar.com' ? 'admin' : 'personnel';
      
      const result = await db.insert(users)
        .values({
          uid: decodedToken.uid,
          email: email,
          role: role,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email: decodedToken.email || '' },
        })
        .returning();
      req.dbUser = result[0];
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.dbUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Requires admin role' });
  }
  next();
};
