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
 * Feedback entgegennehmen: zuerst in die Datenbank (verlustsicher), dann
 * per Brevo an den Betreiber mailen.
 *
 * Die Reihenfolge ist Absicht: die Mail ist Komfort, die Datenbank die
 * Wahrheit. Schlaegt der Versand fehl -- Schluessel fehlt, Brevo down --
 * bekommt die Person trotzdem ein "Danke" und nichts geht verloren; die
 * Zeile hat dann einfach kein emailed_at.
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
  const { error } = await supabase.rpc("submit_feedback", {
    p_category: category,
    p_message: message,
  });
  if (error) return { status: "error", message: error.message };

  // Ab hier ist das Feedback gesichert -- der Mail-Versand darf scheitern.
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const to = process.env.FEEDBACK_EMAIL;
    // Empfaenger und Absender sind getrennt: empfangen kann jede Adresse,
    // aber ABSENDEN darf nur eine, die in Brevo verifiziert ist. Ohne
    // eigene Angabe wird der Empfaenger auch als Absender versucht.
    const from = process.env.FEEDBACK_SENDER ?? to;
    if (apiKey && to) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const admin = createAdminClient();
      const { data: me } = await admin
        .from("members")
        .select("display_name")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      const wer = me?.display_name ?? user?.email ?? "Unbekannt";

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Pace or Pay", email: from },
          to: [{ email: to }],
          subject: `[Pace or Pay] ${KATEGORIE_LABEL[category]} — von ${wer}`,
          textContent: `Kategorie: ${KATEGORIE_LABEL[category]}\nVon: ${wer}\n\n${message}`,
        }),
      });

      if (res.ok) {
        await admin
          .from("feedback")
          .update({ emailed_at: new Date().toISOString() })
          .eq("user_id", user!.id)
          .is("emailed_at", null);
      }
    }
  } catch {
    // Bewusst geschluckt -- siehe Kommentar oben.
  }

  return { status: "sent" };
}
