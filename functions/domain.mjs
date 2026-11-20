export const TIME_ZONE = 'America/Costa_Rica';
export const dateCR = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const timeCR = (now = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
export function validDate(date) { return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().startsWith(date); }
export function period(year, month) {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2200 || !Number.isInteger(m) || m < 1 || m > 12) throw new Error('Período inválido.');
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10) };
}
export const norm = name => String(name || '').trim().toLocaleLowerCase('es-CR');
export const present = row => !row.deletedAt && !['anulado', 'ausente', 'pendiente'].includes(row.estado || 'presente');
export function summarize({ people, records, absences, rosters, from, to }) {
  const seen = new Map();
  for (const r of records.filter(present)) { const key = JSON.stringify([r.fecha, r.personaId, r.ministerio]); if (!seen.has(key)) seen.set(key, r); }
  const rows = [...seen.values()].map(r => ({ ...r, estado: 'presente' }));
  const presenceKeys = new Set(rows.map(r => JSON.stringify([r.fecha, r.personaId, r.ministerio])));
  const absenceKeys = new Set();
  for (const a of absences.filter(a => !a.deletedAt)) {
    const key = JSON.stringify([a.fecha, a.personaId, a.ministerio]);
    if (!presenceKeys.has(key) && !absenceKeys.has(key)) { absenceKeys.add(key); rows.push({ ...a, estado: 'ausente', source: 'registrada' }); }
  }
  let expected = 0;
  for (const roster of rosters.filter(r => r.closed && !r.deletedAt)) {
    expected += roster.people.length;
    for (const p of roster.people) {
      const key = JSON.stringify([roster.fecha, p.id, roster.ministerio]);
      if (!presenceKeys.has(key) && !absenceKeys.has(key)) { absenceKeys.add(key); rows.push({ ...p, personaId: p.id, fecha: roster.fecha, ministerio: roster.ministerio, estado: 'ausente', source: 'lista_confirmada', id: `roster:${roster.id}:${p.id}` }); }
    }
  }
  if (from === to) for (const p of people) {
    const key = JSON.stringify([from, p.id, p.ministerio]);
    if (!presenceKeys.has(key) && !absenceKeys.has(key)) rows.push({ ...p, personaId: p.id, fecha: from, estado: 'sin_registro', source: 'sin_lista_confirmada' });
  }
  const known = rows.filter(r => r.estado !== 'sin_registro'), presentCount = rows.filter(r => r.estado === 'presente').length;
  const covered = rosters.filter(r => r.closed && !r.deletedAt);
  const coveredKeys = new Set(covered.flatMap(r => r.people.map(p => JSON.stringify([r.fecha, p.id, r.ministerio]))));
  const ministries = new Set([...people,...known,...covered].map(r=>r.ministerio));
  const days=[];for(let t=Date.parse(from+'T12:00:00Z');t<=Date.parse(to+'T12:00:00Z');t+=86400000)days.push(new Date(t).toISOString().slice(0,10));
  const rosterDates=new Set(covered.map(r=>JSON.stringify([r.fecha,r.ministerio])));
  const fullyCovered = covered.length > 0 && rows.every(r=>r.estado!=='sin_registro') && days.every(d=>[...ministries].every(m=>rosterDates.has(JSON.stringify([d,m])))) && known.every(r => coveredKeys.has(JSON.stringify([r.fecha, r.personaId, r.ministerio])));
  return { rows: rows.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.nombre || '').localeCompare(b.nombre || '')), totals: { people: people.length, present: presentCount, absent: absenceKeys.size, unknown: rows.filter(r => r.estado === 'sin_registro').length, expected: fullyCovered ? expected : null, percentage: fullyCovered && expected ? Math.round(presentCount / expected * 1000) / 10 : null }, state: records.length || absences.length || rosters.length ? 'datos' : 'sin_asistencia_tomada' };
}
