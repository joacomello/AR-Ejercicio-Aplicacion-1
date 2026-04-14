import type { ReservationContext, ReservationFilter } from '../types';

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

export class PassengerTypeAdjustmentFilter implements ReservationFilter {
	public readonly name = 'passengerTypeAdjustments' as const;

	public async execute(context: ReservationContext): Promise<void> {
		if (!context.passenger || !context.price) {
			context.errors.push('Passenger type adjustment requires a valid passenger and price.');
			context.failed = true;
			return;
		}

		let discount = 0;
		if (context.passenger.age < 12) {
			discount = 0.25;
		} else if (context.passenger.age > 65) {
			discount = 0.15;
		}

		context.price.subtotalUSD = roundMoney(context.price.subtotalUSD * (1 - discount));
		context.price.totalUSD = context.price.subtotalUSD;
		context.metadata.passengerDiscount = {
			age: context.passenger.age,
			discountPercent: roundMoney(discount * 100),
		};
	}
}
