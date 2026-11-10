
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileUp,
  FileText,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Database,
} from "lucide-react";
import {
  getAccessToken,
  authFetch,
} from "../utils/authSession";
import { getProductDraft } from "../utils/productDraftStorage";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const toText = (value) => (value == null ? "" : String(value));

const getFileName = (value) =>
  toText(value).split(/[\\/]/).pop().toLowerCase();

export default function ProductBulkImport({
  onClose,
  onImported,
  onRestoreDraft,
}) {
  const inputRef = useRef(null);

  const [jsonFile, setJsonFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [products, setProducts] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [savedDraft, setSavedDraft] = useState(null);
const [checkingDraft, setCheckingDraft] = useState(true);

useEffect(() => {
  let cancelled = false;

  getProductDraft()
    .then((draft) => {
      if (!cancelled) setSavedDraft(draft);
    })
    .catch(() => {
      if (!cancelled) setSavedDraft(null);
    })
    .finally(() => {
      if (!cancelled) setCheckingDraft(false);
    });

  return () => {
    cancelled = true;
  };
}, []);

function restoreSavedDraft() {
  if (!savedDraft || busy) return;
  onRestoreDraft?.(savedDraft);
}

  const imageLookup = useMemo(
    () =>
      new Map(
        imageFiles.map((file) => [file.name.toLowerCase(), file])
      ),
    [imageFiles]
  );

  async function readJson(file) {
    setError("");
    setResults([]);

    if (!file) return;

    if (!/\.json$/i.test(file.name)) {
      setError("একটি valid .json product file নির্বাচন করো।");
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed?.products;

      if (!Array.isArray(list) || !list.length) {
        throw new Error(
          'JSON-এ product array অথবা {"products": [...]} থাকতে হবে।'
        );
      }

      if (
        list.some(
          (item) =>
            !item ||
            typeof item !== "object" ||
            Array.isArray(item)
        )
      ) {
        throw new Error("প্রতিটি product অবশ্যই একটি object হতে হবে।");
      }

      setJsonFile(file);
      setProducts(list);
    } catch (err) {
      setJsonFile(null);
      setProducts([]);
      setError(err.message || "JSON ফাইল পড়া যায়নি।");
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);

    const files = Array.from(event.dataTransfer?.files || []);
    const json = files.find((file) => /\.json$/i.test(file.name));
    const images = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (images.length) {
      setImageFiles((old) => [
        ...old.filter(
          (existing) =>
            !images.some(
              (next) =>
                next.name.toLowerCase() ===
                existing.name.toLowerCase()
            )
        ),
        ...images,
      ]);
    }

    if (json) {
      readJson(json);
    } else if (!images.length) {
      setError("JSON ফাইল অথবা JSON-এর সঙ্গে image ফাইল drop করো।");
    }
  }

  async function importAll() {
    setError("");
    setResults([]);

    const token = getAccessToken();

    if (!token) {
      setError("Admin হিসেবে login করো, তারপর আবার চেষ্টা করো।");
      return;
    }

    if (!products.length) {
      setError("প্রথমে JSON ফাইল নির্বাচন করো।");
      return;
    }

    const invalidIndex = products.findIndex((product) => {
      const imageName = getFileName(
        product.imageFile || product.image
      );

      const hasLocalImage = imageLookup.has(imageName);
      const imageValue = toText(product.image).trim();
      const isUrl = /^https?:\/\//i.test(imageValue);

      return (
        !toText(product.title).trim() ||
        !toText(product.category).trim() ||
        (!isUrl && !hasLocalImage)
      );
    });

    if (invalidIndex >= 0) {
      setError(
        `Product ${invalidIndex + 1}: title, category এবং valid image URL বা image filename প্রয়োজন।`
      );
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: products.length });

    const importedResults = [];

    try {
      const existingResponse = await authFetch(
        `${API}/api/admin/products`,
        {
          method: "GET",
        }
      );

      const existingData = await existingResponse
        .json()
        .catch(() => ({}));

      if (!existingResponse.ok) {
        throw new Error(
          existingData.message ||
            "MongoDB থেকে আগের product list পাওয়া যায়নি।"
        );
      }

      const existingProducts = Array.isArray(existingData)
        ? existingData
        : existingData.products || existingData.data || [];

      const usedIds = new Set(
        existingProducts
          .map((product) => Number(product.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      );

      let nextId = Math.max(0, ...usedIds) + 1;

      for (let index = 0; index < products.length; index++) {
        const product = products[index];

        let id = Number(product.id);

        if (
          !Number.isInteger(id) ||
          id < 1 ||
          usedIds.has(id)
        ) {
          while (usedIds.has(nextId)) nextId++;
          id = nextId++;
        }

        const body = new FormData();

        body.append("id", String(id));

        [
          "title",
          "category",
          "bn",
          "tag",
          "description",
          "descriptionBn",
        ].forEach((key) => {
          if (product[key] !== undefined) {
            body.append(key, toText(product[key]));
          }
        });

        ["price", "costPrice", "stock", "oldPrice"].forEach(
          (key) => {
            if (
              product[key] !== undefined &&
              product[key] !== null &&
              product[key] !== ""
            ) {
              body.append(key, String(Number(product[key])));
            }
          }
        );

        body.append(
          "active",
          String(product.active !== false)
        );

        if (product.discountEndsAt) {
          body.append(
            "discountEndsAt",
            toText(product.discountEndsAt)
          );
        }

        const imageName = getFileName(
          product.imageFile || product.image
        );
        const imageFile = imageLookup.get(imageName);

        if (imageFile) {
          body.append("image", imageFile);
        } else {
          body.append("imageUrl", toText(product.image));
        }

        try {
          const response = await authFetch(
            `${API}/api/admin/products`,
            {
              method: "POST",
              body,
            }
          );

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.message || `HTTP ${response.status}`
            );
          }

          usedIds.add(id);

          importedResults.push({
            row: index + 1,
            title: product.title,
            id,
            ok: true,
          });
        } catch (err) {
          importedResults.push({
            row: index + 1,
            title: product.title,
            id,
            ok: false,
            message: err.message,
          });
        }

        setProgress({
          done: index + 1,
          total: products.length,
        });

        setResults([...importedResults]);
      }

      if (importedResults.some((item) => item.ok)) {
        await onImported?.();
      } else {
        setError(
          "কোনো product save হয়নি। নিচের error details দেখো।"
        );
      }
    } catch (err) {
      setError(err.message || "Product import ব্যর্থ হয়েছে।");
    } finally {
      setBusy(false);
    }
  }

  const successCount = results.filter((item) => item.ok).length;
  const failureCount = results.filter((item) => !item.ok).length;

  return (
    <div
      className="pb-bulk-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose?.();
        }
      }}
    >
      <section
        className="pb-bulk-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import products"
      >
        <header className="pb-bulk-header">
          <div>
            <small>PREBOTIX CATALOG</small>
            <h2>Import Products</h2>
            <p>
              JSON file থেকে product import করো। আগের Add/Edit
              সিস্টেম অপরিবর্তিত থাকবে।
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X />
          </button>
        </header>

        {!checkingDraft && savedDraft && (
          <div className="pb-bulk-format">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>Saved New Product Draft পাওয়া গেছে</strong>
                <p style={{ margin: "5px 0 0" }}>
                  আগের অসমাপ্ত product form এবং uploaded image ফিরিয়ে আনতে পারবে।
                </p>
              </div>

              <button
                type="button"
                className="pb-primary-button"
                onClick={restoreSavedDraft}
                disabled={busy}
              >
                <FileText size={16} />
                Import Draft
              </button>
            </div>
          </div>
        )}

        <div
          className={`pb-bulk-drop ${
            dragging ? "is-dragging" : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <FileUp size={34} />

          <strong>JSON file এখানে Drag & Drop করো</strong>
          <span>অথবা কম্পিউটার থেকে ফাইল নির্বাচন করো</span>

          <button
            type="button"
            className="pb-primary-button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Upload size={16} />
            Choose JSON File
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) =>
              readJson(event.target.files?.[0])
            }
          />

          {jsonFile && (
            <p className="pb-bulk-file">
              {jsonFile.name} · {products.length} product(s)
            </p>
          )}
        </div>

        <label className="pb-bulk-images">
          Product image files (optional). JSON-এর image value-তে
          image filename লিখবে।
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) =>
              setImageFiles(
                Array.from(event.target.files || [])
              )
            }
          />
        </label>

        <div className="pb-bulk-format">
          <strong>Required fields:</strong> title, category, price,
          image. Image URL অথবা image filename ব্যবহার করো।
          JSON-এ product array অথবা{" "}
          <code>{"{ \"products\": [...] }"}</code> দিতে পারবে।
        </div>

        {products.length > 0 && (
          <div className="pb-bulk-preview">
            <div className="pb-bulk-preview-head">
              <strong>Preview ({products.length})</strong>
              <span>না থাকলে বা আগে ব্যবহৃত হলে ID তৈরি হবে</span>
            </div>

            <div className="pb-bulk-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 8).map((product, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{toText(product.title) || "—"}</td>
                      <td>{toText(product.category) || "—"}</td>
                      <td>৳{toText(product.price) || "0"}</td>
                      <td>
                        {imageLookup.has(
                          getFileName(
                            product.imageFile || product.image
                          )
                        )
                          ? "Local image"
                          : toText(product.image).slice(0, 35) ||
                            "Missing"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {products.length > 8 && (
                <p>আরও {products.length - 8}টি product আছে…</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="pb-bulk-message is-error">
            <AlertCircle size={17} />
            {error}
          </p>
        )}

        {results.length > 0 && (
          <div className="pb-bulk-results">
            <strong>
              <Database size={16} />
              ফলাফল: {successCount} saved, {failureCount} failed
            </strong>

            {results
              .filter((item) => !item.ok)
              .slice(0, 8)
              .map((item) => (
                <p key={item.row}>
                  Row {item.row} ({item.title}): {item.message}
                </p>
              ))}
          </div>
        )}

        {busy && (
          <div className="pb-bulk-progress">
            <span>
              Importing {progress.done} / {progress.total}
            </span>
            <div>
              <i
                style={{
                  width: `${
                    progress.total
                      ? (progress.done / progress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {successCount > 0 && !busy && (
          <p className="pb-bulk-message is-success">
            <CheckCircle2 size={17} />
            {successCount}টি product সফলভাবে save হয়েছে।
          </p>
        )}

        <footer className="pb-bulk-footer">
          <button
            type="button"
            className="pb-secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>

          <button
            type="button"
            className="pb-primary-button"
            onClick={importAll}
            disabled={busy || !products.length}
          >
            <Database size={16} />
            {busy
              ? "Importing…"
              : `Import ${products.length || ""} Product(s)`}
          </button>
        </footer>
      </section>
    </div>
  );
}
