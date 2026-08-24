import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment or generate one
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Ensure key is 32 bytes for AES-256
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
};

// Encrypt sensitive data
export const encrypt = (data: string): string => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Decrypt sensitive data
export const decrypt = (encryptedData: string): string => {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract iv, authTag, and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

// Hash sensitive data (one-way)
export const hash = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Generate secure random token
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate MFA secret
export const generateMFASecret = (): string => {
  return crypto.randomBytes(20).toString('base64');
};

// Hash password with bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Mask PII for logging
export const maskPII = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const piiFields = [
    'email', 'phone', 'ssn', 'password', 'token', 'secret',
    'apiKey', 'accessToken', 'refreshToken', 'mfaSecret',
    'firstName', 'lastName', 'address', 'city', 'state', 'zip'
  ];

  const masked = { ...data };

  for (const field of piiFields) {
    if (field in masked) {
      const value = masked[field];
      if (typeof value === 'string' && value.length > 0) {
        // Show first and last character, mask the rest
        masked[field] = value[0] + '*'.repeat(Math.min(value.length - 2, 10)) + (value.length > 1 ? value[value.length - 1] : '');
      }
    }
  }

  return masked;
};

// Validate encryption key is set
export const validateEncryptionKey = (): boolean => {
  return !!process.env.ENCRYPTION_KEY;
};
