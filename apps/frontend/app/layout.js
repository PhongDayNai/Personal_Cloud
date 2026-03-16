export const metadata = {
  title: 'HC Photos',
  description: 'Private photo/video hub',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: 'Inter, Arial, sans-serif', margin: 0, background: '#0b1020', color: '#e6ecff' }}>
        {children}
      </body>
    </html>
  );
}
