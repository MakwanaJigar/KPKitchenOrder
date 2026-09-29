/* =========================================================
 * STRIPE CONFIG
 * =========================================================
 *
 * Publishable key only. Never put sk_test_ / sk_live_ here —
 * the Stripe secret key must remain on Laravel only.
 * ========================================================= */

export const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51U6SdyANg7fMOeypPugvZNrDN2FVjt1a6dMdKCvW0iw5se0u3CDdVqsX40eivgN7iBdGCHFFuIkg31uH7SaayEk000vpaKlvhL';

/*
 * Google Pay environment MUST match the Stripe key mode.
 *
 * pk_test_ key -> Google Pay TEST environment
 * pk_live_ key -> Google Pay PRODUCTION environment
 *
 * Using __DEV__ here is wrong: a release APK has
 * __DEV__ = false, which opens Google Pay in production
 * while Stripe is in test mode, and Google Pay rejects it
 * with "This merchant is having trouble accepting your
 * payment [OR_BIBED_11]".
 */
export const STRIPE_TEST_MODE = STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_');
