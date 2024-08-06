const mongoose = require('mongoose');
require('dotenv').config();


// const mongoURL =process.env.MONGOdB_URL;
const mongoURL = process.env.MONGOdB_URL_lOCAL 

mongoose.connect(mongoURL, {
  serverSelectionTimeoutMS: 30000, 
  socketTimeoutMS: 45000, 
});

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('Connection error:', err);
});
db.once('open', () => {
  console.log('Connected to the database');
});

module.exports = db;
