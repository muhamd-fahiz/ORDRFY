/** All amounts in the schema are INR (Indian micro-businesses, V1 has no multi-currency scope). */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
