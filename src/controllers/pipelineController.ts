import { Request, Response } from 'express';
import { reservationService } from '../services/reservation.service';

export async function getConfig(_req: Request, res: Response): Promise<void> {
	res.json(reservationService.getPipelineConfig());
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
	res.json(reservationService.updatePipelineConfig(req.body ?? {}));
}
