import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProductThumb } from "@/components/ui/ProductThumb";
import { TextInput } from "@/components/ui/Field";
import {
  bluetoothPrintSupported,
  printBytes,
  printErrorMessage,
} from "@/lib/bluetoothPrinter";
import { GAS_FILL_KINDS, fmtBaht, fmtQty, todayStr } from "@/lib/constants";
import { buildReceiptBytes } from "@/lib/escpos";
import type { PosReceipt } from "@/lib/escpos";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useDerived } from "@/lib/useDerived";
import { useAppStore } from "@/store/useAppStore";
import { usePosStore } from "@/store/usePosStore";
import type { Customer, Product, ProductKind, UUID } from "@/types";

/** ของที่ห้ามขายหน้าร้าน — ถังเปล่า/ถังเต็มเป็นของหลังร้าน ตัดเองตอนขายน้ำแก๊สอยู่แล้ว */
const NOT_FOR_SALE: ReadonlyArray<ProductKind> = [
  "ดิบ",
  "เปล่า",
  "เต็ม",
  "ชำรุด",
  "ต่างยี่ห้อ",
];

const CATEGORIES: ReadonlyArray<{
  key: string;
  label: string;
  kinds: ReadonlyArray<ProductKind>;
}> = [
  { key: "gas", label: "แก๊ส", kinds: ["น้ำแก๊ส", "หมุนเวียน"] },
  { key: "tank", label: "ถังใหม่", kinds: ["ใหม่"] },
  { key: "equip", label: "เตา/อุปกรณ์", kinds: ["เตาแก๊ส", "อุปกรณ์แก๊ส"] },
  { key: "service", label: "บริการ", kinds: ["บริการ"] },
  { key: "other", label: "อื่น ๆ", kinds: [""] },
];

/** ปุ่มบนแท็บเล็ตต้องกดง่าย — touch-manipulation กันจังหวะกดสองทีแล้วจอซูม */
const TAP = "touch-manipulation select-none";

export function PosPage() {
  const loadAll = useAppStore((s) => s.loadAll);
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);
  const settings = useAppStore((s) => s.settings);

  const { products, customers, priceFor, hasCustomPrice, productById } =
    useDerived();

  const saveOrder = useAppStore((s) => s.saveOrder);
  const completeOrder = useAppStore((s) => s.completeOrder);

  const cart = usePosStore((s) => s.cart);
  const customerId = usePosStore((s) => s.customerId);
  const paidCash = usePosStore((s) => s.paidCash);
  const paidTransfer = usePosStore((s) => s.paidTransfer);
  const addToCart = usePosStore((s) => s.addToCart);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeFromCart = usePosStore((s) => s.removeFromCart);
  const clearCart = usePosStore((s) => s.clearCart);
  const setPosCustomer = usePosStore((s) => s.setPosCustomer);
  const setPaidCash = usePosStore((s) => s.setPaidCash);
  const setPaidTransfer = usePosStore((s) => s.setPaidTransfer);
  const resetSale = usePosStore((s) => s.resetSale);

  const [cat, setCat] = useState("all");
  const [term, setTerm] = useState("");
  const [pickCustomer, setPickCustomer] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  // บิลที่บันทึกแล้วแต่ปิดไม่ผ่าน (เช่นของไม่พอ) — กดขายซ้ำต้องแก้ใบเดิม ไม่ใช่เปิดใบใหม่
  const [pendingOrderId, setPendingOrderId] = useState<UUID | null>(null);

  // หน้านี้อยู่นอกโครงแดชบอร์ด เลยต้องสั่งโหลดข้อมูลเอง (เข้ามาตรง ๆ จาก /pos ก็ต้องได้)
  useEffect(() => {
    if (isSupabaseConfigured && useAppStore.getState().status === "idle") {
      void loadAll();
    }
  }, [loadAll]);

  const sellable = useMemo(
    () => products.filter((p) => p.active && !NOT_FOR_SALE.includes(p.kind)),
    [products],
  );

  const cats = useMemo(
    () =>
      CATEGORIES.filter((c) => sellable.some((p) => c.kinds.includes(p.kind))),
    [sellable],
  );

  const shown = useMemo(() => {
    const kinds = cats.find((c) => c.key === cat)?.kinds;
    const q = term.trim().toLowerCase();
    return sellable.filter((p) => {
      if (kinds && !kinds.includes(p.kind)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [sellable, cats, cat, term]);

  const lines = useMemo(
    () =>
      cart.map((line) => {
        const product = productById(line.product_id);
        const price = priceFor(line.product_id, customerId);
        return { ...line, product, price, amount: price * line.qty };
      }),
    [cart, productById, priceFor, customerId],
  );

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const paid = paidCash + paidTransfer;
  const remain = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const count = cart.reduce((sum, l) => sum + l.qty, 0);

  // ร้านจด VAT → ราคาที่ตั้งไว้ถือว่ารวม VAT แล้ว แยกให้ดูเฉย ๆ ยอดเก็บเงินไม่เปลี่ยน
  const vatBase = settings?.vat_registered
    ? Math.round((total / 1.07) * 100) / 100
    : 0;
  const vatAmt = settings?.vat_registered ? total - vatBase : 0;

  const customer = customers.find((c) => c.id === customerId);

  /**
   * ปิดการขาย = บันทึกบิล แล้วส่งให้ complete_order ทำต่อทั้งหมด
   * ⭐ ตัดสต๊อก ลงเงินเข้า ตั้งลูกหนี้ และปิดงานเป็น "ปิด" เกิดในฐานข้อมูลครั้งเดียวจบ
   *    ห้ามตัดสต๊อกหรือแก้ status เองตรงนี้เด็ดขาด ไม่งั้นตัวเลขจะเพี้ยนกับแอปอื่น
   */
  async function handleCheckout() {
    if (!cart.length || busy) return;

    const snapshot: PosReceipt = {
      orderId: "",
      createdAt: new Date().toISOString(),
      date: todayStr(),
      shopName: settings?.shop_name ?? "JAMAREE GAS",
      customerName: customer?.name ?? "ลูกค้าจร",
      lines: lines.map((l) => ({
        name: l.product?.name ?? "-",
        qty: l.qty,
        price: l.price,
        amount: l.amount,
      })),
      total,
      paidCash,
      paidTransfer,
      change,
      remain,
    };

    setBusy(true);
    try {
      const order = await saveOrder(
        {
          customer_id: customerId,
          date: snapshot.date,
          items: cart.map(({ product_id, qty }) => ({ product_id, qty })),
          paid_cash: paidCash,
          paid_transfer: paidTransfer,
        },
        pendingOrderId ?? undefined,
      );
      setPendingOrderId(order.id);

      await completeOrder(order.id);

      setPendingOrderId(null);
      setReceipt({ ...snapshot, orderId: order.id });
      setCartOpen(false);
      resetSale();
    } catch {
      // ข้อความจากฐานข้อมูล (ของไม่พอ ฯลฯ) ขึ้นแถบเตือนด้านบนแล้ว — คงตะกร้าไว้ให้แก้ต่อ
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center gap-2.5 bg-paper text-muted">
        <Loader2 size={18} className="animate-spin" />
        <span>กำลังโหลดสินค้า…</span>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-3 py-2.5">
        <Link
          to="/"
          className={`${TAP} inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-sm font-medium text-muted hover:bg-paper hover:text-ink`}
        >
          <ArrowLeft size={18} />
          <span className="max-sm:sr-only">ออกจากโหมดขาย</span>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-head text-lg text-ink">ขายหน้าร้าน</h1>
          <p className="truncate text-xs text-muted">
            {settings?.shop_name ?? "JAMAREE GAS"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPickCustomer(true)}
          className={`${TAP} inline-flex max-w-[45%] items-center gap-2 rounded-btn border border-line px-3 py-2 text-sm hover:bg-paper`}
        >
          <User size={16} className="shrink-0 text-muted" />
          <span className="truncate text-ink">
            {customer?.name ?? "ลูกค้าจร"}
          </span>
        </button>
      </header>

      {error && (
        <div className="flex shrink-0 items-start gap-3 border-b border-danger/30 bg-danger-soft px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <p className="flex-1 text-sm text-ink">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className={`${TAP} rounded-btn px-2 py-1 text-sm font-medium text-danger hover:bg-card`}
          >
            ปิด
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_24rem]">
        {/* ---------- ฝั่งซ้าย: เลือกสินค้า ---------- */}
        <section className="flex min-h-0 flex-col">
          <div className="shrink-0 space-y-2.5 border-b border-line bg-card px-3 py-3">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <TextInput
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="ค้นหาสินค้า…"
                className="py-2.5 pl-9"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[{ key: "all", label: "ทั้งหมด" }, ...cats].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCat(c.key)}
                  className={[
                    TAP,
                    "shrink-0 rounded-btn px-4 py-2 text-sm font-medium transition-colors",
                    cat === c.key
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-paper",
                  ].join(" ")}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 lg:pb-3">
            {shown.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted">
                ไม่พบสินค้าที่ตรงกับที่ค้นหา
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {shown.map((p) => (
                  <ProductTile
                    key={p.id}
                    product={p}
                    price={priceFor(p.id, customerId)}
                    special={hasCustomPrice(p.id, customerId)}
                    onPick={() => addToCart(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ---------- ฝั่งขวา: ตะกร้า ---------- */}
        <aside
          className={[
            "flex min-h-0 flex-col border-line bg-card lg:border-l",
            "max-lg:fixed max-lg:inset-0 max-lg:z-40",
            cartOpen ? "max-lg:flex" : "max-lg:hidden",
          ].join(" ")}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-head text-base text-ink">
              รายการ {count > 0 && `(${fmtQty(count)})`}
            </h2>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className={`${TAP} inline-flex items-center gap-1.5 rounded-btn px-2.5 py-1.5 text-sm text-danger hover:bg-danger-soft`}
                >
                  <Trash2 size={15} />
                  ล้างบิล
                </button>
              )}
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="ปิดตะกร้า"
                className={`${TAP} rounded-btn p-2 text-muted hover:bg-paper lg:hidden`}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-muted">
                ยังไม่มีรายการ — แตะสินค้าทางซ้ายเพื่อเริ่มขาย
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={l.product_id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {l.product?.name ?? "สินค้าถูกลบ"}
                        </p>
                        <p className="text-xs text-muted">
                          {fmtBaht(l.price)} × {fmtQty(l.qty)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink">
                        {fmtBaht(l.amount)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <StepBtn
                        label="ลดจำนวน"
                        onClick={() => updateQuantity(l.product_id, l.qty - 1)}
                      >
                        <Minus size={16} />
                      </StepBtn>
                      <span className="w-10 text-center text-sm font-semibold text-ink">
                        {fmtQty(l.qty)}
                      </span>
                      <StepBtn
                        label="เพิ่มจำนวน"
                        onClick={() => updateQuantity(l.product_id, l.qty + 1)}
                      >
                        <Plus size={16} />
                      </StepBtn>
                      <button
                        type="button"
                        onClick={() => removeFromCart(l.product_id)}
                        className={`${TAP} ml-auto rounded-btn p-2 text-muted hover:bg-danger-soft hover:text-danger`}
                        aria-label="เอาออก"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-line px-4 py-3">
            {settings?.vat_registered && total > 0 && (
              <div className="space-y-1 text-sm text-muted">
                <Row label="ก่อน VAT" value={fmtBaht(vatBase)} />
                <Row label="VAT 7%" value={fmtBaht(vatAmt)} />
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">รวมทั้งบิล</span>
              <span className="font-head text-3xl text-ink">
                {fmtBaht(total)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <PayInput
                label="เงินสด"
                value={paidCash}
                onChange={setPaidCash}
                onFull={() => setPaidCash(Math.max(0, total - paidTransfer))}
              />
              <PayInput
                label="เงินโอน"
                value={paidTransfer}
                onChange={setPaidTransfer}
                onFull={() => setPaidTransfer(Math.max(0, total - paidCash))}
              />
            </div>

            {remain > 0 && paid > 0 && (
              <p className="text-sm text-danger">
                ค้างชำระ {fmtBaht(remain)} บาท — จะขึ้นเป็นลูกหนี้ให้อัตโนมัติ
              </p>
            )}
            {change > 0 && (
              <p className="text-sm text-ok">เงินทอน {fmtBaht(change)} บาท</p>
            )}

            {pendingOrderId && (
              <p className="text-sm text-warn">
                บิลนี้บันทึกไว้แล้วแต่ยังปิดไม่ได้ —
                แก้ตามข้อความด้านบนแล้วกดปิดการขายอีกครั้ง (ระบบจะแก้บิลเดิม
                ไม่เปิดบิลซ้ำ)
              </p>
            )}

            <Button
              variant="ok"
              disabled={!cart.length || busy}
              onClick={() => void handleCheckout()}
              className="h-14 w-full text-base"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  กำลังปิดการขาย…
                </>
              ) : paid === 0 && total > 0 ? (
                <>ปิดการขาย · ค้างชำระทั้งบิล {fmtBaht(total)} บาท</>
              ) : (
                <>ปิดการขาย {total > 0 && `· ${fmtBaht(total)} บาท`}</>
              )}
            </Button>
          </div>
        </aside>
      </div>

      {/* แถบล่างบนจอเล็ก — เปิดตะกร้าขึ้นมาเต็มจอ */}
      {!cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className={`${TAP} fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-accent px-4 py-3.5 text-on-accent lg:hidden`}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <ShoppingCart size={18} />
            {count > 0 ? `${fmtQty(count)} รายการ` : "ตะกร้าว่าง"}
          </span>
          <span className="font-head text-lg">{fmtBaht(total)}</span>
        </button>
      )}

      <CustomerPicker
        open={pickCustomer}
        customers={customers}
        currentId={customerId}
        onClose={() => setPickCustomer(false)}
        onPick={(id) => {
          setPosCustomer(id);
          setPickCustomer(false);
        }}
      />

      <ReceiptModal
        key={receipt?.orderId}
        receipt={receipt}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}

/* ---------------- ชิ้นส่วนย่อย ---------------- */

function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: PosReceipt | null;
  onClose: () => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);

  if (!receipt) return null;

  async function print() {
    if (!receipt) return;
    setPrinting(true);
    setPrintError(null);
    try {
      await printBytes(buildReceiptBytes(receipt));
      setPrinted(true);
    } catch (err) {
      setPrintError(printErrorMessage(err));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Modal
      open
      title="ขายสำเร็จ"
      hint="ตัดสต๊อกและลงบัญชีให้เรียบร้อยแล้ว"
      onClose={onClose}
      footer={
        <div className="flex w-full gap-2">
          <Button
            variant="secondary"
            disabled={printing || !bluetoothPrintSupported}
            onClick={() => void print()}
            icon={
              printing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Printer size={16} />
              )
            }
            className="h-12 flex-1"
          >
            {printing ? "กำลังพิมพ์…" : printed ? "พิมพ์อีกใบ" : "พิมพ์ใบเสร็จ"}
          </Button>
          <Button variant="primary" onClick={onClose} className="h-12 flex-1">
            ขายบิลใหม่
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-ok">
          <CheckCircle2 size={20} />
          <span className="font-head text-2xl">
            {fmtBaht(receipt.total)} บาท
          </span>
        </div>

        <p className="text-sm text-muted">ลูกค้า {receipt.customerName}</p>

        <ul className="divide-y divide-line rounded-btn border border-line">
          {receipt.lines.map((l, i) => (
            <li
              key={i}
              className="flex justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {l.name} <span className="text-muted">× {fmtQty(l.qty)}</span>
              </span>
              <span className="shrink-0 text-ink">{fmtBaht(l.amount)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 text-sm text-muted">
          {receipt.paidCash > 0 && (
            <Row label="เงินสด" value={fmtBaht(receipt.paidCash)} />
          )}
          {receipt.paidTransfer > 0 && (
            <Row label="เงินโอน" value={fmtBaht(receipt.paidTransfer)} />
          )}
          {receipt.change > 0 && (
            <Row label="เงินทอน" value={fmtBaht(receipt.change)} />
          )}
        </div>

        {receipt.remain > 0 && (
          <p className="text-sm text-danger">
            ค้างชำระ {fmtBaht(receipt.remain)} บาท — ตั้งเป็นลูกหนี้ให้แล้ว
          </p>
        )}

        {printError && (
          <p className="rounded-btn border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-ink">
            {printError}
          </p>
        )}
        {!bluetoothPrintSupported && (
          <p className="rounded-btn border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-ink">
            เครื่องนี้สั่งพิมพ์ผ่านบลูทูธไม่ได้ — ต้องใช้ Chrome บน Android,
            Windows หรือ Mac และเปิดหน้าเว็บผ่าน https (iPad/iPhone ใช้ไม่ได้)
          </p>
        )}

        <Link
          to={`/orders/${receipt.orderId}`}
          className="inline-block text-sm font-medium text-accent hover:underline"
        >
          ดูบิลนี้ในหน้าออเดอร์
        </Link>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StepBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${TAP} grid size-10 place-items-center rounded-btn border border-line text-ink hover:bg-paper active:bg-accent-soft`}
    >
      {children}
    </button>
  );
}

function ProductTile({
  product,
  price,
  special,
  onPick,
}: {
  product: Product;
  price: number;
  special: boolean;
  onPick: () => void;
}) {
  const tracked =
    product.kind !== "บริการ" && !GAS_FILL_KINDS.includes(product.kind);
  const out = tracked && Number(product.stock) <= 0;

  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        TAP,
        "flex min-h-32 flex-col rounded-card border border-line bg-card p-2.5 text-left",
        "shadow-card transition-colors hover:border-accent active:bg-accent-soft",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <ProductThumb url={product.image_url} name={product.name} size="md" />
        {special && (
          <span className="ml-auto text-sm text-warn" title="ราคาชุดพิเศษ">
            ★
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-ink">
        {product.name}
      </p>
      <div className="mt-auto flex items-end justify-between pt-1.5">
        <span className="font-head text-lg text-accent">{fmtBaht(price)}</span>
        {tracked && (
          <span className={`text-xs ${out ? "text-danger" : "text-muted"}`}>
            เหลือ {fmtQty(Number(product.stock))}
          </span>
        )}
      </div>
    </button>
  );
}

function PayInput({
  label,
  value,
  onChange,
  onFull,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onFull: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-ink">{label}</span>
        <button
          type="button"
          onClick={onFull}
          className={`${TAP} rounded px-1 text-xs font-medium text-accent hover:underline`}
        >
          เต็มจำนวน
        </button>
      </div>
      <TextInput
        inputMode="decimal"
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        onChange={(e) =>
          onChange(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)
        }
        className="py-2.5 text-right text-base"
      />
    </div>
  );
}

function CustomerPicker({
  open,
  customers,
  currentId,
  onClose,
  onPick,
}: {
  open: boolean;
  customers: Customer[];
  currentId: UUID | null;
  onClose: () => void;
  onPick: (id: UUID | null) => void;
}) {
  const [term, setTerm] = useState("");

  const hits = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = q
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q),
        )
      : customers;
    return list.slice(0, 40);
  }, [customers, term]);

  return (
    <Modal
      open={open}
      title="เลือกลูกค้า"
      hint="ไม่เลือกก็ขายได้ — จะคิดราคาปกติของสินค้า"
      onClose={onClose}
    >
      <div className="space-y-2">
        <TextInput
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร…"
          className="py-2.5"
        />

        <button
          type="button"
          onClick={() => onPick(null)}
          className={[
            TAP,
            "w-full rounded-btn border border-line px-3 py-3 text-left text-sm hover:bg-paper",
            currentId === null
              ? "border-accent bg-accent-soft text-accent"
              : "text-ink",
          ].join(" ")}
        >
          ลูกค้าจร (ไม่ระบุชื่อ)
        </button>

        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c.id)}
                className={[
                  TAP,
                  "w-full rounded-btn border border-line px-3 py-3 text-left hover:bg-paper",
                  currentId === c.id ? "border-accent bg-accent-soft" : "",
                ].join(" ")}
              >
                <span className="block text-sm font-medium text-ink">
                  {c.name}
                </span>
                {c.phone && (
                  <span className="block text-xs text-muted">{c.phone}</span>
                )}
              </button>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="py-6 text-center text-sm text-muted">
              ไม่พบลูกค้าที่ค้นหา
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
