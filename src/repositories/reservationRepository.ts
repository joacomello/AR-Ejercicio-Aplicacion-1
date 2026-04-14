import type { ReservationProcessingResult } from '../pipes-filters/types';

function cloneResult(result: ReservationProcessingResult): ReservationProcessingResult {
	return {
		...result,
		warnings: [...result.warnings],
		errors: [...result.errors],
		metadata: { ...result.metadata },
		price: result.price ? { ...result.price } : null,
	};
}

export class ReservationRepository {
	private readonly reservations = new Map<string, ReservationProcessingResult>();

	public save(result: ReservationProcessingResult): ReservationProcessingResult {
		const stored = cloneResult(result);
		this.reservations.set(stored.id, stored);
		return cloneResult(stored);
	}

	public findById(id: string): ReservationProcessingResult | undefined {
		const result = this.reservations.get(id);
		return result ? cloneResult(result) : undefined;
	}

	public list(): ReservationProcessingResult[] {
		return Array.from(this.reservations.values()).map(cloneResult);
	}
}
