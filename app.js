const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const fs = require('fs')
const indexRouter = require('./routes/index');
const cors = require('cors')

const app = express();

app.use(cors())
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/uploads', express.static('uploads'))

app.use('/api', indexRouter);

if (!fs.existsSync('uploads')){
  fs.mkdirSync('uploads')
}

app.use(function(req, res, next) {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Ресурс ${req.method} ${req.originalUrl} не найден`
  });
});

app.use(function(err, req, res, next) {
  console.error('Error:', err.message);
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'Произошла внутренняя ошибка сервера',
    ...(req.app.get('env') === 'development' && { 
      stack: err.stack 
    })
  });
});

module.exports = app;