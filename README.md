# ADR-EJ1 - Arquitectura Pipes & Filters para Sistema de Reservas de Vuelos

**Equipo:**
- 305595 - Joaquin Mello
- 282191 - Catalina Griego
- 308052 - Mainoí Caballero
- 298024 - Carolina Otero

---

## Fuerzas

- **Modularidad:** El negocio requiere que las reglas de validación y cálculo sean independientes.
- **Configurabilidad:** Se debe poder habilitar o deshabilitar pasos del proceso (filtros) sin afectar al resto.
- **Resiliencia:** La integración con APIs externas (tipo de cambio) no debe ser un punto único de falla.
- **Testabilidad:** Cada regla de negocio (descuentos, tasas, validaciones) debe poder probarse de forma aislada.

## Decisión

Se adopta el **patrón arquitectónico Pipes & Filters**. Cada reserva fluye a través de una tubería compuesta por **7 filtros independientes** que comparten un contexto común (`ReservationContext`). La ejecución es **secuencial**:

- **Filtros de validación** (Passenger, Flight): Detienen el pipeline si fallan (`context.failed = true`).
- **Filtros de cálculo/enriquecimiento** (Pricing, Exchange): Capturan errores internamente y continúan el pipeline, agregando advertencias.

### Flujo de Filtros
```
Entrada → PassengerValidation → FlightValidation → BasePriceCalculation 
       → LoyaltyDiscount → PassengerTypeAdjustment → TaxesAndFees 
       → ExchangeRateEnrichment → Salida
```

## Justificación

Este patrón es ideal para sistemas de **procesamiento de datos por etapas** porque:

1. **Separación de Responsabilidades:** Cada filtro maneja una única regla de negocio (SRP).
2. **Configurabilidad Dinámica:** Los endpoints `/pipeline/config` permiten habilitar/deshabilitar filtros sin despliegue.
3. **Testabilidad:** Cada filtro es independiente y puede testearse de forma aislada.
4. **Extensibilidad:** Es posible agregar nuevos filtros con modificaciones mínimas al código existente.

## Opciones Rechazadas

### Enfoque Monolítico
Crear un único servicio de reserva con una función lineal gigante.
- **Problema:** Viola SRP, dificulta pruebas unitarias, rígido ante cambios de negocio.

## Consecuencias

### Beneficios
- Facilidad para agregar nuevas reglas de negocio.
- Reporte de errores por filtro.
- Endpoints de configuración dinámica del pipeline.
- Cache y fallback en llamadas externas.

### Costos
- Complejidad inicial de implementación del pipeline.
- Necesidad de serializar/clonar datos en repositorios para evitar mutaciones.
- Overhead de validaciones en cada filtro.

---

## Referencias

- **Patrón Pipes & Filters:** Material de clase

---

# Sistema de Reservas de Vuelos - Documentación Técnica

## Stack Tecnológico

| Componente | Versión | Propósito |
|-----------|---------|----------|
| **Node.js** | 18+ | Runtime JavaScript |
| **TypeScript** | 6.0.2 | Type safety (strict mode) |
| **Express** | 5.2.1 | Framework HTTP |
| **tsx** | 4.20.3 | TypeScript executor para tests |

## Requisitos

- **Node.js** 18 o superior
- **npm** 10 o superior (incluido con Node.js)

## Instalación

### 1. Clonar/Descargar el Repositorio
```bash
cd AR-Ejercicio-Aplicacion-1
```

### 2. Instalar Dependencias
```bash
npm install
```

Este comando instala:
- **Producción:** `express`
- **Desarrollo:** `typescript`, `@types/express`, `@types/node`, `tsx`

### 3. Compilar TypeScript
```bash
npm run build
```

Genera archivos `.js` en la carpeta `dist/` con tipos verificados en strict mode.

## Ejecución

### Iniciar el Servidor
```bash
npm start
```

**Salida esperada:**
```
Server listening on port 3000
```

El servidor escucha en `http://localhost:3000` con los siguientes endpoints disponibles:
- `POST /reservations/process` - Procesar reservas
- `GET /reservations/:id/status` - Obtener estado de reserva
- `GET /pipeline/config` - Ver configuración del pipeline
- `PUT /pipeline/config` - Actualizar configuración del pipeline
- `GET /health` - Verificar salud del servidor

## Testing

### Ejecutar Suite Completa de Tests
```bash
npm test
```

## Estructura del Proyecto

```
src/
├── index.ts                    # Entry point Express
├── controllers/
│   ├── reservationController.ts
│   └── pipelineController.ts    
├── data/                       # Datos de prueba
│   ├── mockFlights.ts           
│   └── mockPassengers.ts        
├── models/
│   ├── flight.ts                
│   ├── passenger.ts             
│   └── reservation.ts           
├── pipes-filters/
│   ├── config.ts                # Configuración por defecto (filtros, exchange)
│   ├── pipeline.ts              # Orquestador de ejecución Pipes & Filters
│   ├── types.ts                 # Tipos de contexto y filtros
│   └── filters/                 # Filtros implementados
│       ├── basePriceCalculationFilter.ts
│       ├── exchangeRateEnrichmentFilter.ts
│       ├── flightValidationFilter.ts
│       ├── loyaltyDiscountFilter.ts
│       ├── passengerTypeAdjustmentFilter.ts
│       ├── passengerValidationFilter.ts
│       └── taxesAndFeesFilter.ts
├── repositories/
│   ├── flightRepository.ts      
│   ├── passengerRepository.ts   
│   └── reservationRepository.ts
└── services/
    ├── exchange.service.ts      # API integraciones 
    └── reservation.service.ts   # Orquestador principal (singleton)

tests/
├── reservation.test.ts          # 25 tests (unitarios + integración)
└── tsconfig.json                # Config TypeScript para tests

postman/
└── flight-reservations.postman_collection.json  # requests de prueba
```

## Flujo de Procesamiento

```
POST /reservations/process
           ↓
  Validación de Payload (400 si inválido)
           ↓
  Para cada reserva en el array:
           ↓
  [1] PassengerValidationFilter
      ├─ ✗ Pasajero inactivo → error, stop
      └─ ✓ Validado → context.passenger
           ↓
  [2] FlightValidationFilter
      ├─ ✗ Vuelo sin asientos → error, stop
      ├─ ✗ Vuelo pasado → error, stop
      └─ ✓ Validado → context.flight
           ↓
  [3] BasePriceCalculationFilter
      └─ basePriceUSD × seatMultiplier → subtotalUSD
           ↓
  [4] LoyaltyDiscountFilter
      └─ subtotalUSD × (1 - loyaltyDiscount%) → subtotalUSD
           ↓
  [5] PassengerTypeAdjustmentFilter
      └─ subtotalUSD × (1 + typeAdjustment%) → subtotalUSD
           ↓
  [6] TaxesAndFeesFilter
      └─ Suma: taxesUSD, airportFeeUSD, fuelSurchargeUSD → totalUSD
           ↓
  [7] ExchangeRateEnrichmentFilter
      ├─ Intenta API (timeout 5s, retry 3x)
      ├─ Si falla: usa cache (1h TTL)
      ├─ Si cache vacío: usa fallback rates
      └─ convertedTotal = totalUSD × exchangeRate
           ↓
  Almacenar en ReservationRepository
           ↓
  200 OK con resultado procesado
```
