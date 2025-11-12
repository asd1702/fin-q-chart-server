import express, { Application, Request, Response, NextFunction } from 'express';
import apiRoutes from './routes/index.js';

export function createApp(): Application {
    const app: Application = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.get('/', (req: Request, res: Response) => {
        res.status(200).send('Server is running');
    });

    app.use('/api', apiRoutes);
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.status(404).send('Sorry, cant find that');
    });

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error(err.stack);
        if (err.message.includes('Unsupported timeframe')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).send('Something broke!');
    });

    return app;
}