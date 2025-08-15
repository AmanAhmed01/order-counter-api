// File: api/order-counter.js
// Vercel serverless function to fetch real order count from Shopify Admin API.
// Secure: reads token from environment variable; optional basic check for App Proxy origin.

export default async function handler(req, res) {
  // Allow CORS requests from your Shopify store
  res.setHeader('Access-Control-Allow-Origin', 'https://acetech.pk');  // Only allow your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');  // Allow specific methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');  // Allow headers like Content-Type

  // Cache response at the edge to reduce API calls
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const shop = process.env.SHOPIFY_STORE_DOMAIN; 
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

  // Check if the environment variables are set
  if (!shop || !token) {
    return res.status(500).json({
      error: `Missing environment variables: ${
        !shop ? "SHOPIFY_STORE_DOMAIN" : ""
      } ${!token ? "SHOPIFY_ADMIN_API_TOKEN" : ""}`.trim()
    });
  }

  const url = `https://${shop}/admin/api/2025-07/orders/count.json`;

  try {
    const r = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Shopify API error', details: text });
    }

    const data = await r.json();
    return res.status(200).json({ count: data.count });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
