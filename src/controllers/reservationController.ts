import type { Request, Response } from 'express';
import type { ReservationInput } from '../models/reservation';
import type { ReservationService } from '../services/reservationService';

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

export function createReservationController(reservationService: ReservationService) {
	return {
		processReservations: async (request: Request, response: Response) => {
			const reservations = normalizeReservations(request.body);
			const config = normalizeConfig(request.body);
			const result = await reservationService.processReservations(reservations, config);

			response.status(200).json(result);
		},
		getReservationStatus: (request: Request, response: Response) => {
			const reservationId = String(request.params.id ?? '');
			const status = reservationService.getReservationStatus(reservationId);

			if (!status) {
				response.status(404).json({ message: 'Reservation not found' });
				return;
			}

			response.json(status);
		},
	};
}
