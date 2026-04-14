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
			context.metadata.exchangeConversion = {
				status: 'skipped',
				reason: 'pricing data is not ready',
			};
			return;
		}

		const originalCurrency = 'USD';
		const originalTotalUSD = roundMoney(context.price.totalUSD);
		const targetCurrency = normalizeCurrency(context.config.countryCurrencyMap[context.flight.destinationCountry] ?? 'USD');
		context.price.convertedCurrency = targetCurrency;

		if (targetCurrency === 'USD') {
			context.price.exchangeRate = 1;
			context.price.convertedTotal = roundMoney(context.price.totalUSD);
			context.metadata.exchangeConversion = {
				status: 'converted',
				source: 'disabled',
				originalCurrency,
				targetCurrency,
				rate: 1,
				originalAmount: originalTotalUSD,
				convertedAmount: context.price.convertedTotal,
			};
			return;
		}

		try {
			const conversion = await this.exchangeService.convert(context.price.totalUSD, targetCurrency);
			context.price.exchangeRate = conversion.rate;
			context.price.convertedTotal = conversion.convertedAmount;
			context.metadata.exchangeConversion = {
				status: 'converted',
				source: conversion.source,
				originalCurrency,
				targetCurrency,
				rate: conversion.rate,
				originalAmount: originalTotalUSD,
				convertedAmount: conversion.convertedAmount,
			};
			if (conversion.warning) {
				context.warnings.push(conversion.warning);
				const existingExchangeMetadata =
					context.metadata.exchangeConversion && typeof context.metadata.exchangeConversion === 'object'
						? (context.metadata.exchangeConversion as Record<string, unknown>)
						: {};
				context.metadata.exchangeConversion = {
					...existingExchangeMetadata,
					warning: conversion.warning,
				};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			context.warnings.push(`Exchange rate enrichment failed: ${message}. Using USD fallback.`);
			context.price.convertedCurrency = 'USD';
			context.price.exchangeRate = 1;
			context.price.convertedTotal = context.price.totalUSD;
			context.metadata.exchangeConversion = {
				status: 'fallback',
				source: 'fallback',
				originalCurrency,
				targetCurrency: 'USD',
				rate: 1,
				originalAmount: originalTotalUSD,
				convertedAmount: roundMoney(context.price.totalUSD),
				warning: `Exchange rate enrichment failed: ${message}. Using USD fallback.`,
			};
		}
	}
}
