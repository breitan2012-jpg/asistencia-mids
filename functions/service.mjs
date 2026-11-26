import { randomUUID } from 'node:crypto';
import { credentialKey, digest, hashPassword, randomToken, verifyPassword } from './crypto.mjs';
import { dateCR, timeCR, validDate, summarize, norm, present, countsOnDate } from './domain.mjs';
import { validAttendanceLocation } from './geofence.mjs';
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new ApiError(status, message); };
const identifier = x => typeof x === 'string' && /^[\w-]{1,160}$/.test(x) ? x : fail(400, 'Identificador inválido.');
const string = (value, max = 500) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
const required = (value, label, max) => string(value, max) || fail(400, `${label} es obligatorio.`);
const profileView = p => p ? { id: p.id, name: p.name, role: p.role, ministerio: p.ministerio, canManageAbsences: p.role === 'leader' || !!p.canManageAbsences, active: p.active !== false } : null;
const privateFields=new Set(['registradoPorId','adminId','userId','pin','code','credentialKey','hash']);
const publicView=value=>Array.isArray(value)?value.map(publicView):value && typeof value==='object' && Object.getPrototypeOf(value)===Object.prototype?Object.fromEntries(Object.entries(value).filter(([key])=>!privateFields.has(key)).map(([key,v])=>[key,publicView(v)])):value;
const collections = ['personas', 'ministerios', 'asistencia', 'absences', 'fechas', 'config', 'adminUsers', 'admin_alerts', 'attemptLogs', 'update_delivery_logs', 'fcm_tokens', 'auditLogs'];
const masterOrigins = new Set(['https://admin-57368.web.app', 'https://admin-57368.firebaseapp.com']);
export function createService({ store, pepper, now = () => new Date() }) {
  if (!pepper || pepper.length < 32) throw new Error('A server-only pepper is required.');
  async function throttle(key, maximum) {
    const over = await store.transaction(async tx => { const path = `secureRateLimits/${digest(key)}`, previous = await tx.get(path), time = +now(); const count = previous?.until > time ? previous.count + 1 : 1; tx.set(path, { count, until: previous?.until > time ? previous.until : time + 900000 }); return count > maximum; });
    if (over) fail(429, 'Demasiados intentos. Espera unos minutos.');
  }
  return { async dispatch({ action, body = {}, token, ip = 'unknown', origin }) {
    const masterAttendance = action === 'masterAttendance';
    if (masterAttendance && !masterOrigins.has(origin)) fail(403, 'El registro sin ubicación está disponible desde MIDS Master.');
    if (masterAttendance) await throttle(`master-attendance:${credentialKey(ip, pepper)}`, 300);
    if (action === 'login') { required(body.code, 'El código', 128); await throttle(`ip:${credentialKey(ip, pepper)}`, 12); await throttle(`code:${credentialKey(body.code, pepper)}`, 12); }
    return store.transaction(async tx => {
      const settings = await tx.get('secureAdmin/config');
      if (!settings?.enabled) fail(503, 'El acceso seguro está pendiente de activación.');
      let session = token && /^[\w-]{43}$/.test(token) ? await tx.get(`secureSessions/${digest(token)}`) : null;
      if (session?.revoked || session?.expiresAt <= +now()) session = null;
      if (action === 'session' && !session) {
        const next = randomToken(); tx.set(`secureSessions/${digest(next)}`, { createdAt: +now(), expiresAt: +now() + 180 * 86400000, profileId: null });
        return { token: next, data: { profile: null, today: dateCR(now()) } };
      }
      if (!session) fail(401, 'Recarga la aplicación para recuperar tu sesión.');
      const sessionPath = `secureSessions/${session.id}`;
      // A deployment can advance the authentication epoch to invalidate every
      // previously issued administrative session. Old sessions did not carry
      // an epoch, so they deliberately become public sessions after this fix.
      const authEpoch = Number.isSafeInteger(settings.authEpoch) && settings.authEpoch > 0 ? settings.authEpoch : 1;
      const candidate = session.profileId && session.adminExpiresAt > +now() && session.authEpoch === authEpoch
        ? await tx.get(`secureProfiles/${session.profileId}`) : null;
      const profile = candidate?.active !== false && candidate?.epoch === session.epoch ? candidate : null;
      const superOnly = () => { if (profile?.role !== 'superadmin') fail(403, 'Esta acción requiere superadministración.'); };
      const adminOnly = () => { if (!profile) fail(403, 'Ingresa por Administración.'); };
      const scope = ministry => { adminOnly(); if (ministry !== undefined && (typeof ministry !== 'string' || ministry.length > 160)) fail(400, 'Ministerio inválido.'); if (profile.role === 'leader') { if (ministry && ministry !== 'Todos' && ministry !== profile.ministerio) fail(403, 'No puedes consultar otro ministerio.'); return profile.ministerio; } return ministry && ministry !== 'Todos' ? ministry : null; };
      const audit = (type, target, before, after, reason) => tx.set(`auditLogs/${randomUUID()}`, { type, target, at: +now(), fecha: dateCR(now()), hora: timeCR(now()), actorId: profile?.id || session.id, actorName: profile?.name || session.personName || 'Dispositivo', before: before ?? null, after: after ?? null, reason: required(reason, 'El motivo', 500) });
      if (action === 'session') return { data: { profile: profileView(profile), today: dateCR(now()) } };
      if (action === 'login') {
        const key = credentialKey(body.code, pepper), credential = await tx.get(`secureCredentials/${key}`);
        const valid = await verifyPassword(body.code, credential?.hash || settings.dummyHash);
        const user = credential ? await tx.get(`secureProfiles/${credential.profileId}`) : null;
        if (!valid || !user || user.active === false || user.credentialKey !== key) fail(401, 'Código incorrecto o desactivado.');
        tx.set(sessionPath, { profileId: user.id, epoch: user.epoch, authEpoch, adminExpiresAt: +now() + 8 * 3600000 }, true);
        return { data: profileView(user) };
      }
      if (action === 'logout') { tx.set(sessionPath, { profileId: null, adminExpiresAt: 0 }, true); return { data: { ok: true } }; }
      if(action==='registerPush'){
        if(typeof body.token!=='string'||!/^[-\w:]{20,4096}$/.test(body.token))fail(400,'Token de notificación inválido.');
        tx.set(`fcm_tokens/${digest(body.token)}`,{token:body.token,secureDeviceId:session.id,lastActive:now().toISOString(),platform:string(body.platform,100)},true);
        return {data:{ok:true}};
      }
      if (['report', 'export', 'confirmRoster'].includes(action)) {
        const ministry = scope(body.ministerio);
        if (!validDate(body.from) || !validDate(body.to) || body.to < body.from || Date.parse(body.to) - Date.parse(body.from) > 366 * 86400000) fail(400, 'Selecciona un período válido de hasta un año.');
        if (action === 'export' && profile.role === 'leader' && body.kind !== 'absences') fail(403, 'Los líderes solo pueden descargar reportes de ausencias.');
        if (body.kind === 'image') superOnly();
        const filters = [['fecha', '>=', body.from], ['fecha', '<=', body.to]], minFilter = ministry ? [['ministerio', '==', ministry]] : [];
        if (action === 'confirmRoster') {
          superOnly(); if (!ministry || body.from !== body.to || body.confirm !== true) fail(400, 'Confirma una fecha y un ministerio.');
          const id = `${body.from}_${digest(ministry).slice(0, 24)}`, before = await tx.get(`attendanceRosters/${id}`);
          if (before) fail(409, 'Ya existe una lista confirmada para ese día.');
          const people = (await tx.list('personas', minFilter)).filter(p => !p.deletedAt && p.active !== false).map(p => ({ id: p.id, nombre: p.nombre }));
          const after = { fecha: body.from, ministerio: ministry, people, closed: true, confirmedAt: +now(), confirmedBy: profile.id };
          tx.set(`attendanceRosters/${id}`, after); audit('roster.confirm', `attendanceRosters/${id}`, null, after, body.reason); return { data: { ok: true } };
        }
        const [people, records, absences, rosters, ministries] = await Promise.all([tx.list('personas', minFilter), tx.list('asistencia', [...filters, ...minFilter], 15000), tx.list('absences', [...filters, ...minFilter], 10000), tx.list('attendanceRosters', [...filters, ...minFilter]), tx.list('ministerios', ministry ? [['nombre', '==', ministry]] : [])]);
        const data = summarize({ people: people.filter(p => !p.deletedAt && p.active !== false), records, absences, rosters, from: body.from, to: body.to });
        if (action === 'export' && body.kind === 'absences') data.rows = data.rows.filter(r => r.estado === 'ausente');
        return { data: publicView({ ...data, ministries: ministries.filter(m => !m.deletedAt), ministry, from: body.from, to: body.to }) };
      }
      if (action === 'profiles') { superOnly(); return { data: (await tx.list('secureProfiles')).map(profileView) }; }
      if (action === 'saveProfile') {
        superOnly(); const pid = body.id ? identifier(body.id) : randomUUID(), before = await tx.get(`secureProfiles/${pid}`);
        const name = required(body.name, 'El nombre', 160), role = body.role;
        if (!['leader', 'superadmin'].includes(role)) fail(400, 'Rol inválido.');
        let ministry = 'Todos'; if (role === 'leader') { const m = await tx.get(`ministerios/${identifier(body.ministryId)}`); if (!m || m.deletedAt) fail(400, 'Selecciona un ministerio válido.'); ministry = m.nombre; }
        if (pid === profile.id && (body.active === false || role !== 'superadmin')) fail(409, 'No puedes quitar tu propio acceso de superadministración.');
        let key = before?.credentialKey;
        if (body.code) {
          if (typeof body.code !== 'string' || body.code.trim() !== body.code || body.code.length < 4 || body.code.length > 128) fail(400, 'Utiliza un código de 4 a 128 caracteres.');
          key = credentialKey(body.code, pepper); const duplicate = await tx.get(`secureCredentials/${key}`);
          if (duplicate && duplicate.profileId !== pid) fail(409, 'Ese código ya está asignado.');
          tx.set(`secureCredentials/${key}`, { hash: await hashPassword(body.code), profileId: pid });
        }
        if (!key) fail(400, 'El código es obligatorio para un nuevo acceso.');
        const after = { name, role, ministerio: ministry, active: body.active !== false, canManageAbsences: role === 'leader' && body.canManageAbsences === true, credentialKey: key, epoch: (before?.epoch || 0) + 1 };
        tx.set(`secureProfiles/${pid}`, after); audit('profile.save', `secureProfiles/${pid}`, before ? profileView({ ...before, id: pid }) : null, { ...profileView({ ...after, id: pid }), codeChanged: key !== before?.credentialKey }, body.reason);
        if(pid===profile.id)tx.set(sessionPath,{epoch:after.epoch},true);
        return { data: profileView({ ...after, id: pid }) };
      }
      if (action === 'audit') {
        superOnly(); const filters = [];
        if (body.from) { if (!validDate(body.from) || !validDate(body.to)) fail(400, 'Fechas inválidas.'); filters.push(['at', '>=', Date.parse(body.from + 'T00:00:00-06:00')], ['at', '<=', Date.parse(body.to + 'T23:59:59.999-06:00')]); }
        return { data: publicView((await tx.list('auditLogs', filters)).filter(r => (!body.actorId || r.actorId === body.actorId) && (!body.type || r.type === body.type)).sort((a, b) => b.at - a.at)) };
      }
      if (masterAttendance) {
        const markedAt = now();
        body = {
          ref: { collection: 'asistencia' },
          operation: 'add',
          data: { personaId: body.personaId, fecha: dateCR(markedAt), hora: timeCR(markedAt), timestamp: markedAt.toISOString() }
        };
      }
      if (!masterAttendance && !['dbRead', 'dbWrite'].includes(action)) fail(404, 'Operación no disponible.');
      const { collection, id: rawId } = body.ref || {};
      if (!collections.includes(collection)) fail(403, 'Colección no autorizada.');
      const docId = rawId ? identifier(rawId) : null;
      let filters = Array.isArray(body.ref.filters) ? body.ref.filters : [];
      if (filters.length > 6 || filters.some(f => !Array.isArray(f) || f.length !== 3 || !/^[\w.]{1,80}$/.test(f[0]) || !['==', '>=', '<='].includes(f[1]))) fail(400, 'Consulta inválida.');
      const personal = ['personas', 'asistencia', 'absences', 'fechas'];
      if (action === 'dbRead') {
        if (collection === 'adminUsers') { superOnly(); return { data: (await tx.list('secureProfiles')).map(p => ({ ...profileView(p), userId: '', isAdmin: p.active !== false })) }; }
        if (collection === 'config') {
          if (docId === 'emailjs') fail(403, 'Configuración no disponible.');
          if (!['gps', 'system', 'identityReset'].includes(docId)) superOnly();
          if (docId === 'admin') fail(403, 'Los códigos solo se verifican en el servidor.');
        } else if (['admin_alerts', 'attemptLogs', 'update_delivery_logs', 'fcm_tokens', 'auditLogs'].includes(collection)) superOnly();
        else if (!profile && ['absences', 'fechas'].includes(collection)) fail(403, 'Ingresa por Administración.');
        if (profile?.role === 'leader' && collection === 'ministerios') filters = [...filters, ['nombre', '==', profile.ministerio]];
        if (profile?.role === 'leader' && personal.includes(collection)) {
          const requested = filters.find(f => f[0] === 'ministerio' && f[1] === '==')?.[2]; if (requested && requested !== profile.ministerio) fail(403, 'No puedes consultar otro ministerio.'); filters = [...filters.filter(f => f[0] !== 'ministerio'), ['ministerio', '==', profile.ministerio]];
        }
        if (!profile && collection === 'asistencia') { const date = filters.find(f => f[0] === 'fecha' && f[1] === '==')?.[2]; if (docId || date !== dateCR(now())) fail(403, 'El historial requiere Administración.'); }
        const rows = docId ? [await tx.get(`${collection}/${docId}`)].filter(Boolean) : await tx.list(collection, filters, collection === 'asistencia' ? 15000 : 5000);
        const allowed = rows.filter(r => !r.deletedAt && !(collection === 'config' && r.id === 'emailjs') &&
          (profile?.role !== 'leader' || (collection === 'ministerios' ? r.nombre === profile.ministerio : !personal.includes(collection) || r.ministerio === profile.ministerio)));
        if (docId && rows.length && !allowed.length && profile?.role === 'leader') fail(403, 'No puedes consultar otro ministerio.');
        const projected = !profile && collection === 'asistencia' ? allowed.filter(present).map(r => ({ id: r.id, personaId: r.personaId, ministerio: r.ministerio, fecha: r.fecha, estado: r.estado })) : !profile && collection === 'personas' ? allowed.map(r => ({ id: r.id, nombre: r.nombre, nombreDisplay:r.nombreDisplay, ministerio: r.ministerio, esMultiple: r.esMultiple })) : allowed;
        return { data: publicView(docId ? projected[0] || null : projected) };
      }
      const data = body.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Datos inválidos.');
      if (JSON.stringify(data).length > 120000) fail(413, 'El registro es demasiado grande.');
      if (collection === 'asistencia' && body.operation === 'add') {
        const person = await tx.get(`personas/${identifier(data.personaId)}`); if (!person || person.deletedAt) fail(404, 'Persona no disponible.');
        if (profile?.role === 'leader' && person.ministerio !== profile.ministerio) fail(403, 'No puedes registrar otro ministerio.');
        let operator = person.nombre;
        if (!masterAttendance) {
          const registrante = string(body.device?.registrante, 160) || session.personName || person.nombre;
          if (!session.personName) tx.set(sessionPath, { personName: registrante, legacyDeviceId: string(body.device?.id, 160) }, true);
          operator = session.personName || registrante;
          const pair = norm(operator).includes('javier') && norm(person.nombre).includes('rosario') || norm(operator).includes('rosario') && norm(person.nombre).includes('javier');
          if (!profile && norm(operator) !== norm(person.nombre) && !pair) fail(403, 'Se requiere un código administrativo para registrar a otra persona.');
        }
        if (!validDate(data.fecha) || data.fecha > dateCR(now())) fail(400, 'Fecha de asistencia inválida.');
        const existing = await tx.list('asistencia', [['personaId', '==', person.id], ['fecha', '==', data.fecha]]);
        const duplicate = existing.find(r => r.ministerio === person.ministerio && present(r)); if (duplicate) return { data: { id: duplicate.id, duplicate: true } };
        const rid = `${data.fecha}_${digest(person.id + '\0' + person.ministerio).slice(0, 32)}`;
        if (existing.some(r => r.id === rid || (r.ministerio === person.ministerio && !r.deletedAt && r.estado === 'pendiente'))) {
          fail(409, 'Ya hay un registro para revisión administrativa. No se creó otro.');
        }
        if (!masterAttendance && profile?.role !== 'superadmin') {
          const fix = data.location;
          const gps = await tx.get('config/gps');
          const markedAt = Date.parse(data.timestamp);
          if (!validAttendanceLocation(fix, gps) || !Number.isFinite(markedAt) ||
              Math.abs(markedAt - fix.capturedAt) > 30000 || fix.capturedAt > +now() + 30000 ||
              dateCR(new Date(fix.capturedAt)) !== data.fecha) {
            fail(422, 'Ubicación fuera de rango o imprecisa. La asistencia no se guardó.');
          }
        }
        tx.set(`asistencia/${rid}`, { personaId: person.id, nombre: person.nombre, ministerio: person.ministerio, fecha: data.fecha, hora: required(data.hora, 'La hora', 50), timestamp: data.timestamp || now(), registradoPor: profile?.name || operator, estado: 'presente', createdAt: +now(), ...(masterAttendance && { origen: 'mids-master' }) });
        return { data: { id: rid } };
      }
      if (['admin_alerts', 'attemptLogs', 'update_delivery_logs', 'fcm_tokens'].includes(collection) && body.operation !== 'delete') {
        if (JSON.stringify(data).length > 16000) fail(413, 'Registro técnico demasiado grande.'); const rid = docId || randomUUID(); tx.set(`${collection}/${rid}`, { ...data, serverReceivedAt: +now(), secureDeviceId: session.id }, true); return { data: { id: rid } };
      }
      if (collection === 'adminUsers' || collection === 'auditLogs' || collection === 'config' && ['admin', 'identityReset'].includes(docId)) fail(403, 'Usa la herramienta administrativa específica.');
      const rid = docId || randomUUID(), path = `${collection}/${rid}`, before = docId ? await tx.get(path) : null;
      if (profile?.role === 'leader') {
        if (collection === 'personas') {
          if ((before && before.ministerio !== profile.ministerio) ||
              (data.ministerio && data.ministerio !== profile.ministerio)) fail(403, 'No puedes modificar otro ministerio.');
          if (Object.keys(data).some(k => !['nombre','nombreDisplay','ministerio'].includes(k))) fail(400, 'Campos de persona no autorizados.');
          if (body.operation !== 'delete') data.ministerio = profile.ministerio;
        } else {
          if (collection !== 'absences') fail(403, 'No tienes autorización para modificar este registro.');
          if (Object.keys(data).some(k => !['personaId','fecha','ministerio','motivo'].includes(k))) fail(400, 'Solo puedes corregir el motivo de una ausencia.');
          const ministry = before?.ministerio || data.ministerio;
          if (ministry && ministry !== profile.ministerio) fail(403, 'No puedes modificar otro ministerio.');
        }
      } else superOnly();
      if (docId && !before) fail(404, 'Registro no encontrado.');
      if (collection === 'absences') {
        const personId = before?.personaId || data.personaId, date = before?.fecha || data.fecha;
        if (!validDate(date)) fail(400, 'Fecha de ausencia inválida.');
        const person = await tx.get(`personas/${identifier(personId)}`); if (!person) fail(404, 'Persona no encontrada.');
        if (profile.role === 'leader' && person.ministerio !== profile.ministerio) fail(403, 'La persona pertenece a otro ministerio.');
        if (before && (data.personaId && data.personaId !== before.personaId || data.fecha && data.fecha !== before.fecha || data.ministerio && data.ministerio !== before.ministerio)) fail(400, 'No se puede reasignar la ausencia a otra persona, fecha o ministerio.');
        if (!countsOnDate(person, date)) fail(400, 'Esta fecha no cuenta como asistencia para esta persona.');
        if (profile.role === 'leader' && (await tx.list('asistencia', [['personaId', '==', personId], ['fecha', '==', date]])).some(present)) fail(403, 'La persona está presente. Solo superadministración puede corregirla.');
        data.personaId = person.id; data.ministerio = person.ministerio; data.nombre = person.nombre;
        if (!before && (await tx.list('absences',[['personaId','==',personId],['fecha','==',date]])).some(r=>!r.deletedAt && r.ministerio===person.ministerio)) fail(409,'Ya existe una ausencia para esta persona y fecha.');
        if (body.operation !== 'delete') data.motivo = required(data.motivo || before?.motivo, 'El motivo de ausencia', 500);
      }
      if (collection === 'ministerios') {
        if (body.operation !== 'delete') data.nombre = before && data.nombre === before.nombre ? before.nombre : required(data.nombre || before?.nombre, 'El nombre', 160);
        if (before && (body.operation === 'delete' || data.nombre !== before.nombre)) {
          const linked = await Promise.all(['personas','asistencia','absences','secureProfiles'].map(c => tx.list(c, [['ministerio','==',before.nombre]], 15000)));
          if (linked.some(rows => rows.some(r => !r.deletedAt))) fail(409, 'Este ministerio tiene personas, accesos o registros vinculados. Conserva su nombre para no separar el historial.');
        }
      }
      if (collection === 'personas' && body.operation !== 'delete') {
        data.nombre = required(data.nombre || before?.nombre, 'El nombre', 160);
        const ministry = data.ministerio || before?.ministerio;
        if (!(await tx.list('ministerios', [['nombre','==',ministry]])).some(m => !m.deletedAt)) fail(400, 'Selecciona un ministerio válido.');
        data.ministerio = ministry;
      }
      if (collection === 'config') {
        if (!['gps','system'].includes(docId) || body.operation === 'delete') fail(403, 'Configuración no autorizada.');
        if (docId === 'gps' && (![data.lat,data.lng,data.radius].every(Number.isFinite) || Math.abs(data.lat)>90 || Math.abs(data.lng)>180 || data.radius<1 || data.radius>5000 || typeof data.required !== 'boolean')) fail(400,'Ubicación o radio inválidos.');
      }
      if (body.version !== undefined && body.version !== (before?.version || 0)) fail(409, 'Otra persona modificó el registro. Vuelve a cargarlo.');
      const after = body.operation === 'delete' ? { ...before, deletedAt: +now(), estado: collection === 'asistencia' ? 'anulado' : before?.estado || 'inactivo' } : { ...(before || {}), ...data, version: (before?.version || 0) + 1 };
      delete after.id;
      tx.set(path, after); audit(`${collection}.${body.operation === 'delete' ? 'delete' : before ? 'update' : 'create'}`, path, before, after, body.reason);
      return { data: { id: rid, version: after.version || 0 } };
    });
  } };
}
