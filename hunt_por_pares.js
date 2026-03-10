exports.handler = function (context, event, callback) {
  const VoiceResponse = require("twilio").twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // ==============================
  // TIMEZONE
  // ==============================
  const TIMEZONE = String(context.TIMEZONE || "America/New_York").trim();

  const getLocalTime = (timeZone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const get = (type) => (parts.find((p) => p.type === type) || {}).value;

    const weekday = String(get("weekday") || "");
    const year = String(get("year") || "");
    const month = String(get("month") || "");
    const day = String(get("day") || "");
    const hour = parseInt(get("hour"), 10);
    const minute = parseInt(get("minute"), 10);

    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[weekday] ?? new Date().getDay();
    const mins = (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
    const dateKey = `${year}-${month}-${day}`; // YYYY-MM-DD

    return { dow, mins, dateKey };
  };

  const dedupe = (arr) => {
    const seen = new Set();
    const out = [];
    for (const x of arr || []) {
      const v = String(x || "").trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  };

  const isInWeeklyWindow = (now, windows) =>
    (windows || []).some((w) => now.dow === w.dow && now.mins >= w.start && now.mins < w.end);

  const isInDateOverride = (now, windows) =>
    (windows || []).some((w) => now.mins >= w.start && now.mins < w.end);

  const isAvailableNow = (now, person) => {
    const override = person.dateOverrides?.[now.dateKey];
    return override ? isInDateOverride(now, override) : isInWeeklyWindow(now, person.windows);
  };

  // ==============================
  // FRONT (base) + VENDEDORAS (por horario)
  // ==============================
  const FRONT_BASE = ["+15714075456", "+15714077207", "+15714077815"];

  // fallback (si ninguna vendedora está disponible en horario)
  const SALES_FALLBACK_BASE = ["+15714075456", "+15714077207", "+15714077815"];

  // Tus vendedoras con horarios (America/New_York)
  // Nota: "Excepto mañana" lo interpreto como 2026-02-24 (ajústalo si aplica a otra fecha).
  const SALES_REPS = [
    {
      name: "Nohemi",
      phone: "+15717752255",
      windows: [
        // Mon-Thu 08:00-16:00
        { dow: 1, start: 8 * 60, end: 16 * 60 },
        { dow: 2, start: 8 * 60, end: 16 * 60 },
        { dow: 3, start: 8 * 60, end: 16 * 60 },
        { dow: 4, start: 8 * 60, end: 16 * 60 },
        // Fri 08:00-14:00
        { dow: 5, start: 8 * 60, end: 14 * 60 },
        // Sat 09:00-15:00
        { dow: 6, start: 9 * 60, end: 15 * 60 },
      ],
      dateOverrides: {
        "2026-02-24": [{ start: 9 * 60 + 30, end: 17 * 60 + 30 }], // 9:30–17:30
      },
    },
    {
      name: "Valeria",
      phone: "+15717752221",
      windows: [
        // Mon-Thu 12:30-20:00
        { dow: 1, start: 12 * 60 + 30, end: 20 * 60 },
        { dow: 2, start: 12 * 60 + 30, end: 20 * 60 },
        { dow: 3, start: 12 * 60 + 30, end: 20 * 60 },
        { dow: 4, start: 12 * 60 + 30, end: 20 * 60 },
        // Fri 14:00-20:00
        { dow: 5, start: 14 * 60, end: 20 * 60 },
        // Sat 09:00-13:00
        { dow: 6, start: 9 * 60, end: 13 * 60 },
        // Sun 11:00-15:00
        { dow: 0, start: 11 * 60, end: 15 * 60 },
      ],
    },
    {
      name: "Annabel",
      phone: "+15717751682",
      windows: [
        // Mon-Fri 18:00-20:00
        { dow: 1, start: 18 * 60, end: 20 * 60 },
        { dow: 2, start: 18 * 60, end: 20 * 60 },
        { dow: 3, start: 18 * 60, end: 20 * 60 },
        { dow: 4, start: 18 * 60, end: 20 * 60 },
        { dow: 5, start: 18 * 60, end: 20 * 60 },
        // Sat 10:00-18:00
        { dow: 6, start: 10 * 60, end: 18 * 60 },
        // Sun 09:00-17:00
        { dow: 0, start: 9 * 60, end: 17 * 60 },
      ],
    },
  ];

  const now = getLocalTime(TIMEZONE);

  const FRONT = dedupe(FRONT_BASE);

  const salesActive = SALES_REPS
    .filter((p) => isAvailableNow(now, p))
    .map((p) => p.phone);

  const SALES = dedupe(salesActive.length ? salesActive : SALES_FALLBACK_BASE);

  // ==============================
  // PARAMETROS (idioma + attempt)
  // ==============================
  const service = String(event.service || "").toLowerCase();
  const detail = String(event.detail || "").toLowerCase();
  let group = String(event.group || "").toLowerCase().trim();

  const attempt = Math.max(0, parseInt(event.attempt || "0", 10) || 0);
  const MAX_ATTEMPTS = Math.max(1, parseInt(context.MAX_BATCH_ATTEMPTS || "6", 10) || 6);

  const rawLang = String(event.language || event.lang || event.locale || "").toLowerCase().trim();
  const isSpanish =
    rawLang.startsWith("es") ||
    rawLang.includes("spanish") ||
    rawLang.includes("espanol") ||
    rawLang.includes("español");

  const sayLang = isSpanish ? "es-US" : "en-US";
  const vmIntro = isSpanish
    ? "No pudimos conectarlo con un agente. Por favor deje su nombre, número y mensaje después del tono. Presione numeral para finalizar."
    : "We could not connect you with an agent. Please leave your name, number, and message after the tone. Press pound to finish.";
  const vmThanks = isSpanish ? "Gracias. Hemos recibido su mensaje." : "Thank you. We received your message.";

  // ==============================
  // ROUTING (mantengo tu lógica)
  // ==============================
  if (!group) {
    if (service.includes("accounting")) {
      group = "accounting";
    } else if (service.includes("individual") || service.includes("business")) {
      group = detail === "appt_ready" ? "sales" : "front";
    } else {
      group = "front";
    }
  }

  // ==============================
  // URL base (absolute)
  // ==============================
  const guessedBaseUrl = context.DOMAIN_NAME ? `https://${context.DOMAIN_NAME}` : "";
  const baseUrl = (context.BASE_URL || guessedBaseUrl || "").trim().replace(/\/+$/, "");

  const baseParams =
    `service=${encodeURIComponent(service)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&group=${encodeURIComponent(group)}` +
    `&language=${encodeURIComponent(rawLang || (isSpanish ? "es" : "en"))}`;

  const buildSelfUrl = (nextAttempt) => `${baseUrl}/hunt?${baseParams}&attempt=${nextAttempt}`;

  const whisperUrl = `${baseUrl}/whisper?${baseParams}`;

  // ==============================
  // ✅ BATCHING: 1 FRONT + 1 SALES (solo para front/sales)
  // accounting mantiene su lista (puedes ajustarlo luego)
  // ==============================
  const pick = (arr, idx) => (arr && arr.length ? arr[idx % arr.length] : null);

  const getBatchTargets = () => {
    if (group === "accounting") {
      // Si quieres batching también en accounting, dime y lo adapto.
      // Por ahora: intenta solo el primer accounting fallback (o cambia a tu lista real).
      return dedupe([pick(SALES_FALLBACK_BASE, attempt)]);
    }

    // Para front o sales: 1 front + 1 vendedora
    const f = pick(FRONT, attempt);
    const s = pick(SALES, attempt);

    // Evita duplicados por si las listas se pisan
    const batch = dedupe([f, s]).slice(0, 2);

    // Si por alguna razón quedó 1 solo, intenta completar con otro front
    if (batch.length === 1 && FRONT.length > 1) {
      batch.push(pick(FRONT, attempt + 1));
      return dedupe(batch).slice(0, 2);
    }

    return batch;
  };

  const batchTargets = getBatchTargets();

  // Si no hay targets (raro), directo a voicemail
  if (!batchTargets.length) {
    twiml.say({ language: sayLang, voice: "alice" }, vmIntro);
    twiml.record({ maxLength: 180, finishOnKey: "#", playBeep: true, trim: "trim-silence" });
    twiml.say({ language: sayLang, voice: "alice" }, vmThanks);
    twiml.hangup();
    return callback(null, twiml);
  }

  // ==============================
  // Acción posterior al Dial (si no conectó)
  // ==============================
  if (event.DialCallStatus) {
    const status = String(event.DialCallStatus).toLowerCase();

    if (status === "completed") {
      twiml.hangup();
      return callback(null, twiml);
    }

    // Si no conectó, intenta siguiente batch hasta MAX_ATTEMPTS
    if (attempt + 1 < MAX_ATTEMPTS) {
      twiml.redirect({ method: "POST" }, buildSelfUrl(attempt + 1));
      return callback(null, twiml);
    }

    // Se acabaron los intentos => voicemail
    twiml.say({ language: sayLang, voice: "alice" }, vmIntro);
    twiml.record({ maxLength: 180, finishOnKey: "#", playBeep: true, trim: "trim-silence" });
    twiml.say({ language: sayLang, voice: "alice" }, vmThanks);
    twiml.hangup();
    return callback(null, twiml);
  }

  // ==============================
  // DIAL del batch (2 en paralelo)
  // ==============================
  const dial = twiml.dial({
    timeout: Number(context.RING_TIMEOUT || 12),
    record: "record-from-answer-dual",
    action: buildSelfUrl(attempt), // vuelve aquí con DialCallStatus
    method: "POST",
  });

  batchTargets.forEach((n) => {
    dial.number({ url: whisperUrl, method: "POST" }, n);
  });

  return callback(null, twiml);
};
