import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
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
      <body className={plusJakarta.className} style={{ margin: 0, backgroundColor: '#0A0A0A', color: '#fff', display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  );
}
