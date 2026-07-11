import MenuApp from "@/components/customer/MenuApp";

export function generateStaticParams() {
  return [
    { tableId: "t-1" },
    { tableId: "t-2" },
    { tableId: "t-3" },
    { tableId: "t-4" },
    { tableId: "t-5" },
    { tableId: "t-6" },
    { tableId: "t-7" },
    { tableId: "t-8" },
  ];
}

export default async function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  return <MenuApp tableId={tableId} />;
}
