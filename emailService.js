const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Configure email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Verify transporter configuration
transporter.verify(function (error, success) {
    if (error) {
        console.log('❌ Email service configuration error:', error);
        console.warn('⚠️  Email verification will not work until EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are configured in .env');
    } else {
        console.log('✅ Email service is ready to send messages');
    }
});

/**
 * Send verification email with OTP code
 * @param {string} email - Recipient email address
 * @param {string} code - 6-digit verification code
 * @param {string} name - User's name (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function sendVerificationEmail(email, code, name = 'User') {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"Store B" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email Address - Store B',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #333;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.8;
            }
            .code-container {
              background: #f8f9fa;
              border: 2px dashed #667eea;
              border-radius: 8px;
              padding: 25px;
              text-align: center;
              margin: 30px 0;
            }
            .code-label {
              font-size: 14px;
              color: #666;
              margin-bottom: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .code {
              font-size: 36px;
              font-weight: bold;
              color: #667eea;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .expiry {
              font-size: 14px;
              color: #999;
              margin-top: 15px;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .warning p {
              margin: 0;
              color: #856404;
              font-size: 14px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              font-size: 13px;
              color: #999;
              border-top: 1px solid #e9ecef;
            }
            .footer p {
              margin: 5px 0;
            }
            .footer a {
              color: #667eea;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛍️ Store B</h1>
            </div>
            <div class="content">
              <p class="greeting">Hello ${name},</p>
              <p class="message">
                Thank you for creating an account with Store B! To complete your registration and start shopping, 
                please verify your email address using the code below.
              </p>
              
              <div class="code-container">
                <div class="code-label">Your Verification Code</div>
                <div class="code">${code}</div>
                <div class="expiry">⏱️ This code expires in 10 minutes</div>
              </div>
              
              <p class="message">
                Enter this code on the verification page to activate your account. If you didn't create an account 
                with Store B, you can safely ignore this email.
              </p>
              
              <div class="warning">
                <p>
                  <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Store B staff will never 
                  ask for your verification code.
                </p>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Store B. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
            text: `
Hello ${name},

Thank you for creating an account with Store B!

Your verification code is: ${code}

This code expires in 10 minutes.

Please enter this code on the verification page to activate your account.

If you didn't create an account with Store B, you can safely ignore this email.

Security Notice: Never share this code with anyone. Store B staff will never ask for your verification code.

---
This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} Store B. All rights reserved.
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent:', info.messageId);
        console.log('📧 Email sent to:', email);
        return true;
    } catch (error) {
        console.error('❌ Error sending verification email:', error);
        throw error;
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
    transporter,
};
