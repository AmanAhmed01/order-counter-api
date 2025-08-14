// File: api/order-counter.js
// Vercel serverless function to fetch real order count from Shopify Admin API.
// Secure: reads token from environment variable; optional basic check for App Proxy origin.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const shop = process.env.SHOPIFY_STORE_DOMAIN; 
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const allowedShop = shop;

  if (!shop || !token) {
    return res.status(500).json({
      error: `Missing environment variables: ${
        !shop ? "SHOPIFY_STORE_DOMAIN" : ""
      } ${!token ? "SHOPIFY_ADMIN_API_TOKEN" : ""}`.trim()
    });
  }

  const incomingShop = req.headers['x-shopify-shop-domain'];
  if (incomingShop && allowedShop && incomingShop !== allowedShop) {
    return res.status(403).json({ error: "Forbidden for this shop" });
  }

  const params = new URLSearchParams();
  if (req.query?.status) params.set('financial_status', req.query.status);
  if (req.query?.created_at_min) params.set('created_at_min', req.query.created_at_min);
  if (req.query?.created_at_max) params.set('created_at_max', req.query.created_at_max);

  const version = process.env.SHOPIFY_API_VERSION || '2025-07';
  const url = `https://${shop}/admin/api/${version}/orders/count.json${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

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