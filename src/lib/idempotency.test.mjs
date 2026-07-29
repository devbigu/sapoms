import test from "node:test";
import assert from "node:assert/strict";
import { createIdempotencyKey } from "./idempotency.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function withCrypto(mockCrypto, run) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value: mockCrypto,
  });

  try {
    run();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    } else {
      delete globalThis.crypto;
    }
  }
}

test("uses native randomUUID when the browser provides it", () => {
  withCrypto({ randomUUID: () => "native-id" }, () => {
    assert.equal(createIdempotencyKey("order"), "native-id");
  });
});

test("falls back to getRandomValues when randomUUID is unavailable", () => {
  withCrypto({
    getRandomValues(bytes) {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
      return bytes;
    },
  }, () => {
    assert.match(createIdempotencyKey("order"), uuidV4Pattern);
  });
});

test("returns a prefixed key when Web Crypto is unavailable", () => {
  withCrypto(undefined, () => {
    assert.match(createIdempotencyKey("dealer-order"), /^dealer-order:[0-9a-z]+:[0-9a-z]+$/);
  });
});
