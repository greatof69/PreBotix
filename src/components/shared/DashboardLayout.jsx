import { useNavigate } from "react-router-dom";

const defaultTabs = {
  admin: [
    { id: "orders", label: "Dashboard", icon: "▦" },
    { id: "users", label: "Customers & Roles", icon: "♙" },
  ],
  moderator: [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "orders", label: "Assigned Orders", icon: "▤" },
    { id: "messages", label: "Customer Messages", icon: "✉" },
    { id: "sales", label: "My Sales", icon: "↗" },
    { id: "attendance", label: "Attendance", icon: "◷" },
    { id: "earnings", label: "Earnings", icon: "৳" },
    { id: "profile", label: "Profile", icon: "♙" },
  ],
};

export default function DashboardLayout({
  children,
  title = "Dashboard",
  subtitle = "",
  activeTab = "dashboard",
  onTabChange = () => {},
  navItems,
  lang = "en",
  setLang = () => {},
  mobileOpen = false,
  setMobileOpen = () => {},
  onLogout = () => {},
  role = "admin",
  topbarContent = null,
}) {
  const navigate = useNavigate();

  const isModerator = role === "moderator";
  const items = navItems || defaultTabs[role] || defaultTabs.admin;

  const t = (english, bangla) =>
    lang === "bn" ? bangla : english;

  const styles = {
    shell: {
      display: "flex",
      minHeight: "100vh",
      background: "#f5f7fb",
      color: "#172033",
      fontFamily: "Inter, Arial, sans-serif",
    },
    sidebar: {
      width: 250,
      flex: "0 0 250px",
      background: "#111827",
      color: "#f9fafb",
      padding: 20,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
    brand: {
      fontSize: 25,
      fontWeight: 800,
      marginBottom: 8,
    },
    role: {
      fontSize: 12,
      color: "#9ca3af",
      marginBottom: 24,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    navButton: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "12px 14px",
      marginBottom: 7,
      border: 0,
      borderRadius: 10,
      color: "#d1d5db",
      background: "transparent",
      textAlign: "left",
      cursor: "pointer",
      fontSize: 14,
    },
    main: {
      minWidth: 0,
      flex: 1,
      display: "flex",
      flexDirection: "column",
    },
    topbar: {
      minHeight: 76,
      padding: "14px 24px",
      background: "#fff",
      borderBottom: "1px solid #e5e7eb",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    content: {
      padding: 24,
      width: "100%",
      boxSizing: "border-box",
    },
    button: {
      padding: "9px 12px",
      border: "1px solid #e5e7eb",
      borderRadius: 9,
      background: "#fff",
      color: "#111827",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
    },
  };

  return (
    <div style={styles.shell}>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="prebotix-sidebar-overlay"
        />
      )}

      <aside
        className={`prebotix-sidebar ${
          mobileOpen ? "prebotix-sidebar-open" : ""
        }`}
        style={styles.sidebar}
      >
        <div style={styles.brand}>PreBotix</div>

        <div style={styles.role}>
          {isModerator
            ? t("Moderator Panel", "মডারেটর প্যানেল")
            : t("Administrator Panel", "অ্যাডমিন প্যানেল")}
        </div>

        <nav>
          {items.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              onClick={() => {
                onTabChange(item.id);
                setMobileOpen(false);
              }}
              style={{
                ...styles.navButton,
                background:
                  activeTab === item.id
                    ? "#2563eb"
                    : "transparent",
                color:
                  activeTab === item.id ? "#fff" : "#d1d5db",
                fontWeight: activeTab === item.id ? 700 : 400,
              }}
            >
              <span style={{ width: 20 }}>
                {item.icon || "•"}
              </span>
              <span>
                {lang === "bn" && item.labelBn
                  ? item.labelBn
                  : item.label}
              </span>
            </button>
          ))}
        </nav>


        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => navigate("/")}
          style={styles.navButton}
        >
          <span style={{ width: 20 }}>🏠</span>
          <span>{t("Back to Home", "হোমে ফিরে যান")}</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          style={{
            ...styles.navButton,
            color: "#fca5a5",
          }}
        >
          <span style={{ width: 20 }}>↪</span>
          <span>{t("Logout", "লগআউট")}</span>
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={styles.button}
              className="prebotix-menu-button"
            >
              ☰
            </button>

            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    marginTop: 4,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {topbarContent}

            <button
              type="button"
              onClick={() => navigate("/")}
              style={styles.button}
            >
              🏠 {t("Home", "হোম")}
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === "bn" ? "en" : "bn")}
              style={styles.button}
            >
              🌐 {lang === "bn" ? "English" : "বাংলা"}
            </button>
          </div>
        </header>


        <section style={styles.content}>{children}</section>
      </main>

      <style>{`
        .prebotix-sidebar-overlay {
          display: none;
        }

        .prebotix-menu-button {
          display: none;
        }

        @media (max-width: 800px) {
          .prebotix-sidebar {
            position: fixed !important;
            top: 0;
            bottom: 0;
            left: 0;
            height: 100vh;
            overflow-y: auto;
            z-index: 1001;
            transform: translateX(-105%);
            transition: transform .2s ease;
          }

          .prebotix-sidebar.prebotix-sidebar-open {
            transform: translateX(0);
          }

          .prebotix-sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.45);
            border: 0;
            z-index: 1000;
          }

          .prebotix-menu-button {
            display: block;
          }
        }

        @media (min-width: 801px) {
          .prebotix-sidebar {
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
          }
        }

        @media (max-width: 520px) {
          .prebotix-sidebar {
            width: min(280px, 85vw) !important;
            flex-basis: min(280px, 85vw) !important;
          }
        }
      `}</style>
    </div>
  );
}