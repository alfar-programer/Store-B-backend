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

/**
 * Send order notification email to admin when a new order is placed
 * @param {Object} order - The newly created order object from DB
 * @param {Object} user  - The customer user record (with name, email, phone)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendOrderNotificationEmail(order, user) {
  const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!ADMIN_EMAIL) {
    console.warn('⚠️  ADMIN_NOTIFICATION_EMAIL is not set. Skipping order notification.');
    return { success: false, error: 'ADMIN_NOTIFICATION_EMAIL not configured' };
  }

  if (!isConfigured()) {
    console.error('❌ Cannot send order notification: email service not configured.');
    return { success: false, error: 'Email service not configured' };
  }

  // Parse items from the order (stored as JSON string)
  let items = [];
  try {
    items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
  } catch {
    items = [];
  }

  // Parse shipping address
  let shippingAddress = null;
  try {
    shippingAddress = typeof order.shippingAddress === 'string'
      ? JSON.parse(order.shippingAddress)
      : order.shippingAddress;
  } catch {
    shippingAddress = null;
  }

  // Format the order date
  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short'
      })
    : new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short'
      });

  // Build items rows HTML
  const itemsRows = items.map(item => {
    const name  = item.title || item.name || `Product #${item.id || item.productId}`;
    const qty   = item.quantity || 1;
    const price = parseFloat(item.price || 0).toFixed(2);
    const subtotal = (qty * parseFloat(item.price || 0)).toFixed(2);
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;color:#333;">${name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:center;color:#555;">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:right;color:#555;">$${price}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-weight:600;color:#333;">$${subtotal}</td>
      </tr>`;
  }).join('');

  // Build shipping address block
  const addressHtml = shippingAddress
    ? `
      <div style="margin-top:20px;background:#f0f7ff;border-left:4px solid #4f86f7;padding:15px 20px;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 6px;font-weight:700;color:#2563eb;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">📦 Delivery Address</p>
        <p style="margin:0;color:#374151;line-height:1.6;">
          ${[
            shippingAddress.fullName || shippingAddress.name || user.name,
            shippingAddress.street || shippingAddress.address,
            shippingAddress.city,
            shippingAddress.state,
            shippingAddress.postalCode || shippingAddress.zip,
            shippingAddress.country
          ].filter(Boolean).join(', ')}
        </p>
      </div>`
    : '<p style="color:#9ca3af;font-style:italic;margin-top:16px;">No delivery address provided.</p>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Order Notification</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#06b6d4 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:1px;text-transform:uppercase;">WarmTouch Store</p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:700;">🛍️ New Order Received</h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Order #${order.id} &nbsp;·&nbsp; ${orderDate}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px;">

          <!-- Customer Info -->
          <h2 style="margin:0 0 16px;font-size:16px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:10px;">👤 Customer Details</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:14px;width:120px;">Name</td>
              <td style="padding:6px 0;color:#111827;font-weight:600;font-size:14px;">${user.name || order.customerName || '—'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:14px;">Email</td>
              <td style="padding:6px 0;color:#2563eb;font-size:14px;">${user.email || '—'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:14px;">Phone</td>
              <td style="padding:6px 0;color:#111827;font-size:14px;">${user.phone || '—'}</td>
            </tr>
          </table>

          <!-- Items Table -->
          <h2 style="margin:28px 0 16px;font-size:16px;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:10px;">🛒 Ordered Items</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <thead>
              <tr style="background:#1e3a8a;">
                <th style="padding:11px 12px;text-align:left;color:#fff;font-size:13px;font-weight:600;">Product</th>
                <th style="padding:11px 12px;text-align:center;color:#fff;font-size:13px;font-weight:600;">Qty</th>
                <th style="padding:11px 12px;text-align:right;color:#fff;font-size:13px;font-weight:600;">Unit Price</th>
                <th style="padding:11px 12px;text-align:right;color:#fff;font-size:13px;font-weight:600;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>

          <!-- Total -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:0;">
            <tr>
              <td style="padding:14px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-top:none;border-radius:0 0 8px 8px;">
                <span style="float:left;font-weight:700;color:#166534;font-size:15px;">💰 Order Total</span>
                <span style="float:right;font-weight:800;color:#166534;font-size:18px;">$${parseFloat(order.total || 0).toFixed(2)}</span>
                <div style="clear:both;"></div>
              </td>
            </tr>
          </table>

          <!-- Shipping Address -->
          ${addressHtml}

        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">This is an automated notification from WarmTouch Store admin system.</p>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Please do not reply to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    console.log(`📧 Sending order notification email for Order #${order.id} to: ${ADMIN_EMAIL}`);

    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `🛍️ New Order #${order.id} — ${order.customerName || user.name} ($${parseFloat(order.total || 0).toFixed(2)})`,
      html,
    });

    if (result.error) {
      console.error('❌ Resend API error (order notification):', result.error);
      return { success: false, error: result.error.message || JSON.stringify(result.error) };
    }

    const messageId = result.data?.id || result.id;
    console.log(`✅ Order notification email sent. Message ID: ${messageId}`);
    return { success: true, messageId };

  } catch (err) {
    console.error('❌ Failed to send order notification email:', {
      error: err.message,
      orderId: order.id,
      stack: err.stack
    });
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendVerificationEmail,
  sendOrderNotificationEmail,
  generateOTP,
  isConfigured,
  EMAIL_VERIFICATION_ENABLED,
};

