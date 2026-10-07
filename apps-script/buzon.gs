/**
 * Buzón de entregas — ICS64225 Inteligencia Artificial y Estrategia Empresarial
 *
 * Crea un formulario por avance, lo cierra automáticamente a la hora indicada y sube cada PDF
 * recibido al repositorio de GitHub.
 *
 * Instrucciones de instalación: ver apps-script/README.md
 */

// ---------------------------------------------------------------------------
// 1. CONFIGURACIÓN
// ---------------------------------------------------------------------------

const CONFIG = {
  owner: 'hizocar',
  repo: 'ia-course-entregas',
  branch: 'main',
  // Zona horaria usada para interpretar las fechas y horas de abajo.
  timeZone: 'America/Santiago',
  correoDocente: 'sebastian.azocarm@usm.cl',
};

/**
 * Un objeto por avance. `cierre` es la hora a la que el buzón deja de aceptar respuestas.
 * `limite` es la hora hasta la cual la entrega se considera "a tiempo" según la regla del curso.
 */
const AVANCES = [
  { id: 'hito6a', titulo: 'Hito 6A — Primera mitigación implementada', fecha: '2026-10-07', cierre: '19:20', limite: '19:00' },
  { id: 'hito6b', titulo: 'Hito 6B — Comparación v1 vs. v2',            fecha: '2026-10-14', cierre: '19:20', limite: '19:00' },
  { id: 'hito6c', titulo: 'Hito 6C — Prototipo v2 cerrado',             fecha: '2026-10-19', cierre: '19:20', limite: '19:00' },
  { id: 'hito7a', titulo: 'Hito 7A — Impacto social',                   fecha: '2026-10-21', cierre: '19:20', limite: '19:00' },
  { id: 'hito7b', titulo: 'Hito 7B — Evaluación privada',               fecha: '2026-10-26', cierre: '19:20', limite: '19:00' },
  { id: 'hito7c', titulo: 'Hito 7C — Costos de operar',                 fecha: '2026-10-28', cierre: '19:20', limite: '19:00' },
  { id: 'hito7d', titulo: 'Hito 7D — Beneficio y conclusión',           fecha: '2026-11-02', cierre: '19:20', limite: '19:00' },
  { id: 'pitcha', titulo: 'Presentación final · Avance 1 — Estructura del pitch', fecha: '2026-11-04', cierre: '19:20', limite: '19:00' },
  { id: 'pitchb', titulo: 'Presentación final · Avance 2 — Ensayo',     fecha: '2026-11-09', cierre: '19:20', limite: '19:00' },
];

// ---------------------------------------------------------------------------
// 2. CREAR LOS BUZONES  (ejecutar una vez: función `crearBuzones`)
// ---------------------------------------------------------------------------

function crearBuzones() {
  const props = PropertiesService.getScriptProperties();
  const urls = [];

  AVANCES.forEach(function (avance) {
    const guardado = props.getProperty('form_' + avance.id);
    if (guardado) {
      urls.push(avance.id + '  →  ' + FormApp.openById(guardado).getPublishedUrl());
      return; // ya existe, no se duplica
    }

    const form = FormApp.create('Buzón ' + avance.titulo);
    form.setDescription(
      'Entrega del avance "' + avance.titulo + '".\n\n' +
      'Este buzón se cierra automáticamente a las ' + avance.cierre + ' del ' + avance.fecha + '.\n' +
      'Solo se evalúa lo enviado hasta las ' + avance.limite + '. Un envío posterior queda ' +
      'registrado como fuera de plazo.\n\n' +
      'Sube un único archivo PDF por grupo.'
    );

    form.addTextItem()
      .setTitle('Nombre del grupo')
      .setHelpText('Escríbelo igual que en la planilla de grupos del curso.')
      .setRequired(true);

    form.addParagraphTextItem()
      .setTitle('Integrantes presentes en esta sesión')
      .setHelpText('Un nombre por línea.')
      .setRequired(true);

    const archivo = form.addFileUploadItem()
      .setTitle('Archivo PDF del avance')
      .setHelpText('Un solo archivo, en formato PDF.')
      .setRequired(true);

    // Estas restricciones dependen del dominio; si no están disponibles, el formulario igual
    // funciona y se pueden ajustar a mano desde la interfaz de Google Forms.
    try { archivo.setMaxFiles(1); } catch (e) { Logger.log('setMaxFiles no disponible: ' + e); }
    try { archivo.setAllowedFileTypes([FormApp.FileType.PDF]); } catch (e) { Logger.log('setAllowedFileTypes no disponible: ' + e); }
    try { archivo.setMaxFileSize(FormApp.FileUploadItem ? 20 * 1024 * 1024 : 20 * 1024 * 1024); } catch (e) { Logger.log('setMaxFileSize no disponible: ' + e); }

    try { form.setCollectEmail(true); } catch (e) { Logger.log('setCollectEmail no disponible: ' + e); }
    try { form.setRequireLogin(true); } catch (e) { Logger.log('setRequireLogin no disponible: ' + e); }

    props.setProperty('form_' + avance.id, form.getId());

    // Disparador que procesa cada entrega
    ScriptApp.newTrigger('alRecibirEntrega').forForm(form).onFormSubmit().create();

    // Disparador que cierra el buzón a la hora de cierre
    const cierre = _fechaHora(avance.fecha, avance.cierre);
    if (cierre.getTime() > Date.now()) {
      ScriptApp.newTrigger('cerrarBuzones').timeBased().at(cierre).create();
    }

    urls.push(avance.id + '  →  ' + form.getPublishedUrl());
  });

  Logger.log('Buzones disponibles:\n' + urls.join('\n'));
  return urls;
}

/** Imprime las URLs de todos los buzones ya creados (para pegarlas en el sitio del curso). */
function listarBuzones() {
  const props = PropertiesService.getScriptProperties();
  const urls = AVANCES.map(function (a) {
    const id = props.getProperty('form_' + a.id);
    return a.id + '  →  ' + (id ? FormApp.openById(id).getPublishedUrl() : '(no creado)');
  });
  Logger.log(urls.join('\n'));
  return urls;
}

// ---------------------------------------------------------------------------
// 3. CIERRE AUTOMÁTICO
// ---------------------------------------------------------------------------

/** Cierra todo buzón cuya hora de cierre ya pasó. Lo llama el disparador de tiempo. */
function cerrarBuzones() {
  const props = PropertiesService.getScriptProperties();
  const ahora = new Date();

  AVANCES.forEach(function (avance) {
    const formId = props.getProperty('form_' + avance.id);
    if (!formId) return;
    const cierre = _fechaHora(avance.fecha, avance.cierre);
    if (ahora.getTime() < cierre.getTime()) return;

    const form = FormApp.openById(formId);
    if (form.isAcceptingResponses()) {
      form.setAcceptingResponses(false);
      form.setCustomClosedFormMessage(
        'El buzón de "' + avance.titulo + '" se cerró a las ' + avance.cierre + ' del ' +
        avance.fecha + '. Escribe a ' + CONFIG.correoDocente + ' si tienes una justificación formal.'
      );
      Logger.log('Buzón cerrado: ' + avance.id);
    }
  });
}

// ---------------------------------------------------------------------------
// 4. PROCESAR CADA ENTREGA
// ---------------------------------------------------------------------------

function alRecibirEntrega(e) {
  const formId = e.source.getId();
  const avance = _avanceDeFormulario(formId);
  if (!avance) { Logger.log('Formulario sin avance asociado: ' + formId); return; }

  const respuestas = e.response.getItemResponses();
  let grupo = '';
  let integrantes = '';
  let archivos = [];

  respuestas.forEach(function (r) {
    const titulo = r.getItem().getTitle();
    const valor = r.getResponse();
    if (titulo.indexOf('Nombre del grupo') === 0) grupo = String(valor).trim();
    else if (titulo.indexOf('Integrantes') === 0) integrantes = String(valor).trim();
    else if (r.getItem().getType() === FormApp.ItemType.FILE_UPLOAD) archivos = [].concat(valor);
  });

  if (!grupo || archivos.length === 0) { Logger.log('Entrega incompleta, se omite.'); return; }

  const enviado = e.response.getTimestamp();
  const limite = _fechaHora(avance.fecha, avance.limite);
  const aTiempo = enviado.getTime() <= limite.getTime();
  const slug = _slug(grupo);
  const sello = Utilities.formatDate(enviado, CONFIG.timeZone, 'yyyy-MM-dd HH:mm');

  archivos.forEach(function (fileId, i) {
    const file = DriveApp.getFileById(fileId);
    const sufijo = archivos.length > 1 ? '-' + (i + 1) : '';
    const ruta = 'entregas/' + avance.id + '/' + slug + sufijo + '.pdf';
    const mensaje = avance.id + ': ' + grupo + ' (' + sello + (aTiempo ? '' : ', fuera de plazo') + ')';
    _subirAGitHub(ruta, file.getBlob().getBytes(), mensaje);
  });

  _registrar(avance, grupo, integrantes, slug, sello, aTiempo);
}

/** Agrega una fila al CSV de registro del avance. */
function _registrar(avance, grupo, integrantes, slug, sello, aTiempo) {
  const ruta = 'entregas/' + avance.id + '/_registro.csv';
  const actual = _leerDeGitHub(ruta);
  const encabezado = 'grupo,archivo,enviado,a_tiempo,integrantes\n';
  const fila = [
    '"' + grupo.replace(/"/g, "'") + '"',
    slug + '.pdf',
    sello,
    aTiempo ? 'si' : 'NO',
    '"' + integrantes.replace(/\n/g, ' / ').replace(/"/g, "'") + '"',
  ].join(',') + '\n';

  const contenido = (actual === null ? encabezado : actual) + fila;
  _subirAGitHub(ruta, Utilities.newBlob(contenido).getBytes(), 'registro ' + avance.id + ': ' + grupo);
}

// ---------------------------------------------------------------------------
// 5. UTILIDADES
// ---------------------------------------------------------------------------

function _token() {
  const t = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!t) throw new Error('Falta GITHUB_TOKEN en las propiedades del script.');
  return t;
}

function _api(ruta) {
  return 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' +
    ruta.split('/').map(encodeURIComponent).join('/');
}

function _leerDeGitHub(ruta) {
  const res = UrlFetchApp.fetch(_api(ruta) + '?ref=' + CONFIG.branch, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token(), Accept: 'application/vnd.github+json' },
  });
  if (res.getResponseCode() === 404) return null;
  const data = JSON.parse(res.getContentText());
  return Utilities.newBlob(Utilities.base64Decode(data.content)).getDataAsString();
}

function _shaDeGitHub(ruta) {
  const res = UrlFetchApp.fetch(_api(ruta) + '?ref=' + CONFIG.branch, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token(), Accept: 'application/vnd.github+json' },
  });
  if (res.getResponseCode() === 404) return null;
  return JSON.parse(res.getContentText()).sha;
}

function _subirAGitHub(ruta, bytes, mensaje) {
  const payload = {
    message: mensaje,
    content: Utilities.base64Encode(bytes),
    branch: CONFIG.branch,
  };
  const sha = _shaDeGitHub(ruta);
  if (sha) payload.sha = sha; // sobrescribe si el grupo reenvía

  const res = UrlFetchApp.fetch(_api(ruta), {
    method: 'put',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + _token(), Accept: 'application/vnd.github+json' },
    payload: JSON.stringify(payload),
  });

  const code = res.getResponseCode();
  if (code >= 300) throw new Error('GitHub respondió ' + code + ': ' + res.getContentText());
  Logger.log('Subido: ' + ruta);
}

function _avanceDeFormulario(formId) {
  const props = PropertiesService.getScriptProperties();
  for (let i = 0; i < AVANCES.length; i++) {
    if (props.getProperty('form_' + AVANCES[i].id) === formId) return AVANCES[i];
  }
  return null;
}

function _fechaHora(fecha, hora) {
  return new Date(Utilities.formatDate(
    new Date(fecha + 'T' + hora + ':00'), CONFIG.timeZone, "yyyy/MM/dd HH:mm:ss"
  ));
}

function _slug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'grupo-sin-nombre';
}
