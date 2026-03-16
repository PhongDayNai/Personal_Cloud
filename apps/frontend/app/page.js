import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: '80px auto', padding: 16 }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>HC Photos</h1>
      <p style={{ opacity: 0.9 }}>Kho ảnh/video private của anh — bootstrap phiên bản đầu.</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Link href="/login" style={{ background: '#4f7cff', color: 'white', padding: '10px 16px', borderRadius: 10, textDecoration: 'none' }}>
          Đăng nhập
        </Link>
        <Link href="/dashboard" style={{ border: '1px solid #3d4f8a', color: '#dbe6ff', padding: '10px 16px', borderRadius: 10, textDecoration: 'none' }}>
          Dashboard
        </Link>
      </div>
    </main>
  );
}
