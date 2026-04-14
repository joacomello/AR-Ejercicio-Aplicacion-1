import { Request, Response } from 'express';
import type { ReservationInput } from '../models/reservation';
import { reservationService } from '../services/reservation.service';

function normalizeReservations(body: unknown): ReservationInput[] {
	if (Array.isArray(body)) {
		return body as ReservationInput[];
	}

	if (body && typeof body === 'object') {
		const payload = body as { reservations?: unknown };
		if (Array.isArray(payload.reservations)) {
			return payload.reservations as ReservationInput[];
		}
	}

	return [];
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
