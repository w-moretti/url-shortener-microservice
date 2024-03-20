require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Counter schema
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: Number
});

counterSchema.methods.increment = async function() {
  this.seq += 1;
  return this.save();
};

const Counter = mongoose.model('Counter', counterSchema);

Counter.findOneAndUpdate(
  { _id: 'shortUrl' },
  { $inc: { seq: 1 } },
  { new: true, upsert: true }
)
.catch(console.error);

// Short url schema
const shortUrlSchema = new mongoose.Schema({
  url: { type: String, required: true },
  shortUrl: Number
});

shortUrlSchema.pre('save', async function() {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'shortUrl' }, { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.shortUrl = counter.seq;
  }
});

const ShortUrl = mongoose.model('ShortUrl', shortUrlSchema);

app.use(bodyParser.urlencoded({'extended': false}));
app.use(bodyParser.json());

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

const validateUrl = (req, res, next) => {
  try {
    req.url = new URL(req.body.url);
    const hostname = req.url.hostname;
    dns.lookup(hostname, (err, address, family) => {
      if (err) {
        res.json({'error': 'invalid url'});
      } else {
        next();
      }
    });
  } catch (error) {
    res.json({'error': 'invalid url'});
  }
};

app.post('/api/shorturl', validateUrl, (req, res) => {
  // Check if the url already exists
  ShortUrl.findOne({url: req.url}, function(err, data) {
    if (!data) {
      // Save the new url
      const shortUrl = new ShortUrl({url: req.url});
      shortUrl.save(function(err, data) {
        if (err) {
          res.json({'error': 'Something went wrong'});
        } else {
          res.json({
            'original_url': req.body.url,
            'short_url': data.shortUrl
          });
        }
      })
    } else {
      // Simply return the existing url
      res.json({
        'original_url': req.body.url,
        'short_url': data.shortUrl
      });
    }
  });
});

app.get('/api/shorturl/:shortUrl', (req, res) => {
  ShortUrl.findOne({shortUrl: req.params.shortUrl}, function(err, data) {
    if (err || !data) {
      res.json({"error":"No short URL found for the given input"});
    } else {
      res.redirect(data.url);
    }
  });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
