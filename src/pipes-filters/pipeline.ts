import type { ReservationInput } from '../models/reservation';
import { createDefaultPipelineConfig } from './config';
import { BasePriceCalculationFilter } from './filters/basePriceCalculationFilter';
import { ExchangeRateEnrichmentFilter } from './filters/exchangeRateEnrichmentFilter';
import { FlightValidationFilter } from './filters/flightValidationFilter';
import { LoyaltyDiscountFilter } from './filters/loyaltyDiscountFilter';
import { PassengerTypeAdjustmentFilter } from './filters/passengerTypeAdjustmentFilter';
import { PassengerValidationFilter } from './filters/passengerValidationFilter';
import { TaxesAndFeesFilter } from './filters/taxesAndFeesFilter';
import type {
  PipelineConfig,
  PipelineDependencies,
  PipelineFilterConfig,
  PipelineRunResult,
  ReservationContext,
  ReservationFilter,
  ReservationProcessingResult,
} from './types';

function mergeConfig(baseConfig: PipelineConfig, partialConfig: Partial<PipelineConfig>): PipelineConfig {
  return {
    filters: partialConfig.filters ?? baseConfig.filters,
    exchange: {
      ...baseConfig.exchange,
      ...(partialConfig.exchange ?? {}),
      defaultRates: {
        ...baseConfig.exchange.defaultRates,
        ...(partialConfig.exchange?.defaultRates ?? {}),
      },
    },
    countryCurrencyMap: {
      ...baseConfig.countryCurrencyMap,
      ...(partialConfig.countryCurrencyMap ?? {}),
    },
  };
}

class ReservationPipeline {
  public constructor(private readonly filters: ReservationFilter[], private readonly config: PipelineConfig) {}

  public async run(reservations: ReservationInput[]): Promise<PipelineRunResult> {
    const startedAt = Date.now();
    const results: ReservationProcessingResult[] = [];

    for (const reservation of reservations) {
      const reservationStartedAt = Date.now();
      const context: ReservationContext = {
        request: reservation,
        price: null,
        warnings: [],
        errors: [],
        metadata: {},
        config: this.config,
        failed: false,
      };

      for (const filter of this.filters) {
        try {
          await filter.execute(context);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          context.errors.push(`Filter ${filter.name} failed: ${message}`);
          context.failed = true;
        }

        if (context.failed) {
          break;
        }
      }

      results.push({
        id: reservation.id ?? `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: context.failed ? 'failed' : 'processed',
        passengerId: reservation.passengerId,
        flightCode: reservation.flightCode,
        seatClass: reservation.seatClass,
        warnings: [...context.warnings],
        errors: [...context.errors],
        metadata: { ...context.metadata },
        price: context.price ? { ...context.price } : null,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - reservationStartedAt,
      });
    }

    const summary = results.reduce(
      (accumulator, result) => {
        if (result.status === 'processed') {
          accumulator.processed += 1;
        } else {
          accumulator.failed += 1;
        }

        accumulator.warnings += result.warnings.length;
        accumulator.errors += result.errors.length;
        return accumulator;
      },
      { processed: 0, failed: 0, warnings: 0, errors: 0 },
    );

    return {
      results,
      totalProcessingTimeMs: Date.now() - startedAt,
      summary,
    };
  }
}

function createFilter(filterConfig: PipelineFilterConfig, dependencies: PipelineDependencies): ReservationFilter | null {
  if (!filterConfig.enabled) {
    return null;
  }

  switch (filterConfig.name) {
    case 'passengerValidation':
      return new PassengerValidationFilter(dependencies.passengerRepository);
    case 'flightValidation':
      return new FlightValidationFilter(dependencies.flightRepository);
    case 'exchangeRateEnrichment':
      return new ExchangeRateEnrichmentFilter(dependencies.exchangeService);
    case 'basePriceCalculation':
      return new BasePriceCalculationFilter();
    case 'loyaltyDiscounts':
      return new LoyaltyDiscountFilter();
    case 'passengerTypeAdjustments':
      return new PassengerTypeAdjustmentFilter();
    case 'taxesAndFees':
      return new TaxesAndFeesFilter();
    default:
      return null;
  }
}

export function createReservationPipeline(config: Partial<PipelineConfig> = {}, dependencies: PipelineDependencies): ReservationPipeline {
  const mergedConfig = mergeConfig(createDefaultPipelineConfig(), config);
  const filters = mergedConfig.filters
    .map((filterConfig) => createFilter(filterConfig, dependencies))
    .filter((filter): filter is ReservationFilter => filter !== null);

  return new ReservationPipeline(filters, mergedConfig);
}

export { mergeConfig };
