import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata = {
  title: "Admin Command Center | Food Surplus Router",
  description: "Governance, KYC Compliance, Razorpay Ledger, Logistics & ESG Reporting",
};

export default async function AdminPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminDashboardClient adminEmail={session.user.email || "vokkerlasnehith@gmail.com"} />;
}
