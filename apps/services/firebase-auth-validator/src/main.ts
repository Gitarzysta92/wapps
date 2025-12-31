import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firebase Admin
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

// Validation endpoint for ingress-nginx external auth
app.get('/validate', async (req: Request, res: Response) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('No Authorization header provided');
      return res.status(401).json({ error: 'No authorization header' });
    }

    // Extract Bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token || token === authHeader) {
      console.log('Invalid Authorization header format');
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Set headers for downstream services
    res.setHeader('X-User-Id', decodedToken.uid);
    res.setHeader('X-User-Email', decodedToken.email || '');
    res.setHeader('X-Auth-Time', decodedToken.auth_time?.toString() || '');
    
    // Add custom claims if present
    if (decodedToken.custom_claims) {
      res.setHeader('X-User-Claims', JSON.stringify(decodedToken.custom_claims));
    }
    
    console.log(`✅ Token validated for user: ${decodedToken.uid}`);
    
    // Return 200 for successful validation
    res.status(200).json({ 
      authenticated: true,
      uid: decodedToken.uid 
    });
    
  } catch (error: any) {
    console.error('❌ Token validation failed:', error.message);
    
    // Return appropriate error status
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    return res.status(401).json({ error: 'Token validation failed' });
  }
});

// Optional: endpoint that allows anonymous access
app.get('/validate-optional', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  // If no auth header, allow through as anonymous
  if (!authHeader) {
    res.setHeader('X-Anonymous', 'true');
    return res.status(200).json({ authenticated: false, anonymous: true });
  }

  // If auth header present, validate it
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    res.setHeader('X-User-Id', decodedToken.uid);
    res.setHeader('X-User-Email', decodedToken.email || '');
    
    return res.status(200).json({ 
      authenticated: true,
      uid: decodedToken.uid 
    });
  } catch (error) {
    // If token is invalid, allow through as anonymous
    res.setHeader('X-Anonymous', 'true');
    return res.status(200).json({ authenticated: false, anonymous: true });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Firebase Auth Validator running on port ${PORT}`);
  console.log(`📋 Firebase Project ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
});

