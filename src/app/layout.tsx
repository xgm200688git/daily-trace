import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "每日轨迹",
  description: "一个支持生活记录、工作任务、日报合并和周报生成的中文日记应用。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "每日轨迹",
  },
  icons: {
    apple: "/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
