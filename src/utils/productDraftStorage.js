const DB_NAME = "prebotix-product-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const NEW_PRODUCT_DRAFT_KEY = "new-product";

function openDraftDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("এই browser-এ IndexedDB support নেই।"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Draft database খুলতে সমস্যা হয়েছে।"));
  });
}

export async function saveProductDraft(draft) {
  const db = await openDraftDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put(
      {
        ...draft,
        savedAt: Date.now(),
      },
      NEW_PRODUCT_DRAFT_KEY
    );

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Draft save হয়নি।"));
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Draft save বাতিল হয়েছে।"));
    };
  });
}

export async function getProductDraft() {
  const db = await openDraftDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction
      .objectStore(STORE_NAME)
      .get(NEW_PRODUCT_DRAFT_KEY);

    request.onsuccess = () => {
      const result = request.result || null;
      db.close();
      resolve(result);
    };

    request.onerror = () => {
      db.close();
      reject(request.error || new Error("Draft load হয়নি।"));
    };
  });
}

export async function deleteProductDraft() {
  const db = await openDraftDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).delete(
      NEW_PRODUCT_DRAFT_KEY
    );

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Draft delete হয়নি।"));
    };
  });
}