import config from './config';

import express, { Application, Request, Response, NextFunction} from 'express';

const app: Application = express();

const port: number = 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Server is running');
});

app.use((req:Request, res: Response, next: NextFunction) => {
  res.status(404).send('Sorry, cant find that');
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
})