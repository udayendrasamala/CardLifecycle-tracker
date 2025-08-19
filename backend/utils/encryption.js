// // utils/encryption.js - Simple encryption utilities for PII data
// const crypto = require('crypto');

// // Use environment variable or default key (change in production!)
// const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0TrSVXhu8sBTBlkyuK7vH3OF7P8v6izp';
// console.log('Using encryption key:', ENCRYPTION_KEY);
// const ALGORITHM = 'aes-256-cbc';
// const IV_LENGTH = 16; // For AES, this is always 16

// /**
//  * Encrypt text using AES-256-CBC
//  * @param {string} text - Text to encrypt
//  * @returns {string} - Encrypted text with IV prepended
//  */
// const encrypt = (text) => {
//   if (!text) return null;
  
//   try {
//     // Generate random IV for each encryption
//     const iv = crypto.randomBytes(IV_LENGTH);
//     const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY);
    
//     let encrypted = cipher.update(text, 'utf8', 'hex');
//     encrypted += cipher.final('hex');
    
//     // Prepend IV to encrypted data
//     return iv.toString('hex') + ':' + encrypted;
//   } catch (error) {
//     console.error('Encryption error:', error);
//     throw new Error('Failed to encrypt data');
//   }
// };

// /**
//  * Decrypt text using AES-256-CBC
//  * @param {string} text - Encrypted text with IV prepended
//  * @returns {string} - Decrypted text
//  */
// const decrypt = (text) => {
//   if (!text) return null;
  
//   try {
//     // Split IV and encrypted data
//     const textParts = text.split(':');
//     if (textParts.length !== 2) {
//       throw new Error('Invalid encrypted data format');
//     }
    
//     const iv = Buffer.from(textParts[0], 'hex');
//     const encryptedText = textParts[1];
    
//     const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY);
//     let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');
    
//     return decrypted;
//   } catch (error) {
//     console.error('Decryption error:', error);
//     throw new Error('Failed to decrypt data');
//   }
// };

// /**
//  * Hash sensitive data for comparison (one-way)
//  * @param {string} text - Text to hash
//  * @returns {string} - SHA-256 hash
//  */
// const hash = (text) => {
//   if (!text) return null;
  
//   return crypto.createHash('sha256').update(text).digest('hex');
// };

// /**
//  * Generate a secure random key for encryption
//  * @returns {string} - Random 32-character key
//  */
// const generateKey = () => {
//   return crypto.randomBytes(32).toString('hex');
// };

// /**
//  * Mask sensitive data for display
//  * @param {string} text - Text to mask
//  * @param {number} visibleChars - Number of characters to keep visible at end
//  * @returns {string} - Masked text
//  */
// const maskData = (text, visibleChars = 4) => {
//   if (!text || text.length <= visibleChars) return text;
  
//   const masked = '*'.repeat(text.length - visibleChars);
//   return masked + text.slice(-visibleChars);
// };

// /**
//  * Mask mobile number for display
//  * @param {string} mobile - Mobile number
//  * @returns {string} - Masked mobile number
//  */
// const maskMobile = (mobile) => {
//   if (!mobile) return null;
  
//   // Remove any non-digit characters
//   const digits = mobile.replace(/\D/g, '');
  
//   if (digits.length === 10) {
//     return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
//   } else if (digits.length === 12 && digits.startsWith('91')) {
//     return `+91-****-**${digits.slice(-4)}`;
//   }
  
//   return maskData(mobile, 4);
// };

// /**
//  * Mask PAN for display
//  * @param {string} pan - PAN number
//  * @returns {string} - Masked PAN
//  */
// const maskPAN = (pan) => {
//   if (!pan) return null;
  
//   if (pan.length === 10) {
//     return `${pan.slice(0, 4)}****${pan.slice(-2)}`;
//   }
  
//   return maskData(pan, 2);
// };

// /**
//  * Validate encryption key strength
//  * @param {string} key - Encryption key to validate
//  * @returns {boolean} - True if key is strong enough
//  */
// const validateKey = (key) => {
//   if (!key || key.length < 32) return false;
  
//   // Check for complexity (letters, numbers, special chars)
//   const hasLower = /[a-z]/.test(key);
//   const hasUpper = /[A-Z]/.test(key);
//   const hasNumber = /\d/.test(key);
//   const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(key);
  
//   return hasLower && hasUpper && hasNumber && hasSpecial;
// };

// /**
//  * Secure compare two strings (prevents timing attacks)
//  * @param {string} a - First string
//  * @param {string} b - Second string
//  * @returns {boolean} - True if strings match
//  */
// const secureCompare = (a, b) => {
//   if (!a || !b || a.length !== b.length) return false;
  
//   return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// };

// /**
//  * Generate a secure token for API authentication
//  * @param {number} length - Token length (default 32)
//  * @returns {string} - Secure random token
//  */
// const generateToken = (length = 32) => {
//   return crypto.randomBytes(length).toString('hex');
// };

// module.exports = {
//   encrypt,
//   decrypt,
//   hash,
//   generateKey,
//   maskData,
//   maskMobile,
//   maskPAN,
//   validateKey,
//   secureCompare,
//   generateToken
// };
// utils/encryption.js - Simple encryption utilities for PII data
const crypto = require('crypto');

// Use environment variable or default key (change in production!)
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || '0TrSVXhu8sBTBlkyuK7vH3OF7P8v6izp'; // must be 32 chars
console.log('Using encryption key:', ENCRYPTION_KEY);

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, always 16 bytes

// Ensure key is 32 bytes (AES-256 requires 32)
const KEY = Buffer.from(ENCRYPTION_KEY, 'utf8');
if (KEY.length !== 32) {
  throw new Error(
    `Invalid ENCRYPTION_KEY length: ${KEY.length}. Must be exactly 32 bytes`
  );
}

/**
 * Encrypt text using AES-256-CBC
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text with IV prepended
 */
const encrypt = (text) => {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Prepend IV so it can be used in decrypt
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt text using AES-256-CBC
 * @param {string} text - Encrypted text with IV prepended
 * @returns {string} - Decrypted text
 */
const decrypt = (text) => {
  if (!text) return null;

  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = textParts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash sensitive data for comparison (one-way)
 * @param {string} text - Text to hash
 * @returns {string} - SHA-256 hash
 */
const hash = (text) => {
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
};

/**
 * Generate a secure random key for encryption
 * @returns {string} - Random 32-character key
 */
const generateKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Mask sensitive data for display
 * @param {string} text - Text to mask
 * @param {number} visibleChars - Number of characters to keep visible at end
 * @returns {string} - Masked text
 */
const maskData = (text, visibleChars = 4) => {
  if (!text || text.length <= visibleChars) return text;

  const masked = '*'.repeat(text.length - visibleChars);
  return masked + text.slice(-visibleChars);
};

/**
 * Mask mobile number for display
 * @param {string} mobile - Mobile number
 * @returns {string} - Masked mobile number
 */
const maskMobile = (mobile) => {
  if (!mobile) return null;

  const digits = mobile.replace(/\D/g, '');

  if (digits.length === 10) {
    return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+91-****-**${digits.slice(-4)}`;
  }

  return maskData(mobile, 4);
};

/**
 * Mask PAN for display
 * @param {string} pan - PAN number
 * @returns {string} - Masked PAN
 */
const maskPAN = (pan) => {
  if (!pan) return null;

  if (pan.length === 10) {
    return `${pan.slice(0, 4)}****${pan.slice(-2)}`;
  }

  return maskData(pan, 2);
};

/**
 * Validate encryption key strength
 * @param {string} key - Encryption key to validate
 * @returns {boolean} - True if key is strong enough
 */
const validateKey = (key) => {
  if (!key || key.length < 32) return false;

  const hasLower = /[a-z]/.test(key);
  const hasUpper = /[A-Z]/.test(key);
  const hasNumber = /\d/.test(key);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(key);

  return hasLower && hasUpper && hasNumber && hasSpecial;
};

/**
 * Secure compare two strings (prevents timing attacks)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings match
 */
const secureCompare = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * Generate a secure token for API authentication
 * @param {number} length - Token length (default 32)
 * @returns {string} - Secure random token
 */
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateKey,
  maskData,
  maskMobile,
  maskPAN,
  validateKey,
  secureCompare,
  generateToken,
};
