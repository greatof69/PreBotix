import { useEffect, useState } from "react";
import {
  X,
  Upload,
  Save,
  LoaderCircle,
  Trash2,
  Plus,
} from "lucide-react";
import {
  getAccessToken,
  authFetch,
} from "../utils/authSession";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const blank = {
  id: "",
  title: "",
  category: "",
  bn: "",
  price: "",
  priceMax: "",
  priceMaxEnabled: false,
  oldPrice: "",
  oldPriceMax: "",
  oldPriceMaxEnabled: false,
  discountPrice: "",
  discountPriceMax: "",
  discountPriceMaxEnabled: false,
  costPrice: "0",
  costPriceMax: "",
  costPriceMaxEnabled: false,
  priceOptionsEnabled: false,
  priceOptionsTitle: "Choose your option",
  priceOptions: [],
  stock: "0",
  tag: "",
  description: "",
  descriptionBn: "",
  details: "",
  detailsBn: "",
  discountEndsAt: "",
  active: true,
  priceOptionsDisplay: "min",
};

function toLocalDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

async function readResponse(response) {
  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

function makeOptionId() {
  return `opt_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getRangeError(
  minValue,
  maxValue,
  label,
  maxEnabled = false
) {
  if (
    minValue === "" ||
    !Number.isFinite(Number(minValue)) ||
    Number(minValue) < 0
  ) {
    return `${label} minimum must be a valid non-negative number.`;
  }

  if (maxEnabled && maxValue === "") {
    return `${label} maximum is required.`;
  }

  if (
    maxValue !== "" &&
    (
      !Number.isFinite(Number(maxValue)) ||
      Number(maxValue) < Number(minValue)
    )
  ) {
    return `${label} maximum must be greater than or equal to its minimum.`;
  }

  return "";
}

function getInitialForm(product) {
  return {
    ...blank,

    id: product?.id == null ? "" : String(product.id),
    title: product?.title || product?.name || "",
    category: product?.category || "",
    bn: product?.bn || "",

    price:
      product?.price == null ? "" : String(product.price),

    priceMax:
      product?.priceMax == null ? "" : String(product.priceMax),

    priceMaxEnabled:
      product?.priceMax != null && product?.priceMax !== "",

    oldPrice:
      product?.oldPrice == null ? "" : String(product.oldPrice),

    oldPriceMax:
      product?.oldPriceMax == null
        ? ""
        : String(product.oldPriceMax),

    oldPriceMaxEnabled:
      product?.oldPriceMax != null &&
      product?.oldPriceMax !== "",

    discountPrice:
      product?.discountPrice == null
        ? ""
        : String(product.discountPrice),

    discountPriceMax:
      product?.discountPriceMax == null
        ? ""
        : String(product.discountPriceMax),

    discountPriceMaxEnabled:
      product?.discountPriceMax != null &&
      product?.discountPriceMax !== "",

    costPrice: String(product?.costPrice ?? 0),

    costPriceMax:
      product?.costPriceMax == null
        ? ""
        : String(product.costPriceMax),

    costPriceMaxEnabled:
      product?.costPriceMax != null &&
      product?.costPriceMax !== "",

    priceOptionsEnabled:
      product?.priceOptionsEnabled === true,

    priceOptionsTitle:
      product?.priceOptionsTitle || "Choose your option",

    priceOptions: Array.isArray(product?.priceOptions)
      ? product.priceOptions.map((option) => ({
          id: String(option?.id || makeOptionId()),
          text: String(option?.text || ""),
          price:
            option?.price == null ? "" : String(option.price),
          originalPrice:
            option?.originalPrice == null
              ? ""
              : String(option.originalPrice),
        }))
      : [],

    stock: String(product?.stock ?? 0),
    tag: product?.tag || "",
    description: product?.description || "",
    descriptionBn: product?.descriptionBn || "",

    details:
      product?.details ||
      product?.fullDescription ||
      "",

    detailsBn:
      product?.detailsBn ||
      product?.fullDescriptionBn ||
      "",

    discountEndsAt: toLocalDateTime(product?.discountEndsAt),
    active: product?.active !== false,

    priceOptionsDisplay:
    product?.priceOptionsDisplay === "max" ? "max" : "min",
  };
}

/**
 * One price field.
 *  - checkbox OFF -> a single normal price input.
 *  - checkbox ON  -> Minimum and Maximum inputs side by side on ONE line.
 */
function PriceRangeField({
  label,
  hint,
  name,
  maxName,
  enabledName,
  form,
  setForm,
  onChange,
  required = false,
  maxRequired = false,
  maxDisabled = false,
  placeholder,
}) {
  const enabled = Boolean(form[enabledName]);

  function toggle(event) {
    const on = event.target.checked;

    setForm((current) => ({
      ...current,
      [enabledName]: on,
      [maxName]: on ? current[maxName] : "",
    }));
  }

  return (
    <div
      className={`pb-inline-wide pb-range-field${
        enabled ? " is-range" : ""
      }`}
    >
      <div className="pb-range-head">
        <span className="pb-range-title">
          {label}
          {required ? " *" : ""}
        </span>

        <label className="pb-range-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggle}
          />
          Minimum – Maximum range
        </label>
      </div>

      <div className="pb-range-inputs">
        <label>
          <span>{enabled ? "Minimum (৳)" : "Price (৳)"}</span>

          <input
            name={name}
            type="number"
            min="0"
            step="any"
            value={form[name]}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
          />
        </label>

        {enabled && (
          <label>
            <span>Maximum (৳)</span>

            <input
              name={maxName}
              type="number"
              min={form[name] || 0}
              step="any"
              value={form[maxName]}
              onChange={onChange}
              required={maxRequired}
              disabled={maxDisabled}
              placeholder="Maximum"
            />
          </label>
        )}
      </div>

      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function InlineProductEditor({
  product,
  onClose,
  onSaved,
}) {
  const editing = Boolean(product);

  const [form, setForm] = useState(() => getInitialForm(product));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(product?.image || "");
  const [imageDeleted, setImageDeleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState(!editing);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  // Find the smallest unused positive Product ID.
  useEffect(() => {
    if (editing) {
      setLoadingId(false);
      return undefined;
    }

    let cancelled = false;

    async function loadNextId() {
      setLoadingId(true);
      setError("");

      setForm((current) => ({
        ...current,
        id: "",
      }));

      try {
        const token = getAccessToken();

        if (!token) {
          throw new Error("Please log in again as Admin.");
        }

        const response = await authFetch(`${API}/api/admin/products`, {
          method: "GET",
        });

        const data = await readResponse(response);

        const products = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : null;

        if (!products) {
          throw new Error("Invalid products response from server.");
        }

        const usedIds = new Set();

        for (const item of products) {
          const id = Number(item?.id);

          if (Number.isSafeInteger(id) && id > 0) {
            usedIds.add(id);
          }
        }

        let nextId = 1;

        while (usedIds.has(nextId)) {
          nextId += 1;

          if (!Number.isSafeInteger(nextId)) {
            throw new Error("Could not find an available Product ID.");
          }
        }

        if (!cancelled) {
          setForm((current) => ({
            ...current,
            id: String(nextId),
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setForm((current) => ({
            ...current,
            id: "",
          }));

          setError(err.message || "Could not prepare Product ID.");
        }
      } finally {
        if (!cancelled) {
          setLoadingId(false);
        }
      }
    }

    loadNextId();

    return () => {
      cancelled = true;
    };
  }, [editing]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, saving]);

  function change(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
    setSuccess("");
  }

  function addPriceOption() {
    if (form.priceOptions.length >= 30) {
      setError("You can add a maximum of 30 price options.");
      return;
    }

    setForm((current) => ({
      ...current,
      priceOptions: [
        ...current.priceOptions,
        {
          id: makeOptionId(),
          text: "",
          price: "",
          originalPrice: "",
        },
      ],
    }));

    setError("");
    setSuccess("");
  }

  function updatePriceOption(index, field, value) {
    setForm((current) => ({
      ...current,
      priceOptions: current.priceOptions.map(
        (option, optionIndex) =>
          optionIndex === index
            ? { ...option, [field]: value }
            : option
      ),
    }));

    setError("");
    setSuccess("");
  }

  function removePriceOption(index) {
    setForm((current) => ({
      ...current,
      priceOptions: current.priceOptions.filter(
        (_, optionIndex) => optionIndex !== index
      ),
    }));

    setError("");
  }

  function handleFileChange(event) {
    const input = event.target;
    const selected = input.files?.[0] || null;

    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      input.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(selected.type)) {
      setError("Please select a JPG, PNG, WEBP or GIF image.");
      input.value = "";
      return;
    }

    setError("");
    setSuccess("");
    setImageDeleted(false);
    setFile(selected);

    const reader = new FileReader();

    reader.onload = () => {
      setPreview(String(reader.result || ""));
    };

    reader.onerror = () => {
      setPreview("");
      setError("Could not generate image preview. Please select again.");
    };

    reader.readAsDataURL(selected);

    // Allow selecting the same image again.
    input.value = "";
  }

  function handleDeleteImage() {
    setFile(null);
    setPreview("");
    setImageDeleted(true);

    setForm((current) => ({
      ...current,
      image: "",
    }));

    setError("");
    setSuccess("");
  }

  async function save(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (saving || loadingId) return;

    const token = getAccessToken();

    if (!token) {
      setError("Your session expired. Please log in again.");
      return;
    }

    if (!editing) {
      const id = Number(form.id);

      if (!form.id || !Number.isSafeInteger(id) || id < 1) {
        setError(
          "A valid Product ID is required. Please reopen Add Product."
        );
        return;
      }
    }

    if (!form.title.trim()) {
      setError("Product title is required.");
      return;
    }

    if (!form.category.trim()) {
      setError("Product category is required.");
      return;
    }

    if (
      form.price === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Enter a valid selling price.");
      return;
    }

    if (
      form.oldPrice !== "" &&
      (
        !Number.isFinite(Number(form.oldPrice)) ||
        Number(form.oldPrice) < 0
      )
    ) {
      setError("Enter a valid original price.");
      return;
    }

    if (
      form.discountPrice !== "" &&
      (
        !Number.isFinite(Number(form.discountPrice)) ||
        Number(form.discountPrice) < 0
      )
    ) {
      setError("Enter a valid discount price.");
      return;
    }

    if (form.discountPrice !== "") {
      if (Number(form.discountPrice) >= Number(form.price)) {
        setError("Discount price must be lower than selling price.");
        return;
      }

      // Discount end time is optional.
      if (form.discountEndsAt) {
        const discountEnd = new Date(form.discountEndsAt).getTime();

        if (Number.isNaN(discountEnd)) {
          setError("Enter a valid discount end date.");
          return;
        }

        if (discountEnd <= Date.now()) {
          setError("Discount end time must be in the future.");
          return;
        }
      }
    }

    const rangeChecks = [
      [
        form.price,
        form.priceMaxEnabled ? form.priceMax : "",
        "Selling price",
        form.priceMaxEnabled,
      ],
      [
        form.oldPrice,
        form.oldPriceMaxEnabled ? form.oldPriceMax : "",
        "Original price",
        form.oldPriceMaxEnabled,
      ],
      [
        form.discountPrice,
        form.discountPriceMaxEnabled
          ? form.discountPriceMax
          : "",
        "Discount price",
        form.discountPriceMaxEnabled,
      ],
      [
        form.costPrice,
        form.costPriceMaxEnabled ? form.costPriceMax : "",
        "Cost price",
        form.costPriceMaxEnabled,
      ],
    ];

    for (const [minValue, maxValue, label, maxEnabled] of rangeChecks) {
      if (
        minValue === "" &&
        label === "Original price" &&
        maxValue === ""
      ) {
        continue;
      }

      if (
        minValue === "" &&
        label === "Discount price" &&
        maxValue === ""
      ) {
        continue;
      }

      const rangeError = getRangeError(
        minValue,
        maxValue,
        label,
        maxEnabled
      );

      if (rangeError) {
        setError(rangeError);
        return;
      }
    }

    if (
      form.discountPrice !== "" &&
      Number(form.discountPrice) >= Number(form.price)
    ) {
      setError("Discount minimum must be lower than selling minimum.");
      return;
    }

    if (
      form.discountPriceMaxEnabled &&
      form.discountPriceMax !== "" &&
      Number(form.discountPriceMax) >=
        Number(
          form.priceMaxEnabled && form.priceMax !== ""
            ? form.priceMax
            : form.price
        )
    ) {
      setError("Discount maximum must be lower than selling maximum.");
      return;
    }

    // Validate customer Price Options.
    if (form.priceOptionsEnabled) {
      if (
        form.priceOptions.length < 1 ||
        form.priceOptions.length > 30
      ) {
        setError("Add between 1 and 30 Price Options.");
        return;
      }

      const optionIds = new Set();

      for (const option of form.priceOptions) {
        const optionPrice = Number(option.price);

        if (
          !option.text.trim() ||
          option.price === "" ||
          !Number.isSafeInteger(optionPrice) ||
          optionPrice < 0
        ) {
          setError(
            "Each option needs a name and a valid whole-number selling price."
          );
          return;
        }

        if (optionIds.has(option.id)) {
          setError("Every Price Option must have a unique ID.");
          return;
        }

        optionIds.add(option.id);

        if (option.originalPrice !== "") {
          const originalPrice = Number(option.originalPrice);

          if (
            !Number.isSafeInteger(originalPrice) ||
            originalPrice < 0
          ) {
            setError(
              "Option original price must be a valid non-negative whole number."
            );
            return;
          }
        }
      }
    }

    const hasImage = Boolean(file || preview);

    if (!hasImage && !editing) {
      setError("Please upload a product image.");
      return;
    }

    const costPrice = Number(form.costPrice || 0);

    if (!Number.isFinite(costPrice) || costPrice < 0) {
      setError("Enter a valid cost price.");
      return;
    }

    const stock = Number(form.stock || 0);

    if (!Number.isSafeInteger(stock) || stock < 0) {
      setError("Stock must be a whole number of zero or more.");
      return;
    }

    const body = new FormData();

    if (!editing) {
      body.append("id", String(Number(form.id)));
    }

    body.append("title", form.title.trim());
    body.append("category", form.category.trim());
    body.append("bn", form.bn || "");
    body.append("tag", form.tag || "");
    body.append("description", form.description || "");
    body.append("descriptionBn", form.descriptionBn || "");
    body.append("details", form.details || "");
    body.append("detailsBn", form.detailsBn || "");

    body.append("price", String(Number(form.price)));

    body.append(
      "priceMax",
      form.priceMaxEnabled && form.priceMax !== ""
        ? String(Number(form.priceMax))
        : ""
    );

    body.append(
      "oldPriceMax",
      form.oldPriceMaxEnabled && form.oldPriceMax !== ""
        ? String(Number(form.oldPriceMax))
        : ""
    );

    body.append(
      "discountPriceMax",
      form.discountPriceMaxEnabled &&
        form.discountPriceMax !== ""
        ? String(Number(form.discountPriceMax))
        : ""
    );

    body.append("costPrice", String(costPrice));

    body.append(
      "costPriceMax",
      form.costPriceMaxEnabled && form.costPriceMax !== ""
        ? String(Number(form.costPriceMax))
        : ""
    );

    body.append(
      "priceOptionsEnabled",
      String(Boolean(form.priceOptionsEnabled))
    );

    body.append(
      "priceOptionsTitle",
      form.priceOptionsTitle || ""
    );

    body.append(
      "priceOptions",
      JSON.stringify(
        form.priceOptionsEnabled
          ? form.priceOptions.map((option) => ({
              id: String(option.id || makeOptionId()),
              text: option.text.trim(),
              price: Number(option.price),
              ...(option.originalPrice !== ""
                ? {
                    originalPrice: Number(option.originalPrice),
                  }
                : {}),
            }))
          : []
      )
    );

    // Save Admin's Minimum / Maximum card price selection.
    body.append(
      "priceOptionsDisplay",
      form.priceOptionsDisplay === "max" ? "max" : "min"
    );

    body.append("stock", String(stock));
    body.append("active", String(Boolean(form.active)));

    body.append(
      "discountPrice",
      form.discountPrice === ""
        ? ""
        : String(Number(form.discountPrice))
    );

    body.append(
      "oldPrice",
      form.oldPrice.trim() === ""
        ? ""
        : String(Number(form.oldPrice))
    );

    body.append(
      "discountEndsAt",
      form.discountPrice !== "" && form.discountEndsAt
        ? new Date(form.discountEndsAt).toISOString()
        : ""
    );

    if (file) {
      body.append("image", file);
    } else if (editing && imageDeleted) {
      body.append("deleteImage", "true");
    } else if (editing && !preview) {
      body.append("deleteImage", "true");
    }

    setSaving(true);

    try {
      const productId = Number(product?.id);

      if (
        editing &&
        (!Number.isSafeInteger(productId) || productId < 1)
      ) {
        throw new Error("This product has no valid numeric ID.");
      }

      const url = editing
        ? `${API}/api/admin/products/${productId}`
        : `${API}/api/admin/products`;

      const response = await authFetch(url, {
        method: editing ? "PATCH" : "POST",
        body,
      });
      
      const data = await readResponse(response);

      if (!data.product) {
        throw new Error(
          "The server did not return the saved product."
        );
      }

      setSuccess(
        editing
          ? "Product updated successfully."
          : "Product created successfully."
      );

      await onSaved?.(data.product);
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  const imageValue = imageDeleted
    ? ""
    : preview || product?.image || "";

  const imageSrc = imageValue
    ? /^(https?:\/\/|blob:|data:)/i.test(imageValue)
      ? imageValue
      : `${API}${imageValue.startsWith("/") ? "" : "/"}${imageValue}`
    : "";

  return (
    <div
      className="pb-inline-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving
        ) {
          onClose?.();
        }
      }}
    >
      <section
        className="pb-inline-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pb-product-editor-title"
      >
        <header className="pb-inline-editor-header">
          <div>
            <small>PREBOTIX · PRODUCT MANAGEMENT</small>

            <h2 id="pb-product-editor-title">
              {editing ? "Edit Product" : "Add Product"}
            </h2>

            <p>
              Changes are saved through the Admin API to MongoDB.
            </p>
          </div>

          <button
            type="button"
            className="pb-editor-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close editor"
          >
            <X size={21} />
          </button>
        </header>

        {error && (
          <div className="pb-editor-alert error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="pb-editor-alert success" role="status">
            {success}
          </div>
        )}

        <form onSubmit={save}>
          <div className="pb-inline-editor-grid">
            <label>
              Product ID

              <input
                name="id"
                type="number"
                value={form.id}
                readOnly
                required
                placeholder={
                  loadingId
                    ? "Loading..."
                    : error && !form.id
                      ? "Could not load ID"
                      : "Product ID"
                }
              />

              <small>
                {editing
                  ? "Product ID cannot be changed."
                  : loadingId
                    ? "Checking existing products..."
                    : form.id
                      ? "Automatically selected from existing products."
                      : "Could not determine an ID. Close and reopen this form."}
              </small>
            </label>

            <label>
              Product title *

              <input
                name="title"
                value={form.title}
                onChange={change}
                required
                maxLength={200}
              />
            </label>

            <label>
              Category *

              <input
                name="category"
                value={form.category}
                onChange={change}
                required
                maxLength={100}
              />
            </label>

            <label>
              Bangla title

              <input
                name="bn"
                value={form.bn}
                onChange={change}
                maxLength={200}
              />
            </label>

            {/* PRICES: tick the box to get Minimum + Maximum on one line */}
            <PriceRangeField
              label="Selling price"
              hint="Regular selling price, before any discount."
              name="price"
              maxName="priceMax"
              enabledName="priceMaxEnabled"
              form={form}
              setForm={setForm}
              onChange={change}
              required
              maxRequired
            />

            <PriceRangeField
              label="Original price"
              hint="Optional. Shown crossed out next to the selling price."
              name="oldPrice"
              maxName="oldPriceMax"
              enabledName="oldPriceMaxEnabled"
              form={form}
              setForm={setForm}
              onChange={change}
              placeholder="Optional"
            />

            <PriceRangeField
              label="Discount price"
              hint="Leave empty when there is no discount."
              name="discountPrice"
              maxName="discountPriceMax"
              enabledName="discountPriceMaxEnabled"
              form={form}
              setForm={setForm}
              onChange={change}
              maxDisabled={!form.discountPrice}
              placeholder="Optional"
            />

            <label className="pb-inline-wide">
              Discount ends at

              <input
                name="discountEndsAt"
                type="datetime-local"
                value={form.discountEndsAt}
                onChange={change}
                disabled={!form.discountPrice}
              />

              <small>
                The offer ends automatically at this date and time.
              </small>
            </label>

            <PriceRangeField
              label="Cost price"
              name="costPrice"
              maxName="costPriceMax"
              enabledName="costPriceMaxEnabled"
              form={form}
              setForm={setForm}
              onChange={change}
            />

            {/* CUSTOMER PRICE OPTIONS */}
            <div
              className="pb-inline-wide pb-price-options-section"
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              <label
                className="pb-inline-check"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  name="priceOptionsEnabled"
                  type="checkbox"
                  checked={Boolean(form.priceOptionsEnabled)}
                  onChange={change}
                />

                <span>Enable customer Price Options</span>
              </label>

              {form.priceOptionsEnabled && (
                <>
                  <label>
                    Option group title

                    <input
                      name="priceOptionsTitle"
                      value={form.priceOptionsTitle}
                      onChange={change}
                      placeholder="Choose your option"
                      maxLength={100}
                    />
                  </label>

                  <div className="pb-price-option-list">
                    {form.priceOptions.map((option, index) => (
                      <div
                        className="pb-price-option-card"
                        key={option.id}
                      >
                        <div className="pb-price-option-card-header">
                          <strong>
                            Option {index + 1}
                          </strong>

                          <button
                            type="button"
                            className="pb-price-option-remove"
                            onClick={() =>
                              removePriceOption(index)
                            }
                            aria-label={`Remove option ${index + 1}`}
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                        </div>

                        <div className="pb-price-option-fields">
                          <label>
                            Option name *

                            <input
                              value={option.text}
                              onChange={(event) =>
                                updatePriceOption(
                                  index,
                                  "text",
                                  event.target.value
                                )
                              }
                              placeholder="e.g. Basic Kit"
                              maxLength={120}
                              required
                            />
                          </label>

                          <label>
                            Selling price (৳) *

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={option.price}
                              onChange={(event) =>
                                updatePriceOption(
                                  index,
                                  "price",
                                  event.target.value
                                )
                              }
                              placeholder="e.g. 1500"
                              required
                            />
                          </label>

                          <label>
                            Original price (৳)

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={option.originalPrice ?? ""}
                              onChange={(event) =>
                                updatePriceOption(
                                  index,
                                  "originalPrice",
                                  event.target.value
                                )
                              }
                              placeholder="Optional"
                            />

                            <small>
                              Leave empty if there is no original price.
                            </small>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="pb-secondary-button"
                    onClick={addPriceOption}
                    disabled={form.priceOptions.length >= 30}
                  >
                    <Plus size={16} />
                    Add Price Option
                  </button>

                  <small>
                    Original price will appear crossed out only when
                    it is higher than the option selling price.
                  </small>
                </>
              )}
            </div>
            {form.priceOptionsEnabled && (
              <label>
                Product Card Price Display

                <select
                  name="priceOptionsDisplay"
                  value={form.priceOptionsDisplay}
                  onChange={change}
                >
                  <option value="min">Minimum Price</option>
                  <option value="max">Maximum Price</option>
                </select>
              </label>
            )}
            <label>
              Stock quantity

              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={change}
              />
            </label>

            <label>
              Product tag

              <input
                name="tag"
                value={form.tag}
                onChange={change}
                maxLength={100}
              />
            </label>

            <label className="pb-upload-label">
              <span className="pb-upload-heading">
                <Upload size={18} />
                Product image *
              </span>

              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
              />

              <small>
                JPG, PNG, WEBP or GIF · Max 5 MB.
                {editing
                  ? " Choose a new file to replace the current image."
                  : " Select an image to see its preview."}
              </small>
            </label>

            <label className="pb-inline-wide">
              Description

              <textarea
                name="description"
                rows="3"
                value={form.description}
                onChange={change}
                maxLength={10000}
              />
            </label>

            <label className="pb-inline-wide">
              Bangla description

              <textarea
                name="descriptionBn"
                rows="3"
                value={form.descriptionBn}
                onChange={change}
                maxLength={10000}
              />
            </label>

            <label className="pb-inline-wide">
              Detailed description (English)

              <textarea
                name="details"
                rows="6"
                value={form.details}
                onChange={change}
                maxLength={20000}
                placeholder="Enter detailed product information..."
              />
            </label>

            <label className="pb-inline-wide">
              বিস্তারিত বিবরণ (বাংলা)

              <textarea
                name="detailsBn"
                rows="6"
                value={form.detailsBn}
                onChange={change}
                maxLength={20000}
                placeholder="পণ্যের বিস্তারিত তথ্য লিখুন..."
              />
            </label>

          </div>

          {(file || imageSrc) && (
            <div className="pb-inline-preview">
              {imageSrc ? (
                <img
                  key={imageSrc}
                  src={imageSrc}
                  alt="Product preview"
                  onError={() => {
                    setError("Could not display this image. Please select another image.");
                  }}
                />
              ) : (
                <span>Preparing image preview...</span>
              )}

              <div>
                <span>
                  {file ? "New image preview" : "Current image"}
                </span>

                <button
                  type="button"
                  className="pb-inline-delete-image"
                  onClick={handleDeleteImage}
                >
                  <Trash2 size={16} />
                  Delete Image
                </button>
              </div>
            </div>
          )}

          <footer className="pb-inline-editor-footer">
            <button
              type="button"
              className="pb-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="pb-primary-button"
              disabled={
                saving ||
                loadingId ||
                (!editing && !form.id)
              }
            >
              {saving ? (
                <LoaderCircle
                  className="pb-editor-spinner"
                  size={17}
                />
              ) : (
                <Save size={17} />
              )}

              {saving
                ? "Saving..."
                : editing
                  ? "Update Product"
                  : "Save Product"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}