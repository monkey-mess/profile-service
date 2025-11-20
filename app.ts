import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import fs from 'fs';
import cors from 'cors';
import indexRouter from './routes/index';

const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/uploads', express.static('uploads'));

app.use('/api', indexRouter);

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 404 handler
app.use(function(req: Request, res: Response) {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Ресурс ${req.method} ${req.originalUrl} не найден`
  });
});

// Error handler
app.use(function(err: Error & { status?: number }, req: Request, res: Response) {
  console.error('Error:', err.message);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'Произошла внутренняя ошибка сервера',
    ...(req.app.get('env') === 'development' && { 
      stack: err.stack 
    })
  });
});

export default app;

