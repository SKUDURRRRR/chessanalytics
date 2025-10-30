# Chess.com OAuth Authentication Setup Guide

## Overview

Chess.com OAuth authentication has been added to the application, allowing users to sign in with their Chess.com accounts. This guide will walk you through the complete setup process.

## Frontend Implementation ✅

The frontend has been updated with Chess.com authentication support:

### Files Modified
- `src/contexts/AuthContext.tsx` - Added `signInWithChessCom()` and support for `chess_com` provider
- `src/pages/LoginPage.tsx` - Added Chess.com login button
- `src/pages/SignUpPage.tsx` - Added Chess.com sign up button

### UI Changes
- Login and signup pages now display three OAuth options in a row: Google, Chess.com, and Lichess
- Chess.com button features a green knight icon to match Chess.com branding
- All OAuth buttons are styled consistently

## Backend Configuration Required

### Step 1: Register OAuth Application with Chess.com

**Important:** Chess.com's OAuth system may have specific requirements or limitations. Check their current API documentation.

1. Visit the Chess.com Developer Portal or API documentation
2. Look for OAuth application registration (typically at https://www.chess.com/clubs/forum/view/developer-api)
3. Register a new OAuth application with the following settings:

   **Application Name:** Your App Name (e.g., "ChessData Analytics")

   **Redirect URI:**
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```

   **Scopes Required:**
   - User profile information (email, username)
   - Basic account access

4. After registration, you'll receive:
   - **Client ID**
   - **Client Secret**

   **Save these credentials securely - you'll need them for Supabase configuration.**

### Step 2: Configure Supabase Custom OAuth Provider

Since Chess.com is not a default Supabase provider, you'll need to configure it as a custom OAuth provider.

#### Option A: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Providers**
3. Scroll down to find the option to add a custom OAuth provider
4. If Chess.com is listed, select it and configure
5. If not listed, you'll need to configure it as a generic OAuth2 provider

#### Option B: Using Supabase Custom OAuth Configuration

If Chess.com is not natively supported by Supabase, you may need to:

1. Contact Supabase support to add Chess.com as a provider
2. Or implement a custom OAuth flow using Chess.com's OAuth2 endpoints
3. Use Supabase Edge Functions as a proxy for the OAuth flow

### Chess.com OAuth2 Endpoints (Verify with Current Documentation)

Based on typical OAuth2 implementation, Chess.com likely uses:

```
Authorization URL: https://oauth.chess.com/oauth/authorize
Token URL: https://oauth.chess.com/oauth/token
User Info URL: https://api.chess.com/pub/player/{username}
```

**⚠️ Important:** These URLs may have changed. Always refer to Chess.com's official API documentation.

### Step 3: Configure in Supabase

Once you have the OAuth credentials from Chess.com:

1. In Supabase Dashboard → **Authentication → Providers**
2. Add/Configure Chess.com OAuth:
   - **Client ID:** [Your Chess.com Client ID]
   - **Client Secret:** [Your Chess.com Client Secret]
   - **Redirect URL:** `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
   - **Scopes:** (as required by Chess.com, typically `openid profile email`)

3. Enable the provider
4. Save the configuration

### Step 4: Test the Integration

1. Navigate to your login page
2. Click "Sign in with Chess.com"
3. You should be redirected to Chess.com's authorization page
4. Authorize the application
5. You should be redirected back to your app and logged in

## Current Status

### ✅ Completed
- Frontend code updated with Chess.com OAuth support
- AuthContext updated to handle chess_com provider
- Login and signup pages updated with Chess.com buttons
- UI styled consistently with green Chess.com branding

### 🔧 Configuration Required
- Register OAuth application with Chess.com
- Configure Chess.com as OAuth provider in Supabase
- Test the complete OAuth flow

## Alternative: Using Chess.com API Without OAuth

If Chess.com OAuth is not available or feasible, consider these alternatives:

### Option 1: Username-Based Linking
Instead of OAuth, allow users to:
1. Sign up with email/password or Google/Lichess OAuth
2. Link their Chess.com username in their profile
3. Fetch their Chess.com data using the public API

**Benefits:**
- Easier to implement
- No OAuth registration required
- Still provides access to Chess.com data

**Limitations:**
- Can't verify Chess.com account ownership
- Users must manually enter their username

### Option 2: Hybrid Approach
1. Use OAuth for Google and Lichess
2. Use username linking for Chess.com
3. Optionally add Chess.com OAuth later when/if available

## Implementation Notes

### Code Changes Summary

**AuthContext.tsx:**
```typescript
// Added chess_com to provider type
signInWithOAuth: (provider: 'google' | 'lichess' | 'chess_com') => Promise<{ error: any }>

// Added convenience method
signInWithChessCom: () => Promise<{ error: any }>
```

**LoginPage.tsx & SignUpPage.tsx:**
```typescript
// Updated handler to accept chess_com
const handleOAuthLogin = async (provider: 'google' | 'lichess' | 'chess_com') => {
  // ... existing code
}

// Added Chess.com button
<button onClick={() => handleOAuthLogin('chess_com')}>
  <span className="text-green-500">♞</span>
  <span>Chess.com</span>
</button>
```

## Troubleshooting

### Chess.com OAuth Not Working

1. **Check Redirect URI:** Must exactly match what's configured in Chess.com OAuth app
2. **Verify Client Credentials:** Ensure Client ID and Secret are correct
3. **Check Scopes:** Make sure you're requesting the correct scopes
4. **Review Supabase Logs:** Check Authentication logs in Supabase dashboard
5. **Test Chess.com OAuth Directly:** Use a tool like Postman to test Chess.com's OAuth flow

### Supabase Doesn't Support Chess.com

If Supabase doesn't natively support Chess.com OAuth:

1. **Use Supabase Edge Functions:** Implement custom OAuth flow
2. **Contact Supabase Support:** Request Chess.com provider addition
3. **Use Alternative Method:** Implement username linking instead

## Security Considerations

1. **Keep Credentials Secret:** Never commit Client ID/Secret to version control
2. **Use Environment Variables:** Store credentials in Supabase dashboard or env vars
3. **Validate Redirect URIs:** Only allow whitelisted redirect URIs
4. **Handle Token Securely:** Let Supabase manage OAuth tokens
5. **Test Thoroughly:** Test the complete OAuth flow in staging before production

## Resources

- Chess.com API Documentation: https://www.chess.com/news/view/published-data-api
- Chess.com Developer Portal: [Check Chess.com website for current URL]
- Supabase OAuth Documentation: https://supabase.com/docs/guides/auth/social-login
- Supabase Custom OAuth: https://supabase.com/docs/guides/auth/social-login/auth-custom

## Next Steps

1. ✅ Frontend implementation complete
2. 🔧 Register OAuth app with Chess.com
3. 🔧 Configure in Supabase
4. 🔧 Test end-to-end OAuth flow
5. 🔧 Deploy to production
6. ✅ Update documentation

## Support

If you encounter issues:
1. Check Chess.com API documentation for current OAuth implementation
2. Review Supabase authentication logs
3. Test with other OAuth providers (Google, Lichess) to isolate the issue
4. Consider using username linking as a fallback

---

**Note:** Chess.com's OAuth implementation may have changed since this documentation was written. Always refer to Chess.com's official API documentation for the most current information.
