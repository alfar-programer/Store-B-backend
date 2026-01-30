# 📧 Email Configuration Guide - Resend Setup

## Overview

This application uses **Resend** for sending verification emails during user registration. Email verification is **required** by default - users cannot login without verifying their email address.

---

## Quick Setup with Resend (Recommended)

### Step 1: Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get Your API Key

1. Log in to your Resend dashboard
2. Navigate to **API Keys** section: [https://resend.com/api-keys](https://resend.com/api-keys)
3. Click **Create API Key**
4. Give it a name (e.g., "Store B Backend")
5. Select permissions: **Sending access**
6. Click **Add**
7. **Copy the API key** (it starts with `re_`) - you won't be able to see it again!

### Step 3: Configure Email Sender

For **Development/Testing**:
- You can use Resend's default sender: `onboarding@resend.dev`
- No domain verification needed
- Limited to 100 emails per day

For **Production**:
1. Go to **Domains** section: [https://resend.com/domains](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records shown to your domain provider
5. Wait for verification (usually takes a few minutes)
6. Use an email like: `noreply@yourdomain.com`

### Step 4: Update Environment Variables

Create or update your `.env` file in the `server` directory:

```env
# Resend Email Configuration
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=onboarding@resend.dev

# Optional: Enable/disable email verification
EMAIL_VERIFICATION_ENABLED=true
```

**Important Notes:**
- Replace `re_your_actual_api_key_here` with your actual API key from Step 2
- For production, replace `onboarding@resend.dev` with your verified domain email
- Never commit your `.env` file to version control!

### Step 5: Restart the Server

```bash
# Stop the server (Ctrl+C in the terminal)
npm start
# or
npm run dev
```

### Step 6: Verify Configuration

When the server starts, you should see:
```
✅ Email service initialized with Resend
📧 Sending emails from: onboarding@resend.dev
✅ Email verification is enabled and configured
```

If you see errors, check that:
- Your API key is correct and starts with `re_`
- The `EMAIL_FROM` address is valid
- You've restarted the server after updating `.env`

---

## Development Mode (Skip Email Verification)

If you want to test the application **without** setting up email (not recommended for production):

1. Update your `.env` file:
   ```env
   EMAIL_VERIFICATION_ENABLED=false
   ```

2. Restart the server

3. Users will be **automatically verified** upon registration

**Warning:** This is only for development! Never use this in production.

---

## Testing Email Delivery

### Test Registration Flow

1. Register a new user account
2. Check your email inbox for the verification code
3. Enter the 6-digit code to verify your account
4. Login with your credentials

### Check Resend Logs

1. Go to [https://resend.com/emails](https://resend.com/emails)
2. View all sent emails and their delivery status
3. Click on any email to see details and preview

---

## Troubleshooting

### Error: "Email service not configured"

**Problem:** `RESEND_API_KEY` is missing or invalid

**Solution:**
1. Check your `.env` file has `RESEND_API_KEY=re_...`
2. Verify the API key is correct (copy it again from Resend)
3. Restart the server

### Error: "Failed to send verification email"

**Possible causes:**
1. **Invalid API key** - Check your Resend dashboard
2. **Invalid sender email** - Must be verified domain or use `onboarding@resend.dev`
3. **Rate limit exceeded** - Free tier has limits
4. **Network issues** - Check your internet connection

**Solution:**
- Check server logs for detailed error messages
- Verify your Resend account status
- Check Resend dashboard for any issues

### Emails not arriving

1. **Check spam folder** - Verification emails might be filtered
2. **Check Resend logs** - See if email was sent successfully
3. **Verify sender domain** - Make sure DNS records are correct
4. **Use resend code** - Click "Resend verification code" on the frontend

### Server shows: "Email verification is DISABLED"

**Problem:** `EMAIL_VERIFICATION_ENABLED` is set to `false`

**Solution:**
1. Update `.env`: `EMAIL_VERIFICATION_ENABLED=true`
2. Configure Resend (see steps above)
3. Restart server

---

## Free Tier Limits

Resend Free Tier includes:
- ✅ 3,000 emails per month
- ✅ 100 emails per day
- ✅ 1 verified domain
- ✅ Full API access

For higher limits, check [Resend Pricing](https://resend.com/pricing)

---

## Security Best Practices

1. **Never commit `.env` file** - Add it to `.gitignore`
2. **Use environment variables** - Don't hardcode API keys
3. **Verify your domain** - Don't use `onboarding@resend.dev` in production
4. **Enable email verification** - Keep `EMAIL_VERIFICATION_ENABLED=true` in production
5. **Monitor usage** - Check Resend dashboard regularly
6. **Rotate API keys** - If compromised, create new ones immediately

---

## Need Help?

- **Resend Documentation:** [https://resend.com/docs](https://resend.com/docs)
- **Resend Support:** [https://resend.com/support](https://resend.com/support)
- **Check server logs** for detailed error messages
- **Review `.env.example`** for required variables

---

## Summary Checklist

- [ ] Created Resend account
- [ ] Generated API key
- [ ] Added `RESEND_API_KEY` to `.env`
- [ ] Set `EMAIL_FROM` in `.env`
- [ ] Restarted server
- [ ] Verified configuration in server logs
- [ ] Tested registration and email delivery
- [ ] (Production only) Verified custom domain

Once all steps are complete, your email verification system is ready! 🎉
