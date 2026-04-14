import type { Flight } from '../models/flight';

const futureDate = (daysAhead: number): string => {
	const date = new Date();
	date.setDate(date.getDate() + daysAhead);
	return date.toISOString();
};

export const mockFlights: Flight[] = [
	{
		code: 'AA001',
		originCountry: 'US',
		destinationCountry: 'AR',
		departureDate: futureDate(10),
		availableSeats: 12,
		basePriceUSD: 100,
	},
	{
		code: 'LA4567',
		originCountry: 'BR',
		destinationCountry: 'US',
		departureDate: futureDate(7),
		availableSeats: 0,
		basePriceUSD: 220,
	},
	{
		code: 'IB900',
		originCountry: 'ES',
		destinationCountry: 'FR',
		departureDate: futureDate(3),
		availableSeats: 4,
		basePriceUSD: 150,
	},
	{
		code: 'AR777',
		originCountry: 'AR',
		destinationCountry: 'BR',
		departureDate: futureDate(-2),
		availableSeats: 3,
		basePriceUSD: 180,
	},
	{
		code: 'MX808',
		originCountry: 'MX',
		destinationCountry: 'CO',
		departureDate: futureDate(15),
		availableSeats: 6,
		basePriceUSD: 130,
	},
];