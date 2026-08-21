"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export type FeedbackState = { status: "idle" | "error" | "sent"; message?: string };

const KATEGORIEN = new Set(["punkte", "bug", "idee", "sonstiges"]);

const KATEGORIE_LABEL: Record<string, string> = {
  punkte: "Punkteverteilung",
  bug: "Fehler",
  idee: "Idee",
  sonstiges: "Sonstiges",
};

/**
 * Versucht den Mailversand und sagt, was dabei herauskam.
 *
 * Bewusst als eigene Funktion, die nie wirft: der Rueckgabewert ist eine
 * kurze Statuszeile, die an der Feedback-Zeile landet. Ein stilles
 * try/catch war hier ein Fehler -- wenn keine Mail ankommt, muss
 * nachvollziehbar sein warum, sonst bleibt nur Raten zwischen fehlendem
 * Schluessel, nicht verifiziertem Absender und Netzproblem.
 */
async function sendeMail(opts: {
  wer: string;
  category: string;
  message: string;
}): Promise<string> {
  const apiKey = process.env.BREVO_API_KEY;
  const to = process.env.FEEDBACK_EMAIL;
  // Empfaenger und Absender sind getrennt: empfangen kann jede Adresse,
  // aber ABSENDEN darf nur eine, die in Brevo verifiziert ist. Ohne
  // eigene Angabe wird der Empfaenger auch als Absender versucht.
  const from = process.env.FEEDBACK_SENDER || to;

  if (!apiKey) return "kein BREVO_API_KEY gesetzt";
  if (!to) return "kein FEEDBACK_EMAIL gesetzt";

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Pace or Pay", email: from },
        to: [{ email: to }],
        replyTo: { email: from! },
        subject: `[Pace or Pay] ${KATEGORIE_LABEL[opts.category]} — von ${opts.wer}`,
        textContent:
          `Kategorie: ${KATEGORIE_LABEL[opts.category]}\n` +
          `Von: ${opts.wer}\n\n${opts.message}`,
      }),
    });

    if (res.ok) return "gesendet";

    // Brevos Fehlertext ist brauchbar ("sender not valid", "unauthorized")
    // und gehoert deshalb ungekuerzt in die Zeile.
    const body = await res.text().catch(() => "");
    return `Brevo ${res.status}: ${body.slice(0, 300)}`;
  } catch (e) {
    return `Netzfehler: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/**
 * Anzeigename fuer die Betreffzeile. Darf nie werfen -- ein fehlender
 * Name ist kein Grund, die Mail nicht zu schicken.
 */
async function ermittleNamen(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: me } = await supabase
      .from("members")
      .select("display_name")
      .eq("user_id", user!.id)
      .limit(1)
      .maybeSingle();
    return me?.display_name ?? user?.email ?? "Unbekannt";
  } catch {
    return "Unbekannt";
  }
}

/**
 * Feedback entgegennehmen: zuerst in die Datenbank (verlustsicher), dann
 * per Brevo an den Betreiber mailen.
 *
 * Die Reihenfolge ist Absicht: die Mail ist Komfort, die Datenbank die
 * Wahrheit. Schlaegt der Versand fehl, bekommt die Person trotzdem ein
 * "Danke" -- ihr Anliegen ist ja angekommen. Der Grund des Fehlschlags
 * steht in feedback.email_status.
 */
export async function submitFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const category = String(formData.get("category") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (!KATEGORIEN.has(category)) {
    return { status: "error", message: "Bitte eine Kategorie wählen." };
  }
  if (message.length < 3) {
    return { status: "error", message: "Bitte etwas mehr schreiben." };
  }
  if (message.length > 2000) {
    return { status: "error", message: "Maximal 2000 Zeichen." };
  }

  const supabase = await createClient();
  const { data: feedbackId, error } = await supabase.rpc("submit_feedback", {
    p_category: category,
    p_message: message,
  });
  if (error) return { status: "error", message: error.message };

  // Ab hier ist das Feedback gesichert -- der Mailversand darf scheitern,
  // ohne die Antwort an die Person zu veraendern.
  //
  // Reihenfolge mit Absicht: erst mailen, dann buchhalten. Vorher hing der
  // Versand am Admin-Client (fuer den Anzeigenamen); fehlt dessen
  // Schluessel oder wirft er, faellt der ganze Block in den catch und es
  // wird nie auch nur versucht zu senden -- ein Fehler, der wie ein
  // Brevo-Problem aussieht, aber keines ist.
  const wer = await ermittleNamen(supabase);
  const status = await sendeMail({ wer, category, message });
  if (status !== "gesendet") {
    // Zusaetzlich in die Vercel-Logs, damit es auch ohne Blick in die
    // Datenbank auffaellt.
    console.error("[feedback] Mailversand fehlgeschlagen:", status);
  }

  try {
    if (feedbackId) {
      const admin = createAdminClient();
      await admin
        .from("feedback")
        .update({
          email_status: status,
          emailed_at: status === "gesendet" ? new Date().toISOString() : null,
        })
        .eq("id", feedbackId);
    }
  } catch (e) {
    console.error("[feedback] Status konnte nicht notiert werden:", e);
  }

  return { status: "sent" };
}
