export default async function handler(req, res) {
  // Allow CORS requests from Shopify store
  res.setHeader('Access-Control-Allow-Origin', 'https://acetech.pk');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Cache response at the edge to reduce API calls
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const shop = process.env.SHOPIFY_STORE_DOMAIN; 
  const token = process.env.SHOPIFY_ADMIN_API_TOKEN;

  // Check if environment variables are missing
  if (!shop || !token) {
    return res.status(500).json({
      error: `Missing environment variables: ${
        !shop ? "SHOPIFY_STORE_DOMAIN" : ""
      } ${!token ? "SHOPIFY_ADMIN_API_TOKEN" : ""}`.trim()
    });
  }

  // Date range filters: from 14th August to 31st August
  const created_at_min = '2025-08-14T00:00:00Z';
  const created_at_max = '2025-09-31T23:59:59Z';

  // Shopify API call with date range filter for orders
  const params = new URLSearchParams();
  params.set('created_at_min', created_at_min);
  params.set('created_at_max', created_at_max);

  const version = process.env.SHOPIFY_API_VERSION || '2025-07';
  const url = `https://${shop}/admin/api/${version}/orders/count.json?${params.toString()}`;

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
    let orderCount = data.count;

    // Handle refunded orders - decrease the count if any order is refunded
    const refundedOrdersParams = new URLSearchParams();
    refundedOrdersParams.set('created_at_min', created_at_min);
    refundedOrdersParams.set('created_at_max', created_at_max);
    refundedOrdersParams.set('payment_status', 'refunded');  // Only refunded orders

    const refundedOrdersUrl = `https://${shop}/admin/api/${version}/orders/count.json?${refundedOrdersParams.toString()}`;
    const refundedResponse = await fetch(refundedOrdersUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    const refundedData = await refundedResponse.json();
    if (refundedData.count > 0) {
      orderCount -= refundedData.count;  // Subtract refunded orders from the count
    }

    // Handle only "paid" orders (do not count pending)
    const paidOrdersParams = new URLSearchParams();
    paidOrdersParams.set('created_at_min', created_at_min);
    paidOrdersParams.set('created_at_max', created_at_max);
    paidOrdersParams.set('payment_status', 'paid');  // Only paid orders

    const paidOrdersUrl = `https://${shop}/admin/api/${version}/orders/count.json?${paidOrdersParams.toString()}`;
    const paidResponse = await fetch(paidOrdersUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    const paidData = await paidResponse.json();
    if (paidData.count > 0) {
      orderCount += paidData.count;  // Add paid orders to the count
    }

    return res.status(200).json({ count: orderCount });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
}
