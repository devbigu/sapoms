import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";

function toDto(row: { id: bigint; title: string | null; imageUrl: string; position: number; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id.toString(),
    title: row.title,
    imageUrl: row.imageUrl,
    image_url: row.imageUrl,
    position: row.position,
    isActive: row.isActive,
    is_active: row.isActive,
    createdAt: row.createdAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const rows = await prisma.sliderImage.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ success: true, data: rows.map(toDto) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/slider]", error);
    return NextResponse.json({ success: false, message: "Unable to load slider images" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}