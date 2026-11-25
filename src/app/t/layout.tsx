import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "Strike Yard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f5ef",
};

export default function CustomerMenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
