const { OAuth2Client } = require('google-auth-library');

/**
 * Google OAuth Configuration
 * Uses google-auth-library for stateless token verification
 * No passport, no sessions - just verify ID tokens from Google popup
 */

// Initialize Google OAuth2 Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID Token
 * Called when frontend sends credential token from Google popup
 * 
 * @param {string} token - ID token from Google Sign-In
 * @returns {Object} Verified user payload with email, name, picture, sub (Google ID)
 */
async function verifyGoogleToken(token) {
    try {
        // Verify the token with Google's servers
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app
        });

        // Get the user payload from the verified token
        const payload = ticket.getPayload();

        // payload contains:
        // - sub: Google user ID (unique identifier)
        // - email: User's email
        // - name: User's full name
        // - picture: Profile picture URL
        // - email_verified: Boolean

        return {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            avatar: payload.picture,
            emailVerified: payload.email_verified
        };
    } catch (error) {
        console.error('❌ Google token verification failed:', error.message);
        throw new Error('Invalid Google token');
    }
}

/**
 * Validate Google OAuth Configuration
 * Checks if required environment variables are set
 */
function validateGoogleConfig() {
    if (!process.env.GOOGLE_CLIENT_ID) {
        console.error('❌ GOOGLE_CLIENT_ID is not set in environment variables');
        return false;
    }

    console.log('✅ Google OAuth configuration validated');
    return true;
}

module.exports = {
    verifyGoogleToken,
    validateGoogleConfig
};
