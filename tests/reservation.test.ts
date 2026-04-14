import assert from 'node:assert/strict';
import test from 'node:test';
import { FlightRepository } from '../src/repositories/flightRepository';
import { PassengerRepository } from '../src/repositories/passengerRepository';
import { ReservationRepository } from '../src/repositories/reservationRepository';
import { ExchangeService } from '../src/services/exchange.service';
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
} from '../src/services/reservationService';
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
		} as Response;
	});

	const filter = new ExchangeRateEnrichmentFilter(exchangeService);
	const firstContext = createContext({ flightCode: 'AA001' });
	firstContext.flight = new FlightRepository().findByCode('AA001');
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
	secondContext.flight = new FlightRepository().findByCode('AA001');
	secondContext.price = { ...firstContext.price };

	await filter.execute(firstContext);
	await filter.execute(secondContext);

	assert.equal(fetchCount, 1);
	assert.equal(firstContext.price?.exchangeRate, 1000);
	assert.equal(secondContext.price?.exchangeRate, 1000);
	assert.equal(secondContext.price?.convertedTotal, 100000);
});

test('Exchange enrichment falls back when the API fails', async () => {
	const exchangeService = createExchangeService(async () => {
		throw new Error('network failure');
	});

	const filter = new ExchangeRateEnrichmentFilter(exchangeService);
	const context = createContext({ flightCode: 'AA001' });
	context.flight = new FlightRepository().findByCode('AA001');
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
	} as Response));

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