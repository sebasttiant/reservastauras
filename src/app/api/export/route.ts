import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireSuperAdmin } from "@/lib/auth";
import { AUDIT_EVENT, recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { wrapText } from "@/lib/pdf/wrap";
import {
  EXPORT_DEFAULT_LIMIT,
  buildReservationWhere,
  parseExportFilters,
} from "@/lib/reservations/export-filters";
import { getRequestSecurityContext } from "@/lib/security/request";
import ExcelJS from "exceljs";
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

function formatReservationSource(source: string): string {
  const labels: Record<string, string> = {
    web: "Web",
    whatsapp: "WhatsApp",
    llamada: "Llamada",
    instagram: "Instagram",
    facebook: "Facebook",
    crm: "CRM",
    presencial: "Presencial",
    otro: "Otro",
  };

  return labels[source] ?? source;
}

export async function GET(request: Request) {
  const admin = await requireSuperAdmin();

  const { searchParams } = new URL(request.url);
  const parsed = parseExportFilters(searchParams);
  if (!parsed.ok || !parsed.data) {
    return new NextResponse(parsed.error ?? "Filtros inválidos", { status: 400 });
  }
  const filters = parsed.data;
  const format = filters.format;
  const effectiveLimit = filters.limit ?? EXPORT_DEFAULT_LIMIT;

  // Pedimos `effectiveLimit + 1` para detectar si la consulta supera el tope
  // sin pagar un `count()` aparte. Si lo supera, devolvemos 413 con un mensaje
  // accionable (el cliente tiene que filtrar por fecha/estado o subir `limit`).
  const reservations = await prisma.reservation.findMany({
    where: buildReservationWhere(filters),
    orderBy: [{ reservationDate: "desc" }, { reservationTime: "desc" }, { createdAt: "desc" }],
    include: { user: true, confirmedBy: true, createdByAdmin: true },
    take: effectiveLimit + 1,
  });

  if (reservations.length > effectiveLimit) {
    await recordAuditLog({
      event: AUDIT_EVENT.RESERVATIONS_EXPORTED,
      actor: admin,
      request: getRequestSecurityContext(request.headers),
      resourceType: "RESERVATION_EXPORT",
      metadata: {
        format,
        count: reservations.length,
        blocked: true,
        reason: "limit-exceeded",
        filters: {
          from: filters.from?.toISOString().slice(0, 10),
          to: filters.to?.toISOString().slice(0, 10),
          status: filters.status,
          limit: effectiveLimit,
        },
      },
    });

    return new NextResponse(
      `Demasiadas reservas para exportar (más de ${effectiveLimit}). Filtrá por fecha/estado o subí el parámetro 'limit'.`,
      { status: 413 },
    );
  }

  const data = reservations.map((r) => ({
    ID: r.id,
    Fecha: formatDate(r.reservationDate),
    Hora: r.reservationTime,
    Cliente: r.user.name,
    Email: r.user.email,
    Teléfono: r.user.phone ?? "",
    Área: r.area ?? "Sin área",
    Origen: formatReservationSource(r.source),
    Personas: r.partySize,
    Estado: r.status,
    "Creada en": formatDateTime(r.createdAt),
    "Cargada por": r.createdByAdmin ? `${r.createdByAdmin.name} <${r.createdByAdmin.email}>` : "Web / cliente",
    "Actualizada en": formatDateTime(r.updatedAt),
    "Confirmada en": formatDateTime(r.confirmedAt),
    "Rechazada en": formatDateTime(r.rejectedAt),
    "Cancelada en": formatDateTime(r.cancelledAt),
    "Confirmado por": r.confirmedBy ? `${r.confirmedBy.name} <${r.confirmedBy.email}>` : "",
    "Error email": r.emailError ?? "",
    Notas: r.notes ?? "",
  }));

  await recordAuditLog({
    event: AUDIT_EVENT.RESERVATIONS_EXPORTED,
    actor: admin,
    request: getRequestSecurityContext(request.headers),
    resourceType: "RESERVATION_EXPORT",
    metadata: {
      format,
      count: reservations.length,
      filters: {
        from: filters.from?.toISOString().slice(0, 10),
        to: filters.to?.toISOString().slice(0, 10),
        status: filters.status,
        limit: effectiveLimit,
      },
    },
  });

  if (format === "json") {
    return NextResponse.json(data, {
      headers: { "Content-Disposition": 'attachment; filename="reservas.json"' },
    });
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reservas");
    worksheet.columns = Object.keys(data[0] ?? {}).map((key) => ({ header: key, key }));
    worksheet.addRows(data);
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="reservas.xlsx"',
      },
    });
  }

  if (format === "pdf") {
    const pdfDoc = await PDFDocument.create();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Logo embebido. Si no se puede leer (deploy roto, permisos), seguimos
    // sin él en lugar de romper la export — un PDF sin logo es preferible a
    // una export que devuelve 500.
    let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "tauras.png");
      const logoBytes = await readFile(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {
      logoImage = null;
    }

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const primaryColor = rgb(0.102, 0.102, 0.18); // #1a1a2e
    const grayColor = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.97, 0.97, 0.97);
    const borderColor = rgb(0.88, 0.72, 0.08);

    let y = height - 50;

    // Header tipo letterhead: nombre alineado a la izquierda, logo a la
    // derecha, ambos centrados verticalmente en la banda. Antes el logo iba
    // centrado encima del texto y duplicaba la marca con el "TAURAS" de abajo.
    const titleSize = 22;
    const subtitleSize = 11;
    const titleGap = 6;
    const titleBlockH = titleSize + titleGap + subtitleSize;

    let logoTargetHeight = 0;
    let logoTargetWidth = 0;
    if (logoImage) {
      logoTargetWidth = 70;
      const logoScale = logoTargetWidth / logoImage.width;
      logoTargetHeight = logoImage.height * logoScale;
    }

    const headerH = Math.max(logoTargetHeight, titleBlockH);
    const sideMargin = 50;
    const titleTop = y - (headerH - titleBlockH) / 2;

    page.drawText("TAURAS", {
      x: sideMargin,
      y: titleTop - titleSize,
      size: titleSize,
      font: helveticaBold,
      color: primaryColor,
    });
    page.drawText("Restaurante & Bar", {
      x: sideMargin,
      y: titleTop - titleSize - titleGap - subtitleSize,
      size: subtitleSize,
      font: helvetica,
      color: grayColor,
    });

    if (logoImage) {
      const logoTop = y - (headerH - logoTargetHeight) / 2;
      page.drawImage(logoImage, {
        x: width - sideMargin - logoTargetWidth,
        y: logoTop - logoTargetHeight,
        width: logoTargetWidth,
        height: logoTargetHeight,
      });
    }

    y -= headerH + 24;

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

    // Layout constants. Cada row de campo ocupa: label(11) + lines*lineH + gapEntreRows(12).
    const labelH = 11;
    const lineH = 11;
    const rowGap = 12;
    const rowSpace = (maxLines: number) => labelH + Math.max(maxLines, 1) * lineH + rowGap;

    const drawField = (label: string, value: string, x: number, fieldY: number, maxChars: number): number => {
      const lines = wrapText(value || "-", maxChars);
      page.drawText(label.toUpperCase(), {
        x,
        y: fieldY,
        size: 7,
        font: helveticaBold,
        color: rgb(0.45, 0.45, 0.45),
      });
      let lineY = fieldY - labelH;
      for (const line of lines) {
        page.drawText(line, { x, y: lineY, size: 9, font: helvetica, color: grayColor });
        lineY -= lineH;
      }
      return lines.length;
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      const movementInfo = [
        row["Confirmada en"] !== "-" ? `Confirmada: ${row["Confirmada en"]}` : null,
        row["Rechazada en"] !== "-" ? `Rechazada: ${row["Rechazada en"]}` : null,
        row["Cancelada en"] !== "-" ? `Cancelada: ${row["Cancelada en"]}` : null,
      ].filter(Boolean).join(" | ") || "-";

      // Pre-calcular líneas reales de cada campo: la altura del card depende
      // de wrap + saltos explícitos (\n en notes), no de un valor fijo.
      const linesCliente = wrapText(row.Cliente, 40).length;
      const linesEmail = wrapText(row.Email, 42).length;
      const linesTel = wrapText(row.Teléfono || "-", 40).length;
      const linesPersonas = 1;
      const linesFecha = 1;
      const linesHora = 1;
      const linesArea = wrapText(row.Área, 40).length;
      const linesOrigen = wrapText(row.Origen, 42).length;
      const linesCreada = 1;
      const linesCargadaPor = wrapText(row["Cargada por"] || "-", 42).length;
      const linesConfirmado = wrapText(row["Confirmado por"] || "-", 95).length;
      const linesMov = wrapText(movementInfo, 95).length;
      const notesLines = wrapText(row.Notas || "-", 95);
      const emailErrorLines = row["Error email"] ? wrapText(row["Error email"], 95) : [];

      const headerH = 28;
      const pairsH =
        rowSpace(Math.max(linesCliente, linesEmail)) +
        rowSpace(Math.max(linesTel, linesPersonas)) +
        rowSpace(Math.max(linesFecha, linesHora)) +
        rowSpace(Math.max(linesArea, linesOrigen)) +
        rowSpace(Math.max(linesCreada, linesCargadaPor));
      const confirmedH = rowSpace(linesConfirmado);
      const movementsH = rowSpace(linesMov);
      const notesH = labelH + notesLines.length * lineH;
      const errorH = emailErrorLines.length > 0 ? 6 + labelH + emailErrorLines.length * lineH : 0;
      const bottomPad = 14;
      const dynamicHeight = headerH + pairsH + confirmedH + movementsH + notesH + errorH + bottomPad;

      ensureSpace(dynamicHeight);

      const statusColor = statusColors[row.Estado] || { r: 0.3, g: 0.3, b: 0.3 };

      page.drawRectangle({
        x: 40,
        y: y - dynamicHeight,
        width: width - 80,
        height: dynamicHeight,
        color: lightGray,
        borderColor,
        borderWidth: 0.75,
      });

      page.drawText(`Reserva #${i + 1}`, {
        x: 55,
        y: y - 18,
        size: 12,
        font: helveticaBold,
        color: primaryColor,
      });

      const statusLabel = statusLabels[row.Estado] || row.Estado;
      const statusWidth = helveticaBold.widthOfTextAtSize(statusLabel, 11);
      page.drawText(statusLabel, {
        x: width - 55 - statusWidth,
        y: y - 18,
        size: 11,
        font: helveticaBold,
        color: rgb(statusColor.r, statusColor.g, statusColor.b),
      });

      const leftX = 55;
      const rightX = 300;
      let fieldY = y - headerH - 10;

      const drawPair = (
        l: { label: string; value: string; max: number },
        r: { label: string; value: string; max: number },
      ) => {
        const linesL = drawField(l.label, l.value, leftX, fieldY, l.max);
        const linesR = drawField(r.label, r.value, rightX, fieldY, r.max);
        fieldY -= rowSpace(Math.max(linesL, linesR));
      };

      drawPair(
        { label: "Cliente", value: row.Cliente, max: 40 },
        { label: "Email", value: row.Email, max: 42 },
      );
      drawPair(
        { label: "Teléfono", value: row.Teléfono || "-", max: 40 },
        { label: "Personas", value: String(row.Personas), max: 42 },
      );
      drawPair(
        { label: "Fecha", value: row.Fecha, max: 40 },
        { label: "Hora", value: row.Hora, max: 42 },
      );
      drawPair(
        { label: "Área", value: row.Área, max: 40 },
        { label: "Origen", value: row.Origen, max: 42 },
      );
      drawPair(
        { label: "Creada en", value: row["Creada en"], max: 40 },
        { label: "Cargada por", value: row["Cargada por"] || "-", max: 42 },
      );

      const linesC = drawField("Confirmado por", row["Confirmado por"] || "-", leftX, fieldY, 95);
      fieldY -= rowSpace(linesC);

      const linesM = drawField("Movimientos", movementInfo, leftX, fieldY, 95);
      fieldY -= rowSpace(linesM);

      page.drawText("NOTAS", {
        x: leftX,
        y: fieldY,
        size: 7,
        font: helveticaBold,
        color: rgb(0.45, 0.45, 0.45),
      });
      fieldY -= labelH;
      for (const line of notesLines) {
        page.drawText(line, { x: leftX, y: fieldY, size: 9, font: helvetica, color: grayColor });
        fieldY -= lineH;
      }

      if (emailErrorLines.length > 0) {
        fieldY -= 6;
        page.drawText("ERROR DE EMAIL", {
          x: leftX,
          y: fieldY,
          size: 7,
          font: helveticaBold,
          color: rgb(0.9, 0.2, 0.2),
        });
        fieldY -= labelH;
        for (const line of emailErrorLines) {
          page.drawText(line, {
            x: leftX,
            y: fieldY,
            size: 9,
            font: helvetica,
            color: rgb(0.65, 0.15, 0.15),
          });
          fieldY -= lineH;
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
