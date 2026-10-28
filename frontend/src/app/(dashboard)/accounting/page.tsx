import { Suspense } from "react";
import { AccountingModule } from "@/components/accounting/accounting-module";

export default function AccountingPage() {
  return (
    <Suspense fallback={null}>
      <AccountingModule />
    </Suspense>
  );
}
