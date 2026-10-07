# Buzón de entregas — ICS64225 Inteligencia Artificial y Estrategia Empresarial

Repositorio donde quedan almacenadas las entregas de los avances del
[Proyecto del curso](https://hizocar.github.io/ia-course-usm/proyecto/).

Cada avance tiene su propio **buzón** (un formulario de Google) que se abre durante la clase y se
**cierra automáticamente a las 19:20** del mismo día. Al recibir una entrega, un script sube el PDF
a este repositorio.

## Estructura

```
entregas/
  hito6a/
    nombre-del-grupo.pdf
    _registro.csv        ← grupo, archivo, fecha y hora de envío, ¿a tiempo?
  hito6b/
  hito6c/
  ...
```

El archivo `_registro.csv` de cada avance deja la hora exacta de cada envío, que es lo que permite
verificar la regla del curso: **solo se evalúa lo enviado entre las 17:30 y las 19:00** (el buzón
acepta hasta las 19:20 como margen de cierre).

## Cómo se administra

El buzón se crea y se cierra con un script de Google Apps Script. Las instrucciones están en
[`apps-script/README.md`](apps-script/README.md).
