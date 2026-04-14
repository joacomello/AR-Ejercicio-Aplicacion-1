
import { mockPassengers } from '../data/mockPassengers';
import type { Passenger } from '../models/passenger';

function clonePassenger(passenger: Passenger): Passenger {
	return { ...passenger };
}

export class PassengerRepository {
	private readonly passengers: Passenger[];

	public constructor(initialPassengers: Passenger[] = mockPassengers) {
		this.passengers = initialPassengers.map(clonePassenger);
	}

	public findById(id: string): Passenger | undefined {
		return this.passengers.find((passenger) => passenger.id === id);
	}

	public list(): Passenger[] {
		return this.passengers.map(clonePassenger);
	}
}
