# 📧 Email Configuration Guide

## Quick Setup for Gmail

1. **Enable 2-Factor Authentication**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Click "Generate"
   - Copy the 16-character password (remove spaces)

3. **Update .env File**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_FROM="Store B <noreply@storeb.com>"
   ```

4. **Restart Server**
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

## Alternative: SendGrid (Free Tier)

1. Sign up at: https://sendgrid.com/
2. Create API Key
3. Update .env:
   ```env
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_USER=apikey
   EMAIL_PASSWORD=your-sendgrid-api-key
   EMAIL_FROM="Store B <noreply@storeb.com>"
   ```

## Testing Without Email

For development/testing, you can use **Ethereal Email** (fake SMTP):

1. Visit: https://ethereal.email/
2. Click "Create Ethereal Account"
3. Copy credentials to .env
4. Check emails at: https://ethereal.email/messages

## Verify Configuration

After updating .env, check server logs for:
```
✅ Email service is ready to send messages
```

If you see an error, double-check your credentials.
