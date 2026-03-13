import nodemailer from "nodemailer";

interface ShiftEmailWorker {
  id: string;
  name: string;
  email: string;
}

interface ShiftEmailPayload {
  id: string;
  date: string;
  dayOfWeek: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  worker: ShiftEmailWorker;
}

export interface ShiftEmailSendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId: string | null;
  errorMessage: string | null;
}

let transporter: nodemailer.Transporter | null = null;
let warnedMissingConfig = false;

function getEmailMode(): "smtp" | "console" | "off" {
  const mode = (process.env.SHIFT_EMAIL_MODE ?? "smtp").toLowerCase();
  if (mode === "off") {
    return "off";
  }
  if (mode === "console") {
    return "console";
  }
  return "smtp";
}

function getMissingSmtpKeys(): string[] {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  return required.filter((key) => !(process.env[key] ?? "").trim());
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

function buildTextBody(shift: ShiftEmailPayload): string {
  return [
    `Hello ${shift.worker.name},`,
    "",
    "Your shift starts in 1 hour.",
    `Date: ${shift.date} (${shift.dayOfWeek})`,
    `Location: ${shift.location || "Unassigned"}`,
    `Time: ${shift.startTime || "--:--"} - ${shift.endTime || "--:--"}`,
    "",
    "TyoTrack"
  ].join("\n");
}

export async function sendShiftReminderEmail(shift: ShiftEmailPayload): Promise<ShiftEmailSendResult> {
  const mode = getEmailMode();

  if (mode === "off") {
    return {
      status: "SKIPPED",
      providerMessageId: null,
      errorMessage: "SHIFT_EMAIL_MODE=off"
    };
  }

  if (!shift.worker.email) {
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: "Worker email is missing"
    };
  }

  if (mode === "console") {
    console.info(`[shift-email] ${shift.worker.email} :: ${shift.date} ${shift.startTime || "--:--"}-${shift.endTime || "--:--"}`);
    return {
      status: "SENT",
      providerMessageId: "console-mode",
      errorMessage: null
    };
  }

  const missing = getMissingSmtpKeys();
  if (missing.length) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(`[shift-email] SMTP is not fully configured. Missing: ${missing.join(", ")}`);
    }

    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: `SMTP misconfigured: missing ${missing.join(", ")}`
    };
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM,
      to: shift.worker.email,
      subject: `TyoTrack shift reminder - starts in 1 hour (${shift.date})`,
      text: buildTextBody(shift)
    });

    return {
      status: "SENT",
      providerMessageId: info.messageId ?? null,
      errorMessage: null
    };
  } catch (error: any) {
    return {
      status: "FAILED",
      providerMessageId: null,
      errorMessage: String(error?.message ?? error ?? "SMTP send failed")
    };
  }
}
