from pathlib import Path
p = Path('src/app/api/dealer-order/route.ts')
s = p.read_text()
old = '''async function parseItems(tx: Prisma.TransactionClient, rows: Array<Record<string, unknown>>): Promise<ParsedItem[]> {
  const items: ParsedItem[] = [];
  for (const row of rows) {
    const catNo = text(row.catNo ?? row.variantCode ?? row.productname, 160);
    const productName = text(row.productName ?? row.productname, 300);
    const quantityPacks = Math.trunc(num(row.quantityPacks) || (num(row.producQuanity) / Math.max(1, num(row.packSize) || 1)));
    const submittedPackSize = Math.trunc(num(row.packSize) || 1);
    if (!catNo || !productName || quantityPacks <= 0 || submittedPackSize <= 0) throw new OrderError(" Order product quantity is invalid.,
