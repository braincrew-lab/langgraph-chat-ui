import { ReactNode } from "react";
import { getAllSettings } from "@/lib/services/settings.service";
import { AuthLayoutClient } from "./AuthLayoutClient";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const globalSettings = await getAllSettings();

  return (
    <AuthLayoutClient allowRegistration={globalSettings["auth.allowRegistration"]}>
      {children}
    </AuthLayoutClient>
  );
}
