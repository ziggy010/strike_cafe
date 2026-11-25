"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MenuApp from "@/components/customer/MenuApp";

export default function TableMenuPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-ink-soft">Loading menu...</p>}>
      <TableMenu />
    </Suspense>
  );
}

function TableMenu() {
  const id = useSearchParams().get("table") ?? "";
  return <MenuApp key={id} tableId={id} />;
}
