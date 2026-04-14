export interface Flight {
	code: string;
	originCountry: string;
	destinationCountry: string;
	departureDate: string;
	availableSeats: number;
	basePriceUSD: number;
	durationMinutes: number;
}
