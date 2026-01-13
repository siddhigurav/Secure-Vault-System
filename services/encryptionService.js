const crypto = require('crypto');
require('dotenv').config();

/**
 * Encryption Service
 * Implements AES-256-GCM encryption with key hierarchy (DEK + KEK)
 */

// Master Encryption Key (KEK - Key Encryption Key)
// In production, this should come from HSM or cloud KMS
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY;

if (!MASTER_KEY || MASTER_KEY.length !== 64) {
  throw new Error('MASTER_ENCRYPTION_KEY must be a 256-bit hex string (64 characters)');
}

const MASTER_KEY_BUFFER = Buffer.from(MASTER_KEY, 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const DEK_LENGTH = 32; // 256 bits

/**
 * Generate a random Data Encryption Key (DEK)
 * @returns {Buffer} 256-bit random key
 */
function generateDEK() {
  return crypto.randomBytes(DEK_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 * @param {Buffer} key - Encryption key
 * @param {string|Buffer} plaintext - Data to encrypt
 * @returns {Object} { ciphertext, iv, authTag }
 */
function encryptWithKey(key, plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const plaintextBuffer = Buffer.isBuffer(plaintext) 
    ? plaintext 
    : Buffer.from(plaintext, 'utf8');
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintextBuffer),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Buffer} key - Decryption key
 * @param {string} ciphertext - Base64 encoded ciphertext
 * @param {string} iv - Base64 encoded IV
 * @param {string} authTag - Base64 encoded auth tag
 * @returns {string} Decrypted plaintext
 */
function decryptWithKey(key, ciphertext, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);
  
  return plaintext.toString('utf8');
}

/**
 * Encrypt a secret value
 * 1. Generate random DEK
 * 2. Encrypt secret with DEK
 * 3. Encrypt DEK with master key
 * @param {string} secretValue - Plaintext secret
 * @returns {Object} { encryptedValue, encryptedDEK }
 */
function encryptSecret(secretValue) {
  // Generate random DEK
  const dek = generateDEK();
  
  // Encrypt secret with DEK
  const encryptedSecret = encryptWithKey(dek, secretValue);
  
  // Encrypt DEK with master key
  const encryptedDEK = encryptWithKey(MASTER_KEY_BUFFER, dek);
  
  // Combine encrypted secret components
  const encryptedValue = JSON.stringify({
    ciphertext: encryptedSecret.ciphertext,
    iv: encryptedSecret.iv,
    authTag: encryptedSecret.authTag
  });
  
  // Combine encrypted DEK components
  const encryptedDEKString = JSON.stringify({
    ciphertext: encryptedDEK.ciphertext,
    iv: encryptedDEK.iv,
    authTag: encryptedDEK.authTag
  });
  
  return {
    encryptedValue,
    encryptedDEK: encryptedDEKString
  };
}

/**
 * Decrypt a secret value
 * 1. Decrypt DEK using master key
 * 2. Decrypt secret using DEK
 * 3. Securely erase DEK from memory
 * @param {string} encryptedValue - JSON string with encrypted secret
 * @param {string} encryptedDEK - JSON string with encrypted DEK
 * @returns {string} Plaintext secret
 */
function decryptSecret(encryptedValue, encryptedDEK) {
  try {
    // Parse encrypted components
    const secretData = JSON.parse(encryptedValue);
    const dekData = JSON.parse(encryptedDEK);
    
    // Decrypt DEK using master key
    const dekString = decryptWithKey(
      MASTER_KEY_BUFFER,
      dekData.ciphertext,
      dekData.iv,
      dekData.authTag
    );
    const dek = Buffer.from(dekString, 'base64');
    
    // Decrypt secret using DEK
    const plaintext = decryptWithKey(
      dek,
      secretData.ciphertext,
      secretData.iv,
      secretData.authTag
    );
    
    // Securely erase DEK from memory
    dek.fill(0);
    
    return plaintext;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Mask a secret value for display
 * Shows first 8 characters followed by bullets
 * @param {string} secretValue - Plaintext secret
 * @returns {string} Masked secret
 */
function maskSecret(secretValue) {
  if (!secretValue || secretValue.length === 0) {
    return '••••••••';
  }
  
  const visibleChars = Math.min(8, secretValue.length);
  const visible = secretValue.substring(0, visibleChars);
  const masked = '•'.repeat(Math.max(16, secretValue.length - visibleChars));
  
  return visible + masked;
}

/**
 * Generate a cryptographic hash for audit log chaining
 * @param {string} data - Data to hash
 * @param {string} previousHash - Previous hash in chain
 * @returns {string} SHA-256 hash
 */
function generateHash(data, previousHash = '') {
  const hash = crypto.createHash('sha256');
  hash.update(previousHash + data);
  return hash.digest('hex');
}

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
  generateHash,
  generateDEK
};
