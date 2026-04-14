import express, { type Express } from 'express';
import { FlightRepository } from './repositories/flightRepository';
import { PassengerRepository } from './repositories/passengerRepository';
import { ReservationRepository } from './repositories/reservationRepository';
import { createPipelineController } from './controllers/pipelineController';
import { createReservationController } from './controllers/reservationController';
import { ExchangeService } from './services/exchange.service';
import { ReservationService, createDefaultPipelineConfig } from './services/reservationService';

export function createApp(): Express {
	const passengerRepository = new PassengerRepository();
	const flightRepository = new FlightRepository();
	const reservationRepository = new ReservationRepository();
	const exchangeService = new ExchangeService();
	const reservationService = new ReservationService({
		passengerRepository,
		flightRepository,
		reservationRepository,
		exchangeService,
		config: createDefaultPipelineConfig(),
	});

	const app = express();
	app.use(express.json());

	const reservationController = createReservationController(reservationService);
	const pipelineController = createPipelineController(reservationService);

	app.post('/reservations/process', reservationController.processReservations);
	app.get('/reservations/:id/status', reservationController.getReservationStatus);
	app.get('/pipeline/config', pipelineController.getConfig);
	app.put('/pipeline/config', pipelineController.updateConfig);

	app.get('/health', (_request, response) => {
		response.json({ status: 'ok' });
	});

	return app;
}

if (require.main === module) {
	const port = Number(process.env.PORT ?? 3000);
	const app = createApp();

	app.listen(port, () => {
		console.log(`Flight reservation pipeline listening on port ${port}`);
	});
}
