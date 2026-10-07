# Instalación del buzón (15 minutos, una sola vez)

El buzón son formularios de Google creados por un script. El script también los cierra a la hora
indicada y sube cada PDF a este repositorio.

> ⚠️ Los formularios deben crearse **con tu cuenta de Google**, así que estos pasos los tienes que
> hacer tú. El script ya está escrito: solo hay que pegarlo y ejecutarlo.

## 1. Crear un token de GitHub

1. Entra a <https://github.com/settings/tokens?type=beta> → **Generate new token**.
2. Nombre: `buzon-entregas`. Expiración: la que prefieras (conviene que cubra el semestre).
3. **Repository access** → *Only select repositories* → `hizocar/ia-course-entregas`.
4. **Permissions** → *Repository permissions* → **Contents: Read and write**.
5. Genera el token y **cópialo** (se muestra una sola vez).

## 2. Crear el proyecto de Apps Script

1. Entra a <https://script.google.com> → **Nuevo proyecto**.
2. Nómbralo `Buzón ICS64225`.
3. Borra el contenido de `Código.gs` y pega **todo** el contenido de [`buzon.gs`](buzon.gs).
4. En el menú izquierdo, **Configuración del proyecto** (el engranaje) →
   **Propiedades del script** → *Agregar propiedad*:
   - Propiedad: `GITHUB_TOKEN`
   - Valor: el token del paso 1
5. Guarda.

## 3. Crear los buzones

1. En el selector de funciones, elige **`crearBuzones`** y presiona **Ejecutar**.
2. Google pedirá autorización la primera vez: acepta los permisos (crear formularios, leer los
   archivos subidos y conectarse a GitHub).
3. Al terminar, abre **Ver → Registro de ejecución**: ahí aparece la URL de cada buzón.

Esto crea un formulario por avance, con tres campos obligatorios (nombre del grupo, integrantes
presentes y archivo PDF), y programa el cierre automático de cada uno.

## 4. Pegar las URLs en el sitio del curso

Copia las URLs del registro y pégalas en
[`docs/entregas.md`](https://github.com/hizocar/ia-course-usm/blob/main/docs/entregas.md)
del repositorio del sitio, reemplazando los `#` de cada botón. Es el único archivo que hay que
editar: las páginas de clase enlazan a esa página.

Si necesitas verlas de nuevo más tarde, ejecuta la función **`listarBuzones`**.

## Cómo funciona después

| Momento | Qué pasa |
|---|---|
| Durante la clase | El grupo abre el buzón, escribe su nombre y sube el PDF |
| Al recibir la entrega | El script sube el archivo a `entregas/<avance>/<grupo>.pdf` y agrega una fila a `_registro.csv` con la hora exacta |
| A las 19:20 | Un disparador de tiempo cierra el formulario con un mensaje explicando el cierre |

La columna `a_tiempo` del registro marca `NO` si el envío llegó después de las 19:00, que es el
límite de la regla del curso. El buzón acepta hasta las 19:20 solo como margen.

## Ajustes frecuentes

- **Cambiar una fecha u hora:** edita la lista `AVANCES` al inicio del script y vuelve a ejecutar
  `crearBuzones` (los formularios ya creados no se duplican; para reprogramar un cierre, borra el
  disparador antiguo en *Disparadores*).
- **Agregar un avance nuevo:** añade una línea a `AVANCES` y ejecuta `crearBuzones`.
- **Reabrir un buzón:** abre el formulario y activa de nuevo "Aceptar respuestas".
- **Si un grupo reenvía:** el archivo se sobrescribe y queda una fila extra en el registro, así que
  siempre se puede ver qué versión llegó a qué hora.
