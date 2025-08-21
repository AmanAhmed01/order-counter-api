export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://acetech.pk');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2025-07';

  if (!shop || !token) {
    return res.status(500).json({ error: "Missing environment variables" });
  }

  const created_at_min = '2025-08-14T00:00:00Z';
  const created_at_max = '2025-09-30T23:59:59Z';

  async function getOrderCount(financial_status) {
    const url = `https://${shop}/admin/api/${version}/orders/count.json?created_at_min=${created_at_min}&created_at_max=${created_at_max}&financial_status=${financial_status}`;
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data.count || 0;
  }

  try {
    // Get counts for each status separately
    const paid = await getOrderCount('paid');
    const pending = await getOrderCount('pending');
    const refunded = await getOrderCount('refunded');
    const voided = await getOrderCount('voided');
    const cancelled = await getOrderCount('cancelled');

    // Final calculation
    let orderCount = paid + pending;
    orderCount -= (refunded + voided + cancelled);

    return res.status(200).json({ count: orderCount });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
