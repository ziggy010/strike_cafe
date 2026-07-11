import MenuApp from "@/components/customer/MenuApp";

export default async function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  return <MenuApp tableId={tableId} />;
}
