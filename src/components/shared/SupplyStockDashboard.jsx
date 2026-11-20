import { useCallback, useEffect, useState } from "react";

const panel = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 13,
  padding: 16,
  minWidth: 0,
};
const input = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
};
const button = {
  padding: "9px 13px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontWeight: 650,
  fontSize: 13,
};
const primary = {
  ...button,
  background: "#1d4ed8",
  borderColor: "#1d4ed8",
  color: "#fff",
};
const muted = { color: "#64748b", fontSize: 12 };
const money = (value, currency = "BDT") =>
  `${currency === "BDT" ? "৳" : `${currency} `}${Number(value || 0).toLocaleString("en-BD")}`;

export default function SupplyStockDashboard({
  request,
  lang = "en",
  isAdmin = false,
}) {
  const bn = lang === "bn";
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: 20, total: 0, pages: 0,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("all");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);

  const t = (en, bangla) => bn ? bangla : en;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort,
      });
      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);
      if (isAdmin && active !== "all") params.set("active", active);

      const data = await request(`/supply-stock?${params.toString()}`);
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setPagination(data?.pagination || {
        page, limit: 20, total: 0, pages: 0,
      });
    } catch (err) {
      setError(err?.message || t("Could not load Supply Stock.", "Supply Stock লোড করা যায়নি।"));
    } finally {
      setLoading(false);
    }
  }, [request, page, search, category, active, sort, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetails = async (product) => {
    setError("");
    try {
      const data = await request(`/supply-stock/${product._id}`);
      setSelected(data?.product || product);
    } catch (err) {
      setError(err?.message || "Could not load product details.");
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    if (!isAdmin || !editor) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const creating = !editor._id;
      const body = creating
        ? {
            supplierProductId: editor.supplierProductId,
            supplierSku: editor.supplierSku || "",
            title: editor.title,
            category: editor.category,
            description: editor.description || "",
            image: editor.image || "",
            supplierCost: Number(editor.supplierCost),
            supplierCurrency: editor.supplierCurrency || "BDT",
            supplierStock: Number(editor.supplierStock),
            sellingPrice: Number(editor.sellingPrice),
            sellableStock: Number(editor.sellableStock),
            active: Boolean(editor.active),
          }
        : {
            title: editor.title,
            category: editor.category,
            description: editor.description || "",
            image: editor.image || "",
            sellingPrice: Number(editor.sellingPrice),
            sellableStock: Number(editor.sellableStock),
            active: Boolean(editor.active),
          };

      await request(
        creating ? "/supply-stock" : `/supply-stock/${editor._id}`,
        {
          method: creating ? "POST" : "PATCH",
          body: JSON.stringify(body),
        }
      );

      setEditor(null);
      setNotice(t("Supply product saved.", "Supply পণ্য সংরক্ষণ হয়েছে।"));
      await load();
    } catch (err) {
      setError(err?.message || "Could not save Supply product.");
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async (product) => {
    if (!isAdmin) return;
    if (!window.confirm(t(
      `Archive "${product.title}"?`,
      `"${product.title}" Archive করবেন?`
    ))) return;

    setError("");
    setNotice("");
    try {
      await request(`/supply-stock/${product._id}`, { method: "DELETE" });
      setSelected(null);
      setNotice(t("Product archived.", "পণ্য Archive হয়েছে।"));
      await load();
    } catch (err) {
      setError(err?.message || "Could not archive product.");
    }
  };

  const categories = [...new Set(
    products.map((product) => product.category).filter(Boolean)
  )].sort();

  const startCreate = () => setEditor({
    supplierProductId: "",
    supplierSku: "",
    title: "",
    category: "",
    description: "",
    image: "",
    supplierCost: "",
    supplierCurrency: "BDT",
    supplierStock: 0,
    sellingPrice: "",
    sellableStock: 0,
    active: false,
  });

  const field = (key, value) =>
    setEditor((current) => ({ ...current, [key]: value }));

  return (
    <section style={{ display: "grid", gap: 14, minWidth: 0 }}>
      <div style={panel}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              {t("Supply Stock", "সাপ্লাই স্টক")}
            </h2>
            <p style={{ ...muted, margin: "5px 0 0" }}>
              {t(
                "MoveDrop-sourced products, separate from PreBotix Product Stock.",
                "PreBotix Product Stock থেকে আলাদা MoveDrop পণ্য।"
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAdmin && (
              <button type="button" style={primary} onClick={startCreate}>
                + {t("Add Supply Product", "Supply পণ্য যোগ করুন")}
              </button>
            )}
            <button type="button" style={button} onClick={load} disabled={loading}>
              {loading ? t("Loading...", "লোড হচ্ছে...") : t("Refresh", "রিফ্রেশ")}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{
          ...panel, color: "#b91c1c", background: "#fef2f2",
          borderColor: "#fecaca",
        }}>{error}</div>
      )}
      {notice && (
        <div role="status" style={{
          ...panel, color: "#047857", background: "#ecfdf5",
          borderColor: "#a7f3d0",
        }}>{notice}</div>
      )}

      <div style={{ ...panel, display: "grid", gap: 12 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}>
          <input
            style={input}
            value={search}
            placeholder={t("Search name, SKU or supplier ID...", "নাম, SKU বা Supplier ID খুঁজুন...")}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
          <select style={input} value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="">{t("All categories", "সব ক্যাটাগরি")}</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {isAdmin && (
            <select style={input} value={active}
              onChange={(event) => { setActive(event.target.value); setPage(1); }}>
              <option value="all">{t("All statuses", "সব Status")}</option>
              <option value="true">{t("Active", "সক্রিয়")}</option>
              <option value="false">{t("Inactive", "নিষ্ক্রিয়")}</option>
            </select>
          )}
          <select style={input} value={sort}
            onChange={(event) => { setSort(event.target.value); setPage(1); }}>
            <option value="updated">{t("Recently updated", "সাম্প্রতিক আপডেট")}</option>
            <option value="price_asc">{t("Price: Low to high", "দাম: কম থেকে বেশি")}</option>
            <option value="price_desc">{t("Price: High to low", "দাম: বেশি থেকে কম")}</option>
            <option value="stock_asc">{t("Supplier stock: Low first", "Supplier Stock: কম আগে")}</option>
          </select>
        </div>
        <div style={muted}>
          {pagination.total || 0} {t("products found", "টি পণ্য পাওয়া গেছে")}
        </div>
      </div>

      <div style={{ ...panel, overflowX: "auto", padding: 0 }}>
        {loading && products.length === 0 ? (
          <p style={{ padding: 18, ...muted }}>{t("Loading products...", "পণ্য লোড হচ্ছে...")}</p>
        ) : products.length === 0 ? (
          <p style={{ padding: 22, textAlign: "center", ...muted }}>
            {t("No Supply products found.", "কোনো Supply পণ্য পাওয়া যায়নি।")}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                {[t("Product", "পণ্য"), t("Supplier ID", "Supplier ID"),
                  t("Category", "ক্যাটাগরি"), t("Supplier Stock", "Supplier Stock"),
                  t("Sellable Stock", "বিক্রয়যোগ্য Stock"), t("Selling Price", "বিক্রয় মূল্য"),
                  t("Status", "Status")].map((label) => (
                  <th key={label} style={{ padding: 12, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{label}</th>
                ))}
                <th style={{ padding: 12 }}>{t("Action", "কাজ")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      {product.image ? (
                        <img src={product.image} alt="" loading="lazy"
                          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 7 }} />
                      ) : (
                        <div style={{ width: 48, height: 48, background: "#f1f5f9", borderRadius: 7 }} />
                      )}
                      <strong>{product.title}</strong>
                    </div>
                  </td>
                  <td style={{ padding: 12 }}>{product.supplierProductId}</td>
                  <td style={{ padding: 12 }}>{product.category}</td>
                  <td style={{ padding: 12 }}>{product.supplierStock ?? "—"}</td>
                  <td style={{ padding: 12 }}>{product.sellableStock ?? "—"}</td>
                  <td style={{ padding: 12, fontWeight: 700 }}>{money(product.sellingPrice)}</td>
                  <td style={{ padding: 12 }}>
                    <span style={{ color: product.active ? "#047857" : "#b91c1c", fontWeight: 700 }}>
                      {product.active ? t("Active", "সক্রিয়") : t("Inactive", "নিষ্ক্রিয়")}
                    </span>
                  </td>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                    <button type="button" style={button} onClick={() => openDetails(product)}>
                      {t("Details", "বিস্তারিত")}
                    </button>{" "}
                    {isAdmin && (
                      <button type="button" style={button}
                        onClick={() => setEditor({ ...product })}>
                        {t("Edit", "Edit")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap",
      }}>
        <span style={muted}>
          {t("Page", "পৃষ্ঠা")} {pagination.page || page} / {pagination.pages || 1}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={button} disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}>
            {t("Previous", "আগের")}
          </button>
          <button style={button} disabled={page >= (pagination.pages || 1) || loading}
            onClick={() => setPage((current) => current + 1)}>
            {t("Next", "পরের")}
          </button>
        </div>
      </div>

      {selected && (
        <div role="dialog" aria-modal="true" style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(15,23,42,.55)", display: "grid",
          placeItems: "center", padding: 14,
        }}>
          <div style={{
            ...panel, width: "min(650px, 100%)", maxHeight: "90vh",
            overflowY: "auto", display: "grid", gap: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <h3 style={{ margin: 0 }}>{selected.title}</h3>
              <button style={button} onClick={() => setSelected(null)}>✕</button>
            </div>
            {selected.image && <img src={selected.image} alt={selected.title}
              style={{ width: "100%", maxHeight: 240, objectFit: "contain" }} />}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              <div><small style={muted}>Supplier Product ID</small><div>{selected.supplierProductId}</div></div>
              <div><small style={muted}>Category</small><div>{selected.category}</div></div>
              <div><small style={muted}>Supplier Stock</small><div>{selected.supplierStock}</div></div>
              <div><small style={muted}>Sellable Stock</small><div>{selected.sellableStock}</div></div>
              <div><small style={muted}>Selling Price</small><div>{money(selected.sellingPrice)}</div></div>
              {isAdmin && (
                <div><small style={muted}>Supplier Cost (Admin only)</small>
                  <div>{money(selected.supplierCost, selected.supplierCurrency || "BDT")}</div>
                </div>
              )}
              <div><small style={muted}>Sync Status</small><div>{selected.syncStatus || "not_synced"}</div></div>
            </div>
            {selected.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{selected.description}</p>}
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={button} onClick={() => { setEditor({ ...selected }); setSelected(null); }}>
                  {t("Edit product", "পণ্য Edit")}
                </button>
                <button style={{ ...button, color: "#b91c1c" }}
                  onClick={() => archiveProduct(selected)}>
                  {t("Archive", "Archive")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {editor && isAdmin && (
        <div role="dialog" aria-modal="true" style={{
          position: "fixed", inset: 0, zIndex: 1201,
          background: "rgba(15,23,42,.55)", display: "grid",
          placeItems: "center", padding: 14,
        }}>
          <form onSubmit={saveProduct} style={{
            ...panel, width: "min(620px, 100%)", maxHeight: "90vh",
            overflowY: "auto", display: "grid", gap: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>
                {editor._id ? t("Edit Supply Product", "Supply পণ্য Edit") : t("Add Supply Product", "Supply পণ্য যোগ")}
              </h3>
              <button type="button" style={button} onClick={() => setEditor(null)}>✕</button>
            </div>
            {[
              ["title", "Product name", true],
              ["category", "Category", true],
              ["image", "Image URL", false],
              ["description", "Description", false],
            ].map(([key, label, required]) => (
              <label key={key} style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 650 }}>
                {label}
                {key === "description" ? (
                  <textarea style={input} rows={3} value={editor[key] || ""}
                    onChange={(event) => field(key, event.target.value)} />
                ) : (
                  <input style={input} required={required} value={editor[key] || ""}
                    onChange={(event) => field(key, event.target.value)} />
                )}
              </label>
            ))}
            {!editor._id && (
              <>
                <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                  Supplier Product ID
                  <input style={input} required value={editor.supplierProductId}
                    onChange={(event) => field("supplierProductId", event.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                  Supplier SKU
                  <input style={input} value={editor.supplierSku}
                    onChange={(event) => field("supplierSku", event.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                  Supplier Cost (private)
                  <input style={input} type="number" min="0" step="0.01" required
                    value={editor.supplierCost}
                    onChange={(event) => field("supplierCost", event.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
                  Supplier Stock
                  <input style={input} type="number" min="0" required
                    value={editor.supplierStock}
                    onChange={(event) => field("supplierStock", event.target.value)} />
                </label>
              </>
            )}
            <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
              PreBotix Selling Price
              <input style={input} type="number" min="0" step="0.01" required
                value={editor.sellingPrice}
                onChange={(event) => field("sellingPrice", event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
              Sellable Stock
              <input style={input} type="number" min="0" step="1" required
                value={editor.sellableStock}
                onChange={(event) => field("sellableStock", event.target.value)} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={Boolean(editor.active)}
                onChange={(event) => field("active", event.target.checked)} />
              {t("Active / visible", "সক্রিয় / দৃশ্যমান")}
            </label>
            <p style={muted}>
              {t(
                "Supplier cost and supplier stock cannot be changed after creation in this phase. Supplier sync will be added after API verification.",
                "এই পর্যায়ে তৈরির পর Supplier Cost ও Supplier Stock পরিবর্তন করা যাবে না। API যাচাইয়ের পরে Sync যুক্ত হবে।"
              )}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={button} onClick={() => setEditor(null)}>
                {t("Cancel", "বাতিল")}
              </button>
              <button type="submit" style={primary} disabled={saving}>
                {saving ? t("Saving...", "সংরক্ষণ হচ্ছে...") : t("Save", "সংরক্ষণ")}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
