import type { Request, Response } from 'express';
import type { ReservationService } from '../services/reservationService';

export function createPipelineController(reservationService: ReservationService) {
	return {
		getConfig: (_request: Request, response: Response) => {
			response.json(reservationService.getPipelineConfig());
		},
		updateConfig: (request: Request, response: Response) => {
			response.json(reservationService.updatePipelineConfig(request.body ?? {}));
		},
	};
}
