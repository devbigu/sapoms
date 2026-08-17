import { formatDisplayOrderNumber } from '@/lib/orderDisplay';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@supabase/supabase-js";
import moment from "moment";
import { resolveOrderAmounts } from "@/lib/orderAmounts";

// ─── Supabase Setup ────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ────────────────────────────────────────────────────────────────
export type Order = {
  order_id: string;
  order_date: string;
  order_amount: string | number;
  order_discount: string | number;
  Dealer_Name: string;
  orderdata_item_quantity: string;
  mtstatus: string;
  outstandingDate: string;
  reason?: string;
  order_discount_amount?: string | number;
  order_net_amount?: string | number;
  grossAmount?: string | number;
  discountAmount?: string | number;
  netPayableAmount?: string | number;
};

export interface ExportOptions {
  orders: Order[];
  dealerName?: string;
  fileName?: string;
  title?: string;
}

export interface ExportResult {
  success: boolean;
  message: string;
  url?: string;
  error?: string;
}

// ─── Generate PDF ────────────────────────────────────────────────────────
export async function generateOrdersPDF(options: ExportOptions): Promise<Blob> {
  const { orders, dealerName = "Order Export", title = "Order History Report", fileName } = options;
  const year = new Date().getFullYear();

  // Create PDF in portrait mode, A4 size
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ─── Header ────────────────────────────────────────────────────────────
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, margin + 8);

  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");
  doc.text(`Dealer: ${dealerName}`, margin, margin + 16);
  doc.text(`Generated: ${moment().format("DD MMM YYYY hh:mm A")}`, margin, margin + 22);

  // ─── Summary Stats ────────────────────────────────────────────────────
  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + resolveOrderAmounts(o).gross, 0);
  const totalDiscount = orders.reduce((sum, o) => sum + resolveOrderAmounts(o).discountAmount, 0);
  const totalNet = orders.reduce((sum, o) => sum + resolveOrderAmounts(o).netPayable, 0);
  const totalUnits = orders.reduce((sum, o) => sum + Number(o.orderdata_item_quantity), 0);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `Total Orders: ${totalOrders} | Gross: ₹${totalAmount.toLocaleString("en-IN")} | Discount: ₹${totalDiscount.toLocaleString("en-IN")} | Net: ₹${totalNet.toLocaleString("en-IN")} | Units: ${totalUnits}`,
    margin,
    margin + 28
  );

  // ─── Table Data ────────────────────────────────────────────────────────
  const tableData = orders.map((order, idx) => {
    const amounts = resolveOrderAmounts(order);
    const statusLabel = order.mtstatus || "—";
    const isDeleted = !!order.reason;

    return [
      String(idx + 1).padStart(2, "0"),
      `${formatDisplayOrderNumber(order.order_id)}${isDeleted ? " [DEL]" : ""}`,
      moment(order.order_date).format("DD MMM YY"),
      `₹${amounts.gross.toLocaleString("en-IN")}`,
      `₹${amounts.discountAmount.toLocaleString("en-IN")}`,
      `₹${amounts.netPayable.toLocaleString("en-IN")}`,
      order.orderdata_item_quantity,
      statusLabel,
      order.outstandingDate ? moment(order.outstandingDate).format("DD MMM YY") : "—",
    ];
  });

  // ─── Add Table ────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: margin + 35,
    head: [["#", "Order No.", "Date", "Gross", "Discount", "Net", "Units", "Status", "Outstanding"]],
    body: tableData,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    styles: {
      font: "Helvetica",
      fontSize: 8,
      cellPadding: 3,
      textColor: [50, 50, 50],
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "center" },
      8: { halign: "center" },
    },
    didDrawPage: (data) => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(8);
      doc.setFont("Helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 8);
    },
  });

  return doc.output("blob");
}

// ─── Upload to Supabase Storage ────────────────────────────────────────────
export async function uploadPDFToSupabase(
  pdfBlob: Blob,
  dealerId: string,
  fileName?: string
): Promise<ExportResult> {
  try {
    const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
    const sanitizedFileName = fileName ? fileName.replace(/[^a-z0-9-._]/gi, "_") : `order-export_${timestamp}`;
    const filePath = `order-exports/${dealerId}/${sanitizedFileName}_${timestamp}.pdf`;

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from("order-pdfs") // Make sure this bucket exists in Supabase
      .upload(filePath, pdfBlob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      return {
        success: false,
        message: "Failed to upload PDF",
        error: error.message,
      };
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage.from("order-pdfs").getPublicUrl(filePath);

    return {
      success: true,
      message: "PDF exported and stored successfully",
      url: publicUrl.publicUrl,
    };
  } catch (error) {
    return {
      success: false,
      message: "Error uploading to Supabase",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── All-in-one Export Function ────────────────────────────────────────────
export async function exportOrdersToSupabase(options: ExportOptions & { dealerId: string }): Promise<ExportResult> {
  try {
    // Step 1: Generate PDF
    const pdfBlob = await generateOrdersPDF(options);

    // Step 2: Upload to Supabase
    const result = await uploadPDFToSupabase(pdfBlob, options.dealerId, options.fileName);

    // Step 3: Optionally save export record to database
    if (result.success) {
      await saveExportRecord({
        dealerId: options.dealerId,
        fileName: options.fileName || "order-export",
        fileUrl: result.url || "",
        orderCount: options.orders.length,
      });
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: "Export failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── Save Export Metadata to Database (Optional) ────────────────────────────
async function saveExportRecord(data: {
  dealerId: string;
  fileName: string;
  fileUrl: string;
  orderCount: number;
}) {
  try {
    const { error } = await supabase.from("order_exports").insert([
      {
        dealer_id: data.dealerId,
        file_name: data.fileName,
        file_url: data.fileUrl,
        order_count: data.orderCount,
        exported_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("Failed to save export record:", error);
    }
  } catch (error) {
    console.warn("Error saving export record:", error);
  }
}

// ─── Download PDF directly (without Supabase) ────────────────────────────────
export async function downloadPDFDirectly(options: ExportOptions) {
  try {
    const pdfBlob = await generateOrdersPDF(options);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.fileName || `order-export-${moment().format("YYYY-MM-DD")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: "PDF downloaded successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: "Download failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
