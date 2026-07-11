import StaffShell from "@/components/staff/StaffShell";

export const metadata = { title: "Staff — Strike Yard" };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
