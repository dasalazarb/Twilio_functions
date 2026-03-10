exports.handler = function (context, event, callback) {
  const VoiceResponse = require("twilio").twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // ==============================
  // 1) LISTAS DE NÚMEROS
  // ==============================
  const FRONT = [
    "+15714075456",
    "+15714077207",
    "+15714077815",
    // "+17034784258",
    // "+17035685348",
  ];

  // SALES no se usa por ahora
  const SALES = [];

  const ACCOUNT = [
    "+17033864844",
    "+15714075456",
    "+15714077207",
    "+15714077815",
  ];

  // ==============================
  // 2) PARÁMETROS QUE VIENEN DEL IVR
  // ==============================
  const service = String(event.service || "").toLowerCase();
  const detail = String(event.detail || "").toLowerCase();

  // Compatibilidad si mandas group manualmente
  let group = String(event.group || "").toLowerCase().trim();

  // ==============================
  // 3) IDIOMA
  // ==============================
  const rawLang = String(
    event.language || event.lang || event.locale || ""
  )
    .toLowerCase()
    .trim();

  const isSpanish =
    rawLang.startsWith("es") ||
    rawLang.includes("spanish") ||
    rawLang.includes("espanol") ||
    rawLang.includes("español");

  const sayLang = isSpanish ? "es-US" : "en-US";
  const langParam = isSpanish ? "es" : "en";

  const vmIntro = isSpanish
    ? "No pudimos conectarlo con un agente. Por favor deje su nombre, número y mensaje después del tono. Presione numeral para finalizar."
    : "We could not connect you with an agent. Please leave your name, number, and message after the tone. Press pound to finish.";

  const vmThanks = isSpanish
    ? "Gracias. Hemos recibido su mensaje."
    : "Thank you. We received your message.";

  // ==============================
  // 4) ROUTING RULES
  // accounting -> accounting
  // individual/business -> front
  // sales deshabilitado por ahora
  // ==============================
  if (!group) {
    if (service.includes("accounting")) {
      group = "accounting";
    } else if (service.includes("individual")) {
      group = "front";
    } else if (service.includes("business")) {
      group = "front";
    } else {
      group = "front";
    }
  }

  const groups = {
    sales: SALES,
    front: FRONT,
    accounting: ACCOUNT,
  };

  // Si llega un grupo vacío, cae a FRONT
  const selectedGroup = groups[group];
  const targets =
    Array.isArray(selectedGroup) && selectedGroup.length > 0
      ? selectedGroup.filter(Boolean).slice(0, 10)
      : FRONT.filter(Boolean).slice(0, 10);

  // ==============================
  // 5) SI YA TERMINÓ EL DIAL: FALLBACK VOICEMAIL
  // ==============================
  if (event.DialCallStatus) {
    const status = String(event.DialCallStatus).toLowerCase();

    if (status === "completed") {
      twiml.hangup();
      return callback(null, twiml);
    }

    twiml.say({ language: sayLang, voice: "alice" }, vmIntro);

    twiml.record({
      maxLength: 180,
      finishOnKey: "#",
      playBeep: true,
      trim: "trim-silence",
    });

    twiml.say({ language: sayLang, voice: "alice" }, vmThanks);
    twiml.hangup();
    return callback(null, twiml);
  }

  // ==============================
  // 6) URLS ABSOLUTAS
  // ==============================
  const guessedBaseUrl = context.DOMAIN_NAME
    ? `https://${context.DOMAIN_NAME}`
    : "";

  const baseUrl = (context.BASE_URL || guessedBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  const actionUrl =
    `${baseUrl}/hunt` +
    `?service=${encodeURIComponent(service)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&group=${encodeURIComponent(group)}` +
    `&language=${encodeURIComponent(rawLang || langParam)}`;

  const whisperUrl =
    `${baseUrl}/whisper` +
    `?service=${encodeURIComponent(service)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&language=${encodeURIComponent(rawLang || langParam)}`;

  // ==============================
  // 7) DIAL SECUENCIAL + WHISPER
  // ==============================
  const dial = twiml.dial({
    sequential: true,
    timeout: Number(context.RING_TIMEOUT || 5),
    record: "record-from-answer-dual",
    action: actionUrl,
    method: "POST",
  });

  targets.forEach((n) => {
    dial.number(
      {
        url: whisperUrl,
        method: "POST",
      },
      n
    );
  });

  return callback(null, twiml);
};
