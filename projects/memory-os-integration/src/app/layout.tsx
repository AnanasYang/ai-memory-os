import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Memory OS - 记忆可视化系统',
  description: '基于 5 层记忆架构的智能可视化系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-background">
        {children}
      </body>
    </html>
  );
}