import { Request, Response } from 'express';
import type { ReservationInput } from '../models/reservation';
import { reservationService } from '../services/reservation.service';

function normalizeReservations(body: unknown): ReservationInput[] | null {
	if (Array.isArray(body)) {
		return body as ReservationInput[];
	}

	if (body && typeof body === 'object') {
		const payload = body as { reservations?: unknown };
		if (Array.isArray(payload.reservations)) {
			return payload.reservations as ReservationInput[];
		}
	}

	return null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isValidSeatClass(value: unknown): value is ReservationInput['seatClass'] {
	return value === 'economy' || value === 'business' || value === 'first';
}

function validateReservations(reservations: ReservationInput[]): string[] {
	if (reservations.length === 0) {
		return ['The reservations array must contain at least one item.'];
	}

	const errors: string[] = [];

	for (let index = 0; index < reservations.length; index += 1) {
		const reservation = reservations[index] as unknown;

		if (!reservation || typeof reservation !== 'object') {
			errors.push(`reservations[${index}] must be an object.`);
			continue;
		}

		const input = reservation as Partial<ReservationInput>;

		if (!isNonEmptyString(input.passengerId)) {
			errors.push(`reservations[${index}].passengerId must be a non-empty string.`);
		}

		if (!isNonEmptyString(input.flightCode)) {
			errors.push(`reservations[${index}].flightCode must be a non-empty string.`);
		}

		if (!isValidSeatClass(input.seatClass)) {
			errors.push(`reservations[${index}].seatClass must be one of: economy, business, first.`);
		}
	}

	return errors;
}

function normalizeConfig(body: unknown) {
	if (body && typeof body === 'object') {
		const payload = body as { config?: unknown; pipelineConfig?: unknown };
		return payload.config ?? payload.pipelineConfig ?? {};
	}

	return {};
}

export async function processReservations(req: Request, res: Response): Promise<void> {
	const reservations = normalizeReservations(req.body);
	if (!reservations) {
		res.status(400).json({
			error: 'Invalid payload',
			details: ['Body must be an array of reservations or an object with a reservations array.'],
		});
		return;
	}

	const validationErrors = validateReservations(reservations);
	if (validationErrors.length > 0) {
		res.status(400).json({
			error: 'Invalid payload',
			details: validationErrors,
		});
		return;
	}

	const config = normalizeConfig(req.body);
	const result = await reservationService.processReservations(reservations, config);
	res.status(200).json(result);
}

export async function getReservationStatus(req: Request, res: Response): Promise<void> {
	const reservationId = String(req.params.id ?? '');
	const status = reservationService.getReservationStatus(reservationId);

	if (!status) {
		res.status(404).send('Reservation not found');
		return;
	}

	res.json(status);
}
