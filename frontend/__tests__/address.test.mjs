import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWalletAddress, validateAuthorChange } from "../lib/address.js";

const owner = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
const stewardSample = "0x1509759377876c435914b5394fa83E7391dEfbAc";

test("normalizes the mixed-case steward sample", () => {
  assert.equal(normalizeWalletAddress(stewardSample), stewardSample.toLowerCase());
});

test("rejects malformed and zero addresses", () => {
  for (const value of ["", "0x1234", "1509759377876c435914b5394fa83E7391dEfbAc", `0x${"g".repeat(40)}`, `0x${"0".repeat(40)}`]) {
    assert.throws(() => normalizeWalletAddress(value));
  }
});

test("rejects duplicate, owner, missing removal, and ninth author", () => {
  assert.throws(() => validateAuthorChange({ value: owner, owner, authors: [], allowed: true }), /owner/i);
  assert.throws(() => validateAuthorChange({ value: stewardSample.toUpperCase().replace("0X", "0x"), owner, authors: [stewardSample], allowed: true }), /already/i);
  assert.throws(() => validateAuthorChange({ value: stewardSample, owner, authors: [], allowed: false }), /not an authorized/i);
  const full = Array.from({ length: 8 }, (_, index) => `0x${String(index + 1).padStart(40, "0")}`);
  assert.throws(() => validateAuthorChange({ value: stewardSample, owner, authors: full, allowed: true }), /maximum/i);
});

test("returns the canonical address for add and remove", () => {
  assert.equal(validateAuthorChange({ value: stewardSample, owner, authors: [], allowed: true }), stewardSample.toLowerCase());
  assert.equal(validateAuthorChange({ value: stewardSample.toLowerCase(), owner, authors: [stewardSample], allowed: false }), stewardSample.toLowerCase());
});
