import type { Flight } from '../../models/flight';
import type { ReservationContext, ReservationFilter } from '../types';

export class FlightValidationFilter implements ReservationFilter {
	public readonly name = 'flightValidation' as const;

	public constructor(private readonly flightRepository: { findByCode: (code: string) => Flight | undefined }) {}

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

		if (context.request.originCountry && context.request.originCountry.toUpperCase() !== flight.originCountry.toUpperCase()) {
			context.errors.push(`Reservation origin ${context.request.originCountry} does not match flight origin ${flight.originCountry}.`);
			context.failed = true;
			return;
		}

		if (context.request.destinationCountry && context.request.destinationCountry.toUpperCase() !== flight.destinationCountry.toUpperCase()) {
			context.errors.push(`Reservation destination ${context.request.destinationCountry} does not match flight destination ${flight.destinationCountry}.`);
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
		context.metadata.flightDurationMinutes = flight.durationMinutes;
	}
}
