"use client";

import { BhdRIntegrationSettings } from "@/components/integrations/bhd-r-integration-settings";

export default function BhdRPage() {
  return (
    <div className="space-y-6">
      <div id="bhd-r" className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <BhdRIntegrationSettings />
      </div>
    </div>
  );
}
