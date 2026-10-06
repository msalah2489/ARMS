/**
 * Custom static 500 page so `output: "export"` does not rely on the default
 * `/_error` → `.next/export/500.html` rename path (flaky on Windows).
 */
export default function Custom500() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: "system-ui, sans-serif",
        background: "#f7f3ee",
        color: "#1c1917",
        padding: 16,
      }}
    >
      <h1 style={{ fontSize: 28, margin: 0 }}>خطأ في الخادم</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Server error (500)</p>
      <a href="/dashboard/" style={{ color: "#0f766e" }}>
        العودة إلى الرئيسية
      </a>
    </main>
  );
}
