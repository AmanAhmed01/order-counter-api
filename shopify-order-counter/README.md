# Shopify Order Counter (Vercel + App Proxy) — Hinglish Guide

Ye project Shopify Admin API se **real-time order count** nikaal ke frontend par dikhata hai.
Safe hai kyunki Admin API token sirf **serverless function** me rehta hai (frontend me nahi).

---

## 1) Deploy on Vercel
1. Repo ko fork/import karo ya direct upload karo.
2. Vercel -> New Project -> is repo ko select karo.
3. Environment Variables set karo:
   - `SHOPIFY_STORE_DOMAIN` = `your-store.myshopify.com`  (exact `.myshopify.com` domain, custom domain nahi)
   - `SHOPIFY_ADMIN_API_TOKEN` = `shpat_xxx`  (Admin API access token, read_orders scope hona chahiye)
   - (optional) `ALLOWED_SHOP_DOMAIN` = `your-store.myshopify.com`  (App Proxy se aane wale requests restrict karne ke liye)
4. Deploy kar do. Deploy hone ke baad tumhare paas public URL aayega, jaise: `https://your-vercel-app.vercel.app`.

---

## 2) Shopify App Proxy Setup
Shopify Admin -> Apps and sales channels -> apna **Custom App** open karo.

- **App settings** me `App URL` me Vercel ka base URL set karo (e.g. `https://your-vercel-app.vercel.app`).
- **Configuration** tab par jao -> **App proxy** section -> **Configure**:
  - **Subpath prefix:** `apps`
  - **Subpath:** `order-counter`
  - **Proxy URL:** `https://your-vercel-app.vercel.app/api/order-counter`
- Save.

Ab tumhare store par `/apps/order-counter` hit karoge to ye Vercel function ko call karega aur JSON return karega:
```json
{ "count": 1234 }
```

---

## 3) Theme (Liquid + JS) — Frontend Counter Snippet
Ye snippet theme.liquid ya kisi section me daal do jahan counter dikhana hai.

```liquid
<div id="giveawayWrap" style="padding:10px; background:#f6f6f6; border-radius:8px; font-weight:600;">
  <div style="font-size:18px;">Giveaway on every <span id="goalNum">50</span> orders 🎁</div>
  <div style="margin-top:6px; font-size:16px;">
    Current Orders: <span id="orderCounter">Loading…</span>
  </div>
  <div id="giveawayProgress" style="margin-top:6px; font-size:14px;"></div>
</div>

<script>
(async () => {
  const GOAL = 50; // yahan apni giveaway threshold set karo
  document.getElementById('goalNum').textContent = GOAL;

  try {
    const res = await fetch('/apps/order-counter', { cache: 'no-store' });
    const data = await res.json();
    const count = Number(data.count || 0);

    const mod = count % GOAL;
    const nextMilestone = count - mod + GOAL;
    const left = mod === 0 ? GOAL : (GOAL - mod);

    document.getElementById('orderCounter').textContent = count.toLocaleString();
    document.getElementById('giveawayProgress').innerHTML =
      `Next giveaway at <b>${nextMilestone.toLocaleString()}</b> orders — only <b>${left}</b> left!`;

    // (optional) exact multiple par badge/burst dikhana
    if (mod === 0 && count !== 0) {
      const burst = document.createElement('div');
      burst.textContent = '🎉 Giveaway Unlocked!';
      burst.style.marginTop = '8px';
      burst.style.color = '#0a7';
      burst.style.fontWeight = '700';
      burst.style.animation = 'pop 600ms ease';
      document.getElementById('giveawayWrap').appendChild(burst);
    }
  } catch (e) {
    document.getElementById('orderCounter').textContent = 'Error';
    console.error(e);
  }
})();
</script>
```

---

## 4) Notes / Tips
- **Real-time feel**: Upar function ko page load pe call kiya hai. Agar tum chaaho to small interval pe refresh kara sakte ho (e.g., 30–60 sec).
- **Caching**: API response ko edge pe 15 sec cache kiya ja raha hai (s-maxage). Isse Shopify Admin API ko unnecessary hits nahi padte.
- **Filters**: Agar sirf paid orders count chahiye to App Proxy URL me `?status=paid` pass kar sakte ho. (`financial_status=paid` map hota hai).
  - Example: `/apps/order-counter?status=paid`
- **Security**: Token kabhi frontend me expose mat karna. Agar strict check chahiye to `ALLOWED_SHOP_DOMAIN` env var set rakho; function header `x-shopify-shop-domain` ko verify karega.
- **Versioning**: Function `2025-07` Admin API version use karta hai.

---

## 5) Troubleshooting
- **403 Forbidden**: Ensure `x-shopify-shop-domain` header App Proxy se aa raha ho (live store se test karo) aur `ALLOWED_SHOP_DOMAIN` sahi ho.
- **500 Missing env vars**: Vercel me env set kiye bina function chalega nahi.
- **Order count 0**: Ensure `read_orders` scope di hui ho aur token valid ho. App install & permissions recheck karo.

---

Made with ❤️ for Aman (Hinglish docs).
