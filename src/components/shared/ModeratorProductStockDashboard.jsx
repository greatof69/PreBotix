import { useEffect, useMemo, useState } from "react";

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, minWidth: 0 };
const field = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 9, background: "#fff", fontSize: 14 };
const money = (value) => `৳${Number(value || 0).toLocaleString("en-BD")}`;

export default function ModeratorProductStockDashboard({ request, lang = "en" }) {
  const bn = lang === "bn";
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    request("/product-stock")
      .then((data) => {
        if (alive) setProducts(Array.isArray(data?.products) ? data.products : []);
      })
      .catch((err) => { if (alive) setError(err.message || "Could not load products."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [request]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const filtered = useMemo(() => products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [p.name, p.nameBn, p.category, p.sku, p.id].some((v) => String(v ?? "").toLowerCase().includes(q));
    const matchesCategory = category === "all" || p.category === category;
    const stock = Number(p.stock ?? p.quantity ?? 0);
    const matchesStock = stockFilter === "all" || (stockFilter === "out" ? stock <= 0 : stockFilter === "low" ? stock > 0 && stock <= 5 : stock > 5);
    return matchesSearch && matchesCategory && matchesStock;
  }), [products, search, category, stockFilter]);

  return <section style={{ display: "grid", gap: 14, minWidth: 0 }}>
    <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <div><h2 style={{ margin: 0, fontSize: 20 }}>{bn ? "Product Stock" : "Product Stock"}</h2><p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>{bn ? "সব PreBotix পণ্যের স্টক ও বিক্রয় মূল্য দেখুন" : "View all PreBotix products, stock quantities and selling prices."}</p></div>
      <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "7px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{filtered.length} {bn ? "টি পণ্য" : "Products"} · View only</span>
    </div>
    <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
      <input style={field} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={bn ? "নাম / SKU দিয়ে খুঁজুন" : "Search name / SKU / ID"} />
      <select style={field} value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">{bn ? "সব ক্যাটাগরি" : "All categories"}</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <select style={field} value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}><option value="all">{bn ? "সব স্টক" : "All stock levels"}</option><option value="in">{bn ? "স্টকে আছে" : "In stock"}</option><option value="low">{bn ? "কম স্টক (১–৫)" : "Low stock (1–5)"}</option><option value="out">{bn ? "স্টক শেষ" : "Out of stock"}</option></select>
    </div>
    {error && <div style={{ ...card, color: "#b91c1c" }}>{error}</div>}
    {loading ? <div style={card}>{bn ? "পণ্য লোড হচ্ছে..." : "Loading products..."}</div> : filtered.length === 0 ? <div style={card}>{bn ? "কোনো পণ্য পাওয়া যায়নি।" : "No products found."}</div> : <div style={{ ...card, overflowX: "auto", padding: 0 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650, fontSize: 13 }}><thead><tr style={{ background: "#f8fafc", textAlign: "left" }}>{["Product", "Category", "Stock", "Selling price", "Details"].map((h) => <th key={h} style={{ padding: 12, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead><tbody>{filtered.map((p) => <tr key={p._id || p.id} style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src={p.image || p.images?.[0] || ""} alt="" style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 7, background: "#f8fafc" }} /><div style={{ fontWeight: 650 }}>{bn && p.nameBn ? p.nameBn : p.name || "Unnamed product"}<div style={{ color: "#94a3b8", fontSize: 11 }}>#{p.id ?? p._id}</div></div></div></td><td style={{ padding: 12 }}>{p.category || "—"}</td><td style={{ padding: 12 }}><span style={{ color: Number(p.stock ?? p.quantity ?? 0) <= 0 ? "#dc2626" : Number(p.stock ?? p.quantity ?? 0) <= 5 ? "#d97706" : "#059669", fontWeight: 700 }}>{p.stock ?? p.quantity ?? 0}</span></td><td style={{ padding: 12, fontWeight: 700 }}>{money(p.price)}</td><td style={{ padding: 12 }}><button type="button" onClick={() => setSelected(p)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 7, padding: "7px 10px", cursor: "pointer" }}>{bn ? "বিস্তারিত" : "View details"}</button></td></tr>)}</tbody></table></div>}
    {selected && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0f172a88", display: "grid", placeItems: "center", padding: 16 }} onClick={() => setSelected(null)}><div style={{ ...card, width: "min(560px,100%)", maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><h3 style={{ margin: 0 }}>{bn && selected.nameBn ? selected.nameBn : selected.name}</h3><button type="button" onClick={() => setSelected(null)} style={{ ...field, width: "auto", cursor: "pointer" }}>✕</button></div>{(selected.image || selected.images?.[0]) && <img src={selected.image || selected.images?.[0]} alt="" style={{ width: "100%", height: 180, objectFit: "contain", margin: "12px 0", background: "#f8fafc", borderRadius: 10 }} />}<p><b>Category:</b> {selected.category || "—"}</p><p><b>Stock quantity:</b> {selected.stock ?? selected.quantity ?? 0}</p><p><b>Selling price:</b> {money(selected.price)}</p>{selected.oldPrice > selected.price && <p><b>Previous price:</b> {money(selected.oldPrice)}</p>}<p><b>Description:</b><br />{selected.description || "—"}</p>{Array.isArray(selected.priceOptions) && selected.priceOptions.length > 0 && <div><b>Available options:</b><ul>{selected.priceOptions.map((option, index) => <li key={option.id || index}>{option.text || option.name || `Option ${index + 1}`} — {money(option.price)}</li>)}</ul></div>}<p style={{ color: "#64748b", fontSize: 12, marginBottom: 0 }}>View only. Supplier cost and editing controls are not available.</p></div></div>}
  </section>;
}
