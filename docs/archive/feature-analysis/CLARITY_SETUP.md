# Microsoft Clarity Setup Guide

Microsoft Clarity has been successfully installed and configured! Follow these steps to complete the setup:

## ✅ What's Already Done

- ✅ Installed `@microsoft/clarity` package
- ✅ Created clarity utility functions in `src/lib/clarity.ts`
- ✅ Integrated Clarity initialization in `src/main.tsx`
- ✅ Added environment variable configuration

## 📋 Next Steps

### 1. Get Your Clarity Project ID

1. Go to [Microsoft Clarity](https://clarity.microsoft.com/)
2. Sign in with your Microsoft account
3. Click **"Add new project"** or select an existing project
4. Enter your project details:
   - **Project name**: Chess Analytics
   - **Website URL**: Your website URL (e.g., https://yoursite.com)
5. Copy your **Project ID** (looks like: `abc123xyz`)

### 2. Configure Your Environment

1. Create a `.env` file in the project root (if you don't have one):
   ```bash
   cp env.example .env
   ```

2. Add your Clarity Project ID to `.env`:
   ```env
   VITE_CLARITY_PROJECT_ID=your_actual_project_id_here
   ```

3. **Important**: Make sure `.env` is in your `.gitignore` (it should be by default)

### 3. Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to your app

3. Check the browser console - you should see:
   ```
   Microsoft Clarity initialized successfully
   ```

4. Go to [Clarity Dashboard](https://clarity.microsoft.com/) and verify sessions are being recorded

## 🎯 Advanced Features

The integration includes several useful functions you can use anywhere in your app:

### Track Custom User Sessions

```typescript
import { identifyUser, setClarityTag } from './lib/clarity'

// Identify a user (useful after login)
identifyUser('user-123')

// Add custom tags to sessions
setClarityTag('subscription', 'pro')
setClarityTag('gameType', 'rapid')
```

### Upgrade Important Sessions

```typescript
import { upgradeSession } from './lib/clarity'

// Upgrade session for detailed recording (e.g., when user encounters an error)
upgradeSession('checkout_error')
upgradeSession('critical_interaction')
```

## 🔒 Privacy Considerations

Microsoft Clarity automatically masks sensitive data like:
- Email addresses
- Credit card numbers
- Phone numbers
- Other PII

You can configure additional masking in the Clarity dashboard under **Settings > Privacy**.

## 🚀 Production Deployment

For production, make sure to set the environment variable on your hosting platform:

### Vercel
```bash
vercel env add VITE_CLARITY_PROJECT_ID production
```

### Netlify
```bash
netlify env:set VITE_CLARITY_PROJECT_ID your_project_id
```

### Other platforms
Add `VITE_CLARITY_PROJECT_ID` to your environment variables in your hosting dashboard.

## 📊 What You Can Track with Clarity

Once setup is complete, you'll be able to:

- 🖱️ **Session Recordings**: Watch how users interact with your chess app
- 🔥 **Heatmaps**: See where users click and scroll
- 📈 **Dashboard**: View key metrics like rage clicks, dead clicks, and quick backs
- 🐛 **Error Tracking**: Identify JavaScript errors affecting users
- 📱 **Device Analytics**: Understand which devices your users prefer

## 🆘 Troubleshooting

### Clarity not initializing?

1. Check that `VITE_CLARITY_PROJECT_ID` is set in your `.env` file
2. Restart your dev server after adding environment variables
3. Verify the Project ID is correct in the Clarity dashboard

### No sessions appearing?

1. Wait a few minutes - there can be a delay
2. Make sure your Project ID is from a valid Clarity project
3. Check browser console for any error messages

### Console warnings about Clarity?

This is normal if the environment variable is not set. In development, it's safe to ignore if you haven't configured Clarity yet.

## 📝 Notes

- Clarity is **free** with **no session limits**
- Data retention: 60 days on free plan, 90 days on paid plan
- Works great alongside other analytics (Google Analytics, etc.)
- Minimal performance impact on your site

## 🔗 Useful Links

- [Clarity Dashboard](https://clarity.microsoft.com/)
- [Clarity Documentation](https://learn.microsoft.com/en-us/clarity/)
- [Privacy & Compliance](https://learn.microsoft.com/en-us/clarity/setup-and-installation/privacy-disclosure)

---

**Need help?** Check the [Clarity Support Center](https://learn.microsoft.com/en-us/clarity/) or review the integration code in `src/lib/clarity.ts`.
