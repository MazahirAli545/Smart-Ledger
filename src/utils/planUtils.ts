/**
 * Plan utility functions for subscription management
 */

// Plan hierarchy for determining next plan
export const PLAN_HIERARCHY = [
  'free',
  'starter',
  'professional',
  'enterprise',
] as const;

export type PlanType = (typeof PLAN_HIERARCHY)[number];

/**
 * Get the next plan name in the hierarchy
 * @param currentPlanName - The current plan name
 * @returns The next plan name or null if already at highest plan
 */
export const getNextPlanName = (currentPlanName: string): string | null => {
  const currentPlan = currentPlanName.toLowerCase();
  const currentIndex = PLAN_HIERARCHY.indexOf(currentPlan as PlanType);

  if (currentIndex === -1 || currentIndex === PLAN_HIERARCHY.length - 1) {
    return null; // No next plan available (already at highest plan)
  }

  const nextPlan = PLAN_HIERARCHY[currentIndex + 1];
  return nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1); // Capitalize first letter
};

/**
 * Check if a plan is the highest plan in the hierarchy
 * @param planName - The plan name to check
 * @returns True if it's the highest plan
 */
export const isHighestPlan = (planName: string): boolean => {
  return getNextPlanName(planName) === null;
};

/**
 * Get plan hierarchy level (0 = free, 1 = starter, etc.)
 * @param planName - The plan name
 * @returns The hierarchy level or -1 if not found
 */
export const getPlanLevel = (planName: string): number => {
  const plan = planName.toLowerCase();
  return PLAN_HIERARCHY.indexOf(plan as PlanType);
};

/**
 * Compare two plans in the hierarchy
 * @param plan1 - First plan name
 * @param plan2 - Second plan name
 * @returns -1 if plan1 < plan2, 0 if equal, 1 if plan1 > plan2
 */
export const comparePlans = (plan1: string, plan2: string): number => {
  const level1 = getPlanLevel(plan1);
  const level2 = getPlanLevel(plan2);

  if (level1 === -1 || level2 === -1) {
    return 0; // Unknown plans are considered equal
  }

  return level1 - level2;
};

/**
 * Check if plan1 is higher than plan2 in the hierarchy
 * @param plan1 - First plan name
 * @param plan2 - Second plan name
 * @returns True if plan1 is higher than plan2
 */
export const isPlanHigher = (plan1: string, plan2: string): boolean => {
  return comparePlans(plan1, plan2) > 0;
};

/**
 * Get all available plans
 * @returns Array of all plan names
 */
export const getAllPlans = (): string[] => {
  return PLAN_HIERARCHY.map(
    plan => plan.charAt(0).toUpperCase() + plan.slice(1),
  );
};
