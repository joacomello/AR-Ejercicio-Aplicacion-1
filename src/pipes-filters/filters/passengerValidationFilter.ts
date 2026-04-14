import type { LoyaltyTier } from '../../models/passenger';
import type { ReservationContext, ReservationFilter } from '../types';

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function classifyPassengerAge(age: number): 'child' | 'adult' | 'senior' {
	if (age < 12) {
		return 'child';
	}

	if (age > 65) {
		return 'senior';
	}

	return 'adult';
}

export class PassengerValidationFilter implements ReservationFilter {
	public readonly name = 'passengerValidation' as const;

	public constructor(private readonly passengerRepository: { findById: (id: string) => { id: string; name: string; email: string; age: number; isActive: boolean; loyaltyTier: LoyaltyTier; } | undefined; }) {}

	public async execute(context: ReservationContext): Promise<void> {
		const passenger = this.passengerRepository.findById(context.request.passengerId);
		if (!passenger) {
			context.errors.push(`Passenger ${context.request.passengerId} was not found.`);
			context.failed = true;
			return;
		}

		if (!passenger.isActive) {
			context.errors.push(`Passenger ${passenger.id} is inactive.`);
			context.failed = true;
			return;
		}

		if (!passenger.name.trim()) {
			context.errors.push(`Passenger ${passenger.id} has an empty name.`);
			context.failed = true;
			return;
		}

		if (!isValidEmail(passenger.email)) {
			context.errors.push(`Passenger ${passenger.id} has an invalid email address.`);
			context.failed = true;
			return;
		}

		context.passenger = passenger;
		context.metadata.passengerType = classifyPassengerAge(passenger.age);
	}
}
