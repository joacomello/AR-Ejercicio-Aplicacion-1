import type { ReservationContext, ReservationFilter } from '../types';

export class FlightValidationFilter implements ReservationFilter {
	public readonly name = 'flightValidation' as const;

	public constructor(private readonly flightRepository: { findByCode: (code: string) => { code: string; originCountry: string; destinationCountry: string; departureDate: string; availableSeats: number; basePriceUSD: number; } | undefined; }) {}

	public async execute(context: ReservationContext): Promise<void> {
		const flight = this.flightRepository.findByCode(context.request.flightCode);
		if (!flight) {
			context.errors.push(`Flight ${context.request.flightCode} was not found.`);
			context.failed = true;
			return;
		}

		if (flight.availableSeats <= 0) {
			context.errors.push(`Flight ${flight.code} has no available seats.`);
			context.failed = true;
			return;
		}

		const departureDate = new Date(flight.departureDate);
		if (Number.isNaN(departureDate.getTime()) || departureDate.getTime() <= Date.now()) {
			context.errors.push(`Flight ${flight.code} has an invalid or past departure date.`);
			context.failed = true;
			return;
		}

		context.flight = flight;
		context.price = {
			basePriceUSD: flight.basePriceUSD,
			seatMultiplier: 1,
			subtotalUSD: flight.basePriceUSD,
			totalUSD: flight.basePriceUSD,
			convertedCurrency: 'USD',
			exchangeRate: 1,
			convertedTotal: flight.basePriceUSD,
			taxesUSD: 0,
			airportFeeUSD: 0,
			fuelSurchargeUSD: 0,
		};
	}
}
