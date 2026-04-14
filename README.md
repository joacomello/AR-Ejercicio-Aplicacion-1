# ADR [#] - [Título – es la decisión tomada]

**Equipo:**

- 305595 - Joaquin Mello
- 282191 - Catalina Griego
- 308052 - Mainoí Caballero
- 298024 - Carolina Otero

---

## Fuerzas

- Modularidad: El negocio requiere que las reglas de validación y cálculo sean independientes.
- Configurabilidad: Se debe poder habilitar o deshabilitar pasos del proceso (filtros) sin afectar al resto.
- Resiliencia: La integración con APIs externas (tipo de cambio) no debe ser un punto único de falla.
- Testabilidad: Cada regla de negocio (descuentos, tasas, validaciones) debe poder probarse de forma aislada.

---

## Decisión

Nosotros haremos uso del patrón arquitectónico Pipes & Filters. Cada reserva fluye a través de una tubería compuesta por una serie de filtros independientes que comparten un contexto común (ReservationContext). La ejecución es secuencial y permite detener el proceso si un filtro de validación falla.

## Justificación

Este patrón es ideal para sistemas de procesamiento de datos por pasos. Permite cumplir con el requerimiento de "filtros independientes y testeables" y facilita la implementación de los endpoints de configuración del pipeline. Se rechazó una arquitectura monolítica tradicional porque dificultaría la activación/desactivación dinámica de las reglas de cálculo.

## Estado

[Borrador / Propuesta / Aceptada / Despreciada / Reemplazada]

---

## Consecuencias

- **Se adoptó por:**  
  Facilidad para agregar nuevas reglas de negocio y reporte de errores.
- **Se adoptó a pesar de:**  
  Incremento de complejidad inicial para gestionar el estado del contexto a través de la tubería.

- **Opción rechazada:**
  - Enfoque Monolítico
    Se rechazó la creación de un único servicio de reserva con una función lineal gigante. Aunque es más simple de implementar inicialmente, viola el principio de Responsabilidad Única (SRP) y hace que el sistema sea extremadamente rígido
  - Responsabilidad en Cadena
    Se descartó porque semánticamente este patrón se utiliza para que uno de muchos receptores maneje una petición y detenga el flujo. En nuestro sistema de vuelos, necesitamos que todos los filtros procesen la reserva de forma acumulativa.

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
