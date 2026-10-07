/**
 * Buzón de entregas — ICS64225 Inteligencia Artificial y Estrategia Empresarial
 *
 * Web App: una sola URL sirve los nueve buzones (?a=hito6a, ?a=hito6b, ...). Recibe un PDF por
 * grupo, verifica la hora contra el horario de la clase y sube el archivo al repositorio de GitHub.
 *
 * No usa Google Forms, así que funciona con cualquier cuenta de Google (no requiere Workspace).
 *
 * Instalación: ver apps-script/README.md
 */

// ---------------------------------------------------------------------------
// 1. CONFIGURACIÓN
// ---------------------------------------------------------------------------

const CONFIG = {
  owner: 'hizocar',
  repo: 'ia-course-entregas',
  branch: 'main',
  timeZone: 'America/Santiago',
  correoDocente: 'sebastian.azocarm@usm.cl',
  // El buzón se abre a esta hora. Antes de esto no acepta envíos.
  apertura: '17:00',
  // Tamaño máximo por archivo (MB).
  maxMB: 15,
};

/**
 * Un objeto por avance.
 *  - `limite`: hora hasta la cual la entrega se considera a tiempo (regla del curso).
 *  - `cierre`: hora a la que el buzón deja de aceptar envíos.
 */
const AVANCES = [
  { id: 'hito6a', titulo: 'Hito 6A — Primera mitigación implementada',             fecha: '2026-10-07', cierre: '19:20', limite: '19:00' },
  { id: 'hito6b', titulo: 'Hito 6B — Comparación v1 vs. v2',                       fecha: '2026-10-14', cierre: '19:20', limite: '19:00' },
  { id: 'hito6c', titulo: 'Hito 6C — Prototipo v2 cerrado',                        fecha: '2026-10-19', cierre: '19:20', limite: '19:00' },
  { id: 'hito7a', titulo: 'Hito 7A — Impacto social',                              fecha: '2026-10-21', cierre: '19:20', limite: '19:00' },
  { id: 'hito7b', titulo: 'Hito 7B — Evaluación privada',                          fecha: '2026-10-26', cierre: '19:20', limite: '19:00' },
  { id: 'hito7c', titulo: 'Hito 7C — Costos de operar',                            fecha: '2026-10-28', cierre: '19:20', limite: '19:00' },
  { id: 'hito7d', titulo: 'Hito 7D — Beneficio y conclusión',                      fecha: '2026-11-02', cierre: '19:20', limite: '19:00' },
  { id: 'pitcha', titulo: 'Presentación final · Avance 1 — Estructura del pitch',  fecha: '2026-11-04', cierre: '19:20', limite: '19:00' },
  { id: 'pitchb', titulo: 'Presentación final · Avance 2 — Ensayo del pitch',      fecha: '2026-11-09', cierre: '19:20', limite: '19:00' },
];

// ---------------------------------------------------------------------------
// 2. LA PÁGINA DEL BUZÓN
// ---------------------------------------------------------------------------

function doGet(e) {
  const id = (e && e.parameter && e.parameter.a) || '';
  const avance = _avance(id);
  const t = HtmlService.createTemplateFromFile('Index');

  t.avance = avance || null;
  t.estado = avance ? _estado(avance) : null;
  t.maxMB = CONFIG.maxMB;
  t.correo = CONFIG.correoDocente;
  t.listado = AVANCES.map(function (a) {
    return { id: a.id, titulo: a.titulo, fecha: _fechaLarga(a.fecha) };
  });

  return t.evaluate()
    .setTitle(avance ? 'Buzón · ' + avance.titulo : 'Buzones del curso')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Estado del buzón en este instante: 'antes' | 'abierto' | 'atrasado' | 'cerrado'.
 * 'atrasado' = pasó el límite de evaluación pero el buzón todavía acepta (margen de cierre).
 */
function _estado(avance) {
  const ahora = new Date();
  const abre = _fechaHora(avance.fecha, CONFIG.apertura);
  const limite = _fechaHora(avance.fecha, avance.limite);
  const cierra = _fechaHora(avance.fecha, avance.cierre);

  let codigo;
  if (ahora < abre) codigo = 'antes';
  else if (ahora <= limite) codigo = 'abierto';
  else if (ahora <= cierra) codigo = 'atrasado';
  else codigo = 'cerrado';

  return {
    codigo: codigo,
    fecha: _fechaLarga(avance.fecha),
    apertura: CONFIG.apertura,
    limite: avance.limite,
    cierre: avance.cierre,
    ahora: Utilities.formatDate(ahora, CONFIG.timeZone, 'HH:mm'),
  };
}

// ---------------------------------------------------------------------------
// 3. RECEPCIÓN DE LA ENTREGA  (la llama el navegador vía google.script.run)
// ---------------------------------------------------------------------------

function recibirEntrega(datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // evita que dos grupos escriban el CSV al mismo tiempo
  try {
    const avance = _avance(datos.avanceId);
    if (!avance) throw new Error('Avance desconocido.');

    const estado = _estado(avance);
    if (estado.codigo === 'antes') {
      throw new Error('El buzón todavía no abre. Abre a las ' + CONFIG.apertura + ' del ' + estado.fecha + '.');
    }
    if (estado.codigo === 'cerrado') {
      throw new Error('El buzón cerró a las ' + avance.cierre + '. Escribe a ' + CONFIG.correoDocente + ' si tienes una justificación formal.');
    }

    const grupo = String(datos.grupo || '').trim();
    const integrantes = String(datos.integrantes || '').trim();
    if (!grupo) throw new Error('Falta el nombre del grupo.');
    if (!integrantes) throw new Error('Faltan los integrantes presentes.');
    if (!datos.archivo || !datos.archivo.base64) throw new Error('No se recibió ningún archivo.');

    const nombre = String(datos.archivo.nombre || 'entrega.pdf');
    if (!/\.pdf$/i.test(nombre)) throw new Error('El archivo debe ser un PDF.');

    const bytes = Utilities.base64Decode(datos.archivo.base64);
    if (bytes.length > CONFIG.maxMB * 1024 * 1024) {
      throw new Error('El archivo pesa más de ' + CONFIG.maxMB + ' MB.');
    }
    if (bytes.length < 5 || String.fromCharCode(bytes[0] & 0xff, bytes[1] & 0xff, bytes[2] & 0xff, bytes[3] & 0xff) !== '%PDF') {
      throw new Error('El archivo no parece ser un PDF válido.');
    }

    const slug = _slug(grupo);
    const sello = new Date();
    const aTiempo = estado.codigo === 'abierto';
    const ruta = 'entregas/' + avance.id + '/' + slug + '.pdf';

    _subirAGitHub(ruta, bytes,
      avance.id + ': entrega de ' + grupo + (aTiempo ? '' : ' (fuera de plazo)'));
    _registrar(avance, grupo, integrantes, slug, sello, aTiempo);

    return {
      ok: true,
      aTiempo: aTiempo,
      hora: Utilities.formatDate(sello, CONFIG.timeZone, 'HH:mm:ss'),
      archivo: ruta,
      mensaje: aTiempo
        ? 'Entrega recibida dentro del horario de clases.'
        : 'Entrega recibida DESPUÉS de las ' + avance.limite + '. Queda registrada como fuera de plazo.',
    };
  } finally {
    lock.releaseLock();
  }
}

function _registrar(avance, grupo, integrantes, slug, sello, aTiempo) {
  const ruta = 'entregas/' + avance.id + '/_registro.csv';
  const existente = _leerDeGitHub(ruta);
  const encabezado = 'grupo,archivo,enviado,a_tiempo,integrantes\n';
  const fila = [
    _csv(grupo),
    _csv(slug + '.pdf'),
    _csv(Utilities.formatDate(sello, CONFIG.timeZone, 'yyyy-MM-dd HH:mm:ss')),
    aTiempo ? 'si' : 'no',
    _csv(integrantes.replace(/\s*\n\s*/g, '; ')),
  ].join(',') + '\n';

  const contenido = (existente === null ? encabezado : existente) + fila;
  _subirAGitHub(ruta, Utilities.newBlob(contenido).getBytes(),
    avance.id + ': registro de ' + grupo);
}

// ---------------------------------------------------------------------------
// 4. GITHUB
// ---------------------------------------------------------------------------

function _token() {
  const t = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!t) throw new Error('Falta la propiedad de script GITHUB_TOKEN.');
  return t;
}

function _api(ruta) {
  return 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' +
    ruta.split('/').map(encodeURIComponent).join('/');
}

function _get(ruta) {
  const res = UrlFetchApp.fetch(_api(ruta) + '?ref=' + CONFIG.branch, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token(), Accept: 'application/vnd.github+json' },
  });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() >= 300) {
    throw new Error('GitHub respondió ' + res.getResponseCode() + ': ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function _leerDeGitHub(ruta) {
  const j = _get(ruta);
  return j ? Utilities.newBlob(Utilities.base64Decode(j.content.replace(/\n/g, ''))).getDataAsString() : null;
}

function _subirAGitHub(ruta, bytes, mensaje) {
  const actual = _get(ruta);
  const cuerpo = {
    message: mensaje,
    content: Utilities.base64Encode(bytes),
    branch: CONFIG.branch,
  };
  if (actual) cuerpo.sha = actual.sha; // sobrescribe la versión anterior

  const res = UrlFetchApp.fetch(_api(ruta), {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(cuerpo),
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token(), Accept: 'application/vnd.github+json' },
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('No se pudo guardar en GitHub (' + res.getResponseCode() + '): ' + res.getContentText());
  }
}

// ---------------------------------------------------------------------------
// 5. UTILIDADES
// ---------------------------------------------------------------------------

function _avance(id) {
  for (let i = 0; i < AVANCES.length; i++) if (AVANCES[i].id === id) return AVANCES[i];
  return null;
}

function _fechaHora(fecha, hora) {
  return new Date(Utilities.formatDate(
    new Date(fecha + 'T' + hora + ':00'), CONFIG.timeZone, "yyyy-MM-dd'T'HH:mm:ss"
  ) + _offset(fecha));
}

/** Desfase horario de Santiago para esa fecha, en formato ±HH:mm. */
function _offset(fecha) {
  const d = new Date(fecha + 'T12:00:00Z');
  const s = Utilities.formatDate(d, CONFIG.timeZone, 'Z'); // ej. "-0300"
  return s.slice(0, 3) + ':' + s.slice(3);
}

function _fechaLarga(fecha) {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const p = fecha.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()];
}

function _slug(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'grupo';
}

function _csv(v) {
  return '"' + String(v).replace(/"/g, '""') + '"';
}

/**
 * Imprime las URLs de los nueve buzones, listas para pegar en el sitio del curso.
 *
 * Ojo: ejecutada desde el editor, Apps Script devuelve la URL de PRUEBA (termina en /dev), que
 * solo funciona para ti y con sesión iniciada. La URL que va al sitio es la de producción
 * (termina en /exec) y se copia desde Implementar → Administrar implementaciones.
 */
function listarBuzones() {
  let base = ScriptApp.getService().getUrl();
  if (!base) {
    Logger.log('Todavía no hay despliegue. Implementar → Nueva implementación → Aplicación web.');
    return;
  }

  if (base.slice(-4) === '/dev') {
    Logger.log('⚠️  Esta es la URL de PRUEBA (/dev): solo funciona para ti.');
    Logger.log('⚠️  Copia la URL de producción (/exec) desde Implementar → Administrar implementaciones');
    Logger.log('⚠️  y pégala abajo en BASE_EXEC para que este listado imprima las URLs definitivas.');
    Logger.log('');
  }

  // Pega aquí la URL /exec (sin parámetros) para imprimir las URLs definitivas.
  const BASE_EXEC = '';
  if (BASE_EXEC) base = BASE_EXEC.replace(/\?.*$/, '');

  AVANCES.forEach(function (a) {
    Logger.log(a.id + '  →  ' + base + '?a=' + a.id);
  });
}

/** Comprueba que el token de GitHub funciona. Ejecútala una vez después de instalar. */
function probarConexion() {
  _subirAGitHub('entregas/_prueba.txt',
    Utilities.newBlob('Conexión verificada el ' + new Date()).getBytes(),
    'Prueba de conexión del buzón');
  Logger.log('OK: el token funciona y el repositorio acepta escrituras.');
}
