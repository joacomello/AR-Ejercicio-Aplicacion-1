import type { Passenger } from '../models/passenger';

export const mockPassengers: Passenger[] = [
	{
		id: 'PAX-001',
		name: 'Ana Torres',
		email: 'ana.torres@example.com',
		age: 34,
		isActive: true,
		loyaltyTier: 'gold',
	},
	{
		id: 'PAX-002',
		name: 'Bruno Silva',
		email: 'bruno.silva@example.com',
		age: 10,
		isActive: true,
		loyaltyTier: 'silver',
	},
	{
		id: 'PAX-003',
		name: 'Carla Gómez',
		email: 'carla.gomez@example.com',
		age: 71,
		isActive: true,
		loyaltyTier: 'bronze',
	},
	{
		id: 'PAX-004',
		name: 'Diego Fernández',
		email: 'diego.fernandez@example.com',
		age: 42,
		isActive: false,
		loyaltyTier: 'none',
	},
	{
		id: 'PAX-005',
		name: 'Elena Martínez',
		email: 'elena.martinez@example.com',
		age: 27,
		isActive: true,
		loyaltyTier: 'bronze',
	},
];