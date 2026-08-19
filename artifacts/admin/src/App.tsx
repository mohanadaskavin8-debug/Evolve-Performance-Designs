/**
 * The first-party admin portal has been retired — the store is now managed
 * entirely in Shopify Admin (products, inventory, orders, discounts,
 * shipping, payouts). This page just points the owner in the right direction.
 */

const SHOPIFY_ADMIN_URL = 'https://admin.shopify.com/store/ep-23446707';

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white px-6">
      <div className="max-w-xl w-full border border-white/10 bg-white/[0.03] p-10 md:p-14 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40 mb-6">Evolve Performance</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Your store is managed in Shopify
        </h1>
        <p className="text-white/60 leading-relaxed mb-10">
          Products, inventory, orders, discounts, shipping and payments all live
          in Shopify Admin now. This admin portal has been retired.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={SHOPIFY_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#5df179] text-black font-semibold px-8 py-3 hover:opacity-90 transition-opacity"
          >
            Open Shopify Admin
          </a>
          <a
            href="/"
            className="border border-white/20 text-white px-8 py-3 hover:bg-white/10 transition-colors"
          >
            View Storefront
          </a>
        </div>
      </div>
    </div>
  );
}
