'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  LayoutGrid,
  Rows3,
  SearchX,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/common/explain';
import { EmptyState } from '@/components/common/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import { choiceChipClass } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterChips, type FilterChip } from '@/components/common/filter-popover';
import { SearchInput } from '@/components/common/search-input';
import { SortSheet, type SortOption } from '@/components/common/sort-sheet';
import { useSessionState } from '@/components/common/use-session-state';
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
import { cn } from '@/lib/core/utils';

export type DataTableView = 'table' | 'cards';

export interface DataTableColumnMeta {
  label?: string;
  defaultHidden?: boolean;
  noReorder?: boolean;
  headClassName?: string;
  cellClassName?: string;
}

const VIEW_CHOICES = [
  { value: 'table', label: 'Xem dạng bảng', icon: Rows3 },
  { value: 'cards', label: 'Xem dạng thẻ', icon: LayoutGrid },
] as const satisfies readonly { value: DataTableView; label: string; icon: LucideIcon }[];

const EMPTY_SORTING: SortingState = [];
const EMPTY_SIZING: ColumnSizingState = {};

function colId(c: ColumnDef<unknown, unknown>): string {
  return (c.id ?? (c as { accessorKey?: string }).accessorKey ?? '') as string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId?: (row: T) => string;
  persistKey: string;
  urlPrefix?: string;
  searchPlaceholder?: string;
  filterSlot?: ReactNode;
  /** Active filters, shown as clearable pills under the toolbar. */
  filterChips?: readonly FilterChip[];
  onResetFilters?: () => void;
  actionSlot?: ReactNode;
  emptyMessage?: string;
  emptyIcon?: LucideIcon | null;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  estimatedRowHeight?: number;
  estimatedCardHeight?: number;
  rowClassName?: (row: T) => string | undefined;
  totalCount?: number;
  countNoun?: string;
  enableMultiSort?: boolean;
  enableResizing?: boolean;
  enableReordering?: boolean;
  enableRowSelection?: boolean;
  enableRowNumbers?: boolean;
  rowNumberHeader?: string;
  bulkActions?: (selectedRows: T[], clearSelection: () => void) => ReactNode;
  renderCard?: (row: T, index: number) => ReactNode;
  cardHref?: (row: T) => string;
  cardHrefLabel?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  persistKey,
  urlPrefix,
  searchPlaceholder,
  filterSlot,
  filterChips,
  onResetFilters,
  actionSlot,
  emptyMessage = 'Không có dữ liệu.',
  emptyIcon = SearchX,
  pageSizeOptions = [25, 50, 100],
  initialPageSize = 50,
  estimatedRowHeight = 45,
  estimatedCardHeight = 116,
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
  cardHref,
  cardHrefLabel,
}: DataTableProps<T>) {
  'use no memo'; // TanStack's useReactTable returns fresh functions each render — opt out of React Compiler memoization (official guidance); the table does its own memoization internally.
  const up = urlPrefix ?? `${persistKey}.`;

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

  const [sorting, setSorting] = useSessionState<SortingState>(
    `${persistKey}.sort`,
    EMPTY_SORTING,
    `${up}sort`,
  );
  const [visibility, setVisibility] = useSessionState<VisibilityState>(
    `${persistKey}.cols`,
    defaultVisibility,
    `${up}cols`,
  );
  const [order, setOrder] = useSessionState<ColumnOrderState>(`${persistKey}.order`, defaultOrder);
  const [sizing, setSizing] = useSessionState<ColumnSizingState>(`${persistKey}.w`, EMPTY_SIZING);
  const [globalFilter, setGlobalFilter] = useSessionState<string>(
    `${persistKey}.q`,
    '',
    searchPlaceholder ? `${up}q` : undefined,
  );
  const [pageIndex, setPageIndex] = useSessionState<number>(`${persistKey}.page`, 0, `${up}page`);
  const [pageSize, setPageSize] = useSessionState<number>(
    `${persistKey}.size`,
    initialPageSize,
    `${up}size`,
  );
  const [autoFit, setAutoFit] = useSessionState<boolean>(`${persistKey}.autofit`, true);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const cardsRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const fitRows = useFitRows({ topRef: bodyRef, footerRef, rowHeight: estimatedRowHeight });
  // Card view fills a grid, so the count that fits is rows × columns, not rows. The hook reads the
  // real column count out of `grid-template-columns` and the real card height off the first row, so
  // a 3-across grid asks for 3× the page a 1-across phone does — measured, not guessed.
  const fitCards = useFitRows({
    topRef: cardsRef,
    footerRef,
    rowHeight: estimatedCardHeight,
    grid: true,
  });
  // Exactly one of the two is visible at any width, and the hidden one reports null.
  const fit = fitCards ?? fitRows;
  const effectivePageSize = autoFit && fit != null ? fit : pageSize;
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
  const [showRowNumbers, setShowRowNumbers] = useSessionState<boolean>(
    `${persistKey}.rownum`,
    true,
  );

  // Mobile is card-only and has no switch: the choice below applies from `md` up, which is why both
  // branches stay CSS-driven rather than reading a media query — a JS breakpoint would flip the
  // layout after hydration.
  const [view, setView] = useSessionState<DataTableView>(
    `${persistKey}.view`,
    'table',
    `${up}view`,
  );
  const cards = renderCard != null && view === 'cards';

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const clearSelection = useCallback(() => setRowSelection({}), []);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const changeSorting = useCallback(
    (updater: SetStateAction<SortingState>) => {
      setSorting(updater);
      setPageIndex(0);
    },
    [setSorting, setPageIndex],
  );

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
    onSortingChange: changeSorting,
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
  useEffect(() => {
    if (pageIndex > 0 && pageIndex > pageCount - 1) setPageIndex(Math.max(0, pageCount - 1));
  }, [pageIndex, pageCount, setPageIndex]);
  const hideableColumns = table.getAllColumns().filter((c) => c.getCanHide());
  const sortOptions: SortOption[] = table
    .getAllColumns()
    .filter((c) => c.getCanSort())
    .map((c) => {
      const meta = c.columnDef.meta as DataTableColumnMeta | undefined;
      const header = c.columnDef.header;
      return { id: c.id, label: meta?.label ?? (typeof header === 'string' ? header : c.id) };
    })
    .filter((o) => o.label.trim() !== '');
  const activeSort = sorting[0];
  const rowNumbers = enableRowNumbers && showRowNumbers;
  // Card view has no columns to show or hide, so the menu (and its `c` shortcut) goes away with it.
  const showColumnMenu = !cards && (hideableColumns.length > 0 || enableRowNumbers);
  const canReorder = (c: Column<T, unknown>) =>
    enableReordering && (c.columnDef.meta as DataTableColumnMeta | undefined)?.noReorder !== true;
  const selectedRows = enableRowSelection
    ? table.getSelectedRowModel().rows.map((r) => r.original)
    : [];
  const selectedCount = selectedRows.length;

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
      const root = rootRef.current;
      if (!root || root.offsetParent === null) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

      if (e.key === 'Escape') {
        if (typing && el !== searchRef.current) return;
        if (globalFilter) table.setGlobalFilter('');
        else if (selectedCount > 0) clearSelection();
        return;
      }
      if (typing) return; // a letter typed into any field is text, never a command
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
      <div className="flex flex-row items-center gap-2 sm:gap-3">
        {renderCard && (
          <div
            role="group"
            aria-label="Kiểu hiển thị"
            className="flex shrink-0 items-center gap-1.5 max-md:hidden"
          >
            {VIEW_CHOICES.map(({ value, label, icon: Icon }) => {
              const active = view === value;
              return (
                <Explain key={value} text={label}>
                  <button
                    type="button"
                    onClick={() => setView(value)}
                    aria-pressed={active}
                    aria-label={label}
                    className={cn(
                      'inline-flex h-8.5 w-9 items-center justify-center rounded-sm transition-colors md:h-6.5 md:w-7',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      choiceChipClass(active),
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                </Explain>
              );
            })}
          </div>
        )}
        {searchPlaceholder && (
          <SearchInput
            ref={searchRef}
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 sm:max-w-xs"
          />
        )}

        <div className="flex shrink-0 items-center gap-2 md:ml-auto">
          {sortOptions.length > 0 && (
            <SortSheet
              options={sortOptions}
              columnId={activeSort?.id ?? null}
              desc={activeSort?.desc ?? false}
              onChange={(next) => changeSorting(next ? [{ id: next.id, desc: next.desc }] : [])}
            />
          )}
          {showColumnMenu && (
            <DropdownMenu open={colMenuOpen} onOpenChange={setColMenuOpen}>
              <DropdownMenuTrigger asChild>
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

      {filterChips && <FilterChips chips={filterChips} onReset={onResetFilters} />}

      {rows.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyMessage} className="py-12" />
      ) : (
        <>
          {renderCard && (
            <ul
              ref={cardsRef}
              data-slot="data-table-cards"
              className={cn(
                'grid gap-2',
                // `md:hidden` is the mobile-only case: cards are the phone layout no matter what the
                // desktop switch says. In card view the same list becomes the desktop layout too.
                cards ? 'md:grid-cols-2 md:gap-3 xl:grid-cols-3' : 'md:hidden',
              )}
            >
              {rows.map((row, i) => {
                const selected = enableRowSelection && row.getIsSelected();
                return (
                  <li
                    key={row.id}
                    className={cn(
                      'rounded-xl border-2 border-border p-3 shadow-lift-card transition-colors',
                      selected && 'border-primary bg-primary/5',
                      cardHref && 'relative hover:bg-muted/40 [&_button]:relative [&_button]:z-10',
                    )}
                  >
                    {cardHref && (
                      <Link
                        href={cardHref(row.original)}
                        className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className="sr-only">
                          {cardHrefLabel?.(row.original) ?? 'Xem chi tiết'}
                        </span>
                      </Link>
                    )}
                    <div className="flex items-start gap-2.5">
                      {enableRowSelection && (
                        <Checkbox
                          className="relative z-10 mt-1 shrink-0"
                          checked={selected}
                          onCheckedChange={(v) => row.toggleSelected(v === true)}
                          aria-label="Chọn mục này"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        {renderCard(row.original, start + i + 1)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={cn(renderCard && 'max-md:hidden', cards && 'md:hidden')}>
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

          <div ref={footerRef}>
            <DataPagination
              count={
                <>
                  {start + 1}–{Math.min(start + effectivePageSize, filteredCount)} / {filteredCount}{' '}
                  {countNoun}
                  {totalCount != null && filteredCount !== totalCount && ` (lọc từ ${totalCount})`}
                </>
              }
              page={safePageIndex + 1}
              pageCount={pageCount}
              onPageChange={(p) => setPageIndex(p - 1)}
              pageSize={effectivePageSize}
              pageSizeOptions={sizeOptions}
              onPageSizeChange={choosePageSize}
              autoFit={autoFit}
              autoFitSize={fit ?? effectivePageSize}
              onAutoFit={() => {
                setAutoFit(true);
                setPageIndex(0);
              }}
            />
          </div>
        </>
      )}

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
