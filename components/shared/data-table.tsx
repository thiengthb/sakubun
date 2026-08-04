'use client';

// Copied from ui-kit registry `thiengthb/data-table` (shadcn add data-table). Generic TanStack-backed
// CRUD table — the app supplies columns + filters. Keep in sync with the registry if edited.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  GripVertical,
  Info,
  SearchX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/shared/explain';
import { EmptyState } from '@/components/shared/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/shared/search-input';
import { useFitRows } from '@/components/ui/use-fit-rows';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataPagination } from '@/components/ui/data-pagination';
import { cn } from '@/lib/utils';

/**
 * Per-column extras read by the DataTable. Attach via a column's `meta`.
 *   label        — name shown in the "Cột" (show/hide) menu (falls back to a string header)
 *   defaultHidden— column starts hidden until toggled on (e.g. secondary analysis fields)
 *   noReorder    — column can't be dragged and pins to its edge (e.g. a trailing actions column)
 *   headClassName/cellClassName — extra classes for that column's header / cells
 */
export interface DataTableColumnMeta {
  label?: string;
  defaultHidden?: boolean;
  noReorder?: boolean;
  headClassName?: string;
  cellClassName?: string;
}

// ---------------------------------------------------------------------------
// Self-contained persistence: sessionStorage (survives nav + reload in-tab) with an OPTIONAL mirror to
// the URL via history.replaceState (shareable link, no server refetch). Same idea as `use-session-state`
// but inlined so the DataTable is a single drop-in file. Built on useSyncExternalStore → SSR-safe.
// ---------------------------------------------------------------------------
const cache = new Map<string, { raw: string | null; value: unknown }>();
const listeners = new Map<string, Set<() => void>>();

function readPersisted<T>(storeKey: string, initial: T, urlKey?: string): T {
  if (typeof window === 'undefined') return initial;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(storeKey);
  } catch {
    return initial;
  }
  const hit = cache.get(storeKey);
  if (hit && hit.raw === raw) return hit.value as T;
  let value = initial;
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  } else if (urlKey) {
    const p = new URLSearchParams(window.location.search).get(urlKey);
    if (p != null) {
      try {
        value = JSON.parse(p) as T;
      } catch {
        value = initial;
      }
    }
  }
  cache.set(storeKey, { raw, value });
  return value;
}

function writeUrl<T>(urlKey: string, value: T, initial: T): void {
  const url = new URL(window.location.href);
  const str = JSON.stringify(value);
  if (str === JSON.stringify(initial)) url.searchParams.delete(urlKey);
  else url.searchParams.set(urlKey, str);
  window.history.replaceState(null, '', url);
}

function usePersisted<T>(
  storeKey: string,
  initial: T,
  urlKey?: string,
): [T, Dispatch<SetStateAction<T>>] {
  const value = useSyncExternalStore(
    useCallback(
      (cb: () => void) => {
        let set = listeners.get(storeKey);
        if (!set) {
          set = new Set();
          listeners.set(storeKey, set);
        }
        set.add(cb);
        const onStorage = (e: StorageEvent) => {
          if (e.key === storeKey) cb();
        };
        window.addEventListener('storage', onStorage);
        return () => {
          set?.delete(cb);
          window.removeEventListener('storage', onStorage);
        };
      },
      [storeKey],
    ),
    () => readPersisted(storeKey, initial, urlKey),
    () => initial,
  );

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const prev = readPersisted(storeKey, initial, urlKey);
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      const raw = JSON.stringify(next);
      try {
        window.sessionStorage.setItem(storeKey, raw);
      } catch {
        // best-effort; still update the in-memory cache below so the UI reflects the change
      }
      cache.set(storeKey, { raw, value: next });
      if (urlKey) writeUrl(urlKey, next, initial);
      listeners.get(storeKey)?.forEach((cb) => cb());
    },
    [storeKey, initial, urlKey],
  );

  return [value, setValue];
}

// Stable default references (useSyncExternalStore needs a stable server snapshot).
const EMPTY_SORTING: SortingState = [];
const EMPTY_SIZING: ColumnSizingState = {};

function colId(c: ColumnDef<unknown, unknown>): string {
  return (c.id ?? (c as { accessorKey?: string }).accessorKey ?? '') as string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Stable row id (e.g. `(row) => row.id`) — keeps selection/state correct across re-sorts. */
  getRowId?: (row: T) => string;
  /**
   * sessionStorage namespace (e.g. "items"). REQUIRED so two tables never collide. Also used as the
   * URL-param prefix unless `urlPrefix` is given.
   */
  persistKey: string;
  /** URL-param prefix (default = persistKey + "."). Use distinct prefixes for two tables on one page. */
  urlPrefix?: string;
  /** Show a global search box with this placeholder (searches every column's value). Omit = no search. */
  searchPlaceholder?: string;
  /** App-specific filter controls (e.g. a FilterPopover) — rendered at the toolbar's left. */
  filterSlot?: ReactNode;
  /** App-specific actions (e.g. an import/create button) — rendered at the toolbar's right. */
  actionSlot?: ReactNode;
  emptyMessage?: string;
  /** Icon for the empty body. Defaults to `SearchX` (the table's empty is virtually always a filtered
   *  result — a truly-empty store is handled a level up by the page). `null` = no icon. */
  emptyIcon?: LucideIcon | null;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  /** Estimated px per row — feeds the "fit the viewport" auto page size. */
  estimatedRowHeight?: number;
  /** Per-row class (e.g. dim suspended rows). */
  rowClassName?: (row: T) => string | undefined;
  /** Total rows BEFORE any app-level pre-filtering — shows "(lọc từ N)" when it differs. */
  totalCount?: number;
  /** Noun for the count line ("mẫu", "từ", "dòng"). */
  countNoun?: string;
  /** Multi-column sort (shift-click adds a column). Default true. */
  enableMultiSort?: boolean;
  /** Draggable column widths. Default true. */
  enableResizing?: boolean;
  /** Drag-to-reorder columns (a grip handle appears on each header). Default true. */
  enableReordering?: boolean;
  /** Add a leading checkbox column for multi-row selection (needs a stable `getRowId`). Selection is
   * ephemeral (never persisted) and keyed by row id so it survives sort/filter/paginate. Default false. */
  enableRowSelection?: boolean;
  /** Add a leading ordinal ("STT") column numbering rows by their position in the current view. Default false. */
  enableRowNumbers?: boolean;
  /** Header text for the ordinal column. Default "STT". */
  rowNumberHeader?: string;
  /** Rendered in the floating right-edge selection DOCK while ≥1 row is selected — the app supplies the
   * actions, each as an icon-only `BulkActionButton` (its name shows in a hover tooltip). Receives the
   * selected originals + a `clearSelection` callback. */
  bulkActions?: (selectedRows: T[], clearSelection: () => void) => ReactNode;
  /**
   * MOBILE CARD RENDERER. When supplied, everything below `md` renders as a stacked list of cards
   * instead of the table; `md`+ keeps the table. A data table is the wrong shape on a 360px screen —
   * it becomes a horizontally-scrolling grid where the row you are reading slides out from under the
   * column that identifies it.
   *
   * The cards consume the SAME `rows` the table does — already searched, filtered, sorted and PAGED —
   * so search, filters, pagination and bulk selection keep working with one implementation. The caller
   * only decides what one item looks like; `index` is the 1-based position within the whole filtered
   * set (not the page), matching the table's row numbers.
   *
   * Omit it and the table renders at every width (the fallback for views not yet carded).
   */
  renderCard?: (row: T, index: number) => ReactNode;
}

/**
 * A batteries-included, headless-backed (TanStack Table) data table for CRUD screens. One config-driven
 * component covering: multi-column sort (shift-click to add, with priority badges), draggable column
 * widths, drag-to-reorder columns, show/hide columns, global search, an app filter slot, an optional
 * leading ordinal ("STT") column + multi-row selection with an app-supplied bulk-action bar, and
 * pagination — with the whole view (sort / visible columns / order / widths / page / size / search)
 * persisted to
 * sessionStorage AND mirrored to the URL (shareable + survives reload). The app owns the COLUMNS
 * (accessor + `cell` renderers → any custom cell: edit/delete actions, badges, links) and the domain
 * FILTERS (via `filterSlot`, pre-filtering `data`).
 *
 * Layout: real columns keep EXACT pixel widths (so resize is precise + persists); a trailing auto-width
 * spacer absorbs the slack so the table fills its container without stretching the columns, and it
 * scrolls horizontally once the columns exceed the width. Cell content truncates to one line.
 *
 * NOTE — needs the shadcn primitives it imports (table, button, dropdown-menu, input) + `data-pagination`,
 * and `@tanstack/react-table`. A leading string `header` is used as the column's show/hide label unless
 * `meta.label` is set.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  persistKey,
  urlPrefix,
  searchPlaceholder,
  filterSlot,
  actionSlot,
  emptyMessage = 'Không có dữ liệu.',
  emptyIcon = SearchX,
  pageSizeOptions = [25, 50, 100],
  initialPageSize = 50,
  estimatedRowHeight = 45,
  rowClassName,
  totalCount,
  countNoun = 'dòng',
  enableMultiSort = true,
  enableResizing = true,
  enableReordering = true,
  enableRowSelection = false,
  enableRowNumbers = false,
  rowNumberHeader = 'STT',
  bulkActions,
  renderCard,
}: DataTableProps<T>) {
  'use no memo'; // TanStack's useReactTable returns fresh functions each render — opt out of React Compiler memoization (official guidance); the table does its own memoization internally.
  const up = urlPrefix ?? `${persistKey}.`;

  // Columns flagged `meta.defaultHidden` start hidden (stable object → safe as the persistence default).
  const defaultVisibility = useMemo<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const c of columns) {
      const id = colId(c as ColumnDef<unknown, unknown>);
      if (id && (c.meta as DataTableColumnMeta | undefined)?.defaultHidden) v[id] = false;
    }
    return v;
  }, [columns]);
  const defaultOrder = useMemo<ColumnOrderState>(
    () => columns.map((c) => colId(c as ColumnDef<unknown, unknown>)),
    [columns],
  );

  const [sorting, setSorting] = usePersisted<SortingState>(
    `${persistKey}.sort`,
    EMPTY_SORTING,
    `${up}sort`,
  );
  const [visibility, setVisibility] = usePersisted<VisibilityState>(
    `${persistKey}.cols`,
    defaultVisibility,
    `${up}cols`,
  );
  // Column order + widths are personal LAYOUT prefs → sessionStorage only (survives F5 in-tab), NOT
  // mirrored to the URL (verbose + not really "navigation"). Sort/filter/search/page/size DO (shareable).
  const [order, setOrder] = usePersisted<ColumnOrderState>(`${persistKey}.order`, defaultOrder);
  const [sizing, setSizing] = usePersisted<ColumnSizingState>(`${persistKey}.w`, EMPTY_SIZING);
  const [globalFilter, setGlobalFilter] = usePersisted<string>(
    `${persistKey}.q`,
    '',
    searchPlaceholder ? `${up}q` : undefined,
  );
  const [pageIndex, setPageIndex] = usePersisted<number>(`${persistKey}.page`, 0, `${up}page`);
  const [pageSize, setPageSize] = usePersisted<number>(
    `${persistKey}.size`,
    initialPageSize,
    `${up}size`,
  );
  // Auto page size: fill the viewport (no page scroll) until the user picks a fixed size, then respect
  // their choice. `autoFit` persists so the "fill the screen" default survives reloads.
  const [autoFit, setAutoFit] = usePersisted<boolean>(`${persistKey}.autofit`, true);
  // Measure the ROWS region (tbody top + a real row's height) and RESERVE the actual footer height, so
  // the last row + the pagination bar always sit within the viewport — no page scroll, no off-screen
  // controls. `estimatedRowHeight` is only the pre-measurement fallback.
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const fitRows = useFitRows({ topRef: bodyRef, footerRef, rowHeight: estimatedRowHeight });
  const effectivePageSize = autoFit && fitRows != null ? fitRows : pageSize;
  // Make sure the size selector can show the auto-fit value (it isn't one of the fixed options).
  const sizeOptions = useMemo(
    () =>
      pageSizeOptions.includes(effectivePageSize)
        ? pageSizeOptions
        : [...pageSizeOptions, effectivePageSize].sort((a, b) => a - b),
    [pageSizeOptions, effectivePageSize],
  );
  const choosePageSize = useCallback(
    (s: number) => {
      setAutoFit(false);
      setPageSize(s);
      setPageIndex(0);
    },
    [setAutoFit, setPageSize, setPageIndex],
  );
  // STT (ordinal) column visibility — toggled from the "Cột" menu like any real column, but the ordinal
  // isn't a TanStack column (it's rendered outside the column model), so its show/hide lives here.
  // sessionStorage-only (a personal layout pref, not shareable state), same as column order/widths.
  const [showRowNumbers, setShowRowNumbers] = usePersisted<boolean>(`${persistKey}.rownum`, true);

  // Row selection is EPHEMERAL (not persisted) — a shared link shouldn't carry a stale selection.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const clearSelection = useCallback(() => setRowSelection({}), []);

  // Keyboard shortcuts (see SHORTCUT_HINT below): the root node tells us whether THIS table is the
  // visible one (a tabbed page keeps the inactive table mounted but display:none), the search ref is
  // what "/" focuses, and the column menu is controlled so "c" can open it.
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex, pageSize: effectivePageSize }),
    [pageIndex, effectivePageSize],
  );
  const setPagination = useCallback(
    (updater: SetStateAction<PaginationState>) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: effectivePageSize })
          : updater;
      if (next.pageIndex !== pageIndex) setPageIndex(next.pageIndex);
      if (next.pageSize !== effectivePageSize) choosePageSize(next.pageSize);
    },
    [pageIndex, effectivePageSize, setPageIndex, choosePageSize],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack returns fresh fns each render; the `use no memo` directive above already opts this component out of React Compiler memoization.
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility: visibility,
      columnOrder: order,
      columnSizing: sizing,
      globalFilter,
      pagination,
      rowSelection,
    },
    getRowId,
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onColumnOrderChange: setOrder,
    onColumnSizingChange: setSizing,
    onGlobalFilterChange: (u) => {
      setGlobalFilter(u as string);
      setPageIndex(0); // a new search shouldn't leave you on an out-of-range page
    },
    onPaginationChange: setPagination,
    enableMultiSort,
    enableColumnResizing: enableResizing,
    columnResizeMode: 'onChange',
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false, // we manage page resets explicitly (filter/search) to avoid surprises
  });

  // Native drag-to-reorder. `insert BEFORE the drop target` keeps a non-reorderable trailing column
  // (e.g. actions) pinned last: it has no grip so it's never dragged, and dropping onto it lands before it.
  const dragCol = useRef<string | null>(null);
  const reorder = useCallback(
    (targetId: string) => {
      const from = dragCol.current;
      dragCol.current = null;
      if (!from || from === targetId) return;
      setOrder((prev) => {
        const next = prev.length ? [...prev] : defaultOrder;
        const fi = next.indexOf(from);
        if (fi < 0) return prev;
        next.splice(fi, 1);
        const ti = next.indexOf(targetId);
        next.splice(ti < 0 ? next.length : ti, 0, from);
        return next;
      });
    },
    [setOrder, defaultOrder],
  );

  const filteredCount = table.getFilteredRowModel().rows.length;
  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const safePageIndex = Math.min(pageIndex, Math.max(0, pageCount - 1));
  const start = safePageIndex * effectivePageSize;
  // Self-heal a stale page: an app-level filter (owned outside this component) can shrink the result
  // to fewer pages while the stored pageIndex stays high — TanStack then returns an EMPTY page, which
  // reads as "no results" even though rows match. Clamp the stored index back into range. (autoReset is
  // off on purpose, so we correct explicitly here instead of resetting to 0 on every data change.)
  useEffect(() => {
    if (pageIndex > 0 && pageIndex > pageCount - 1) setPageIndex(Math.max(0, pageCount - 1));
  }, [pageIndex, pageCount, setPageIndex]);
  const hideableColumns = table.getAllColumns().filter((c) => c.getCanHide());
  // The ordinal column renders only when enabled AND not hidden via the "Cột" menu.
  const rowNumbers = enableRowNumbers && showRowNumbers;
  const showColumnMenu = hideableColumns.length > 0 || enableRowNumbers;
  const canReorder = (c: Column<T, unknown>) =>
    enableReordering && (c.columnDef.meta as DataTableColumnMeta | undefined)?.noReorder !== true;
  // Selected originals across ALL pages (selection is keyed by row id, so it spans pagination).
  const selectedRows = enableRowSelection
    ? table.getSelectedRowModel().rows.map((r) => r.original)
    : [];
  const selectedCount = selectedRows.length;

  // The shortcut list — rendered in the header's ⓘ hint AND implemented by the handler below, so the
  // two can never drift: one array, both consumers. Only the keys this table actually offers appear.
  const shortcuts = useMemo(() => {
    const list: { keys: string; desc: string }[] = [];
    if (searchPlaceholder) list.push({ keys: '/', desc: 'Vào ô tìm kiếm' });
    list.push({ keys: 'n · p', desc: 'Trang sau · trang trước' });
    if (enableRowSelection) list.push({ keys: 'a', desc: 'Chọn / bỏ chọn mọi dòng trên trang' });
    if (showColumnMenu) list.push({ keys: 'c', desc: 'Mở menu Cột' });
    list.push({ keys: 'Esc', desc: 'Xóa từ khóa tìm · bỏ chọn' });
    return list;
  }, [searchPlaceholder, enableRowSelection, showColumnMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser/OS combos alone
      // offsetParent === null ⇒ this table sits in a hidden (display:none) tab, so the keystroke
      // belongs to the visible table, not this one. Same guard the floating dock relies on.
      const root = rootRef.current;
      if (!root || root.offsetParent === null) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

      // Esc is the one key that also fires from INSIDE this table's search box (that is where you
      // reach for it): first it empties the search, then it drops the selection.
      if (e.key === 'Escape') {
        if (typing && el !== searchRef.current) return;
        if (globalFilter) table.setGlobalFilter('');
        else if (selectedCount > 0) clearSelection();
        return;
      }
      if (typing) return; // a letter typed into any field is text, never a command
      // An open dialog / menu / select owns the keyboard — never page the table behind it.
      if (document.querySelector('[role="dialog"],[role="menu"],[role="listbox"]')) return;

      switch (e.key) {
        case '/':
          if (!searchPlaceholder) return;
          e.preventDefault(); // otherwise "/" lands in the box as text (and Firefox quick-find opens)
          searchRef.current?.focus();
          searchRef.current?.select();
          return;
        case 'n':
          if (!table.getCanNextPage()) return;
          e.preventDefault();
          table.nextPage();
          return;
        case 'p':
          if (!table.getCanPreviousPage()) return;
          e.preventDefault();
          table.previousPage();
          return;
        case 'a':
          if (!enableRowSelection) return;
          e.preventDefault();
          table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
          return;
        case 'c':
          if (!showColumnMenu) return;
          e.preventDefault();
          setColMenuOpen(true); // Esc (Radix) closes it — the guard above blocks a second "c"
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    table,
    globalFilter,
    selectedCount,
    clearSelection,
    searchPlaceholder,
    enableRowSelection,
    showColumnMenu,
  ]);

  return (
    <div ref={rootRef} className="space-y-4">
      {/* ONE ROW at every width (2026-08-04). It used to stack the actions under the search box below
          sm, which cost a whole row of vertical space on the screen that has the least of it — and the
          actions are icon-only there (see ExpandingIconButton), so they fit beside a shrinking input. */}
      <div className="flex flex-row items-center gap-2 sm:gap-3">
        {searchPlaceholder && (
          <SearchInput
            ref={searchRef}
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            // className styles the WRAPPER here (see SearchInput). min-w-0 + flex-1 so the input
            // yields width to the buttons instead of pushing them off the row.
            className="min-w-0 flex-1 sm:max-w-xs"
          />
        )}

        {/* Column + filter controls sit at the far RIGHT (2026-07-21), with the app's action button
            (e.g. import) OUTERMOST. `ml-auto` pushes the whole group right of the search box. */}
        <div className="flex shrink-0 items-center gap-2 md:ml-auto">
          {/* The column chooser is DESKTOP-ONLY: below md the table is replaced by cards (see
              `renderCard`), whose fields are fixed by the card layout, so there are no columns to
              show or hide. */}
          {showColumnMenu && (
            <DropdownMenu open={colMenuOpen} onOpenChange={setColMenuOpen}>
              <DropdownMenuTrigger asChild>
                {/* Icon-only at rest; the label slides in on hover / focus / while open (matches the
                    app's other toolbar actions). Button already carries the `group/button` class. */}
                <Button
                  variant="outline"
                  className="gap-0 max-md:hidden"
                  aria-label="Hiển thị cột"
                  title="Hiển thị cột"
                >
                  <Columns3 className="size-4 shrink-0" aria-hidden />
                  <span
                    aria-hidden
                    className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover/button:ml-1.5 group-hover/button:max-w-24 group-hover/button:opacity-100 group-focus-visible/button:ml-1.5 group-focus-visible/button:max-w-24 group-focus-visible/button:opacity-100 group-aria-expanded/button:ml-1.5 group-aria-expanded/button:max-w-24 group-aria-expanded/button:opacity-100 motion-reduce:transition-none"
                  >
                    Cột
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Hiển thị trường</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {enableRowNumbers && (
                  <DropdownMenuCheckboxItem
                    checked={showRowNumbers}
                    onCheckedChange={(v) => setShowRowNumbers(v === true)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {rowNumberHeader}
                  </DropdownMenuCheckboxItem>
                )}
                {hideableColumns.map((column) => {
                  const meta = column.columnDef.meta as DataTableColumnMeta | undefined;
                  const label =
                    meta?.label ??
                    (typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id);
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(v) => column.toggleVisibility(v === true)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {filterSlot}
          {actionSlot}
        </div>
      </div>

      {rows.length === 0 ? (
        // The table keeps its toolbar above (search/filter) so the user can clear what filtered the
        // rows away; the empty body itself uses the shared EmptyState (SearchX = "no match"), so a
        // filtered-empty table reads the same as every other empty in the app. A truly-empty store is
        // handled ONE level up (the page renders EmptyState instead of the table) — the resources
        // "Ngữ pháp" tab is the reference.
        <EmptyState icon={emptyIcon} title={emptyMessage} className="py-12" />
      ) : (
        <>
          {/* w-full + min-width(totalSize): real columns keep their EXACT px widths; a trailing auto
              spacer eats the slack so the table fills without stretching columns (and scrolls once the
              columns exceed the width). The Table primitive supplies its own overflow-x-auto container. */}
          {/* Cards below md (only when the caller supplied a renderer — otherwise the table renders at
              every width). Same `rows` as the table: searched, filtered, sorted, paged. */}
          {renderCard && (
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((row, i) => {
                const selected = enableRowSelection && row.getIsSelected();
                return (
                  <li
                    key={row.id}
                    className={cn(
                      'rounded-2xl border border-border/70 bg-card p-4 shadow-soft transition-colors',
                      selected && 'border-primary bg-primary/5',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {enableRowSelection && (
                        // mt-1 lines the box up with the first text line rather than the card's top edge.
                        <Checkbox
                          className="mt-1 shrink-0"
                          checked={selected}
                          onCheckedChange={(v) => row.toggleSelected(v === true)}
                          aria-label="Chọn mục này"
                        />
                      )}
                      {/* min-w-0: without it a long unbroken JA string makes the card wider than the
                          viewport and the whole page scrolls sideways. */}
                      <div className="min-w-0 flex-1">
                        {renderCard(row.original, start + i + 1)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Wrapping div, not a class on <Table>: the Table primitive renders its own
              `overflow-x-auto` container, so hiding the <table> alone would leave that container in
              flow.
              The wrapper is also the table's SHEET — the same card surface every other block on the page
              sits on, so a list stops being a bare grid floating on the background. `overflow-hidden`
              clips the header's tint to the rounded corners; the horizontal scroll still happens on the
              Table primitive's own inner container. */}
          <div
            className={cn(
              'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft',
              renderCard && 'max-md:hidden',
            )}
          >
            <Table className="table-fixed" style={{ minWidth: table.getTotalSize() }}>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {enableRowSelection && (
                      <TableHead style={{ width: 44 }} className="px-2">
                        <Checkbox
                          checked={
                            table.getIsAllPageRowsSelected()
                              ? true
                              : table.getIsSomePageRowsSelected()
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
                          aria-label="Chọn tất cả dòng trên trang"
                        />
                      </TableHead>
                    )}
                    {rowNumbers && (
                      <TableHead style={{ width: 52 }} className="text-muted-foreground">
                        {rowNumberHeader}
                      </TableHead>
                    )}
                    {hg.headers.map((header) => {
                      const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined;
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      const SortIcon =
                        sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown;
                      // With ≥2 sorts, show each column's 1-based priority so the order is legible.
                      const showRank = sorting.length > 1 && sorted;
                      const reorderable = canReorder(header.column);
                      return (
                        <TableHead
                          key={header.id}
                          className={cn('relative', meta?.headClassName)}
                          style={{ width: header.getSize() }}
                          aria-sort={
                            sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : undefined
                          }
                          onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
                          onDrop={reorderable ? () => reorder(header.column.id) : undefined}
                        >
                          {header.isPlaceholder ? null : (
                            <div className="flex items-center gap-1">
                              {reorderable && (
                                <span
                                  draggable
                                  onDragStart={() => (dragCol.current = header.column.id)}
                                  onDragEnd={() => (dragCol.current = null)}
                                  role="button"
                                  aria-label="Kéo để đổi vị trí cột"
                                  title="Kéo để đổi vị trí cột"
                                  className="-ml-1 shrink-0 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
                                >
                                  <GripVertical className="size-3.5" aria-hidden />
                                </span>
                              )}
                              {canSort ? (
                                <Explain text="Bấm để sắp xếp theo cột này. Giữ Shift rồi bấm để thêm cột phụ, sắp xếp nhiều tầng.">
                                  <button
                                    type="button"
                                    onClick={header.column.getToggleSortingHandler()}
                                    className={cn(
                                      'flex min-w-0 items-center gap-1 transition-colors hover:text-foreground',
                                      sorted && 'text-foreground',
                                    )}
                                  >
                                    <span className="truncate">
                                      {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext(),
                                      )}
                                    </span>
                                    <SortIcon
                                      className={cn(
                                        'size-3.5 shrink-0',
                                        sorted ? 'opacity-100' : 'opacity-40',
                                      )}
                                      aria-hidden
                                    />
                                    {showRank && (
                                      <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                                        {header.column.getSortIndex() + 1}
                                      </span>
                                    )}
                                  </button>
                                </Explain>
                              ) : (
                                <span className="truncate">
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </span>
                              )}
                            </div>
                          )}
                          {header.column.getCanResize() && (
                            <span
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onClick={(e) => e.stopPropagation()}
                              role="separator"
                              aria-orientation="vertical"
                              className={cn(
                                'absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-border',
                                header.column.getIsResizing() && 'bg-primary/60',
                              )}
                            />
                          )}
                        </TableHead>
                      );
                    })}
                    {/* Auto-width spacer so the real columns keep exact widths + the table still fills.
                      It also carries the ⓘ SHORTCUT HINT: top-right of the header, on the same row as
                      (and immediately right of) the actions column — the one spot that belongs to no
                      column, so the hint costs no header text and never shifts a column's width. */}
                    <TableHead className="w-auto min-w-8 p-0">
                      <span className="flex justify-end pr-1">
                        <Explain
                          side="left"
                          className="items-start"
                          text={
                            <span className="flex flex-col gap-1">
                              <span className="font-medium">Phím tắt bàn phím</span>
                              {shortcuts.map((s) => (
                                <span key={s.keys} className="flex items-center gap-2">
                                  <kbd className="min-w-10 rounded border border-background/40 px-1 text-center font-mono text-xs">
                                    {s.keys}
                                  </kbd>
                                  <span>{s.desc}</span>
                                </span>
                              ))}
                            </span>
                          }
                        >
                          <button
                            type="button"
                            aria-label="Phím tắt của bảng"
                            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground"
                          >
                            <Info className="size-3.5" aria-hidden />
                          </button>
                        </Explain>
                      </span>
                    </TableHead>
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody ref={bodyRef}>
                {rows.map((row, i) => (
                  // Uniform data-row height (h-12 = 48px) so EVERY table reads at the same rhythm
                  // regardless of which controls a column carries — the resources table's `size-8` action
                  // button sets the 48px standard; without this, a table whose tallest control is smaller
                  // (e.g. /library's size-6 buttons) rendered shorter rows (invariant #9: same height). It
                  // is a MIN in table layout, so a cell that ever needs more still grows.
                  <TableRow key={row.id} className={cn('h-12', rowClassName?.(row.original))}>
                    {enableRowSelection && (
                      <TableCell style={{ width: 44 }} className="px-2">
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(v) => row.toggleSelected(v === true)}
                          aria-label="Chọn dòng"
                        />
                      </TableCell>
                    )}
                    {rowNumbers && (
                      <TableCell
                        style={{ width: 52 }}
                        className="text-muted-foreground tabular-nums"
                      >
                        {start + i + 1}
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined;
                      return (
                        <TableCell
                          key={cell.id}
                          className={meta?.cellClassName}
                          style={{ width: cell.column.getSize() }}
                        >
                          {/* one-line truncation so a narrowed / long cell never breaks the row height */}
                          <div className="truncate">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell aria-hidden className="p-0" />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div
            ref={footerRef}
            className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center"
          >
            <span className="text-xs text-muted-foreground">
              {start + 1}–{Math.min(start + effectivePageSize, filteredCount)} / {filteredCount}{' '}
              {countNoun}
              {totalCount != null && filteredCount !== totalCount && ` (lọc từ ${totalCount})`}
            </span>
            <DataPagination
              page={safePageIndex + 1}
              pageCount={pageCount}
              onPageChange={(p) => setPageIndex(p - 1)}
              pageSize={effectivePageSize}
              pageSizeOptions={sizeOptions}
              // Always shown (even on a short table) so "Tự động (N)" is a visible cue that the page
              // size fits the viewport — and the way back to auto after picking a fixed size.
              onPageSizeChange={choosePageSize}
              autoFit={autoFit}
              // The measured viewport fit — so "Tự động (N)" shows the fit, not the fixed size picked.
              autoFitSize={fitRows ?? effectivePageSize}
              onAutoFit={() => {
                setAutoFit(true);
                setPageIndex(0);
              }}
            />
          </div>
        </>
      )}

      {/* Bulk-action DOCK — a vertical strip FLOATING over the right edge of the viewport (2026-07-25;
          it used to be a horizontal bar at the bottom-centre). Why floating at all: an in-flow bar
          pushed the tbody down, which changed `useFitRows`' measured top edge and shrank the auto page
          size whenever a row was selected (then grew it back on clear) — a visible reflow. As an
          overlay it never touches the table's layout, so the row count stays put. Why vertical on the
          right: it clears the pagination footer and reads as one column of ICONS — the count as a
          themed chip on top, then "bỏ chọn" (×), then the app's actions, each named by its own hover
          tooltip (`BulkActionButton`). Fixed + display:none-safe: on a tabbed page an inactive table's
          dock is hidden with its tab, so only the active table's dock shows.
          Vertical centring rides in the animation (`y: '-50%'`), NOT a `-translate-y-1/2` class: Motion
          writes the whole `transform`, so a translate class on the same element would be overwritten. */}
      {enableRowSelection && bulkActions && (
        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 24, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={{ opacity: 0, x: 24, y: '-50%' }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-1/2 right-3 z-50 flex max-h-[calc(100vh-4rem)] flex-col items-center gap-1.5 overflow-y-auto rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
              {/* Count = the NUMBER only, in a button-sized container carrying the app's theme
                    colour; the full sentence lives in its tooltip. */}
              <Explain side="left" text={`Đã chọn ${selectedCount} ${countNoun}`}>
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                  {selectedCount}
                </span>
              </Explain>
              <Explain side="left" text="Bỏ chọn tất cả (phím Esc).">
                <Button variant="ghost" size="icon" aria-label="Bỏ chọn" onClick={clearSelection}>
                  <X className="size-4" aria-hidden />
                </Button>
              </Explain>
              <span aria-hidden className="my-0.5 h-px w-5 shrink-0 bg-border" />
              {bulkActions(selectedRows, clearSelection)}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
