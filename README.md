# ADR [#] - [Título – es la decisión tomada]

**Equipo:**  
- 305595 - Joaquin Mello
- 282191 - Catalina Griego
- 308052 - Mainoí Caballero
- 298024 - Carolina Otero

---

## Fuerzas
[Describa aquí las fuerzas que influyeron la decisión de diseño, incluyendo los aspectos tecnológicos, costos de proyecto.]

---

## Decisión
[Describa aquí nuestra respuesta a estas fuerzas, es decir, la decisión de diseño que se tomó. Exprese la decisión en oraciones completas, con voz activa ("Nosotros haremos ...").]

---

## Justificación
[Describa aquí la justificación de la decisión de diseño. Indique también la justificación de alternativas significativas que hayan sido rechazadas. Esta sección también puede indicar suposiciones, restricciones, requisitos y resultados de evaluaciones y experimentos.]

---

## Estado
[Borrador / Propuesta / Aceptada / Despreciada / Reemplazada]

---

## Consecuencias

- **Se adoptó por:**  
  [Beneficio de adoptarla]

- **Se adoptó a pesar de:**  
  [Desventaja de adoptarla]

- [Repetir consecuencias]

- **Opción rechazada:**  
  [Opción rechazada]

[Describa aquí el contexto que resulta después de aplicar la decisión. Todas las consecuencias deben enumerarse, no solo las consecuencias "positivas". Indique también las consecuencias "negativas".]

---

## Material de referencia
[LINK]



# Sistema de Reservas de Vuelos

Sistema de procesamiento de reservas con Node.js, TypeScript, Express y el patrón Pipes & Filters.

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run build
npm start
```

El servidor escucha por defecto en `http://localhost:3000`.

## Tests

```bash
npm test
```

## Endpoints

### POST /reservations/process

Procesa un array de reservas por el pipeline.

Ejemplo:

```json
{
  "reservations": [
    {
      "id": "RES-001",
      "passengerId": "PAX-001",
      "flightCode": "AA001",
      "seatClass": "business",
      "originCountry": "US",
      "destinationCountry": "AR"
    }
  ]
}
```

### GET /reservations/:id/status

Devuelve el estado procesado de una reserva específica.

### GET /pipeline/config

Muestra la configuración activa del pipeline.

### PUT /pipeline/config

Permite habilitar o deshabilitar filtros y ajustar la configuración de conversión.

Ejemplo:

```json
{
  "enabledFilters": {
    "exchangeRateEnrichment": false
  }
}
```

## Arquitectura

- Los datos de validación viven en memoria en `src/data/`.
- Los repositorios son in-memory y se clonan para evitar efectos colaterales en tests.
- El filtro de tipo de cambio usa timeout, retry, cache y fallback.
- Cada filtro del pipeline es independiente y testeable por separado.

## Postman

La colección de Postman está en `postman/flight-reservations.postman_collection.json`.