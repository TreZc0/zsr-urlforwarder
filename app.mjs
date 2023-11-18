import { createRequire } from 'module';
import { nanoid } from 'nanoid';
import { profanity } from '@2toad/profanity';

const require = createRequire(import.meta.url);

const express = require('express');
const admin = require('firebase-admin');

const bodyParser = require('body-parser');
const NodeCache = require('node-cache');


const app = express();
const cache = new NodeCache();
const cacheTTL = 60 * 60 * 24 * 7; // 7 days

const config = require('./config.json');
const PORT = config.port;
const DOMAIN = config.domain;
const DBURL = config.databaseURL;

// Initialize Firebase Admin with credentials
const serviceAccount = require('./secrets/serviceAccount.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DBURL
});
const db = admin.database();

// Clean up cache function
const cleanUpCache = () => {
  const cachedKeys = cache.keys();
  cachedKeys.forEach((key) => {
    const ttl = cache.ttl(key);
    if (ttl < 0) {
      cache.del(key);
    }
  });
};

setInterval(cleanUpCache, 1000 * 60 * 60); // Run cleanup every hour

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.static('public'))

// Serve the index page
app.get('/', (req, res) => {
  res.render('index', { resultMessage: '' });
});

app.post('/shorten', async (req, res) => {
  const { url, customTag } = req.body;
  const tag = customTag.trim().replace(/\s/g, "") || nanoid(5); // Generate a 5-character unique ID

  if (!isValidUrl(url)) {
      res.render('index', { resultMessage: "Sorry, you need to provide a valid URL."});
      return;
  }
  
  if (customTag) {
    //profanity check against string only
    if (profanity.exists(tag)) {
      res.render('index', { resultMessage: "Sorry, no blacklisted words are allowed in custom tags."});
      return;
    }
  
    //any non ascii characters
    if ([...tag].some(char => char.charCodeAt(0) > 127)) { 
      res.render('index', { resultMessage: "Sorry, no special characters are allowed in custom tags."});
      return;
    }
  }

  const urlRef = db.ref(`urls/${tag}`);

  // Check if the tag already exists
  urlRef.once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        throw new Error('Short URL already exists.');
      } else {
        return urlRef.set(url); // Set the URL in the Realtime Database
      }
    })
    .then(() => {
      cache.set(tag, url, cacheTTL);
      res.render('index', { resultMessage: `${DOMAIN}/${tag}` });
    })
    .catch((error) => {
      res.render('index', { resultMessage: error.message });
    });
});

app.get('/:tag', (req, res) => {
  const { tag } = req.params;

  // Check for a valid tag format to avoid querying invalid paths
  if (!tag || /[\.\#\$\[\]]/.test(tag)) {
    return res.status(400).send('Invalid URL tag.');
  }

  let cachedUrl = cache.get(tag);
  if (cachedUrl) {
    return res.redirect(cachedUrl);
  }

  const urlRef = db.ref(`urls/${tag}`);
  urlRef.once('value', (snapshot) => {
    if (snapshot.exists()) {
      const url = snapshot.val();
      cache.set(tag, url, cacheTTL);
      res.redirect(url);
    } else {
      res.status(404).send('Short URL not found.');
    }
  });
});

function isValidUrl(urlString) {
    var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
    '(\\?[;&a-z\\d%_.~+=#-]*)?'+ // validate query string
    '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
  
    return !!urlPattern.test(urlString);
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at ${DOMAIN}:${PORT}`);
});
