# Chess.com OAuth Authentication Setup Guide

## Overview

Chess.com authentication support has been added to the application frontend. **However, Chess.com does NOT provide public OAuth endpoints** like Google or Lichess do. This guide documents the current implementation status and recommended alternatives.

**⚠️ IMPORTANT:** The Chess.com OAuth button in the UI will not work without special OAuth access from Chess.com (which is not publicly available). See the "Alternative Implementation" section below for the recommended approach.

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

### Step 1: Apply for OAuth Access with Chess.com

**⚠️ CRITICAL:** Unlike Google or Lichess, Chess.com does **NOT** have a public OAuth application registration process available to all developers.

**What you need to know:**
- Chess.com's OAuth system is **not publicly documented**
- There is **no public developer portal** for OAuth registration
- You must **contact Chess.com directly** and request OAuth access
- Approval is **not guaranteed** and depends on Chess.com's evaluation of your use case

**How to request access:**
1. Contact Chess.com through their support channels or developer community
2. Provide detailed information about:
   - Your application/website
   - Your use case for OAuth
   - Expected user volume
   - Why username-based linking is insufficient
3. Wait for Chess.com's response (timeline varies)
4. If approved, they will provide OAuth credentials and endpoint documentation

**Most developers should use username-based linking instead** (see recommended alternative section above).

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

### Chess.com OAuth2 Endpoints

**⚠️ CRITICAL LIMITATION:** Chess.com does **NOT** publish public OAuth endpoints. Unlike Google or Lichess, Chess.com's OAuth system is not publicly documented or available for general third-party applications.

**What this means:**
- There are **no public OAuth URLs** like `oauth.chess.com` that you can use
- The Chess.com Published Data API (https://api.chess.com/pub/player/{username}) is a simple REST API that does **NOT** use OAuth
- To implement OAuth with Chess.com, you must apply directly to Chess.com and request special access
- Most third-party applications cannot use Chess.com OAuth

**If you need Chess.com OAuth:**
1. Contact Chess.com directly through their developer support channels
2. Explain your use case and request OAuth access
3. If approved, they will provide you with the necessary OAuth endpoints and credentials

**Recommended Alternative:** Use username-based linking instead (see below for details)

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

### ⚠️ Known Limitation
- **Chess.com OAuth button will not work** - Chess.com does not provide public OAuth endpoints
- The button is implemented but non-functional without special Chess.com OAuth access

### 🔧 Recommended Next Steps
1. **Implement username-based linking** (recommended - see section below)
2. Consider hiding the Chess.com OAuth button in the UI until OAuth access is obtained
3. OR apply to Chess.com for OAuth access (approval not guaranteed)

## ⭐ Recommended Alternative: Username-Based Linking

**This is the practical approach for most applications.**

Since Chess.com OAuth is not publicly available, the recommended implementation is username-based linking:

### How It Works
1. Users sign up with email/password, Google OAuth, or Lichess OAuth
2. Users link their Chess.com username in their profile settings
3. Your application fetches Chess.com data using the public Published Data API

### Implementation Steps
1. Add a "Chess.com Username" field to user profiles
2. Use the Chess.com Published Data API to fetch user data:
   - API endpoint: `https://api.chess.com/pub/player/{username}`
   - No authentication required
   - Rate limits apply (check Chess.com's documentation)
3. Optionally verify the username exists by making an API call
4. Store the username in your database linked to the user's account

### Benefits
- ✅ **Actually works** - No special access needed
- ✅ **Easy to implement** - Simple API calls
- ✅ **No OAuth complexity** - Direct API integration
- ✅ **Still provides Chess.com data** - Access to games, stats, etc.

### Limitations
- ❌ Can't verify Chess.com account ownership (user could enter any username)
- ❌ Users must manually enter their username
- ❌ Not a true "Sign in with Chess.com" experience

### Code Example
```typescript
// Fetch Chess.com player data
async function getChessComPlayerData(username: string) {
  const response = await fetch(`https://api.chess.com/pub/player/${username}`)
  if (!response.ok) {
    throw new Error('Chess.com username not found')
  }
  return await response.json()
}
```

---

## Alternative: Using Chess.com OAuth (Advanced)

**Note:** This section documents the OAuth approach, but it requires special access from Chess.com that is not publicly available.

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

- Chess.com Published-Data API Documentation: https://support.chess.com/en/articles/9650547-published-data-api
- Chess.com OAuth/Login Documentation: https://www.chess.com/blog/CHESScom/chess-com-oauth-login-connected-board-application
- Chess.com Public API Base Endpoint: https://api.chess.com/pub/ (reference resource)
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

**⚠️ IMPORTANT DISCLAIMER:**

Chess.com does **NOT** provide public OAuth endpoints. The OAuth implementation described in this document requires special access from Chess.com that is not publicly available.

**For most developers, the recommended approach is username-based linking** using Chess.com's Published Data API (`https://api.chess.com/pub/player/{username}`), which is free, public, and does not require OAuth.
