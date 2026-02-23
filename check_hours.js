exports.handler = function (context, event, callback) {
  const tz = "America/New_York";
  const openHour = 8;   
  const closeHour = 21; 

  // Hora y día local en NY
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",    
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hourStr = parts.find(p => p.type === "hour")?.value;
  const weekdayStr = parts.find(p => p.type === "weekday")?.value;

  const hour = hourStr ? parseInt(hourStr, 10) : NaN;

  // Domingo 
  const isSunday = weekdayStr === "Sun";

  const inHours =
    !isSunday &&
    Number.isFinite(hour) &&
    hour >= openHour &&
    hour < closeHour;

  callback(null, { in_hours: inHours, hour, weekday: weekdayStr, tz });
};
