exports.handler = function (context, event, callback) {
  const VoiceResponse = require("twilio").twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const service = String(event.service || "").toLowerCase();
  const detail = String(event.detail || "").toLowerCase();

  // Mensajes por partes (mejor control)
  let intro = "Llamada entrante.";
  if (service.includes("accounting")) {
    intro = "Llamada de contabilidad.";
  } else if (service.includes("individual")) {
    intro = "Llamada de servicios individuales.";
  } else if (service.includes("business")) {
    intro = "Llamada de servicios de negocio.";
  }

  let extra = "";
  if (detail === "appt_ready") {
    extra = "Cliente listo para agendar cita.";
  } else if (detail === "questions") {
    extra = "Cliente con consultas.";
  } else if (detail === "other_agent") {
    extra = "Cliente solicita otros servicios o hablar con un agente.";
  }

  // ✅ 1) Pausa ANTES de hablar (silencio)
  twiml.pause({ length: 1 }); // segundos (1 a 10)

  // ✅ 2) SSML con Polly (pausas y velocidad)
  const say = twiml.say({ language: "es-US", voice: "Polly.Pedro-Generative" });

  // Baja la velocidad (85% suele ser un buen punto)
  say.prosody({ rate: "85%" }, intro);

  if (extra) {
    // Pausa corta entre frases
    say.break({ time: "450ms" });
    say.prosody({ rate: "85%" }, extra);
  }

  return callback(null, twiml);
};
