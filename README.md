# Shopify AI Virtual Try-On App (Optimized Version)

This is an optimized version of the Shopify AI Virtual Try-On app, ready for deployment.

## Features

- Complete OAuth flow with Shopify
- Token storage (file-based for dev, replace with Redis/DB for production)
- AI-powered virtual try-on using NanoBanana API
- Storefront widget for product pages
- Theme app extension for clean installation
- Webhook handling for uninstall and order tracking
- Rate limiting and security guardrails

## Project Structure

```
SHOPIFY/
├── backend/                 # Node.js/Express server
│   ├── src/
│   │   ├── server.js        # Main server entry
│   │   ├── routes/          # API routes (auth, tryon, webhooks, products)
│   │   └── services/        # Storage, AI provider, stats, guardrails
│   ├── package.json
│   └── .env.example
├── ai-virtual-try-on/       # Shopify embedded app (React Router)
│   ├── app/
│   │   ├── shopify.server.ts
│   │   ├── db.server.ts
│   │   └── routes/          # Embedded app routes
│   ├── public/
│   │   └── tryon-widget.js  # Storefront widget
│   ├── shopify.app.toml     # Shopify app configuration
│   ├── package.json
│   ├── .env.example
│   ├── tsconfig.json
│   └── vite.config.ts
└── ai-virtual-try-on/extensions/tryaura-storefront/  # Theme app extension (app embed)
    ├── blocks/tryon-embed.liquid
    └── assets/tryon-widget.js
```

## Quick Start Guide

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (>=20)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- A Shopify partner account and development store
- NanoBanana API key (sign up at [nanobananaapi.ai](https://nanobananaapi.ai))

### 2. Setup Backend

```bash
cd SHOPIFY/backend
cp .env.example .env
npm install
```

Edit `.env` with your values:
- `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` from Shopify Partners
- `NANOBANANA_API_KEY` from NanoBanana
- `BACKEND_URL` and `FRONTEND_URL` will be set later by Shopify CLI

### 3. Setup Frontend (Embedded App)

```bash
cd SHOPIFY/ai-virtual-try-on
cp .env.example .env
npm install
```

### 4. Start Development

In two separate terminals:

**Terminal 1: Backend**
```bash
cd SHOPIFY/backend
npm run dev
```

**Terminal 2: Frontend (creates tunnel)**
```bash
cd SHOPIFY/ai-virtual-try-on
npm run dev
```

### 5. Configure Environment

1. Copy the tunnel URL from the frontend output (look for `https://xxx.trycloudflare.com`)
2. Update `backend/.env`:
   ```
   BACKEND_URL=https://xxx.trycloudflare.com
   FRONTEND_URL=https://xxx.trycloudflare.com
   ```
3. Restart the backend (`npm run dev` in backend terminal)

### 6. Update Shopify Partner Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Select your app (create one if needed)
3. Under **Configuration**:
   - **App URL**: `https://xxx.trycloudflare.com`
   - **Allowed redirection URL(s)**: `https://xxx.trycloudflare.com/auth/callback`
   - **API key and secret**: Should match your `.env`
   - **Scopes**: `read_products,write_products,read_themes,write_themes,read_customers`
4. **Save** changes

### 7. Install the App

Visit the OAuth URL:
```
https://xxx.trycloudflare.com/auth?shop=your-store.myshopify.com
```

Replace `your-store.myshopify.com` with your development store.

### 8. Verify Installation

After successful OAuth, you should be redirected to the embedded app showing your shop name.

Check token storage:
```bash
curl "https://xxx.trycloudflare.com/auth/status?shop=your-store.myshopify.com"
```

Expected response:
```json
{
  "success": true,
  "shop": "your-store.myshopify.com",
  "authenticated": true,
  "hasToken": true
}
```

### 9. Enable Storefront Widget (one click for merchants)

Deploy the theme app extension once (from `ai-virtual-try-on`):

```bash
cd ai-virtual-try-on
npm run deploy
```

Merchants then open the TryAura app → **Storefront** tab → **Enable on my theme**. That opens the theme editor with the Virtual Try-On app embed ready; they click **Save**. No manual upload of `tryon-widget.js`, Liquid snippets, or `settings_schema.json` edits.

The app automatically saves the backend API URL to shop metafields on install.

### 10. Test the Widget

1. Visit your storefront product page
2. Click "Virtual Try-On ✨" button
3. Upload a photo and generate try-on result

## Production Deployment

### 1. Token Storage (Critical)
The current implementation uses file-based storage (`tokens.json`). For production, replace with:
- Redis
- PostgreSQL
- MongoDB
- Or any database of your choice

Modify `backend/src/routes/auth.js` functions:
- `getShopToken`
- `setShopToken`
- `deleteShopToken`
- `loadTokens`/`saveTokens`

### 2. Environment Variables
Set in your production hosting environment:
```env
NODE_ENV=production
BACKEND_URL=https://your-production-domain.com
FRONTEND_URL=https://your-production-domain.com
WEBHOOK_SECRET=your_strong_random_string
API_SECRET=your_strong_admin_secret
```

### 3. Deploy Backend
Deploy to any Node.js hosting service (AWS, Google Cloud, Heroku, Render, etc.) that supports:
- Node.js >=20
- HTTPS
- Environment variables

### 4. Deploy Frontend
Run:
```bash
cd ai-virtual-try-on
npm run build
npm run start
```
Or deploy via Shopify CLI to Shopify hosting.

### 5. Update Partner Dashboard
Replace tunnel URLs with your production domain.

### 6. Monitor and Scale
- Monitor logs for errors
- Consider adding caching for product images
- Scale based on traffic

## API Endpoints

### Authentication
- `GET /auth?shop=xxx.myshopify.com` - Initiate OAuth
- `GET /auth/callback` - OAuth callback
- `GET /auth/status?shop=xxx.myshopify.com` - Check token status
- `GET /auth/token?shop=xxx.myshopify.com` - Get token preview
- `POST /auth/token/delete` - Delete token (webhook)

### Try-On
- `POST /api/tryon` - Generate try-on result
  - Body: `personImage` (file), `productId`, `shop`
  - Returns: `{ success: true, output: "base64-image" }`

### Product Images
- `GET /api/products/:productId/image?shop=xxx.myshopify.com` - Get product image
- `GET /api/products/image-url?shop=xxx.myshopify.com&productIds=1,2,3` - Batch product images

### Webhooks
- `POST /api/webhooks/uninstalled` - App uninstall (clears token)
- `POST /api/webhooks/orders/create` - Order tracking for conversions

## Credits and Costs

### NanoBanana API
- Sign up at [nanobananaapi.ai](https://nanobananaapi.ai) for API key
- Pricing: Check their website for current rates
- Each try-on generation consumes credits

### Hosting Costs
- Backend: Small Node.js instance (e.g., AWS t3.micro, $3-5/month)
- Frontend: Shopify hosting included with app, or self-hosted
- Storage: Optional S3 for images (if enabled)

### Storefront Widget
- No additional costs; runs on customer's browser

## Troubleshooting

### Common Issues
1. **"Missing 'shop' parameter"** - Ensure shop query param is present in OAuth URL
2. **"No access token found"** - Reinstall app via OAuth
3. **"Invalid state parameter"** - Clear cookies or restart OAuth flow
4. **"Could not fetch garment image"** - Verify shop parameter is sent to `/api/products/:productId/image`
5. **"AI generation failed"** - Check NanoBanana API key and quota

### Logs
- Backend console shows detailed logs for OAuth, try-on, and errors
- Check browser console for widget errors
- Storefront widget includes error handling UI

## Support

For issues, check:
1. Backend logs (terminal where `npm run dev` runs)
2. Browser developer tools (console/network tabs)
3. Shopify admin → Notifications → Webhooks (for delivery errors)

Happy selling! 👕