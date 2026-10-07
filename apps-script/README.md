# Buzón de entregas — instalación

Aplicación web de Google Apps Script. Sirve los nueve buzones del curso desde **una sola URL**,
verifica la hora de entrega y sube cada PDF a este repositorio.

Funciona con cualquier cuenta de Google. No usa Google Forms (la subida de archivos en Forms solo
está disponible en cuentas Google Workspace).

## Archivos

| Archivo | Qué es |
|---|---|
| `Codigo.gs` | Lógica: horarios, validación, subida a GitHub |
| `Index.html` | La página que ven los estudiantes |

## Pasos (15 minutos, una sola vez)

### 1. Token de GitHub

GitHub → *Settings* → *Developer settings* → *Personal access tokens* → **Fine-grained tokens** →
*Generate new token*:

- **Repository access:** Only select repositories → `hizocar/ia-course-entregas`
- **Permissions** → *Repository permissions* → **Contents: Read and write**
- **Expiration:** después del término del curso (ej. 31 de diciembre de 2026)

Copia el token; se muestra una sola vez.

### 2. Proyecto de Apps Script

1. Entra a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Renómbralo a `Buzón ICS64225`.
3. Pega el contenido de `Codigo.gs` en el archivo `Código.gs` que viene por defecto.
4. Botón **+** junto a *Archivos* → **HTML** → nómbralo exactamente `Index` → pega `Index.html`.
5. Guarda (💾).

### 3. Token como propiedad del script

*Configuración del proyecto* (⚙️) → *Propiedades del script* → **Añadir propiedad**:

| Propiedad | Valor |
|---|---|
| `GITHUB_TOKEN` | el token del paso 1 |

### 4. Verificar la conexión

Selecciona la función `probarConexion` → **Ejecutar**. Google pedirá autorización la primera vez
("Esta app no está verificada" → *Configuración avanzada* → *Ir a Buzón ICS64225*).

Si funciona, aparece `entregas/_prueba.txt` en este repositorio. Bórralo después.

### 5. Desplegar como aplicación web

**Implementar** → *Nueva implementación* → ⚙️ → **Aplicación web**:

| Campo | Valor |
|---|---|
| Ejecutar como | **Yo** (tu cuenta) |
| Quién tiene acceso | **Cualquier usuario** |

> "Cualquier usuario" es necesario para que los estudiantes no tengan que iniciar sesión con una
> cuenta Google. El buzón solo acepta envíos dentro del horario de la clase, así que la ventana de
> exposición son esas dos horas.

Copia la **URL de la aplicación web** (termina en `/exec`).

### 6. Obtener las nueve URLs

Ejecuta la función `listarBuzones` y abre el registro (*Ver* → *Registros*). Imprime:

```
hito6a  →  https://script.google.com/macros/s/AKfy.../exec?a=hito6a
hito6b  →  https://script.google.com/macros/s/AKfy.../exec?a=hito6b
...
```

Esas son las URLs que van en los botones del sitio del curso
(`docs/entregas.md` y el bloque del buzón al final de cada clase).

## Cómo funciona

- **Una URL, nueve buzones.** El parámetro `?a=<id>` elige el avance; sin parámetro muestra el
  índice de todos.
- **El cierre se evalúa al enviar**, comparando la hora del servidor con `limite` (19:00) y `cierre`
  (19:20) del avance. No hay disparadores programados que puedan fallar.
- Entre las 19:00 y las 19:20 el buzón sigue aceptando, pero marca la entrega como fuera de plazo
  tanto en pantalla como en el registro.
- Cada PDF se guarda en `entregas/<avance>/<nombre-del-grupo>.pdf`. Si un grupo reenvía, se
  sobrescribe el archivo y el registro conserva ambos envíos.
- `LockService` evita que dos envíos simultáneos se pisen al escribir el CSV.

## Cambiar fechas u horarios

Todo está en la constante `AVANCES` de `Codigo.gs`. Después de editar, guarda y vuelve a
**Implementar** → *Administrar implementaciones* → ✏️ → *Nueva versión* → **Implementar**.
Las URLs no cambian.
