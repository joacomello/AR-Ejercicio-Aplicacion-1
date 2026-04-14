
import { mockFlights } from '../data/mockFlights';
import type { Flight } from '../models/flight';

function cloneFlight(flight: Flight): Flight {
	return { ...flight };
}

export class FlightRepository {
	private readonly flights: Flight[];

	public constructor(initialFlights: Flight[] = mockFlights) {
		this.flights = initialFlights.map(cloneFlight);
	}

	public findByCode(code: string): Flight | undefined {
		return this.flights.find((flight) => flight.code === code);
	}

	public reserveSeat(code: string): Flight | undefined {
		const flight = this.findByCode(code);

		if (!flight || flight.availableSeats <= 0) {
			return undefined;
		}

		flight.availableSeats -= 1;
		return cloneFlight(flight);
	}

	public list(): Flight[] {
		return this.flights.map(cloneFlight);
	}
}
