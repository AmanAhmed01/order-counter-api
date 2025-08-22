export default async function handler(req, res) {
  // CORS settings
  res.setHeader('Access-Control-Allow-Origin', 'https://acetech.pk');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

  if (!shop || !token) {
    return res.status(500).json({
      error: `Missing environment variables: ${
        !shop ? "SHOPIFY_STORE_DOMAIN" : ""
      } ${!token ? "SHOPIFY_ADMIN_API_TOKEN" : ""}`.trim()
    });
  }

  // Date Range
  const startDate = "2025-08-14T00:00:00Z";
  const endDate = "2025-09-30T23:59:59Z";

  // Orders API
  const url = `https://${shop}/admin/api/2025-07/orders.json?status=any&created_at_min=${startDate}&created_at_max=${endDate}`;

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

    // Filter Orders: Paid or Pending only & tag "daraz" not allowed
    const validOrders = data.orders.filter(order => {
      const isValidStatus = ["paid", "pending"].includes(order.financial_status);
      const hasDarazTag = order.tags && order.tags.toLowerCase().includes("daraz");
      return isValidStatus && !hasDarazTag;
    });

    return res.status(200).json({ count: validOrders.length });

  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
