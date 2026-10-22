import { test, describe } from "node:test";
import assert from "node:assert/strict";

function normalizeTitle(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}

describe("seed-books title normalization", () => {
  test("strips leading 'the' and punctuation correctly", () => {
    assert.equal(normalizeTitle("The Hobbit"), "hobbit");
    assert.equal(normalizeTitle("The Fellowship of the Ring"), "fellowship of the ring");
    assert.equal(normalizeTitle("Harry Potter and the Sorcerer's Stone"), "harry potter and the sorcerers stone");
    assert.equal(normalizeTitle("The Hitchhiker's Guide to the Galaxy"), "hitchhikers guide to the galaxy");
    assert.equal(normalizeTitle("1984"), "1984");
    assert.equal(normalizeTitle("Dune"), "dune");
    assert.equal(normalizeTitle("The Martian"), "martian");
    assert.equal(normalizeTitle("Where the Crawdads Sing"), "where the crawdads sing");
  });

  test("candidate title starts with wanted normalized title", () => {
    const wanted = normalizeTitle("The Fellowship of the Ring");
    const candidate = normalizeTitle("The Fellowship of the Ring: Being the First Part of The Lord of the Rings");
    assert.equal(candidate.startsWith(wanted), true);

    const duneWanted = normalizeTitle("Dune");
    const duneCandidate = normalizeTitle("Dune (Deluxe Edition)");
    assert.equal(duneCandidate.startsWith(duneWanted), true);
  });
});
