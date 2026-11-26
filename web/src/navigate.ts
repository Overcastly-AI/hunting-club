/** Leaves the page for another site (Stripe Checkout). One place, so tests can stub it. */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
