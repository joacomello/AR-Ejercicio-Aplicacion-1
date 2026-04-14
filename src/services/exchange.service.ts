import type { PipelineExchangeConfig } from '../pipes-filters/types';

export interface ExchangeRateResult {
	rate: number;
	source: 'api' | 'cache' | 'fallback' | 'disabled';
	currency: string;
	warning?: string;
}

interface CacheEntry {
	expiresAt: number;
	rates: Record<string, number>;
}

export interface ExchangeServiceOptions {
	config?: PipelineExchangeConfig;
	fetchFn?: typeof fetch;
}

const DEFAULT_EXCHANGE_CONFIG: PipelineExchangeConfig = {
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
};

function roundMoney(amount: number): number {
	return Math.round(amount * 100) / 100;
}

function normalizeCurrency(currency: string): string {
	return currency.trim().toUpperCase();
}

export class ExchangeService {
	private readonly cache = new Map<string, CacheEntry>();

	private readonly config: PipelineExchangeConfig;

	private readonly fetchFn: typeof fetch;

	public constructor(options: ExchangeServiceOptions = {}) {
		this.config = options.config ?? DEFAULT_EXCHANGE_CONFIG;
		this.fetchFn = options.fetchFn ?? fetch;
	}

	public clearCache(): void {
		this.cache.clear();
	}

	public async getRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRateResult> {
		const normalizedBase = normalizeCurrency(baseCurrency);
		const normalizedTarget = normalizeCurrency(targetCurrency);

		if (normalizedBase === normalizedTarget) {
			return { rate: 1, source: 'disabled', currency: normalizedTarget };
		}

		const cachedEntry = this.getCachedRates(normalizedBase);
		if (cachedEntry) {
			const cachedRate = cachedEntry.rates[normalizedTarget];
			if (typeof cachedRate === 'number') {
				return { rate: cachedRate, source: 'cache', currency: normalizedTarget };
			}
		}

		const apiUrl = `${this.config.apiBaseUrl}${encodeURIComponent(normalizedBase)}`;
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= this.config.retryCount; attempt += 1) {
			try {
				const rates = await this.fetchRates(apiUrl);
				this.cache.set(normalizedBase, {
					expiresAt: Date.now() + this.config.cacheTtlMs,
					rates,
				});

				const apiRate = rates[normalizedTarget];
				if (typeof apiRate === 'number') {
					return { rate: apiRate, source: 'api', currency: normalizedTarget };
				}

				const defaultRate = this.config.defaultRates[normalizedTarget];
				if (typeof defaultRate === 'number') {
					return {
						rate: defaultRate,
						source: 'fallback',
						currency: normalizedTarget,
						warning: `Currency ${normalizedTarget} not found in API response; using default rate.`,
					};
				}

				return {
					rate: 1,
					source: 'fallback',
					currency: normalizedTarget,
					warning: `Currency ${normalizedTarget} not found in API response; using USD fallback.`,
				};
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
			}
		}

		const defaultRate = this.config.defaultRates[normalizedTarget];
		if (typeof defaultRate === 'number') {
			return {
				rate: defaultRate,
				source: 'fallback',
				currency: normalizedTarget,
				warning: lastError
					? `Exchange API failed after retries: ${lastError.message}. Using default rate.`
					: `Exchange API unavailable. Using default rate for ${normalizedTarget}.`,
			};
		}

		return {
			rate: 1,
			source: 'fallback',
			currency: normalizedTarget,
			warning: lastError
				? `Exchange API failed after retries: ${lastError.message}. Using USD fallback.`
				: `Exchange API unavailable. Using USD fallback for ${normalizedTarget}.`,
		};
	}

	public async convert(amountUSD: number, targetCurrency: string): Promise<ExchangeRateResult & { convertedAmount: number }> {
		const rateResult = await this.getRate('USD', targetCurrency);
		return {
			...rateResult,
			convertedAmount: roundMoney(amountUSD * rateResult.rate),
		};
	}

	private getCachedRates(baseCurrency: string): CacheEntry | undefined {
		const entry = this.cache.get(baseCurrency);
		if (!entry) {
			return undefined;
		}

		if (entry.expiresAt < Date.now()) {
			this.cache.delete(baseCurrency);
			return undefined;
		}

		return entry;
	}

	private async fetchRates(url: string): Promise<Record<string, number>> {
		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), this.config.timeoutMs);

		try {
			const response = await this.fetchFn(url, { signal: abortController.signal });
			if (!response.ok) {
				throw new Error(`Exchange API returned HTTP ${response.status}`);
			}

			const payload = (await response.json()) as {
				rates?: Record<string, number>;
				conversion_rates?: Record<string, number>;
				data?: Record<string, number>;
			};

			const rates = payload.rates ?? payload.conversion_rates ?? payload.data;
			if (!rates) {
				throw new Error('Exchange API response did not include rates');
			}

			return rates;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
