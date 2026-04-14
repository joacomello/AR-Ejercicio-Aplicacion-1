import type { ReservationContext, ReservationFilter } from '../types';

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

function normalizeCurrency(currency: string): string {
	return currency.trim().toUpperCase();
}

export class ExchangeRateEnrichmentFilter implements ReservationFilter {
	public readonly name = 'exchangeRateEnrichment' as const;

	public constructor(private readonly exchangeService: { convert: (amountUSD: number, targetCurrency: string) => Promise<{ rate: number; convertedAmount: number; source: 'api' | 'cache' | 'fallback' | 'disabled'; warning?: string; }>; }) {}

	public async execute(context: ReservationContext): Promise<void> {
		if (!context.flight || !context.price) {
			context.warnings.push('Exchange enrichment skipped because pricing data is not ready.');
			return;
		}

		const targetCurrency = normalizeCurrency(context.config.countryCurrencyMap[context.flight.destinationCountry] ?? 'USD');
		context.price.convertedCurrency = targetCurrency;

		if (targetCurrency === 'USD') {
			context.price.exchangeRate = 1;
			context.price.convertedTotal = roundMoney(context.price.totalUSD);
			return;
		}

		try {
			const conversion = await this.exchangeService.convert(context.price.totalUSD, targetCurrency);
			context.price.exchangeRate = conversion.rate;
			context.price.convertedTotal = conversion.convertedAmount;
			if (conversion.warning) {
				context.warnings.push(conversion.warning);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			context.warnings.push(`Exchange rate enrichment failed: ${message}. Using USD fallback.`);
			context.price.convertedCurrency = 'USD';
			context.price.exchangeRate = 1;
			context.price.convertedTotal = context.price.totalUSD;
		}
	}
}
