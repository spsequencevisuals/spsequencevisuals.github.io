import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SPSequence Visuals",
  description: "Video editing, photography, design and motion. Start a project or request a session with SP.",
  icons: {
    icon: "/assets/mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
