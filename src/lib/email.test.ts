import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  getEnv: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("node:fs", () => ({ existsSync: mocks.existsSync }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
  createTransport: mocks.createTransport,
}));

vi.mock("@/lib/env", () => ({ getEnv: mocks.getEnv }));

interface CapturedMail {
  from?: string;
  to?: string;
  subject?: string;
  html?: string;
  attachments?: unknown;
}

function lastSentMail(): CapturedMail {
  const call = mocks.sendMail.mock.calls.at(-1);
  expect(call, "expected at least one sendMail call").toBeDefined();
  return call![0] as CapturedMail;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.existsSync.mockReturnValue(false);
  mocks.sendMail.mockResolvedValue(undefined);
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.getEnv.mockReturnValue({
    SMTP_HOST: "smtp.test",
    SMTP_PORT: 587,
    SMTP_USER: "u",
    SMTP_PASSWORD: "p",
    SMTP_FROM: "from@tauras.test",
  });
});

const FIXED_DATE = new Date("2026-12-25T18:00:00Z");

const EMAIL_LOCATION = {
  reservationLabel: "TAURAS Steakhouse",
  address: "Calle 123",
  phone: "+57 300 123 4567",
  whatsappUrl: "https://wa.me/573001234567",
};

describe("sendReservationConfirmationEmail", () => {
  it("renders Spanish copy when language is 'es'", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "cliente@tauras.test",
      name: "Cliente Tauras",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "es",
    });

    const mail = lastSentMail();
    expect(mail.subject).toBe("Tu reserva en TAURAS ha sido confirmada");
    const html = mail.html ?? "";
    expect(html).toContain("¡Tu reserva ha sido confirmada!");
    expect(html).toContain("Hola <strong>");
    expect(html).toContain("<strong>confirmada exitosamente</strong>");
    expect(html).toContain("Fecha");
    expect(html).toContain("Hora");
    expect(html).toContain("Sede");
    expect(html).toContain("TAURAS Steakhouse");
    expect(html).toContain("Calle 123");
    expect(html).toContain("¿Necesitas ayuda con tu reserva?");
    expect(html).toContain("Escribir por WhatsApp");
    expect(html).toContain("+57 300 123 4567");
    expect(html).toContain('href="https://wa.me/573001234567"');
    expect(html).not.toContain(">https://wa.me/573001234567<");
    expect(html).toContain("Sector");
    expect(html).toContain("Confirmado por");
    expect(html).toContain("Todos los derechos reservados.");

    // No EN copy must leak in
    expect(html).not.toContain("Hello ");
    // Avoid colliding with "Date" appearing as substring of any ES text — ES has no "Date" label
    expect(html).not.toContain(">Date<");
    expect(html).not.toContain("All rights reserved");
  });

  it("renders English copy when language is 'en'", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "client@tauras.test",
      name: "John Doe",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "en",
    });

    const mail = lastSentMail();
    expect(mail.subject).toBe("Your TAURAS reservation has been confirmed");
    const html = mail.html ?? "";
    expect(html).toContain("Your reservation is confirmed!");
    expect(html).toContain("Hello <strong>");
    expect(html).toContain("<strong>successfully confirmed</strong>");
    expect(html).toContain("Date");
    expect(html).toContain("Time");
    expect(html).toContain("Location");
    expect(html).toContain("Area");
    expect(html).toContain("Need help with your reservation?");
    expect(html).toContain("Message us on WhatsApp");
    expect(html).toContain("Confirmed by");
    expect(html).toContain("All rights reserved.");

    // No ES copy must leak in
    expect(html).not.toContain("Fecha");
    expect(html).not.toContain("Hora");
    expect(html).not.toContain("Sector");
    expect(html).not.toContain("Hola ");
    expect(html).not.toContain("Todos los derechos");
  });

  it("escapes HTML in the customer name (XSS smoke)", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "client@tauras.test",
      name: '<script>alert("xss")</script>',
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "en",
    });

    const html = lastSentMail().html ?? "";
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("embeds the uploaded area photo as a CID attachment when the uploaded file exists", async () => {
    mocks.existsSync.mockReturnValue(true);
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "cliente@tauras.test",
      name: "Cliente Tauras",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Terraza",
      areaImagePath: "/uploads/zones/tauras-default/terraza.jpg",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "es",
    });

    const mail = lastSentMail();
    const html = mail.html ?? "";
    expect(html).toContain('src="cid:reservation-area"');
    expect(html).toContain("Sector reservado en TAURAS");
    expect(mail.attachments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: "terraza.jpg",
        cid: "reservation-area",
      }),
    ]));
  });

  it("does not render uploaded area photos from unsafe or missing relative paths", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "cliente@tauras.test",
      name: "Cliente Tauras",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Terraza",
      areaImagePath: "/admin/secret.jpg",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "es",
    });

    const mail = lastSentMail();
    expect(mail.html ?? "").not.toContain("cid:reservation-area");
    expect(mail.attachments).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ cid: "reservation-area" }),
    ]));
  });

  it("escapes HTML in the area / sector value", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "client@tauras.test",
      name: "Cliente",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: '<img src=x onerror="alert(1)">',
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "es",
    });

    const html = lastSentMail().html ?? "";
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  });

  it("escapes HTML in confirmedByName and confirmedByEmail", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");
    await sendReservationConfirmationEmail({
      to: "client@tauras.test",
      name: "Cliente",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      confirmedByName: '<script>alert("name")</script>',
      confirmedByEmail: '"><img src=x>',
      language: "es",
    });

    const html = lastSentMail().html ?? "";
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;&gt;&lt;img");
    expect(html).not.toContain('<script>alert("name")</script>');
    expect(html).not.toContain('"><img src=x>');
  });

  it("falls back to localized 'area to be assigned' when area is null", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");

    await sendReservationConfirmationEmail({
      to: "cliente@tauras.test",
      name: "Cliente",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: null,
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "es",
    });
    expect(lastSentMail().html ?? "").toContain("A designar");

    await sendReservationConfirmationEmail({
      to: "client@tauras.test",
      name: "Client",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: null,
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "en",
    });
    expect(lastSentMail().html ?? "").toContain("To be assigned");
  });

  it("appends the ' h' suffix in Spanish but not in English", async () => {
    const { sendReservationConfirmationEmail } = await import("@/lib/email");

    await sendReservationConfirmationEmail({
      to: "cliente@tauras.test",
      name: "Cliente",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "es",
    });
    expect(lastSentMail().html ?? "").toContain("20:00 h");

    await sendReservationConfirmationEmail({
      to: "client@tauras.test",
      name: "Client",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      confirmedByName: "Admin",
      confirmedByEmail: "admin@tauras.test",
      language: "en",
    });
    const enHtml = lastSentMail().html ?? "";
    expect(enHtml).toContain("20:00");
    expect(enHtml).not.toContain("20:00 h");
  });

  it("formats the date with the language-specific locale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T00:00:00Z"));
    try {
      const { sendReservationConfirmationEmail } = await import("@/lib/email");
      const knownDate = new Date("2026-12-25T18:00:00Z");

      await sendReservationConfirmationEmail({
        to: "cliente@tauras.test",
        name: "Cliente",
        reservationDate: knownDate,
        reservationTime: "20:00",
        area: "Patio",
        location: EMAIL_LOCATION,
        confirmedByName: "Admin",
        confirmedByEmail: "admin@tauras.test",
        language: "es",
      });
      const esHtml = lastSentMail().html ?? "";
      // Lenient: el spelling exacto (con/sin acento, con/sin "de") puede variar
      // según el ICU del runner. Lo estable es la base léxica.
      expect(esHtml).toMatch(/viernes|diciembre/i);

      await sendReservationConfirmationEmail({
        to: "client@tauras.test",
        name: "Client",
        reservationDate: knownDate,
        reservationTime: "20:00",
        area: "Patio",
        location: EMAIL_LOCATION,
        confirmedByName: "Admin",
        confirmedByEmail: "admin@tauras.test",
        language: "en",
      });
      const enHtml = lastSentMail().html ?? "";
      expect(enHtml).toMatch(/December|Friday/i);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("sendReservationRejectionEmail", () => {
  it("escapes HTML in the staff-supplied reason", async () => {
    const { sendReservationRejectionEmail } = await import("@/lib/email");
    await sendReservationRejectionEmail({
      to: "client@tauras.test",
      name: "Cliente",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      reason: '<script>alert("reason")</script>',
      language: "es",
    });

    const html = lastSentMail().html ?? "";
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert("reason")</script>');
  });

  it("uses English chrome but does NOT translate the staff-supplied reason", async () => {
    const { sendReservationRejectionEmail } = await import("@/lib/email");
    await sendReservationRejectionEmail({
      to: "client@tauras.test",
      name: "Client",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      reason: "El restaurante está cerrado por feriado",
      language: "en",
    });

    const mail = lastSentMail();
    expect(mail.subject).toBe("Your reservation request at TAURAS");
    const html = mail.html ?? "";
    // Localized chrome
    expect(html).toContain("Reason");
    expect(html).toContain("<strong>could not be confirmed</strong>");
    // Staff text passes through verbatim (not translated)
    expect(html).toContain("El restaurante está cerrado por feriado");
  });
});

describe("sendReservationCancellationEmail", () => {
  it("renders Spanish cancellation copy", async () => {
    const { sendReservationCancellationEmail } = await import("@/lib/email");
    await sendReservationCancellationEmail({
      to: "cliente@tauras.test",
      name: "Cliente",
      reservationDate: FIXED_DATE,
      reservationTime: "20:00",
      area: "Patio",
      location: EMAIL_LOCATION,
      language: "es",
    });

    const mail = lastSentMail();
    expect(mail.subject).toBe("Tu reserva en TAURAS ha sido cancelada");
    expect(mail.html ?? "").toContain("<strong>cancelada</strong>");
  });
});

afterEach(() => {
  vi.useRealTimers();
});
