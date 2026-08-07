import type { AdminProfileRecord } from "./profile.types";

export function mapAdminProfile(record: AdminProfileRecord) {
  const id = record.id.toString();
  const name = record.displayName || "";
  const email = record.user.email || "";
  const phone = record.phone || "";
  const imageUrl = record.imageUrl || "";

  return {
    id,
    name,
    email,
    phone,
    imageUrl,
    role: "admin",
    admin_id: id,
    ADMIN_ID: id,
    ADMIN_NAME: name,
    ADMIN_EMAIL: email,
    ADMIN_PHONE: phone,
    ADMIN_IMAGE: imageUrl,
  };
}