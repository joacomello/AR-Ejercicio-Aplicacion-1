import type { ReservationContext, ReservationFilter } from '../types';

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

export class LoyaltyDiscountFilter implements ReservationFilter {
	public readonly name = 'loyaltyDiscounts' as const;

	public async execute(context: ReservationContext): Promise<void> {
		if (!context.passenger || !context.price) {
			context.errors.push('Loyalty discount requires a valid passenger and price.');
			context.failed = true;
			return;
		}

		const discountByTier: Record<string, number> = {
			bronze: 0.05,
			silver: 0.1,
			gold: 0.15,
			none: 0,
		};

		const discount = discountByTier[context.passenger.loyaltyTier] ?? 0;
		context.price.subtotalUSD = roundMoney(context.price.subtotalUSD * (1 - discount));
		context.price.totalUSD = context.price.subtotalUSD;
		context.metadata.loyaltyDiscount = {
			tier: context.passenger.loyaltyTier,
			discountPercent: roundMoney(discount * 100),
		};
	}
}
