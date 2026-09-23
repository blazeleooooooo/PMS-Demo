import {
  isBwaProjectSizeAtLeast,
  resolveBwaProjectSize,
} from "@/lib/bwa-project-size";

/** Pure eligibility for /news spotlight project listing. */
export function isNewsSpotlightEligible(input: {
  projectSize: string | null | undefined;
  estimatedIncome?: number | null;
  projectTypeIds: string[];
  requiredProjectTypeIds: Set<string> | ReadonlySet<string>;
  customerId: string | null | undefined;
  wellKnownBrandCustomerIds: Set<string> | ReadonlySet<string>;
}): boolean {
  const resolved = resolveBwaProjectSize(input.projectSize, input.estimatedIncome);
  if (!isBwaProjectSizeAtLeast(resolved, "$500K-$1M中型")) return false;
  const hasRequiredType = input.projectTypeIds.some((id) =>
    input.requiredProjectTypeIds.has(id),
  );
  const hasBrandCustomer =
    !!input.customerId && input.wellKnownBrandCustomerIds.has(input.customerId);
  return hasRequiredType || hasBrandCustomer;
}
