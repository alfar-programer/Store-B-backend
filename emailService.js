const { Resend } = require('resend');
const dotenv = require('dotenv');

dotenv.config();

// Validate email configuration at module load
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_VERIFICATION_ENABLED = process.env.EMAIL_VERIFICATION_ENABLED !== 'false';

let resend = null;
let configurationError = null;

// Initialize Resend client with validation
try {
  if (!RESEND_API_KEY || RESEND_API_KEY === 're_your_resend_api_key_here') {
    configurationError = 'RESEND_API_KEY is not configured or is using placeholder value';
    console.error('❌ Email Service Error:', configurationError);
    console.error('📧 Please set RESEND_API_KEY in your .env file');
    console.error('📧 Get your API key from: https://resend.com/api-keys');
  } else if (!EMAIL_FROM || EMAIL_FROM === 'onboarding@resend.dev') {
    console.warn('⚠️  Using default Resend email address (onboarding@resend.dev)');
    console.warn('⚠️  For production, verify your own domain at: https://resend.com/domains');
  }

  if (!configurationError) {
    resend = new Resend(RESEND_API_KEY);
    console.log('✅ Email service initialized with Resend');
    console.log(`📧 Sending emails from: ${EMAIL_FROM}`);
  }
} catch (error) {
  configurationError = `Failed to initialize Resend: ${error.message}`;
  console.error('❌ Email Service Initialization Error:', error);
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email service is properly configured
 * @returns {boolean} - True if configured
 */
function isConfigured() {
  return !configurationError && resend !== null;
}

/**
 * Send verification email with OTP code using Resend
 * @param {string} to - Recipient email address
 * @param {string} code - 6-digit verification code
 * @param {string} name - Optional recipient name
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendVerificationEmail(to, code, name = 'User') {
  // Check if email verification is enabled
  if (!EMAIL_VERIFICATION_ENABLED) {
    console.log('ℹ️  Email verification is disabled (EMAIL_VERIFICATION_ENABLED=false)');
    return { success: true, messageId: 'verification-disabled' };
  }

  // Validate configuration
  if (configurationError) {
    const error = `Email service not configured: ${configurationError}`;
    console.error('❌ Cannot send email:', error);
    throw new Error(error);
  }

  // Validate email format
  if (!isValidEmail(to)) {
    const error = `Invalid email address: ${to}`;
    console.error('❌ Email validation failed:', error);
    throw new Error(error);
  }

  // Validate code
  if (!code || code.length !== 6) {
    const error = 'Invalid verification code format';
    console.error('❌ Code validation failed:', error);
    throw new Error(error);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <p>Hello ${name},</p>
          <p>Thank you for registering! Please use the verification code below to complete your registration:</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p><strong>This code expires in 10 minutes.</strong></p>
          <p>If you didn't request this verification, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    console.log(`📧 Sending verification email to: ${to}`);

    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: "Verify your email - Action Required",
      html,
    });

    if (result.error) {
      console.error('❌ Resend API error:', result.error);
      throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`);
    }

    console.log(`✅ Verification email sent successfully. Message ID: ${result.data?.id || result.id}`);
    return {
      success: true,
      messageId: result.data?.id || result.id
    };
  } catch (err) {
    console.error('❌ Failed to send verification email:', {
      error: err.message,
      recipient: to,
      stack: err.stack
    });

    // Re-throw with more context
    throw new Error(`Failed to send verification email: ${err.message}`);
  }
}

/**
 * Generate a random 6-digit OTP code
 * @returns {string} - 6-digit code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  sendVerificationEmail,
  generateOTP,
  isConfigured,
  EMAIL_VERIFICATION_ENABLED,
};

