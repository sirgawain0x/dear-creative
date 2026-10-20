import { StorageClient } from "@lens-chain/storage-client";

export type LensGroveUploadResult = {
  uri: string;
  gatewayUrl: string;
  storageKey: string;
};

let cachedClient: StorageClient | null = null;

export function getLensGroveStorageClient(): StorageClient {
  if (!cachedClient) {
    cachedClient = StorageClient.create();
  }
  return cachedClient;
}

export function resolveGroveOrIpfsUrl(
  urlOrUri: string | null | undefined,
): string {
  if (!urlOrUri) return "";
  const trimmed = urlOrUri.trim();
  if (trimmed.startsWith("lens://")) {
    const key = trimmed.slice("lens://".length);
    return `https://api.grove.storage/${key}`;
  }
  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://api.grove.storage/${cid}`;
  }
  return trimmed;
}

function abortRejection(signal: AbortSignal): Promise<never> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true },
    );
  });
}

async function raceWithAbortSignal<T>(
  work: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (!signal) {
    return work;
  }
  return Promise.race([work, abortRejection(signal)]);
}

/**
 * Uploads a file (File or Blob) to Lens Grove on-chain controlled storage.
 * Returns the decentralized URI and the public gateway URL (https://api.grove.storage/...).
 */
export async function uploadToLensGrove(
  file: File | Blob,
  fileName = "banner.png",
  signal?: AbortSignal,
): Promise<LensGroveUploadResult> {
  const client = getLensGroveStorageClient();
  const fileObj =
    file instanceof File
      ? file
      : new File([file], fileName, {
          type: file.type || "image/png",
        });

  try {
    const response = await raceWithAbortSignal(
      client.uploadFile(fileObj),
      signal,
    );
    const gatewayUrl = response.gatewayUrl || client.resolve(response.uri);

    return {
      uri: response.uri,
      gatewayUrl,
      storageKey: response.storageKey,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }

    // If the storage propagation timed out, the file was already uploaded and has a key
    const msg = err instanceof Error ? err.message : String(err);
    const timeoutMatch =
      /resource\s+([a-zA-Z0-9_\-:]+)\s+to reach status/i.exec(msg);
    if (timeoutMatch && timeoutMatch[1]) {
      const storageKey = timeoutMatch[1].replace(/^lens:\/\//, "");
      const gatewayUrl = `https://api.grove.storage/${storageKey}`;
      return {
        uri: `lens://${storageKey}`,
        gatewayUrl,
        storageKey,
      };
    }

    // Direct upload fallback (signal can cancel this fetch)
    try {
      const directRes = await fetch("https://api.grove.storage?chain_id=232", {
        method: "POST",
        headers: {
          "Content-Type": fileObj.type || "image/png",
          "Content-Length": fileObj.size.toString(),
        },
        body: fileObj,
        signal,
      });
      if (directRes.ok) {
        const list = (await directRes.json()) as Array<{
          storage_key?: string;
          uri?: string;
        }>;
        if (list && list[0]?.storage_key) {
          const storageKey = list[0].storage_key;
          return {
            uri: list[0].uri || `lens://${storageKey}`,
            gatewayUrl: `https://api.grove.storage/${storageKey}`,
            storageKey,
          };
        }
      }
    } catch (fallbackErr) {
      if (
        fallbackErr instanceof DOMException &&
        fallbackErr.name === "AbortError"
      ) {
        throw fallbackErr;
      }
      if (fallbackErr instanceof Error && fallbackErr.name === "AbortError") {
        throw fallbackErr;
      }
      // Fall through to re-throwing original error
    }

    throw err;
  }
}
