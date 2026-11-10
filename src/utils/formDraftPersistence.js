const STORAGE_PREFIX = "prebotix:form-drafts:v1:";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const RESTORE_ATTRIBUTE = "data-pb-draft-restored";
const SENSITIVE_NAME_PATTERN = /password|passwd|passcode|otp|one.?time|verification|token|secret|credit.?card|card.?number|cvv|cvc|security.?code|\bpin\b/i;
const SENSITIVE_AUTOCOMPLETE_PATTERN = /current-password|new-password|one-time-code|cc-number|cc-csc|cc-exp|cc-name/i;
const IGNORED_INPUT_TYPES = new Set([
  "password",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
]);

function canUseStorage() {
  try {
    const testKey = `${STORAGE_PREFIX}test`;
    window.sessionStorage.setItem(testKey, "1");
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function isPersistableField(field) {
  if (field.closest("[data-pb-no-global-draft]")) return false;

  if (!(field instanceof HTMLElement) || field.disabled) return false;
  if (!(field instanceof HTMLElement) || field.disabled) return false;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return false;

  const type = field instanceof HTMLInputElement ? field.type.toLowerCase() : "";
  if (IGNORED_INPUT_TYPES.has(type)) return false;

  const identity = [
    field.name,
    field.id,
    field.getAttribute("autocomplete"),
    field.getAttribute("aria-label"),
    field.getAttribute("placeholder"),
  ].filter(Boolean).join(" ");

  return !SENSITIVE_NAME_PATTERN.test(identity)
    && !SENSITIVE_AUTOCOMPLETE_PATTERN.test(field.getAttribute("autocomplete") || "");
}

function getStorageKey() {
  return `${STORAGE_PREFIX}${window.location.pathname}${window.location.search}`;
}

function getFormKey(field) {
  const form = field.form;
  if (!form) return "outside-form";
  return form.id
    || form.getAttribute("name")
    || form.getAttribute("data-draft-key")
    || [...form.classList].sort().join(".")
    || `form-${[...document.forms].indexOf(form)}`;
}

function getFieldKey(field) {
  const stableIdentity = field.getAttribute("data-draft-key")
    || field.name
    || field.id
    || field.getAttribute("aria-label")
    || field.getAttribute("placeholder");

  if (stableIdentity) {
    const optionIdentity = field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")
      ? `::${field.value}`
      : "";
    return `${getFormKey(field)}::${field.tagName.toLowerCase()}::${stableIdentity}${optionIdentity}`;
  }

  const siblings = field.form
    ? [...field.form.querySelectorAll("input, textarea, select")]
    : [...document.querySelectorAll("input, textarea, select")];
  return `${getFormKey(field)}::${field.tagName.toLowerCase()}::index-${siblings.indexOf(field)}`;
}

function readDrafts(storageKey) {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    if (!parsed || Date.now() - parsed.updatedAt > DRAFT_TTL_MS || !parsed.fields) return {};
    return parsed.fields;
  } catch {
    return {};
  }
}

function writeDrafts(storageKey, fields) {
  try {
    if (Object.keys(fields).length === 0) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify({ updatedAt: Date.now(), fields }));
  } catch {
    // Draft persistence is best-effort; it must never interrupt normal form use.
  }
}

function getFieldValue(field) {
  if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
    return { kind: "checked", value: field.checked };
  }
  return { kind: "value", value: field.value };
}

function setNativeChecked(field, checked) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  if (setter) setter.call(field, checked);
  else field.checked = checked;
}

function setNativeValue(field, value) {
  const prototype = field instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
}

/**
 * Keeps non-sensitive form drafts for the current browser tab so a refresh,
 * route remount, or temporary loading screen does not erase typed values.
 * Passwords, OTPs, file uploads, and payment-card fields are never stored.
 */
export function installFormDraftPersistence() {
  if (typeof window === "undefined" || !canUseStorage()) return () => {};

  const restored = new WeakSet();

  const persistField = (field) => {
    if (!isPersistableField(field)) return;
    const fields = readDrafts(getStorageKey());
    const key = getFieldKey(field);
    const { kind, value } = getFieldValue(field);

    if (kind === "value" && value === "") delete fields[key];
    else fields[key] = { kind, value };
    writeDrafts(getStorageKey(), fields);
  };

  const restoreField = (field) => {
    if (!isPersistableField(field) || restored.has(field) || field.hasAttribute(RESTORE_ATTRIBUTE)) return;

    const saved = readDrafts(getStorageKey())[getFieldKey(field)];
    restored.add(field);
    field.setAttribute(RESTORE_ATTRIBUTE, "true");
    if (!saved) return;

    if (saved.kind === "checked" && field instanceof HTMLInputElement) {
      setNativeChecked(field, Boolean(saved.value));
    } else if (saved.kind === "value") {
      setNativeValue(field, String(saved.value ?? ""));
    } else {
      return;
    }

    // Notify React controlled inputs so component state matches the restored DOM value.
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const restoreAllFields = () => {
    document.querySelectorAll("input, textarea, select").forEach(restoreField);
  };

  const handleEdit = (event) => {
    if (event.target instanceof HTMLElement) persistField(event.target);
  };

  const handleReset = (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    window.setTimeout(() => {
      const fields = readDrafts(getStorageKey());
      form.querySelectorAll("input, textarea, select").forEach((field) => {
        if (isPersistableField(field)) delete fields[getFieldKey(field)];
      });
      writeDrafts(getStorageKey(), fields);
    }, 0);
  };

  document.addEventListener("input", handleEdit, true);
  document.addEventListener("change", handleEdit, true);
  document.addEventListener("reset", handleReset, true);

  const observer = new MutationObserver(() => restoreAllFields());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  restoreAllFields();

  return () => {
    observer.disconnect();
    document.removeEventListener("input", handleEdit, true);
    document.removeEventListener("change", handleEdit, true);
    document.removeEventListener("reset", handleReset, true);
  };
}
