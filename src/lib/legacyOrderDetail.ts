export async function fetchLegacyOrderDetail(orderId: string) {
  const response = await fetch(`/api/order-access/${encodeURIComponent(orderId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Order detail failed with ${response.status}`);
  const payload = await response.json();
  return { success: payload?.success !== false, data: payload?.data ? [payload.data] : [] };
}

async function fetchFirstOk(paths: string[]) {
  for (const path of paths) {
    const response = await fetch(path, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) continue;
    const payload = await response.json().catch(() => null);
    const data = payload?.data ?? payload?.dealer ?? payload;
    if (data && typeof data === "object") return { success: true, data };
  }
  return { success: false, data: null };
}

export async function fetchLegacyDealerProfile(dealerId: string) {
  const id = encodeURIComponent(dealerId);
  return fetchFirstOk([
    `/api/staff/dealers/${id}`,
    `/api/admin/dealers/${id}`,
    "/api/dealer/profile",
  ]);
}