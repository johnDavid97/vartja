import config from "@payload-config";
import { Suspense } from "react";
import { connection } from "next/server";
import "@payloadcms/next/css";
import "@/components/admin/editor/editor.css";
import "@/components/admin/buttons.css";
import "./custom.css";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import type { ServerFunctionClient } from "payload";
import { importMap } from "./admin/importMap";

const serverFunction: ServerFunctionClient = async (args) => {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

// Payload's authenticated providers also read the clock, independently of the page.
export const instant = false;

export default function PayloadLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}><RequestPayloadLayout>{children}</RequestPayloadLayout></Suspense>;
}

async function RequestPayloadLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction} htmlProps={{ className: "wedding-admin" }}>
      {children}
    </RootLayout>
  );
}
