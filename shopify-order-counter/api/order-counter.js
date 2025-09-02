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
        !shop ? "SHOPIFY_STORE_DOMAIN " : ""
      }${!token ? "SHOPIFY_ADMIN_API_TOKEN" : ""}`.trim(),
    });
  }

  // Date Range: last 60 days
  const now = new Date();
  const past = new Date();
  past.setDate(past.getDate() - 60);

  const startDate = past.toISOString();
  const endDate = now.toISOString();

  // Orders API
  const url = `https://${shop}/admin/api/2024-07/orders.json?status=any&created_at_min=${startDate}&created_at_max=${endDate}`;

  try {
    const r = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Shopify API error', details: text });
    }

    const data = await r.json();

    // Filter Orders: Paid / Pending / Authorized
    const validOrders = data.orders.filter(order => {
      const isValidStatus = ["paid", "pending", "authorized"].includes(order.financial_status);
      const hasDarazTag = order.tags && order.tags.toLowerCase().includes("daraz");
      return isValidStatus && !hasDarazTag;
    });

    // Accessories collection handle (skip accessories products only)
    let totalUnits = 0;
    let skippedUnits = 0;

    for (const order of validOrders) {
      for (const item of order.line_items) {
        const collectionsUrl = `https://${shop}/admin/api/2024-07/products/${item.product_id}/collections.json`;
        const cRes = await fetch(collectionsUrl, {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        });
        const collections = await cRes.json();

        const isAccessories = collections.custom_collections?.some(c =>
          c.title.toLowerCase().includes("accessories")
        );

        if (!isAccessories) {
          totalUnits += item.quantity;
        } else {
          skippedUnits += item.quantity;
        }
      }
    }

    return res.status(200).json({
      ordersFound: data.orders.length,
      validOrders: validOrders.length,
      skippedUnits,
      count: totalUnits,
    });

  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
