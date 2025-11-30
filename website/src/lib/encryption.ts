import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get encryption key from environment variable
 * Falls back to a default key for development (NOT for production!)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  
  if (!key) {
    console.warn('⚠️ WARNING: ENCRYPTION_KEY not set in environment variables. Using default key (NOT SECURE FOR PRODUCTION!)');
    // Default key for development only - should be replaced in production
    return crypto.scryptSync('drivedrop-default-encryption-key', 'salt', KEY_LENGTH)
  }
  
  // If key is hex-encoded, decode it
  if (key.length === KEY_LENGTH * 2) {
    return Buffer.from(key, 'hex')
  }
  
  // Otherwise, derive key from string
  return crypto.scryptSync(key, 'salt', KEY_LENGTH)
}

/**
 * Encrypt sensitive data (like SSN)
 * Returns base64-encoded string in format: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const authTag = cipher.getAuthTag()
    
    // Combine iv, authTag, and encrypted data
    const result = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
    
    return result
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data (like SSN)
 * Input format: iv:authTag:encryptedData (base64-encoded)
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey()
    
    // Split the encrypted data
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const [ivBase64, authTagBase64, encrypted] = parts
    
    const iv = Buffer.from(ivBase64, 'base64')
    const authTag = Buffer.from(authTagBase64, 'base64')
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash data for comparison (one-way, cannot be decrypted)
 * Useful for storing passwords or creating checksums
 */
export function hash(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
}

/**
 * Generate a secure random token
 * Useful for password reset tokens, verification codes, etc.
 */
export function generateToken(length: number = 32): string {
  return crypto
    .randomBytes(length)
    .toString('hex')
}

/**
 * Generate a secure random password
 */
export function generatePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  const randomBytes = crypto.randomBytes(length)
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length]
  }
  
  return password
}
