export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'none';

export interface Passenger {
	id: string;
	name: string;
	email: string;
	age: number;
	isActive: boolean;
	loyaltyTier: LoyaltyTier;
}
