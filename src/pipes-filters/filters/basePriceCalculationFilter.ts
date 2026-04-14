import type { ReservationContext, ReservationFilter } from '../types';

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

function seatMultiplier(seatClass: ReservationContext['request']['seatClass']): number {
	switch (seatClass) {
		case 'business':
			return 2.5;
		case 'first':
			return 4;
		default:
			return 1;
	}
}

export class BasePriceCalculationFilter implements ReservationFilter {
	public readonly name = 'basePriceCalculation' as const;

	public async execute(context: ReservationContext): Promise<void> {
		if (!context.flight || !context.price) {
			context.errors.push('Base price calculation requires a valid flight.');
			context.failed = true;
			return;
		}

		const multiplier = seatMultiplier(context.request.seatClass);
		context.price.seatMultiplier = multiplier;
		context.price.subtotalUSD = roundMoney(context.flight.basePriceUSD * multiplier);
		context.price.totalUSD = context.price.subtotalUSD;
	}
}
