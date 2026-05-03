import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(request: Request) {
  await requireSuperAdmin();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "xlsx";

  const reservations = await prisma.reservation.findMany({
    orderBy: [{ reservationDate: "desc" }, { reservationTime: "desc" }, { createdAt: "desc" }],
    include: { user: true, confirmedBy: true },
  });

  const data = reservations.map((r) => ({
    ID: r.id,
    Fecha: r.reservationDate.toISOString().slice(0, 10),
    Hora: r.reservationTime,
    Cliente: r.user.name,
    Email: r.user.email,
    Teléfono: r.user.phone ?? "",
    Área: r.area ?? "Sin área",
    Personas: r.partySize,
    Estado: r.status,
    "Creado en": r.createdAt.toISOString(),
    "Confirmado por": r.confirmedBy?.email ?? "",
    Notas: r.notes ?? "",
  }));

  if (format === "json") {
    return NextResponse.json(data, {
      headers: { "Content-Disposition": 'attachment; filename="reservas.json"' },
    });
  }

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reservas");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="reservas.xlsx"',
      },
    });
  }

  if (format === "pdf") {
    const pdfDoc = await PDFDocument.create();
    
    // Embedded font - no external files needed
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Colors
    const primaryColor = rgb(0.102, 0.102, 0.18); // #1a1a2e
    const grayColor = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.97, 0.97, 0.97);
    const white = rgb(1, 1, 1);

    let y = height - 60;

    // Header
    page.drawText("TAURAS", {
      x: width / 2 - helveticaBold.widthOfTextAtSize("TAURAS", 22) / 2,
      y,
      size: 22,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 25;
    page.drawText("Restaurante & Bar", {
      x: width / 2 - helvetica.widthOfTextAtSize("Restaurante & Bar", 12) / 2,
      y,
      size: 12,
      font: helvetica,
      color: grayColor,
    });
    y -= 40;

    // Title
    page.drawText("REPORTE DE RESERVAS", {
      x: width / 2 - helveticaBold.widthOfTextAtSize("REPORTE DE RESERVAS", 16) / 2,
      y,
      size: 16,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 25;

    // Metadata
    const dateStr = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    page.drawText(`Fecha de emisión: ${dateStr}`, {
      x: width / 2 - helvetica.widthOfTextAtSize(`Fecha de emisión: ${dateStr}`, 10) / 2,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= 15;
    page.drawText(`Total de reservas registradas: ${reservations.length}`, {
      x: width / 2 - helvetica.widthOfTextAtSize(`Total de reservas registradas: ${reservations.length}`, 10) / 2,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= 30;

    // Divider line
    page.drawLine({
      start: { x: 40, y },
      end: { x: width - 40, y },
      thickness: 1,
      color: rgb(0.87, 0.87, 0.87),
    });
    y -= 20;

    // Summary section
    page.drawText("RESUMEN POR ESTADO", {
      x: 40,
      y,
      size: 11,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 18;

    const statusCounts = new Map<string, number>();
    for (const r of reservations) {
      statusCounts.set(r.status, (statusCounts.get(r.status) || 0) + 1);
    }

    const statusLabels: Record<string, string> = {
      PENDING: "Pendientes",
      CONFIRMED: "Confirmadas",
      REJECTED: "Rechazadas",
      CANCELLED: "Canceladas",
    };

    for (const [status, count] of statusCounts) {
      const label = statusLabels[status] || status;
      page.drawText(`• ${label}: ${count} reserva${count !== 1 ? "s" : ""}`, {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      y -= 14;
    }
    y -= 15;

    // Table header
    const colWidths = [60, 50, 90, 110, 40, 60];
    const headers = ["Fecha", "Hora", "Cliente", "Email", "Pax", "Estado"];
    const tableX = 40;
    const rowHeight = 16;

    // Header background
    page.drawRectangle({
      x: tableX,
      y: y - rowHeight + 4,
      width: width - 80,
      height: rowHeight,
      color: primaryColor,
    });

    // Header text
    let x = tableX + 5;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i], {
        x,
        y: y - rowHeight + 10,
        size: 9,
        font: helveticaBold,
        color: white,
      });
      x += colWidths[i];
    }
    y -= rowHeight;

    // Table rows
    const statusColors: Record<string, { r: number; g: number; b: number }> = {
      PENDING: { r: 0.96, g: 0.62, b: 0.04 },
      CONFIRMED: { r: 0.06, g: 0.73, b: 0.51 },
      REJECTED: { r: 0.94, g: 0.27, b: 0.27 },
      CANCELLED: { r: 0.42, g: 0.45, b: 0.5 },
    };

    for (let i = 0; i < data.length; i++) {
      if (y < 60) {
        page.drawText("Continúa en siguiente página...", {
          x: width / 2 - helvetica.widthOfTextAtSize("Continúa en siguiente página...", 10) / 2,
          y: 30,
          size: 10,
          font: helvetica,
          color: grayColor,
        });
        break;
      }

      const row = data[i];
      const bgColor = i % 2 === 0 ? lightGray : white;
      page.drawRectangle({
        x: tableX,
        y: y - rowHeight + 4,
        width: width - 80,
        height: rowHeight,
        color: bgColor,
      });

      x = tableX + 5;
      const statusColor = statusColors[row.Estado] || { r: 0.3, g: 0.3, b: 0.3 };
      const cols = [row.Fecha, row.Hora, row.Cliente.substring(0, 12), row.Email.substring(0, 18), String(row.Personas), statusLabels[row.Estado] || row.Estado];
      
      for (let j = 0; j < cols.length; j++) {
        const colColor = j === cols.length - 1 ? rgb(statusColor.r, statusColor.g, statusColor.b) : grayColor;
        page.drawText(cols[j], {
          x,
          y: y - rowHeight + 10,
          size: 8,
          font: helvetica,
          color: colColor,
        });
        x += colWidths[j];
      }
      y -= rowHeight;
    }

    // Footer
    page.drawText("Este reporte fue generado automáticamente por el sistema de reservas Tauras.", {
      x: width / 2 - helvetica.widthOfTextAtSize("Este reporte fue generado automáticamente por el sistema de reservas Tauras.", 8) / 2,
      y: 30,
      size: 8,
      font: helvetica,
      color: rgb(0.53, 0.53, 0.53),
    });

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reservas-tauras-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  }

  return new NextResponse("Formato no válido", { status: 400 });
}