const { Resend } = require('resend');
const dotenv = require('dotenv');

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send verification email with OTP code using Resend
 * @param {string} email - Recipient email address
 * @param {string} code - 6-digit verification code
 * @returns {Promise<boolean>} - Success status
 */
async function sendVerificationEmail(email, code) {
  const html = `
    <h2>Email Verification</h2>
    <p>Your verification code is:</p>
    <h1>${code}</h1>
    <p>This code expires in 10 minutes.</p>
    `;

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: "Verify your email",
      html,
    });

    console.log("📧 Resend email sent:", result.id);
    return true;
  } catch (err) {
    console.error("❌ Resend email error:", err);
    return false;
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
};
