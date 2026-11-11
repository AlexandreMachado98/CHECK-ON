/**
 * Meia-noite (início do dia) de `date` no fuso `timeZone`, devolvida como instante UTC.
 * Funciona com qualquer fuso IANA, inclusive os que têm horário de verão.
 */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');

  // Primeira estimativa: meia-noite UTC do dia local; depois corrige pelo deslocamento do fuso.
  const utcMidnight = Date.UTC(year, month - 1, day);
  const offset = timeZoneOffsetMs(new Date(utcMidnight), timeZone);
  const candidate = utcMidnight - offset;
  // Se o deslocamento mudou entre a estimativa e o resultado (troca de horário de verão), recalcula.
  const correctedOffset = timeZoneOffsetMs(new Date(candidate), timeZone);
  return new Date(utcMidnight - correctedOffset);
}

/** Diferença, em ms, entre o horário local do fuso e o UTC no instante dado. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}
