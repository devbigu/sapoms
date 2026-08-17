export const SALES_REGION_OPTIONS = [
  { value: "NORTH_1", label: "North 1" },
  { value: "NORTH_2", label: "North 2" },
  { value: "SOUTH_1", label: "South 1" },
  { value: "SOUTH_2", label: "South 2" },
  { value: "WEST_1", label: "West 1" },
  { value: "WEST_2", label: "West 2" },
  { value: "EAST", label: "East" },
  { value: "ROM", label: "ROM" },
  { value: "CENTRAL", label: "Central" },
] as const;

export type SalesRegionOptionValue = typeof SALES_REGION_OPTIONS[number]["value"];

export function formatSalesRegionLabel(value?: string | null) {
  if (!value) return "";
  const option = SALES_REGION_OPTIONS.find((entry) => entry.value === value);
  return option?.label ?? value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}