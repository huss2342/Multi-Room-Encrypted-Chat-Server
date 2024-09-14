const express = require('express');
const https = require('https'); // Change to use the HTTPS module
const path = require('path');
const socketIO = require('socket.io');
const fs = require('fs');
const socketConnectionHandler = require('./socketHandlers/socketConnectionHandler');

const app = express();

// Read the key and certificate
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');

const credentials = { key: privateKey, cert: certificate };
const server = https.createServer(credentials, app); // Create an HTTPS server
const io = socketIO(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));



app.get('*', (req, res) => {
    fs.readFile(path.join(__dirname, 'public/index.html'), (err, htmlData) => {
        if (err) return res.sendStatus(500);

        fs.readFile(path.join(__dirname, 'public/bird_images'), (err, imageData) => {
            if (err) return res.sendStatus(500);

            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(htmlData);
            res.end();
        });
    });
});


// Socket connection
io.on('connection', socket => socketConnectionHandler(socket, io));

const PORT = 3000; // Set the port to 3000
server.listen(PORT, () => console.log(`Server is running on HTTPS on port ${PORT}`));
