import type { ReservationInput } from '../models/reservation';
import type { FlightRepository } from '../repositories/flightRepository';
import type { PassengerRepository } from '../repositories/passengerRepository';
import type { ReservationRepository } from '../repositories/reservationRepository';
import type { ExchangeService } from './exchange.service';
import { createDefaultPipelineConfig } from '../pipes-filters/config';
import { createReservationPipeline, mergeConfig } from '../pipes-filters/pipeline';
import type { PipelineConfig, PipelineRunResult, ReservationContext } from '../pipes-filters/types';

export type ReservationProcessingContext = ReservationContext;
export { PassengerValidationFilter } from '../pipes-filters/filters/passengerValidationFilter';
export { FlightValidationFilter } from '../pipes-filters/filters/flightValidationFilter';
export { ExchangeRateEnrichmentFilter } from '../pipes-filters/filters/exchangeRateEnrichmentFilter';
export { BasePriceCalculationFilter } from '../pipes-filters/filters/basePriceCalculationFilter';
export { LoyaltyDiscountFilter } from '../pipes-filters/filters/loyaltyDiscountFilter';
export { PassengerTypeAdjustmentFilter } from '../pipes-filters/filters/passengerTypeAdjustmentFilter';
export { TaxesAndFeesFilter } from '../pipes-filters/filters/taxesAndFeesFilter';
export { createDefaultPipelineConfig };

interface ReservationServiceDependencies {
	passengerRepository: PassengerRepository;
	flightRepository: FlightRepository;
	reservationRepository: ReservationRepository;
	exchangeService: ExchangeService;
	config?: Partial<PipelineConfig>;
}

export class ReservationService {
	private config: PipelineConfig;

	public constructor(private readonly dependencies: ReservationServiceDependencies) {
		this.config = mergeConfig(createDefaultPipelineConfig(), dependencies.config ?? {});
	}

	public getPipelineConfig(): PipelineConfig {
		return this.config;
	}

	public updatePipelineConfig(partialConfig: Partial<PipelineConfig>): PipelineConfig {
		this.config = mergeConfig(this.config, partialConfig);
		return this.config;
	}

	public getReservationStatus(id: string) {
		return this.dependencies.reservationRepository.findById(id);
	}

	public async processReservations(reservations: ReservationInput[], partialConfig: Partial<PipelineConfig> = {}): Promise<PipelineRunResult> {
		const effectiveConfig = mergeConfig(this.config, partialConfig);
		const results: PipelineRunResult['results'] = [];
		const startedAt = Date.now();

		for (const reservation of reservations) {
			const pipeline = createReservationPipeline(effectiveConfig, {
				passengerRepository: this.dependencies.passengerRepository,
				flightRepository: this.dependencies.flightRepository,
				exchangeService: this.dependencies.exchangeService,
			});

			const pipelineResult = await pipeline.run([reservation]);
			const result = pipelineResult.results[0];

			if (!result) {
				continue;
			}

			this.dependencies.reservationRepository.save(result);
			if (result.status === 'processed') {
				this.dependencies.flightRepository.reserveSeat(result.flightCode);
			}

			results.push(result);
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
