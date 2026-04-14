import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response as ExpressResponse } from 'express';
import { getConfig, updateConfig } from '../src/controllers/pipelineController';
import { getReservationStatus, processReservations } from '../src/controllers/reservationController';
import { FlightRepository } from '../src/repositories/flightRepository';
import { PassengerRepository } from '../src/repositories/passengerRepository';
import { ReservationRepository } from '../src/repositories/reservationRepository';
import { ExchangeService } from '../src/services/exchange.service';
import { reservationService } from '../src/services/reservation.service';
import {
	BasePriceCalculationFilter,
	ExchangeRateEnrichmentFilter,
	FlightValidationFilter,
	LoyaltyDiscountFilter,
	PassengerTypeAdjustmentFilter,
	PassengerValidationFilter,
	ReservationService,
	TaxesAndFeesFilter,
	type ReservationProcessingContext,
	createDefaultPipelineConfig,
} from '../src/services/reservation.service';
import type { ReservationInput } from '../src/models/reservation';

function createContext(reservationOverrides: Partial<ReservationInput> = {}): ReservationProcessingContext {
	const reservation: ReservationInput = {
		id: 'RES-TEST',
		passengerId: 'PAX-001',
		flightCode: 'AA001',
		seatClass: 'economy',
		...reservationOverrides,
	};

	return {
		request: reservation,
		warnings: [],
		errors: [],
		metadata: {},
		price: null,
		config: createDefaultPipelineConfig(),
		failed: false,
	};
}

function createExchangeService(fetchFn: typeof fetch = async () => {
	throw new Error('fetch not configured');
}) {
	return new ExchangeService({
		config: createDefaultPipelineConfig().exchange,
		fetchFn,
	});
}

function createMockResponse() {
	const response = {
		statusCode: 200,
		body: undefined as unknown,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(payload: unknown) {
			this.body = payload;
			return this;
		},
		send(payload: unknown) {
			this.body = payload;
			return this;
		},
	};

	return response as unknown as ExpressResponse & { statusCode: number; body: unknown };
}

test('Passenger validation accepts an active passenger with consistent data', async () => {
	const filter = new PassengerValidationFilter(new PassengerRepository());
	const context = createContext({ passengerId: 'PAX-001' });

	await filter.execute(context);

	assert.equal(context.failed, false);
	assert.ok(context.passenger);
	assert.equal(context.metadata.passengerType, 'adult');
});

test('Passenger validation rejects an inactive passenger', async () => {
	const filter = new PassengerValidationFilter(new PassengerRepository());
	const context = createContext({ passengerId: 'PAX-004' });

	await filter.execute(context);

	assert.equal(context.failed, true);
	assert.match(context.errors[0] ?? '', /inactive/iu);
});

test('Flight validation rejects flights without seats', async () => {
	const filter = new FlightValidationFilter(new FlightRepository());
	const context = createContext({ flightCode: 'LA4567' });

	await filter.execute(context);

	assert.equal(context.failed, true);
	assert.match(context.errors[0] ?? '', /no available seats/iu);
});

test('Flight validation rejects past flights', async () => {
	const filter = new FlightValidationFilter(new FlightRepository());
	const context = createContext({ flightCode: 'AR777' });

	await filter.execute(context);

	assert.equal(context.failed, true);
	assert.match(context.errors[0] ?? '', /past departure date/iu);
});

test('Exchange enrichment uses API data and caches results', async () => {
	let fetchCount = 0;
	const exchangeService = createExchangeService(async () => {
		fetchCount += 1;
		return {
			ok: true,
			status: 200,
			json: async () => ({ rates: { ARS: 1000 } }),
		} as unknown as globalThis.Response;
	});

	const filter = new ExchangeRateEnrichmentFilter(exchangeService);
	const firstContext = createContext({ flightCode: 'AA001' });
	const flight = new FlightRepository().findByCode('AA001');
	assert.ok(flight);
	firstContext.flight = flight;
	firstContext.price = {
		basePriceUSD: 100,
		seatMultiplier: 1,
		subtotalUSD: 100,
		taxesUSD: 0,
		airportFeeUSD: 0,
		fuelSurchargeUSD: 0,
		totalUSD: 100,
		convertedCurrency: 'USD',
		exchangeRate: 1,
		convertedTotal: 100,
	};

	const secondContext = createContext({ flightCode: 'AA001' });
	secondContext.flight = flight;
	secondContext.price = { ...firstContext.price };

	await filter.execute(firstContext);
	await filter.execute(secondContext);

	assert.equal(fetchCount, 1);
	assert.equal(firstContext.price?.exchangeRate, 1000);
	assert.equal(secondContext.price?.exchangeRate, 1000);
	assert.equal(secondContext.price?.convertedTotal, 100000);
	assert.deepEqual(firstContext.metadata.exchangeConversion, {
		status: 'converted',
		source: 'api',
		originalCurrency: 'USD',
		targetCurrency: 'ARS',
		rate: 1000,
		originalAmount: 100,
		convertedAmount: 100000,
	});
});

test('Exchange enrichment falls back when the API fails', async () => {
	const exchangeService = createExchangeService(async () => {
		throw new Error('network failure');
	});

	const filter = new ExchangeRateEnrichmentFilter(exchangeService);
	const context = createContext({ flightCode: 'AA001' });
	const flight = new FlightRepository().findByCode('AA001');
	assert.ok(flight);
	context.flight = flight;
	context.price = {
		basePriceUSD: 100,
		seatMultiplier: 1,
		subtotalUSD: 100,
		taxesUSD: 0,
		airportFeeUSD: 0,
		fuelSurchargeUSD: 0,
		totalUSD: 100,
		convertedCurrency: 'ARS',
		exchangeRate: 1,
		convertedTotal: 100,
	};

	await filter.execute(context);

	assert.equal(context.price?.exchangeRate, 1000);
	assert.equal(context.price?.convertedTotal, 100000);
	assert.ok(context.warnings.length > 0);
	assert.deepEqual(context.metadata.exchangeConversion, {
		status: 'converted',
		source: 'fallback',
		originalCurrency: 'USD',
		targetCurrency: 'ARS',
		rate: 1000,
		originalAmount: 100,
		convertedAmount: 100000,
		warning: 'Exchange API failed after retries: network failure. Using default rate.',
	});
});

test('Pricing filters calculate the expected combined total', async () => {
	const context = createContext({ passengerId: 'PAX-002', flightCode: 'AA001', seatClass: 'business' });
	const flightRepository = new FlightRepository();
	const passengerRepository = new PassengerRepository();

	await new PassengerValidationFilter(passengerRepository).execute(context);
	await new FlightValidationFilter(flightRepository).execute(context);
	await new BasePriceCalculationFilter().execute(context);
	await new LoyaltyDiscountFilter().execute(context);
	await new PassengerTypeAdjustmentFilter().execute(context);
	await new TaxesAndFeesFilter().execute(context);

	assert.equal(context.price?.seatMultiplier, 2.5);
	assert.equal(context.price?.subtotalUSD, 168.75);
	assert.equal(context.price?.totalUSD, 222);
	assert.equal(context.price?.taxesUSD, 20.25);
});

test('Reservation service processes reservations end to end', async () => {
	const passengerRepository = new PassengerRepository();
	const flightRepository = new FlightRepository();
	const reservationRepository = new ReservationRepository();
	const exchangeService = createExchangeService(async () => ({
		ok: true,
		status: 200,
		json: async () => ({ rates: { ARS: 1000 } }),
	} as unknown as globalThis.Response));

	const service = new ReservationService({
		passengerRepository,
		flightRepository,
		reservationRepository,
		exchangeService,
		config: createDefaultPipelineConfig(),
	});

	const result = await service.processReservations([
		{
			id: 'RES-001',
			passengerId: 'PAX-001',
			flightCode: 'AA001',
			seatClass: 'business',
		},
	]);

	assert.equal(result.summary.processed, 1);
	assert.equal(result.summary.failed, 0);
	assert.equal(result.results[0]?.status, 'processed');
	assert.equal(result.results[0]?.price?.totalUSD, 271);
	assert.equal(result.results[0]?.price?.convertedTotal, 271000);
	assert.ok(service.getReservationStatus('RES-001'));
});

test('Reservation service flags an unknown passenger', async () => {
	const passengerRepository = new PassengerRepository();
	const flightRepository = new FlightRepository();
	const reservationRepository = new ReservationRepository();
	const exchangeService = createExchangeService();

	const service = new ReservationService({
		passengerRepository,
		flightRepository,
		reservationRepository,
		exchangeService,
		config: createDefaultPipelineConfig(),
	});

	const result = await service.processReservations([
		{
			id: 'RES-FAIL',
			passengerId: 'UNKNOWN',
			flightCode: 'AA001',
			seatClass: 'economy',
		},
	]);

	assert.equal(result.summary.failed, 1);
	assert.equal(result.results[0]?.status, 'failed');
	assert.match(result.results[0]?.errors[0] ?? '', /was not found/iu);
});

test('POST /reservations/process returns 400 for invalid body format', async () => {
	const req = {
		body: { invalid: true },
	} as Request;
	const res = createMockResponse();

	await processReservations(req, res);

	assert.equal(res.statusCode, 400);
	assert.equal((res.body as { error?: string }).error, 'Invalid payload');
});

test('POST /reservations/process returns 400 for empty reservations', async () => {
	const req = {
		body: { reservations: [] },
	} as Request;
	const res = createMockResponse();

	await processReservations(req, res);

	assert.equal(res.statusCode, 400);
	const details = (res.body as { details?: string[] }).details ?? [];
	assert.match(details.join(' '), /at least one item/iu);
});

test('POST /reservations/process returns 400 for malformed reservation item', async () => {
	const req = {
		body: {
			reservations: [
				{
					passengerId: '',
					flightCode: 'AA001',
					seatClass: 'premium',
				},
			],
		},
	} as Request;
	const res = createMockResponse();

	await processReservations(req, res);

	assert.equal(res.statusCode, 400);
	const details = (res.body as { details?: string[] }).details ?? [];
	assert.ok(details.length >= 2);
	assert.match(details.join(' '), /seatClass|passengerId/iu);
});

test('POST /reservations/process processes valid payload', async () => {
	const originalProcessReservations = reservationService.processReservations.bind(reservationService);
	const expectedResult = {
		results: [],
		totalProcessingTimeMs: 0,
		summary: { processed: 0, failed: 0, warnings: 0, errors: 0 },
	};

	(reservationService as unknown as {
		processReservations: (reservations: ReservationInput[], config?: unknown) => Promise<typeof expectedResult>;
	}).processReservations = async () => expectedResult;

	try {
		const req = {
			body: {
				reservations: [
					{
						passengerId: 'PAX-001',
						flightCode: 'AA001',
						seatClass: 'economy',
					},
				],
			},
		} as Request;
		const res = createMockResponse();

		await processReservations(req, res);

		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.body, expectedResult);
	} finally {
		(reservationService as unknown as { processReservations: typeof originalProcessReservations }).processReservations =
			originalProcessReservations;
	}
});

test('GET /reservations/:id/status returns 404 when reservation does not exist', async () => {
	const originalGetReservationStatus = reservationService.getReservationStatus.bind(reservationService);

	(reservationService as unknown as { getReservationStatus: (id: string) => unknown }).getReservationStatus = () => undefined;

	try {
		const req = {
			params: { id: 'UNKNOWN-ID' },
		} as unknown as Request;
		const res = createMockResponse();

		await getReservationStatus(req, res);

		assert.equal(res.statusCode, 404);
		assert.equal(res.body, 'Reservation not found');
	} finally {
		(reservationService as unknown as { getReservationStatus: typeof originalGetReservationStatus }).getReservationStatus =
			originalGetReservationStatus;
	}
});

test('GET /reservations/:id/status returns reservation payload when it exists', async () => {
	const originalGetReservationStatus = reservationService.getReservationStatus.bind(reservationService);
	const mockedStatus = {
		id: 'RES-OK',
		status: 'processed',
		passengerId: 'PAX-001',
		flightCode: 'AA001',
		seatClass: 'economy',
		warnings: [],
		errors: [],
		metadata: {},
		price: null,
		processedAt: new Date().toISOString(),
		processingTimeMs: 1,
	};

	(reservationService as unknown as { getReservationStatus: (id: string) => unknown }).getReservationStatus = () => mockedStatus;

	try {
		const req = {
			params: { id: 'RES-OK' },
		} as unknown as Request;
		const res = createMockResponse();

		await getReservationStatus(req, res);

		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.body, mockedStatus);
	} finally {
		(reservationService as unknown as { getReservationStatus: typeof originalGetReservationStatus }).getReservationStatus =
			originalGetReservationStatus;
	}
});

test('GET /pipeline/config returns current pipeline configuration', async () => {
	const originalGetPipelineConfig = reservationService.getPipelineConfig.bind(reservationService);
	const mockedConfig = createDefaultPipelineConfig();

	(reservationService as unknown as { getPipelineConfig: () => unknown }).getPipelineConfig = () => mockedConfig;

	try {
		const req = {} as Request;
		const res = createMockResponse();

		await getConfig(req, res);

		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.body, mockedConfig);
	} finally {
		(reservationService as unknown as { getPipelineConfig: typeof originalGetPipelineConfig }).getPipelineConfig =
			originalGetPipelineConfig;
	}
});

test('PUT /pipeline/config forwards payload and returns updated config', async () => {
	const originalUpdatePipelineConfig = reservationService.updatePipelineConfig.bind(reservationService);
	const configUpdate = {
		filters: [
			{ name: 'passengerValidation', enabled: false },
			{ name: 'flightValidation', enabled: true },
		],
	};

	let capturedInput: unknown;
	(reservationService as unknown as { updatePipelineConfig: (config: unknown) => unknown }).updatePipelineConfig = (config) => {
		capturedInput = config;
		return config;
	};

	try {
		const req = {
			body: configUpdate,
		} as Request;
		const res = createMockResponse();

		await updateConfig(req, res);

		assert.equal(res.statusCode, 200);
		assert.deepEqual(capturedInput, configUpdate);
		assert.deepEqual(res.body, configUpdate);
	} finally {
		(reservationService as unknown as { updatePipelineConfig: typeof originalUpdatePipelineConfig }).updatePipelineConfig =
			originalUpdatePipelineConfig;
	}
});

test('Exchange service falls back after timeout retries', async () => {
	let attemptCount = 0;
	const exchangeService = new ExchangeService({
		config: {
			...createDefaultPipelineConfig().exchange,
			timeoutMs: 5,
			retryCount: 2,
		},
		fetchFn: async (_input, init) => {
			attemptCount += 1;
			const signal = init?.signal;
			return await new Promise<globalThis.Response>((_resolve, reject) => {
				signal?.addEventListener('abort', () => reject(new Error('aborted')));
			});
		},
	});

	const result = await exchangeService.getRate('USD', 'ARS');

	assert.equal(attemptCount, 2);
	assert.equal(result.source, 'fallback');
	assert.equal(result.rate, 1000);
	assert.match(result.warning ?? '', /failed after retries/iu);
});

test('Pipeline marks reservation as failed when a filter throws an exception', async () => {
	const throwingPassengerRepository = {
		findById: (_id: string) => {
			throw new Error('repository unavailable');
		},
	} as unknown as PassengerRepository;

	const service = new ReservationService({
		passengerRepository: throwingPassengerRepository,
		flightRepository: new FlightRepository(),
		reservationRepository: new ReservationRepository(),
		exchangeService: createExchangeService(),
		config: createDefaultPipelineConfig(),
	});

	const result = await service.processReservations([
		{
			id: 'RES-THROW',
			passengerId: 'PAX-001',
			flightCode: 'AA001',
			seatClass: 'economy',
		},
	]);

	assert.equal(result.summary.failed, 1);
	assert.equal(result.results[0]?.status, 'failed');
	assert.match(result.results[0]?.errors[0] ?? '', /Filter passengerValidation failed/iu);
});

test('Economy class without loyalty discounts: base price calculation', async () => {
	const context = createContext({ passengerId: 'PAX-001', flightCode: 'AA001', seatClass: 'economy' });
	const flightRepository = new FlightRepository();
	const passengerRepository = new PassengerRepository();

	await new PassengerValidationFilter(passengerRepository).execute(context);
	await new FlightValidationFilter(flightRepository).execute(context);
	await new BasePriceCalculationFilter().execute(context);
	await new LoyaltyDiscountFilter().execute(context);
	await new PassengerTypeAdjustmentFilter().execute(context);
	await new TaxesAndFeesFilter().execute(context);

	assert.equal(context.price?.seatMultiplier, 1);
	assert.equal(context.price?.subtotalUSD, 85);
	assert.equal(context.price?.taxesUSD, 10.2);
	assert.equal(context.price?.airportFeeUSD, 25);
	assert.equal(context.price?.fuelSurchargeUSD, 8);
	assert.equal(context.price?.totalUSD, 128.2);
});

test('Loyalty discount: Gold tier with 15% discount applied', async () => {
	const context = createContext({ passengerId: 'PAX-001', flightCode: 'AA001', seatClass: 'economy' });
	const flightRepository = new FlightRepository();
	const passengerRepository = new PassengerRepository();

	await new PassengerValidationFilter(passengerRepository).execute(context);
	await new FlightValidationFilter(flightRepository).execute(context);
	await new BasePriceCalculationFilter().execute(context);
	await new LoyaltyDiscountFilter().execute(context);

	const goldDiscountPercent = (context.metadata.loyaltyDiscount as { discountPercent?: number } | undefined)?.discountPercent;
	assert.equal(goldDiscountPercent, 15);
	assert.equal(context.price?.subtotalUSD, 85);
});

test('Child passenger + Business class with combined discounts', async () => {
	const context = createContext({ passengerId: 'PAX-002', flightCode: 'AA001', seatClass: 'business' });
	const flightRepository = new FlightRepository();
	const passengerRepository = new PassengerRepository();

	await new PassengerValidationFilter(passengerRepository).execute(context);
	await new FlightValidationFilter(flightRepository).execute(context);
	await new BasePriceCalculationFilter().execute(context);
	await new LoyaltyDiscountFilter().execute(context);
	await new PassengerTypeAdjustmentFilter().execute(context);
	await new TaxesAndFeesFilter().execute(context);

	assert.equal(context.price?.seatMultiplier, 2.5);
	assert.equal(context.price?.subtotalUSD, 168.75);
	assert.equal(context.price?.totalUSD, 222);
	const passengerDiscount = (context.metadata.passengerDiscount as { discountPercent?: number } | undefined)?.discountPercent;
	assert.equal(passengerDiscount, 25);
});

test('Senior passenger + First class with bronze loyalty discount', async () => {
	const context = createContext({ passengerId: 'PAX-003', flightCode: 'AA001', seatClass: 'first' });
	const flightRepository = new FlightRepository();
	const passengerRepository = new PassengerRepository();

	await new PassengerValidationFilter(passengerRepository).execute(context);
	await new FlightValidationFilter(flightRepository).execute(context);
	await new BasePriceCalculationFilter().execute(context);
	await new LoyaltyDiscountFilter().execute(context);
	await new PassengerTypeAdjustmentFilter().execute(context);
	await new TaxesAndFeesFilter().execute(context);

	assert.equal(context.price?.seatMultiplier, 4);
	const loyaltyDiscount = (context.metadata.loyaltyDiscount as { discountPercent?: number } | undefined)?.discountPercent;
	assert.equal(loyaltyDiscount, 5);
	const passengerDiscount = (context.metadata.passengerDiscount as { discountPercent?: number } | undefined)?.discountPercent;
	assert.equal(passengerDiscount, 15);
	assert.ok(context.price?.totalUSD ?? 0 > 0);
});

test('Network failure during API call returns fallback and continues processing', async () => {
	const passengerRepository = new PassengerRepository();
	const flightRepository = new FlightRepository();
	const reservationRepository = new ReservationRepository();
	const exchangeService = new ExchangeService({
		config: createDefaultPipelineConfig().exchange,
		fetchFn: async () => {
			throw new Error('Network unreachable');
		},
	});

	const service = new ReservationService({
		passengerRepository,
		flightRepository,
		reservationRepository,
		exchangeService,
		config: createDefaultPipelineConfig(),
	});

	const result = await service.processReservations([
		{
			id: 'RES-NETWORK',
			passengerId: 'PAX-001',
			flightCode: 'AA001',
			seatClass: 'economy',
			destinationCountry: 'AR',
		},
	]);

	assert.equal(result.summary.processed, 1);
	assert.equal(result.results[0]?.status, 'processed');
	assert.ok((result.results[0]?.warnings ?? []).length > 0);
	assert.match((result.results[0]?.warnings ?? []).join(' '), /Network unreachable/iu);
});

test('Corrupted context state: price calculation with missing flight data', async () => {
	const context = createContext({ flightCode: 'INVALID' });
	const flightRepository = new FlightRepository();
	const passengerRepository = new PassengerRepository();

	await new PassengerValidationFilter(passengerRepository).execute(context);
	await new FlightValidationFilter(flightRepository).execute(context);

	assert.equal(context.failed, true);
	assert.match(context.errors[0] ?? '', /not found/iu);
	assert.equal(context.price, null);

	await new BasePriceCalculationFilter().execute(context);

	assert.equal(context.failed, true);
	assert.match(context.errors[context.errors.length - 1] ?? '', /valid flight/iu);
});