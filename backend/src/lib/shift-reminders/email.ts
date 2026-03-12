import nodemailer from "nodemailer";
import type { ShiftRecord } from "@/lib/shifts/service";

interface SendResult {
  status: "SENT" | "SKIPPED";
  providerMessageId: string | null;
  errorMessage: string | null;
}

let transporter: nodemailer.Transporter | null = null;

function getMode(): "console" | "smtp" {
  return process.env.SHIFT_EMAIL_MODE === "smtp" ? "smtp" : "console";
}

function isResendSmtp(): boolean {
  return (process.env.SMTP_HOST ?? "").toLowerCase().includes("resend.com");
}

function getFallbackFromAddress(): string {
  return process.env.SMTP_RESEND_FALLBACK_FROM || "onboarding@resend.dev";
}

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
  });

  return transporter;
}

async function sendWithFrom(shift: ShiftRecord, from: string, replyTo?: string): Promise<SendResult> {
  const info = await getTransporter().sendMail({
    from,
    replyTo,
    to: shift.worker.email,
    subject: `Upcoming shift in 1 hour - ${shift.date}`,
    text: [
      `Hello ${shift.worker.name},`,
      "",
      "Your shift starts in 1 hour.",
      `Date: ${shift.date} (${shift.dayOfWeek})`,
      `Location: ${shift.location || "Unassigned"}`,
      `Time: ${shift.startTime || "--:--"} - ${shift.endTime || "--:--"}`,
      "",
      "TyoTrack"
    ].join("\n")
  });

  return {
    status: "SENT",
    providerMessageId: info.messageId ?? null,
    errorMessage: null
  };
}

export async function sendShiftReminderEmail(shift: ShiftRecord): Promise<SendResult> {
  if (!shift.worker.email) {
    return { status: "SKIPPED", providerMessageId: null, errorMessage: "Employee email is missing" };
  }

  if (getMode() === "console") {
    console.log(`[shift-email] ${shift.worker.email} :: ${shift.date} ${shift.startTime}-${shift.endTime}`);
    return { status: "SENT", providerMessageId: "console-mode", errorMessage: null };
  }

  const from = process.env.SMTP_FROM;
  if (!from || !process.env.SMTP_HOST) {
    return { status: "SKIPPED", providerMessageId: null, errorMessage: "SMTP is not configured" };
  }

  try {
    return await sendWithFrom(shift, from);
  } catch (error: any) {
    const errorMessage = String(error?.message || error || "SMTP send failed");

    if (isResendSmtp() && from.toLowerCase() !== getFallbackFromAddress().toLowerCase()) {
      try {
        console.warn("[shift-email] primary SMTP_FROM failed; retrying with Resend fallback sender");
        return await sendWithFrom(shift, getFallbackFromAddress(), from);
      } catch (fallbackError: any) {
        const fallbackMessage = String(fallbackError?.message || fallbackError || "SMTP fallback failed");
        return {
          status: "SKIPPED",
          providerMessageId: null,
          errorMessage: `${errorMessage} | fallback: ${fallbackMessage}`
        };
      }
    }

    return {
      status: "SKIPPED",
      providerMessageId: null,
      errorMessage
    };
  }
}
