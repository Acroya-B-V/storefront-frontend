/** CMS page fixtures matching the API page response shape. */

export function aboutPage() {
  return {
    id: 'page-about',
    slug: 'about',
    title: 'About Bar Sumac',
    content:
      '<p>Bar Sumac is a Mediterranean-inspired kitchen in the heart of Amsterdam.</p>' +
      '<h2>Our Story</h2>' +
      '<p>Founded in 2020, we serve seasonal mezze, grilled meats, and natural wines.</p>',
    meta_description: 'Learn about Bar Sumac, a Mediterranean restaurant in Amsterdam.',
  };
}

export function contactPage() {
  return {
    id: 'page-contact',
    slug: 'contact',
    title: 'Contact Us',
    content:
      '<p>Visit us at Keizersgracht 123, 1015 Amsterdam.</p>' +
      '<p>Call us at +31 20 123 4567 or email info@barsumac.nl.</p>',
    meta_description: 'Get in touch with Bar Sumac.',
  };
}
