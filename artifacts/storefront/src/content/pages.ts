/**
 * Content pages shown at /pages/:key (FAQ, policies, about, story).
 *
 * This file IS the source of truth for this copy — there is no database.
 * To change a page, edit the HTML here and redeploy (push to GitHub; Vercel
 * deploys automatically). Each body is trusted HTML written by the owner.
 */

export type ContentPageDef = {
  title: string;
  /** Trusted HTML rendered inside the page card. */
  body: string;
};

const RETURN_POLICY_HTML = `
  <h2>All Sales Are Final</h2>
  <p>Because our lifting gear is worn directly against the body and used during training, we do not accept returns, exchanges, or refunds for change of mind, incorrect size selection, or unwanted items. Please review the product description and available options carefully before ordering.</p>
  <h2>Damaged, Defective, or Incorrect Items</h2>
  <p>If your order arrives damaged, defective, or different from what you ordered, contact us through the Support page within 7 days of delivery. Include your order number and clear photos of the item and packaging. We will review the issue and, when approved, arrange a replacement or another appropriate remedy.</p>
  <h2>Order Changes and Cancellations</h2>
  <p>Orders begin processing quickly. We cannot guarantee changes or cancellations after checkout. Contact us immediately through the Support page and we will help if the order has not entered fulfillment.</p>
  <h2>Legal Rights</h2>
  <p>This policy does not limit any rights or remedies that cannot legally be excluded in your location.</p>
`;

const FAQ_HTML = `
  <h2>What is the difference between wrist wraps and lifting straps?</h2>
  <p>Wrist wraps support and stabilize your wrists during pressing and other heavy lifts. Lifting straps wrap around the bar to improve your grip during pulling movements such as deadlifts, rows, and shrugs.</p>
  <h2>How do I choose the right product?</h2>
  <p>Choose Wrist Wraps when you want wrist support. Choose Lifting Straps when grip fatigue limits your pulling exercises. Check the product page for the available options before adding an item to your cart.</p>
  <h2>How do I choose a size?</h2>
  <p>Use the size or option information shown on the individual product page. If you are between options or need help before ordering, contact us through the Support page. Customers are responsible for checking their selection because all sales are final.</p>
  <h2>How should I care for my gear?</h2>
  <p>Hand wash gently in cold water with mild detergent, then air dry completely. Do not bleach, iron, or tumble dry. Close hook-and-loop fasteners before washing to protect the fabric.</p>
  <h2>Where do I check out?</h2>
  <p>Your cart is created on this storefront, and checkout is completed securely through Shopify. Shopify handles payment, shipping details, taxes, and the final order confirmation.</p>
  <h2>Do you ship internationally?</h2>
  <p>Available destinations and shipping rates are shown at Shopify checkout. Delivery availability depends on the destination entered at checkout.</p>
  <h2>How long will delivery take?</h2>
  <p>Available shipping methods and estimated delivery information are shown at checkout. Actual delivery times can vary by destination, carrier, customs processing, weather, and other delays outside our control.</p>
  <h2>Will I have to pay customs fees?</h2>
  <p>International orders may be subject to duties, taxes, or import fees charged by the destination country. Unless checkout states otherwise, those charges are the customer’s responsibility.</p>
  <h2>Can I change or cancel my order?</h2>
  <p>Contact us through the Support page as soon as possible. Orders begin processing quickly, so changes or cancellations are not guaranteed after checkout.</p>
  <h2>Can I return or exchange an item?</h2>
  <p>All sales are final. We do not accept returns or exchanges for change of mind, incorrect size selection, or unwanted items. If an item arrives damaged, defective, or incorrect, contact us within 7 days of delivery with your order number and clear photos.</p>
  <h2>What should I do if my item arrives damaged or incorrect?</h2>
  <p>Submit a message through the Support page within 7 days of delivery. Include your order number, a description of the problem, and clear photos of the item and packaging so we can review it.</p>
  <h2>How can I contact Evolve Performance?</h2>
  <p>Use the Support page and include your order number when your question concerns an existing order.</p>
`;
export const CONTENT_PAGES: Record<string, ContentPageDef> = {
  privacy: {
    title: 'Privacy Policy',
    body: `
  <p>Last updated: January 2025</p>
  <p>Evolve Performance takes your privacy seriously. This policy describes how we collect, use, and protect your personal information when you use our website and services.</p>
`,
  },
  terms: {
    title: 'Terms of Service',
    body: `
  <p>Last updated: January 2025</p>
  <p>By accessing or using the Evolve Performance website, you agree to be bound by these Terms of Service.</p>
`,
  },
  'shipping-policy': {
    title: 'Shipping Policy',
    body: `
  <p>We ship worldwide. Shipping options and rates are shown at checkout. US orders ship within 1-2 business days. International orders ship within 2-3 business days. Customs duties and taxes may apply for international orders.</p>
`,
  },
  'return-policy': {
    title: 'No Return Policy',
    body: RETURN_POLICY_HTML,
  },
  about: {
    title: 'About Evolve Performance',
    body: `
  <p>Evolve Performance was born from a simple idea: your training gear should be as legendary as your favorite characters. We create lifting straps, wristbands, and accessories for athletes who train with purpose and passion.</p>
`,
  },
  story: {
    title: 'Our Story',
    body: `
  <p>It started in a garage gym with a set of anime posters and a barbell. We wanted lifting straps that matched the energy we brought to every training session. When we couldn't find them, we made them.</p>
`,
  },
  faq: {
    title: 'Frequently Asked Questions',
    body: FAQ_HTML,
  },
};
