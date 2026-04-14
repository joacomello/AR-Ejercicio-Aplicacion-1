import express from 'express';
import { processReservations, getReservationStatus } from './controllers/reservationController';
import { getConfig, updateConfig } from './controllers/pipelineController';

const port = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

app.post('/reservations/process', processReservations);
app.get('/reservations/:id/status', getReservationStatus);
app.get('/pipeline/config', getConfig);
app.put('/pipeline/config', updateConfig);

app.get('/health', (_request, response) => {
	response.json({ status: 'ok' });
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
