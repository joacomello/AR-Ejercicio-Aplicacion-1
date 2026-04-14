import type { Flight } from '../models/flight';
import type { Passenger, LoyaltyTier } from '../models/passenger';
import type { ReservationInput, ReservationPrice, SeatClass } from '../models/reservation';
import type { FlightRepository } from '../repositories/flightRepository';
import type { PassengerRepository } from '../repositories/passengerRepository';
import type { ExchangeService } from '../services/exchange.service';

export type FilterName =
	| 'passengerValidation'
	| 'flightValidation'
	| 'exchangeRateEnrichment'
	| 'basePriceCalculation'
	| 'loyaltyDiscounts'
	| 'passengerTypeAdjustments'
	| 'taxesAndFees';

export type ExchangeSource = 'api' | 'cache' | 'fallback' | 'disabled';

export interface PipelineFilterConfig {
	name: FilterName;
	enabled: boolean;
	settings?: Record<string, unknown>;
}

export interface PipelineExchangeConfig {
	apiBaseUrl: string;
	timeoutMs: number;
	retryCount: number;
	cacheTtlMs: number;
	defaultRates: Record<string, number>;
}

export interface PipelineConfig {
	filters: PipelineFilterConfig[];
	exchange: PipelineExchangeConfig;
	countryCurrencyMap: Record<string, string>;
}

export interface ReservationContext {
	request: ReservationInput;
	passenger?: Passenger;
	flight?: Flight;
	price: ReservationPrice | null;
	warnings: string[];
	errors: string[];
	metadata: Record<string, unknown>;
	config: PipelineConfig;
	failed: boolean;
}

export interface PipelineDependencies {
	passengerRepository: PassengerRepository;
	flightRepository: FlightRepository;
	exchangeService: ExchangeService;
}

export interface ReservationFilter {
	name: FilterName;
	execute(context: ReservationContext): Promise<void> | void;
}

export interface ReservationProcessingResult {
	id: string;
	status: 'processed' | 'failed';
	passengerId: string;
	flightCode: string;
	seatClass: SeatClass;
	warnings: string[];
	errors: string[];
	metadata: Record<string, unknown>;
	price: ReservationPrice | null;
	processedAt: string;
	processingTimeMs: number;
}

export interface PipelineRunResult {
	results: ReservationProcessingResult[];
	totalProcessingTimeMs: number;
	summary: {
		processed: number;
		failed: number;
		warnings: number;
		errors: number;
	};
}

export interface ExchangeRateResult {
	rate: number;
	currency: string;
	source: ExchangeSource;
	warning?: string;
}

export interface ExchangeServiceOptions {
	config?: PipelineExchangeConfig;
	fetchFn?: typeof fetch;
}
