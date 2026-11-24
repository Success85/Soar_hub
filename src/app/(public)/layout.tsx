import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { getCurrentUser, primaryRole } from "@/lib/auth/session";
import { homeFor } from "@/lib/nav";
import { getSettings } from "@/lib/services/settings";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <>
      <PublicHeader signedIn={!!user} homeHref={user ? homeFor(primaryRole(user)) : "/dashboard"} />
      {settings.maintenance_mode && (
        <div role="status" className="bg-warning-100 px-4 py-2 text-center text-sm font-medium text-warning-700">
          {settings.maintenance_message}
        </div>
      )}
      <main id="main">{children}</main>
      <PublicFooter supportEmail={settings.support_email} address={settings.contact_address} />
    </>
  );
}
