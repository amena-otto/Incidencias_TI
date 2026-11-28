import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Pagination } from "./ui";
import { SelectCheckbox, SelectionToolbar, useLocalPager } from "./table";

const ITEMS = Array.from({ length: 23 }, (_, index) => `Item ${index}`);

function LocalTable() {
  const [filter, setFilter] = useState("");
  const filtered = ITEMS.filter((item) => item.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const pager = useLocalPager(filtered);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(item));
  const someSelected = filtered.some((item) => selected.has(item));

  return (
    <>
      <input aria-label="Filtro" value={filter} onChange={(event) => { setFilter(event.target.value); pager.reset(); }} />
      <table>
        <thead><tr><th>
          <SelectCheckbox checked={allSelected} indeterminate={someSelected && !allSelected}
            onChange={(checked) => setSelected(checked ? new Set(filtered) : new Set())}
            label="Seleccionar filtrados" />
        </th><th>Registro</th></tr></thead>
        <tbody>
          {pager.visible.map((item) => (
            <tr key={item}><td>
              <input type="checkbox" aria-label={`Elegir ${item}`} checked={selected.has(item)}
                onChange={(event) => toggle(item, event.target.checked)} />
            </td><td>{item}</td></tr>
          ))}
        </tbody>
      </table>
      <SelectionToolbar selectedCount={selected.size} filteredCount={filtered.length}
        pageCount={pager.visible.length}
        onSelectPage={() => setSelected(new Set([...selected, ...pager.visible]))}
        onSelectFiltered={() => setSelected(new Set(filtered))}
        onClear={() => setSelected(new Set())} />
      <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total}
        limit={pager.limit} onLimitChange={pager.setLimit} onChange={pager.setPage} />
    </>
  );
}

describe("Componentes reutilizables de tabla", () => {
  it("usa 10 registros por página por defectro y muestra totales", () => {
    render(<LocalTable />);
    expect(screen.getAllByRole("checkbox", { name: /Elegir Item/ })).toHaveLength(10);
    expect(screen.getByText(/23 registro\(s\) · página 1 de 3/)).toBeTruthy();
  });

  it("permite 5, 10 y 20 registros por página", () => {
    render(<LocalTable />);
    const selector = screen.getByRole("combobox", { name: "Registros por página" });
    fireEvent.change(selector, { target: { value: "5" } });
    expect(screen.getAllByRole("checkbox", { name: /Elegir Item/ })).toHaveLength(5);
    expect(screen.getByText(/página 1 de 5/)).toBeTruthy();
    fireEvent.change(selector, { target: { value: "20" } });
    expect(screen.getAllByRole("checkbox", { name: /Elegir Item/ })).toHaveLength(20);
    expect(screen.getByText(/página 1 de 2/)).toBeTruthy();
    fireEvent.change(selector, { target: { value: "10" } });
    expect(screen.getAllByRole("checkbox", { name: /Elegir Item/ })).toHaveLength(10);
  });

  it("navega entre páginas y conserva la selección", () => {
    render(<LocalTable />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Elegir Item 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.queryByRole("checkbox", { name: "Elegir Item 0" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Elegir Item 10" })).toBeTruthy();
    expect(document.querySelector(".selection-count")?.textContent).toMatch(/1 seleccionado\(s\) de 23/);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect((screen.getByRole("checkbox", { name: "Elegir Item 0" }) as HTMLInputElement).checked).toBe(true);
  });

  it("selecciona todos los filtrados y vuelve a la primera página al filtrar", () => {
    render(<LocalTable />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText(/página 2 de 3/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Filtro" }), { target: { value: "item 1" } });
    expect(screen.getByText(/página 1 de 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar todos los filtrados" }));
    expect(document.querySelector(".selection-count")?.textContent).toMatch(/11 seleccionado\(s\) de 11/);
    const header = screen.getByRole("checkbox", { name: "Seleccionar filtrados" }) as HTMLInputElement;
    expect(header.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Deseleccionar todos" }));
    expect(header.checked).toBe(false);
  });

  it("refleja el estado indeterminado del encabezado", () => {
    render(<LocalTable />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Elegir Item 0" }));
    const header = screen.getByRole("checkbox", { name: "Seleccionar filtrados" }) as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
  });
});
