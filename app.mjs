import { createRequire } from 'module';
import { nanoid } from 'nanoid';
import { profanity } from '@2toad/profanity';
import ky from 'ky';


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

// Google Analytics Measurement API
const gaData = require('./secrets/gaService.json');

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

app.get('/shorten', (req, res) => {
  res.redirect('/');
});

app.post('/shorten', async (req, res) => {
  const { url, customTag } = req.body;
  const tag = customTag.trim().replace(/\s/g, "") || nanoid(5); // Generate a 5-character unique ID

  if (!isValidUrl(url)) {
      res.render('index', { resultMessage: "Sorry, you need to provide a valid URL."});
      return;
  }

  if (config["domain_blacklist"].includes(url.replace(/(http)s{0,1}:\/\//i,"").trim())) {
      res.render('index', { resultMessage: "Sorry, this domain is blacklisted"});
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

  const ga_measurement_id = gaData.measurementId;
  const ga_api_secret = gaData.apiSecret;

  let cachedUrl = cache.get(tag);
  if (cachedUrl) {
    let ga_event_body =
    {
        client_id: getClientId(req.ip),
        non_personalized_ads: false,
        events: [{
            name: 'link_used',
            params: {
                link: cachedUrl
            }
        }]
    };
    ky.post(`https://www.google-analytics.com/mp/collect?measurement_id=${ga_measurement_id}&api_secret=${ga_api_secret}`, { json: ga_event_body }).finally();
    return res.redirect(cachedUrl);
  }

  const urlRef = db.ref(`urls/${tag}`);
  urlRef.once('value', (snapshot) => {
    if (snapshot.exists()) {
      const url = snapshot.val();
      cache.set(tag, url, cacheTTL);

      let ga_event_body =
      {
          client_id: getClientId(req.ip),
          non_personalized_ads: false,
          events: [{
              name: 'link_used',
              params: {
                  link: url
              }
          }]
      };
      ky.post(`https://www.google-analytics.com/mp/collect?measurement_id=${ga_measurement_id}&api_secret=${ga_api_secret}`, { json: ga_event_body }).finally();

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
    '(\\#[-a-z\\d_]*)?','i'); // validate fragment locator
  
    return !!urlPattern.test(urlString);
}

function getClientId(ip) {

    let ipv6Parts = ip.split(":");

    if (ipv6Parts.length > 1) {

        for (let i = 0; i < ipv6Parts.length; i++) {

            if (ipv6Parts[i] == "")
                ipv6Parts[i] = 0;
            else
                ipv6Parts[i] = Number.parseInt(ipv6Parts[i], 16);
        }

        ip = ipv6Parts.join(":");
    }

    ip = ip.replace(/\:/g, "");
    ip = ip.replace(/\./g, "");

    let firstPart = gaData.baseClientPart1;
    let secondPart = gaData.baseClientPart2;

    let filled = 0;

    while (ip.length > 10 && filled < 10) {

        let sign = ip.substr(0, 1);

        let firstPartStart = firstPart.substr(0, filled);
        let firstPartEnd = firstPart.substr(filled + 1);

        firstPart = firstPartStart + sign + firstPartEnd;

        filled++;
        ip = ip.substr(1);
    }

    filled = 0;

    while (ip.length > 0 && filled < 10) {

        let sign = ip.substr(0, 1);

        let secondPartStart = secondPart.substr(0, filled);
        let secondPartEnd = secondPart.substr(filled + 1);

        secondPart = secondPartStart + sign + secondPartEnd;

        filled++;
        ip = ip.substr(1);
    }

    return `${firstPart}.${secondPart}`;
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at ${DOMAIN}:${PORT}`);
});
