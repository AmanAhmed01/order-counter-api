export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://acetech.pk');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

  if (!shop || !token) {
    return res.status(500).json({
      error: `Missing environment variables: ${!shop ? "SHOPIFY_STORE_DOMAIN" : ""} ${!token ? "SHOPIFY_ADMIN_API_TOKEN" : ""}`.trim()
    });
  }

  try {
    // ✅ Step 1: Get all product IDs from Accessories collection
    const accessoriesCollectionId = "284540600397"; // <-- yahan apna collection ID daalo
    const accessoriesUrl = `https://${shop}/admin/api/2025-07/collections/${accessoriesCollectionId}/products.json?limit=250`;

    const accRes = await fetch(accessoriesUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!accRes.ok) {
      const text = await accRes.text();
      return res.status(accRes.status).json({ error: 'Accessories API error', details: text });
    }

    const accessoriesData = await accRes.json();
    const accessoriesIds = new Set(accessoriesData.products.map(p => p.id));

    // ✅ Step 2: Fetch Orders
    const startDate = "2025-08-14T00:00:00Z";
    const endDate = "2025-09-30T23:59:59Z";
    const ordersUrl = `https://${shop}/admin/api/2025-07/orders.json?status=any&created_at_min=${startDate}&created_at_max=${endDate}`;

    const r = await fetch(ordersUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Shopify Orders API error', details: text });
    }

    const data = await r.json();

    // ✅ Step 3: Filter valid orders (exclude daraz + unpaid)
    const validOrders = data.orders.filter(order => {
      const isValidStatus = ["paid", "pending"].includes(order.financial_status);
      const hasDarazTag = order.tags && order.tags.toLowerCase().includes("daraz");
      return isValidStatus && !hasDarazTag;
    });

    // ✅ Step 4: Count units excluding Accessories
    let totalUnits = 0;
    validOrders.forEach(order => {
      order.line_items.forEach(item => {
        if (!accessoriesIds.has(item.product_id)) {
          totalUnits += item.quantity;
        }
      });
    });

    return res.status(200).json({ count: totalUnits });

  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
