import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

function formatDate(value: Date): string {
  return value.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitTextByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

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
    Fecha: formatDate(r.reservationDate),
    Hora: r.reservationTime,
    Cliente: r.user.name,
    Email: r.user.email,
    Teléfono: r.user.phone ?? "",
    Área: r.area ?? "Sin área",
    Personas: r.partySize,
    Estado: r.status,
    "Creada en": formatDateTime(r.createdAt),
    "Actualizada en": formatDateTime(r.updatedAt),
    "Confirmada en": formatDateTime(r.confirmedAt),
    "Rechazada en": formatDateTime(r.rejectedAt),
    "Cancelada en": formatDateTime(r.cancelledAt),
    "Confirmado por": r.confirmedBy ? `${r.confirmedBy.name} <${r.confirmedBy.email}>` : "",
    "Error email": r.emailError ?? "",
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

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Colors
    const primaryColor = rgb(0.102, 0.102, 0.18); // #1a1a2e
    const grayColor = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.97, 0.97, 0.97);
    const borderColor = rgb(0.88, 0.72, 0.08);

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

    const statusColors: Record<string, { r: number; g: number; b: number }> = {
      PENDING: { r: 0.96, g: 0.62, b: 0.04 },
      CONFIRMED: { r: 0.06, g: 0.73, b: 0.51 },
      REJECTED: { r: 0.94, g: 0.27, b: 0.27 },
      CANCELLED: { r: 0.42, g: 0.45, b: 0.5 },
    };

    const ensureSpace = (neededHeight: number) => {
      if (y - neededHeight < 70) {
        page.drawText("Continúa en la siguiente página...", {
          x: width / 2 - helvetica.widthOfTextAtSize("Continúa en la siguiente página...", 9) / 2,
          y: 35,
          size: 9,
          font: helvetica,
          color: grayColor,
        });
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
    };

    const drawField = (label: string, value: string, x: number, fieldY: number, maxChars = 44) => {
      page.drawText(label.toUpperCase(), {
        x,
        y: fieldY,
        size: 7,
        font: helveticaBold,
        color: rgb(0.45, 0.45, 0.45),
      });

      const lines = splitTextByLength(value || "-", maxChars);
      let lineY = fieldY - 11;
      for (const line of lines) {
        page.drawText(line, {
          x,
          y: lineY,
          size: 9,
          font: helvetica,
          color: grayColor,
        });
        lineY -= 11;
      }
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const notesLines = splitTextByLength(row.Notas || "-", 95);
      const emailErrorLines = splitTextByLength(row["Error email"] || "-", 95);
      const dynamicHeight = 170 + (notesLines.length * 11) + (emailErrorLines.length > 1 ? emailErrorLines.length * 11 : 0);

      ensureSpace(dynamicHeight);

      const statusColor = statusColors[row.Estado] || { r: 0.3, g: 0.3, b: 0.3 };

      page.drawRectangle({
        x: 40,
        y: y - dynamicHeight + 10,
        width: width - 80,
        height: dynamicHeight,
        color: lightGray,
        borderColor,
        borderWidth: 0.75,
      });

      page.drawText(`Reserva #${i + 1}`, {
        x: 55,
        y: y - 15,
        size: 12,
        font: helveticaBold,
        color: primaryColor,
      });

      page.drawText(statusLabels[row.Estado] || row.Estado, {
        x: width - 160,
        y: y - 15,
        size: 11,
        font: helveticaBold,
        color: rgb(statusColor.r, statusColor.g, statusColor.b),
      });

      const leftX = 55;
      const rightX = 300;
      let fieldY = y - 38;

      drawField("Cliente", row.Cliente, leftX, fieldY, 40);
      drawField("Email", row.Email, rightX, fieldY, 42);
      fieldY -= 34;

      drawField("Teléfono", row.Teléfono || "-", leftX, fieldY, 40);
      drawField("Personas", String(row.Personas), rightX, fieldY, 42);
      fieldY -= 34;

      drawField("Fecha", row.Fecha, leftX, fieldY, 40);
      drawField("Hora", row.Hora, rightX, fieldY, 42);
      fieldY -= 34;

      drawField("Área", row.Área, leftX, fieldY, 40);
      drawField("Creada en", row["Creada en"], rightX, fieldY, 42);
      fieldY -= 34;

      drawField("Confirmado por", row["Confirmado por"] || "-", leftX, fieldY, 95);
      fieldY -= 34;

      const movementInfo = [
        row["Confirmada en"] !== "-" ? `Confirmada: ${row["Confirmada en"]}` : null,
        row["Rechazada en"] !== "-" ? `Rechazada: ${row["Rechazada en"]}` : null,
        row["Cancelada en"] !== "-" ? `Cancelada: ${row["Cancelada en"]}` : null,
      ].filter(Boolean).join(" | ") || "-";

      drawField("Movimientos", movementInfo, leftX, fieldY, 95);
      fieldY -= 34;

      page.drawText("NOTAS", {
        x: leftX,
        y: fieldY,
        size: 7,
        font: helveticaBold,
        color: rgb(0.45, 0.45, 0.45),
      });
      fieldY -= 11;
      for (const line of notesLines) {
        page.drawText(line, {
          x: leftX,
          y: fieldY,
          size: 9,
          font: helvetica,
          color: grayColor,
        });
        fieldY -= 11;
      }

      if (row["Error email"]) {
        fieldY -= 5;
        page.drawText("ERROR DE EMAIL", {
          x: leftX,
          y: fieldY,
          size: 7,
          font: helveticaBold,
          color: rgb(0.9, 0.2, 0.2),
        });
        fieldY -= 11;
        for (const line of emailErrorLines) {
          page.drawText(line, {
            x: leftX,
            y: fieldY,
            size: 9,
            font: helvetica,
            color: rgb(0.65, 0.15, 0.15),
          });
          fieldY -= 11;
        }
      }

      y -= dynamicHeight + 16;
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
