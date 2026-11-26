import type { PlanPut } from '@huntclub/shared';

/**
 * PLACEHOLDER plans. Member limits per plan are an OPEN DECISION in docs/SPEC.md
 * ("Club member limits per plan"); 50 is a stand-in until the owner decides.
 * Written to the table by `seedPlans` (deploy-time / provisioning Lambda).
 */
export const PLACEHOLDER_PLANS: readonly PlanPut[] = [
  { id: 'club_standard', name: 'Club (placeholder)', memberLimit: 50, active: true },
];
