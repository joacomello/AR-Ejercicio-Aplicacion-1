export type SeatClass = 'economy' | 'business' | 'first';

export interface ReservationInput {
	id?: string;
	passengerId: string;
	flightCode: string;
	seatClass: SeatClass;
	originCountry?: string;
	destinationCountry?: string;
}

export interface ReservationPrice {
	basePriceUSD: number;
	seatMultiplier: number;
	subtotalUSD: number;
	taxesUSD: number;
	airportFeeUSD: number;
	fuelSurchargeUSD: number;
	totalUSD: number;
	convertedCurrency: string;
	exchangeRate: number;
	convertedTotal: number;
}

export interface ReservationProcessingResult {
	id: string;
	status: 'processed' | 'failed';
	passengerId: string;
	flightCode: string;
	seatClass: SeatClass;
	warnings: string[];
	errors: string[];
	metadata: Record<string, unknown>;
	price: ReservationPrice | null;
	processedAt: string;
	processingTimeMs: number;
}
