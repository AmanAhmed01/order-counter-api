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

  try {
    // STEP 1: Accessories collection ke products fetch karo
    const accessoriesCollectionId = "YOUR_ACCESSORIES_COLLECTION_ID"; // <-- yahan apna Accessories collection ID daalna
    const accessoriesUrl = `https://${shop}/admin/api/2025-07/products.json?collection_id=${accessoriesCollectionId}`;

    const accessoriesRes = await fetch(accessoriesUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!accessoriesRes.ok) {
      const text = await accessoriesRes.text();
      return res.status(accessoriesRes.status).json({ error: 'Shopify API error (Accessories fetch)', details: text });
    }

    const accessoriesData = await accessoriesRes.json();
    const excludedProducts = accessoriesData.products.map(p => p.id);

    // STEP 2: Orders fetch karo
    const url = `https://${shop}/admin/api/2025-07/orders.json?status=any&created_at_min=${startDate}&created_at_max=${endDate}`;

    const r = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Shopify API error (Orders fetch)', details: text });
    }

    const data = await r.json();

    // STEP 3: Filter Orders: Paid or Pending only & tag "daraz" not allowed
    const validOrders = data.orders.filter(order => {
      const isValidStatus = ["paid", "pending"].includes(order.financial_status);
      const hasDarazTag = order.tags && order.tags.toLowerCase().includes("daraz");
      return isValidStatus && !hasDarazTag;
    });

    // STEP 4: Calculate total units sold (excluding accessories products)
    let totalUnits = 0;
    validOrders.forEach(order => {
      order.line_items.forEach(item => {
        if (!excludedProducts.includes(item.product_id)) {
          totalUnits += item.quantity;
        }
      });
    });

    return res.status(200).json({ count: totalUnits });

  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
