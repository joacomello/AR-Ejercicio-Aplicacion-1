import type { PipelineConfig } from './types';

export function createDefaultPipelineConfig(): PipelineConfig {
	return {
		filters: [
			{ name: 'passengerValidation', enabled: true },
			{ name: 'flightValidation', enabled: true },
			{ name: 'basePriceCalculation', enabled: true },
			{ name: 'loyaltyDiscounts', enabled: true },
			{ name: 'passengerTypeAdjustments', enabled: true },
			{ name: 'taxesAndFees', enabled: true },
			{ name: 'exchangeRateEnrichment', enabled: true },
		],
		exchange: {
			apiBaseUrl: 'https://api.exchangerate-api.com/v4/latest/',
			timeoutMs: 5000,
			retryCount: 3,
			cacheTtlMs: 60 * 60 * 1000,
			defaultRates: {
				USD: 1,
				ARS: 1000,
				BRL: 5,
				EUR: 0.92,
				MXN: 17,
				CLP: 900,
				UYU: 38,
				COP: 3900,
				PEN: 3.7,
				GBP: 0.79,
			},
		},
		countryCurrencyMap: {
			AR: 'ARS',
			BR: 'BRL',
			US: 'USD',
			EU: 'EUR',
			ES: 'EUR',
			FR: 'EUR',
			DE: 'EUR',
			IT: 'EUR',
			GB: 'GBP',
			MX: 'MXN',
			CL: 'CLP',
			UY: 'UYU',
			PY: 'PYG',
			PE: 'PEN',
			CO: 'COP',
		},
	};
}
