# ZSR URL Forwarder

A Node.js and Express-based URL shortener with a Firebase Realtime Database backend and a basic caching layer.

## Description

This project is a simple URL shortener service, which allows users to shorten long URLs for easier sharing and management. It features a minimalistic frontend using EJS templates and a patterned background. The URL shortening logic is contained within an Express.js web server, with persistent storage in Firebase Realtime Database. An in-memory caching layer is implemented for quick access to recently accessed URLs.

## Features

- Shorten URLs with optional custom alias
- Persistent storage of shortened URLs using Firebase Realtime Database
- In-memory caching for quick retrieval of URLs
- Basic frontend for easy interaction with the service
- Mobile responsive design

## Installation

To get started with this project:

1. Install the necessary npm packages:
```bash
    npm install
```

2. Set up Firebase:

- Create a new Firebase project in the Firebase Console.
- Initialize the Realtime Database.
- Set the appropriate database rules.
- Create a new service account and download the service account key file.
- Configure your project
- Place your Firebase service account JSON file in the secrets folder named ``serviceAccount.json``


3. Set up the config
- Rename the ``config.json.example`` to ``config.json`` and fill in the necessary values

4. Start the server
```bash
    npm start
```

## Usage
To shorten a URL:

- Navigate to the home page of the hosted application.
- Enter the URL you want to shorten in the URL input field.
- Optionally, provide a custom alias for your shortened URL.
- Click the "Shorten" button.
- If not already taken, your URL will be shortened, and the result will be displayed.

To visit a shortened URL:

- Simply enter the provided short URL into your browser's address bar, and you will be redirected to the original URL.

## Customization
Feel free to customize the appearance and functionality of the URL shortener by modifying the EJS templates, the CSS, and the server-side logic as required.

## Contributors
This project is maintained by ZeldaSpeedRuns. All contributions are welcome! If you would like to contribute, please feel free to make a pull request.

## License
This project is released under the MIT License. See the LICENSE file for details.
