import { notFound } from "next/navigation";
import { verifyAdminUser } from "@/lib/auth/admin";
import DevPanelsClient from "./DevPanelsClient";

export const dynamic = "force-dynamic";

/**
 * /dev page: Restricted strictly to the admin user.
 * Compares the signed-in user id to ADMIN_USER_ID env var.
 * If ADMIN_USER_ID is missing or user does not match, returns 404 (notFound).
 */
export default async function DevPage() {
  const { isAdmin } = await verifyAdminUser();

  if (!isAdmin) {
    notFound();
  }

  return <DevPanelsClient />;
}
