export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'none';

export type PassengerType = 'child' | 'adult' | 'senior';

export interface Passenger {
	id: string;
	name: string;
	email: string;
	age: number;
	isActive: boolean;
	loyaltyTier: LoyaltyTier;
	countryCode: string;
	type: PassengerType;
}
