import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: "JamBox Dashboard",
  description: "Social Content Engine Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={manrope.className} style={{ margin: 0, backgroundColor: '#0A0A0A', color: '#fff', display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  );
}
