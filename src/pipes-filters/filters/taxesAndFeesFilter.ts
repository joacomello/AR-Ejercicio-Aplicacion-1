import type { ReservationContext, ReservationFilter } from '../types';

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

export class TaxesAndFeesFilter implements ReservationFilter {
	public readonly name = 'taxesAndFees' as const;

	public async execute(context: ReservationContext): Promise<void> {
		if (!context.price) {
			context.errors.push('Taxes and fees calculation requires a valid price.');
			context.failed = true;
			return;
		}

		context.price.taxesUSD = roundMoney(context.price.subtotalUSD * 0.12);
		context.price.airportFeeUSD = 25;
		context.price.fuelSurchargeUSD = roundMoney(context.price.basePriceUSD * 0.08);
		context.price.totalUSD = roundMoney(
			context.price.subtotalUSD + context.price.taxesUSD + context.price.airportFeeUSD + context.price.fuelSurchargeUSD,
		);
	}
}
