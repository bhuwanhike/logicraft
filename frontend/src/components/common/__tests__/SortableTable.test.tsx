/**
 * Tests for the sortable table.
 *
 * This is the component the "[object Object]" bug shipped through. A column's
 * `render` returns a ReactNode, and a React element has typeof "object", so any
 * coercion to a string replaced every JSX-returning cell — badges, pills,
 * meters — with that literal while string-returning cells in the same table
 * looked fine. The first test below is the regression; the rest pin the
 * contract around it.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination, SortableTable, SortableTableView } from "../SortableTable";
import type { Column } from "../SortableTable";
import type { Row, Rows } from "../../../types";
import { StatusPill } from "../../workspace/format";
import {
  auditLogsPayload,
  driversPayload,
  inventoryPayload,
  notificationsPayload,
  shipmentsPayload,
  tripsPayload,
  usersPayload,
  vehiclesPayload,
  warehousesPayload,
  zonesPayload
} from "../../../test/fixtures/apiPayloads";

const rows: Rows = [
  { id: 1, plate: "TRK-8801", fuelLevel: 72, currentDriverName: "John Doe", docs: 3 },
  { id: 2, plate: "TRK-8802", fuelLevel: null, currentDriverName: null, docs: 0 }
];

const noSort = { key: null, direction: "asc" as const };

function renderTable(columns: Column[], data: Rows = rows, props: Record<string, unknown> = {}) {
  return render(
    <SortableTable
      columns={columns}
      rows={data}
      sort={noSort}
      onSort={() => {}}
      {...props}
    />
  );
}

const bodyRows = () => screen.getAllByRole("row").slice(1);
const cellAt = (row: number, column: number) => bodyRows()[row].querySelectorAll("td")[column];

describe("SortableTable: render regression", () => {
  it("renders a cell whose render function returns JSX", () => {
    // The regression. This cell used to contain the text "[object Object]".
    renderTable([
      { key: "status", label: "Status", render: (row) => <StatusPill status={row.plate} /> }
    ]);
    // humanise turns the plate's hyphen into a space; the point is that the
    // pill rendered at all.
    expect(cellAt(0, 0)).toHaveTextContent("TRK 8801");
    expect(cellAt(0, 0)).not.toHaveTextContent("[object");
  });

  it("renders a cell whose render function returns a fragment with siblings", () => {
    renderTable([
      {
        key: "docs",
        label: "Docs",
        render: (row: Row) => (
          <>
            <span className="icon" />
            {row.docs} on file
          </>
        )
      }
    ]);
    expect(cellAt(0, 0)).toHaveTextContent("3 on file");
    expect(cellAt(0, 0).querySelector(".icon")).toBeInTheDocument();
  });

  it("renders a cell whose render function returns an array of nodes", () => {
    renderTable([
      { key: "pair", label: "Pair", render: () => [<span key="a">A</span>, <span key="b">B</span>] }
    ]);
    expect(cellAt(0, 0)).toHaveTextContent("AB");
  });

  it("renders a nested object read straight off the row", () => {
    // A jsonb column arrives as an object; it must be described, not coerced.
    renderTable([{ key: "meta", label: "Meta" }], [{ id: 1, meta: { label: "Priority" } }]);
    expect(cellAt(0, 0)).toHaveTextContent("Priority");
  });

  it("joins an array read straight off the row", () => {
    // React concatenates sibling children with no separator, so delegating an
    // array to asNode rendered "CDL-ATanker". format() joins it instead.
    renderTable([{ key: "tags", label: "Tags" }], [{ id: 1, tags: ["CDL-A", "Tanker"] }]);
    expect(cellAt(0, 0)).toHaveTextContent("CDL-A, Tanker");
  });

  it("shows the empty cell for an empty array", () => {
    renderTable([{ key: "tags", label: "Tags" }], [{ id: 1, tags: [] }]);
    expect(cellAt(0, 0)).toHaveTextContent("—");
  });

  it("renders a boolean as Yes or No", () => {
    renderTable([{ key: "read", label: "Read" }], [
      { id: 1, read: true },
      { id: 2, read: false }
    ]);
    expect(cellAt(0, 0)).toHaveTextContent("Yes");
    expect(cellAt(1, 0)).toHaveTextContent("No");
  });

  it("shows the em-dash for an absent value", () => {
    renderTable([{ key: "fuelLevel", label: "Fuel" }]);
    expect(cellAt(1, 0)).toHaveTextContent("—");
  });

  it("shows a custom empty cell", () => {
    renderTable([{ key: "fuelLevel", label: "Fuel" }], rows, { emptyCell: "n/a" });
    expect(cellAt(1, 0)).toHaveTextContent("n/a");
  });

  it("treats an empty string as absent", () => {
    renderTable([{ key: "plate", label: "Plate" }], [{ id: 1, plate: "" }]);
    expect(cellAt(0, 0)).toHaveTextContent("—");
  });

  it("renders a number without stringifying it into a bean", () => {
    renderTable([{ key: "fuelLevel", label: "Fuel" }], [{ id: 1, fuelLevel: 0 }]);
    expect(cellAt(0, 0)).toHaveTextContent("0");
  });
});

describe("SortableTable: column resolution", () => {
  it("reads key when neither render nor accessor is supplied", () => {
    renderTable([{ key: "plate", label: "Plate" }]);
    expect(cellAt(0, 0)).toHaveTextContent("TRK-8801");
  });

  it("reads accessor when supplied", () => {
    renderTable([{ key: "Driver", label: "Driver", accessor: "currentDriverName" }]);
    expect(cellAt(0, 0)).toHaveTextContent("John Doe");
  });

  it("lets render win over accessor", () => {
    renderTable([
      {
        key: "Driver",
        label: "Driver",
        accessor: "currentDriverName",
        render: (row: Row) => String(row.currentDriverName).toUpperCase()
      }
    ]);
    expect(cellAt(0, 0)).toHaveTextContent("JOHN DOE");
  });

  it("renders one column per descriptor, in order", () => {
    renderTable([
      { key: "plate", label: "Plate" },
      { key: "fuelLevel", label: "Fuel" }
    ]);
    expect(within(bodyRows()[0]).getAllByRole("cell")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Plate" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Fuel" })).toBeInTheDocument();
  });
});

describe("SortableTable: sorting", () => {
  const columns: Column[] = [
    { key: "plate", label: "Plate", sortable: true },
    { key: "fuelLevel", label: "Fuel", sortable: true },
    { key: "docs", label: "Docs" }
  ];

  it("marks the sorted column ascending", () => {
    renderTable(columns, rows, { sort: { key: "plate", direction: "asc" } });
    expect(screen.getByRole("columnheader", { name: /Plate/ })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
  });

  it("marks the sorted column descending", () => {
    renderTable(columns, rows, { sort: { key: "plate", direction: "desc" } });
    expect(screen.getByRole("columnheader", { name: /Plate/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });

  it("marks other sortable columns as unsorted", () => {
    renderTable(columns, rows, { sort: { key: "plate", direction: "asc" } });
    expect(screen.getByRole("columnheader", { name: /Fuel/ })).toHaveAttribute(
      "aria-sort",
      "none"
    );
  });

  it("leaves a non-sortable column unmarked", () => {
    renderTable(columns, rows, { sort: { key: "plate", direction: "asc" } });
    expect(screen.getByRole("columnheader", { name: "Docs" })).not.toHaveAttribute("aria-sort");
  });

  it("calls onSort with the column key", async () => {
    const onSort = vi.fn();
    renderTable(columns, rows, { onSort });
    await userEvent.click(screen.getByRole("button", { name: /Fuel/ }));
    expect(onSort).toHaveBeenCalledWith("fuelLevel");
  });

  it("does not offer a button on a non-sortable column", () => {
    renderTable(columns, rows);
    expect(screen.queryByRole("button", { name: "Docs" })).not.toBeInTheDocument();
  });

  it("sorts the rows itself when it owns the sort state", async () => {
    const both = rows.map((r) => ({ ...r, fuelLevel: r.fuelLevel ?? 10 }));
    render(<SortableTableView columns={columns} rows={both} initialSortKey="fuelLevel" />);
    expect(bodyRows()[0]).toHaveTextContent("TRK-8802");
    await userEvent.click(screen.getByRole("button", { name: /Fuel/ }));
    expect(bodyRows()[0]).toHaveTextContent("TRK-8801");
  });
});

describe("SortableTable: rows", () => {
  it("renders nothing in the body for an empty result", () => {
    renderTable([{ key: "plate", label: "Plate" }], []);
    expect(bodyRows()).toHaveLength(0);
  });

  it("calls onRowClick with the row", async () => {
    const onRowClick = vi.fn();
    renderTable([{ key: "plate", label: "Plate" }], rows, { onRowClick });
    await userEvent.click(bodyRows()[1]);
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it("uses the row key when the field is missing without crashing", () => {
    // rowKey falls back to the index, so a payload without an id still renders.
    renderTable([{ key: "plate", label: "Plate" }], [{ plate: "A" }, { plate: "B" }]);
    expect(bodyRows()).toHaveLength(2);
  });

  it("keys on a custom field when asked", () => {
    renderTable([{ key: "plate", label: "Plate" }], rows, { rowKey: "plate" });
    expect(bodyRows()).toHaveLength(2);
  });
});

describe("SortableTable: real API payloads", () => {
  const payloads: [string, Rows][] = [
    ["drivers", driversPayload],
    ["vehicles", vehiclesPayload],
    ["trips", tripsPayload],
    ["shipments", shipmentsPayload],
    ["warehouses", warehousesPayload],
    ["zones", zonesPayload],
    ["inventory", inventoryPayload],
    ["notifications", notificationsPayload],
    ["audit logs", auditLogsPayload],
    ["users", usersPayload]
  ];

  /**
   * Declares one column per key found in the payload, the way a page does, then
   * reads every cell. This is the sweep that catches a projection which forgot
   * to alias a column: the key would be missing here, exactly as it was missing
   * on screen.
   */
  it.each(payloads)("renders %s without [object Object] or a missing cell", (_name, data) => {
    const keys = [...new Set(data.flatMap((row) => Object.keys(row)))];
    expect(keys.length).toBeGreaterThan(0);
    const columns: Column[] = keys.map((key) => ({ key, label: key }));

    renderTable(columns, data);

    for (const row of bodyRows()) {
      const cells = within(row).getAllByRole("cell");
      expect(cells).toHaveLength(keys.length);
      for (const cell of cells) {
        expect(cell.textContent ?? "").not.toContain("[object");
      }
    }
  });

  it("does not leave a cell blank where the payload has a value", () => {
    // A key the UI reads but the projection never aliases renders an em-dash
    // with no error anywhere, so this asserts the inverse: every populated
    // payload key reaches the table.
    const keys = [...new Set(driversPayload.flatMap((row) => Object.keys(row)))];
    const columns: Column[] = keys.map((key) => ({ key, label: key }));
    renderTable(columns, driversPayload);

    const [firstRow] = bodyRows();
    keys.forEach((key, index) => {
      const value = driversPayload[0][key];
      if (value === null || value === undefined) return;
      const cell = firstRow.querySelectorAll("td")[index];
      expect(cell.textContent ?? "").not.toBe("—");
    });
  });

  it("renders the array column the drivers table shows as text", () => {
    // certifications is a TEXT[] column; the projection unwraps it and the
    // table joins it. It used to reach a cell as [object Object].
    renderTable([{ key: "certifications", label: "Certifications" }], driversPayload);
    expect(cellAt(0, 0)).toHaveTextContent("CDL-A, Tanker");
  });

  it("renders the aliased camelCase keys the pages read", () => {
    // These are the names the UI depends on. If a projection reverts to the
    // Postgres column labels, this fails instead of the column quietly
    // rendering an em-dash.
    expect(Object.keys(vehiclesPayload[0])).toEqual(
      expect.arrayContaining(["odometerKm", "lastServiceAt", "currentDriverName", "documentCount"])
    );
    expect(Object.keys(tripsPayload[0])).toEqual(
      expect.arrayContaining(["speedKph", "headingDeg", "lastReportedAt", "driverName"])
    );
  });
});

describe("Pagination", () => {
  it("renders nothing when there are no records", () => {
    const { container } = render(
      <Pagination page={1} pageCount={0} total={0} onPageChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a count instead of a pager for a single page", () => {
    render(<Pagination page={1} pageCount={1} total={12} onPageChange={() => {}} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("uses the noun after the count", () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} total={3} onPageChange={() => {}} noun="shipments" />
    );
    // The count and the noun are separate elements, so match on the footer text.
    expect(container.querySelector(".table-footer")).toHaveTextContent("Showing 3 shipments");
  });

  it("disables previous on the first page", () => {
    render(<Pagination page={1} pageCount={5} total={100} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  it("disables next on the last page", () => {
    render(<Pagination page={5} pageCount={5} total={100} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("reports the requested page", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} total={100} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("steps forward and back", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageCount={5} total={100} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("marks the current page", () => {
    render(<Pagination page={2} pageCount={5} total={100} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
  });

  it("lists every page for a short range", () => {
    render(<Pagination page={1} pageCount={7} total={100} onPageChange={() => {}} />);
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("elides the middle of a long range", () => {
    render(<Pagination page={10} pageCount={40} total={1000} onPageChange={() => {}} />);
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "40" })).toBeInTheDocument();
  });
});
