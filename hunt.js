exports.handler = function (context, event, callback) {
  const VoiceResponse = require("twilio").twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // ==============================
  // TIMEZONE
  // Define TIMEZONE en Twilio Functions (recomendado) o usa America/New_York
  // ==============================
  const TIMEZONE = String(context.TIMEZONE || "America/New_York").trim();

  // Lee hora local (HH:MM) + weekday usando Intl (sin dependencias externas)
  const getLocalTime = (timeZone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const get = (type) => (parts.find((p) => p.type === type) || {}).value;
    const weekday = String(get("weekday") || "");
    const hour = parseInt(get("hour"), 10);
    const minute = parseInt(get("minute"), 10);

    // dow: 0=Sun ... 6=Sat
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dowMap[weekday] ?? new Date().getDay();

    const mins = (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
    return { dow, mins, weekday, hour, minute };
  };

  const isInWindow = (now, windows) =>
    (windows || []).some((w) => now.dow === w.dow && now.mins >= w.start && now.mins < w.end);

  // Horarios "por persona" (solo se incluyen si la llamada entra en su rango)
  // Imagen:
  // Valeria: Fri 08:00-16:00, Sat 09:00-14:00
  // Nohemi : Fri 09:30-17:30, Sat 10:00-15:00
  // Annabell: Fri 17:30-19:30, Sat 11:00-16:00, Sun 11:00-16:00
    // Horarios "por persona" (solo se incluyen si la llamada entra en su rango)
  // Imagen (nuevos horarios):
  // Valeria:
  //   Mon-Thu 08:30-16:00
  //   Fri     08:30-14:30
  //   Sat     10:00-14:00
  //   Sun     10:00-14:00
  // Nohemi:
  //   Mon-Fri 09:30-17:30
  //   Sat     10:00-15:00
  // Annabell:
  //   Fri     17:30-19:30
  //   Sat     11:00-16:00
  //   Sun     11:00-16:00
  const EXTRA_BY_SCHEDULE = [
    {
      name: "Valeria",
      phone: "+15717752221",
      windows: [
        // Mon-Thu 08:30-16:00
        { dow: 1, start: 8 * 60 + 30, end: 16 * 60 },
        { dow: 2, start: 8 * 60 + 30, end: 16 * 60 },
        { dow: 3, start: 8 * 60 + 30, end: 16 * 60 },
        { dow: 4, start: 8 * 60 + 30, end: 16 * 60 },

        // Fri 08:30-14:30
        { dow: 5, start: 8 * 60 + 30, end: 14 * 60 + 30 },

        // Sat 10:00-14:00
        { dow: 6, start: 10 * 60, end: 14 * 60 },

        // Sun 10:00-14:00
        { dow: 0, start: 10 * 60, end: 14 * 60 },
      ],
    },
    {
      name: "Nohemi",
      phone: "+15717752255",
      windows: [
        // Mon-Fri 09:30-17:30
        { dow: 1, start: 9 * 60 + 30, end: 17 * 60 + 30 },
        { dow: 2, start: 9 * 60 + 30, end: 17 * 60 + 30 },
        { dow: 3, start: 9 * 60 + 30, end: 17 * 60 + 30 },
        { dow: 4, start: 9 * 60 + 30, end: 17 * 60 + 30 },
        { dow: 5, start: 9 * 60 + 30, end: 17 * 60 + 30 },

        // Sat 10:00-15:00
        { dow: 6, start: 10 * 60, end: 15 * 60 },
      ],
    },
    {
      name: "Annabell",
      phone: "+15717751682",
      windows: [
        // Fri 17:30-19:30
        { dow: 5, start: 17 * 60 + 30, end: 19 * 60 + 30 },

        // Sat 11:00-16:00
        { dow: 6, start: 11 * 60, end: 16 * 60 },

        // Sun 11:00-16:00
        { dow: 0, start: 11 * 60, end: 16 * 60 },
      ],
    },
  ];


  const buildTargetsWithScheduledExtras = (baseList) => {
    const now = getLocalTime(TIMEZONE);

    const extrasActive = EXTRA_BY_SCHEDULE
      .filter((p) => isInWindow(now, p.windows))
      .map((p) => p.phone);

    // Mantén el orden base y agrega (al final) solo los extras activos
    const merged = [...(baseList || []), ...extrasActive]
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    // dedupe preservando el primer orden
    const seen = new Set();
    const uniq = [];
    for (const n of merged) {
      if (!seen.has(n)) {
        seen.add(n);
        uniq.push(n);
      }
    }

    return uniq;
  };

  const parseList = (s) =>
    (s || "")
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  // ==============================
  // 1) LISTAS DE NÚMEROS
  // (Puedes moverlas a ENV VARS si quieres)
  // ==============================
  // const FRONT = parseList(context.FRONT_NUMBERS);
  // const SALES = parseList(context.SALES_NUMBERS);

  // const FRONT = ["+15717752255", "+15717752221", "+15717751682"];
  // const SALES = ["+15717752255", "+15717752221", "+15717751682"];
  // const ACCOUNT = ["+15717752255", "+15717752221", "+15717751682"];

  const FRONT_BASE = [
    "+15714075456",
    "+15714077207",
    "+15714077815",
    // "+17034784258",
    // "+17035685348",
  ];
  
  const SALES_BASE = [
    "+15714075456",
    "+15714077207",
    "+15714077815",
    // "+17034784258",
    // "+17035685348",
  ];  // ["+15717752255", "+15717752221", "+15717751682"];

  const ACCOUNT_BASE = [
    "+17033864844",
    "+15714075456",
    "+15714077207",
    "+15714077815",
    ];

  // Lista final por grupo (base + extras activos según horario)
  const FRONT = buildTargetsWithScheduledExtras(FRONT_BASE);
  const SALES = buildTargetsWithScheduledExtras(SALES_BASE);
  const ACCOUNT = buildTargetsWithScheduledExtras(ACCOUNT_BASE);

  // ==============================
  // 2) PARAMETROS QUE VIENEN DEL IVR
  // service: existing_accounting | existing_individual | existing_business
  // detail:  appt_ready | questions | other_agent
  // ==============================
  const service = String(event.service || "").toLowerCase();
  const detail = String(event.detail || "").toLowerCase();

  // (Compatibilidad) si mandas group manualmente también sirve
  let group = String(event.group || "").toLowerCase().trim();

  // ==============================
  // 2.5) IDIOMA (DIFERENCIADO ES/EN)
  // - Flow Español: language = spanish (o es / es-US)
  // - Flow Inglés: NO defines language => default EN
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
  const langParam = isSpanish ? "es" : "en"; // para persistir en la URL

  const vmIntro = isSpanish
    ? "No pudimos conectarlo con un agente. Por favor deje su nombre, número y mensaje después del tono. Presione numeral para finalizar."
    : "We could not connect you with an agent. Please leave your name, number, and message after the tone. Press pound to finish.";

  const vmThanks = isSpanish
    ? "Gracias. Hemos recibido su mensaje."
    : "Thank you. We received your message.";

  // ==============================
  // 3) ROUTING RULES
  // 1 (contabilidad) -> front
  // 2 + 1 -> sales, 2 + (2 o 3) -> front
  // 3 + 1 -> sales, 3 + (2 o 3) -> front
  // ==============================
  if (!group) {
    if (service.includes("accounting")) {
      group = "accounting";
    } else if (service.includes("individual")) {
      group = detail === "appt_ready" ? "sales" : "front";
    } else if (service.includes("business")) {
      group = detail === "appt_ready" ? "sales" : "front";
    } else {
      group = "front";
    }
  }

  const groups = {
    sales: SALES,
    front: FRONT,
    accounting: ACCOUNT,
  };

  const targets = (groups[group] || groups.front).filter(Boolean).slice(0, 10);

  // ==============================
  // 4) SI YA TERMINÓ EL DIAL: FALLBACK VOICEMAIL
  // Aquí entra cuando Twilio vuelve al actionUrl con DialCallStatus
  // ==============================
  if (event.DialCallStatus) {
    const status = String(event.DialCallStatus).toLowerCase();

    // Si el cliente sí habló con alguien, se terminó.
    if (status === "completed") {
      twiml.hangup();
      return callback(null, twiml);
    }

    // Si no conectó (busy / no-answer / failed / canceled), cae al voicemail
    twiml.say({ language: sayLang, voice: "alice" }, vmIntro);

    // === N8N webhook callback cuando el voicemail ya está listo ===
  // const n8nCallback =
  //   `${context.N8N_VOICEMAIL_WEBHOOK}` +
  //   `?secret=${encodeURIComponent(context.N8N_WEBHOOK_SECRET || "")}` +
  //   `&group=${encodeURIComponent(group)}` +
  //   `&service=${encodeURIComponent(service)}` +
  //   `&detail=${encodeURIComponent(detail)}` +
  //   `&lang=${encodeURIComponent(langParam)}`;

  twiml.record({
    maxLength: 180,
    finishOnKey: "#",
    playBeep: true,
    trim: "trim-silence",

    // Esto dispara a n8n cuando la grabación esté disponible
    // recordingStatusCallback: n8nCallback,
    // recordingStatusCallbackMethod: "POST",
    // recordingStatusCallbackEvent: "completed",
  });

    twiml.say({ language: sayLang, voice: "alice" }, vmThanks);
    twiml.hangup();
    return callback(null, twiml);
  }

  // ==============================
  // 5) URLS ABSOLUTAS
  // Recomendado: define BASE_URL en Environment Variables
  // ejemplo: https://taxsegurofunc-5104.twil.io
  // Si no lo defines, intenta usar DOMAIN_NAME automáticamente
  // ==============================
  const guessedBaseUrl = context.DOMAIN_NAME
    ? `https://${context.DOMAIN_NAME}`
    : "";

  const baseUrl = (context.BASE_URL || guessedBaseUrl || "").trim().replace(/\/+$/, "");

  // actionUrl (cuando termina el dial)
  // IMPORTANTÍSIMO: mandamos language para que se conserve en el 2do request
  const actionUrl =
    `${baseUrl}/hunt` +
    `?service=${encodeURIComponent(service)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&group=${encodeURIComponent(group)}` +
    `&language=${encodeURIComponent(rawLang || langParam)}`;

  // whisperUrl (lo que oye el AGENTE antes de conectar)
  const whisperUrl =
    `${baseUrl}/whisper` +
    `?service=${encodeURIComponent(service)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&language=${encodeURIComponent(rawLang || langParam)}`;

  // ==============================
  // 6) DIAL SECUENCIAL + WHISPER
  // ==============================
  const dial = twiml.dial({
    sequential: true,
    timeout: Number(context.RING_TIMEOUT || 5),
    record: "record-from-answer-dual",
    action: actionUrl,
    method: "POST",
    // answerOnBridge: true, // opcional
  });

  // El whisper solo lo oye el agente
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
