import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { offsetFor, paginateRows, pageInfo, pagerSchema } from "./pagination.js";

const rows = Array.from({ length: 23 }, (_, index) => index + 1);

describe("Paginación compartida", () => {
  it("respeta tamaños 5, 10 y 20", () => {
    assert.deepEqual(paginateRows(rows, { limit: 5 }).rows, [1, 2, 3, 4, 5]);
    assert.deepEqual(paginateRows(rows, { limit: 10 }).rows, rows.slice(0, 10));
    assert.deepEqual(paginateRows(rows, { limit: 20 }).rows, rows.slice(0, 20));
  });

  it("calcula página actual, total de páginas y total de resultados", () => {
    assert.deepEqual(pageInfo({ page: 3, limit: 5 }, rows.length), { page: 3, limit: 5, total: 23, totalPages: 5 });
    assert.deepEqual(pageInfo({ page: 99, limit: 10 }, rows.length), { page: 3, limit: 10, total: 23, totalPages: 3 });
  });

  it("cambia de página sin perder el resto de los registros", () => {
    const second = paginateRows(rows, { page: 2, limit: 10 });
    assert.deepEqual(second.rows, rows.slice(10, 20));
    assert.equal(second.meta?.total, 23);
  });

  it("acepta page y limit como query strings de Express (regresión GET /api/teachers)", () => {
    for (const limit of [5, 10, 20]) {
      const pager = pagerSchema.parse({ page: "2", limit: String(limit) });
      assert.equal(pager.page, 2);
      assert.equal(pager.limit, limit);
      assert.equal(offsetFor(pager), limit);
      assert.deepEqual(pageInfo(pager, 31), { page: 2, limit, total: 31, totalPages: Math.ceil(31 / limit) });
    }
  });

  it("tolera búsqueda vacía y parámetros opcionales ausentes", () => {
    const pager = pagerSchema.parse({ search: "", page: "", limit: undefined });
    assert.equal(pager.page, undefined);
    assert.equal(pager.limit, undefined);
    assert.equal(pagerSchema.safeParse({ limit: "7" }).success, false);
  });
});
