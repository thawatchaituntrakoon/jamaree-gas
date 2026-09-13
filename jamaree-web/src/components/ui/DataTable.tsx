import type { ReactNode } from "react";

export interface Column<T> {
  /** หัวตาราง */
  header: string;
  /** เนื้อในช่อง */
  cell: (row: T) => ReactNode;
  /** ชิดขวา — ใช้กับตัวเลขเสมอ */
  align?: "right";
  /** ซ่อนบนจอเล็ก */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** ข้อความตอนยังไม่มีข้อมูล */
  empty: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
}: DataTableProps<T>) {
  if (!rows.length) {
    return <p className="px-4 py-10 text-center text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {columns.map((col, i) => (
              <th
                key={i}
                className={[
                  "px-4 py-2.5 font-medium whitespace-nowrap",
                  col.align === "right" ? "text-right" : "",
                  col.hideOnMobile ? "hidden md:table-cell" : "",
                ].join(" ")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                "border-b border-line last:border-0",
                onRowClick ? "cursor-pointer hover:bg-paper" : "",
              ].join(" ")}
            >
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={[
                    "px-4 py-3 align-middle",
                    col.align === "right"
                      ? "text-right tabular-nums whitespace-nowrap"
                      : "",
                    col.hideOnMobile ? "hidden md:table-cell" : "",
                    col.className ?? "",
                  ].join(" ")}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
