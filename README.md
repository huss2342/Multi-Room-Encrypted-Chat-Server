# Multi-Room Encrypted Chat Server

## Project Overview

This project is a multi-room chat server implemented using Node.JS and Socket.IO. It provides a real-time communication platform where users can join different chat rooms, send private messages, and customize their experience.

## Features

### Core Functionality
- Main lobby for user sign-on with nicknames
- Creation and joining of multiple chat rooms
- Real-time communication within rooms
- Single webpage interface displaying:
  - Current room
  - All available rooms
  - Users in the current room

### User Management
- Nickname selection upon joining
- Profile picture selection from a set of bird images
- User presence indication in rooms

### Moderation Features
- Kick feature: Temporarily remove a user from a room (1 minute)
- Ban feature: Permanently remove a user from the chat

### Security and Privacy
- HTTPS implementation for secure communication
- Message encryption within the server
- Private messaging ("Whisper") functionality

### Customization
- Color themes and background options for chat interface
- Profile picture selection for user individuality

## Technical Implementation

- Backend: Node.JS with Socket.IO
- Frontend: HTML, CSS, JavaScript
- Security: HTTPS (self-signed certificate), message encryption
- Bundling: kreatebundle.js for application file bundling

## Setup and Usage

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the bundler: `node kreatebundle.js`
4. Start the server: `node app.js`
5. Access the application at https://localhost:3000

**Note**: The application uses a self-signed HTTPS certificate. You may need to bypass security warnings in your browser and create a self signed certificate.

## Security Measures

- HTTPS implementation
- Server-side message encryption
- Dynamic key management for each user session

## Creative Portions

1. **Customizable Interface**: Users can select different color themes and backgrounds.
2. **Profile Pictures**: Users can choose a bird image as their profile picture.
3. **HTTPS Implementation**: Enhanced security for message transmission.
4. **Message Encryption**: Server-side encryption of chat logs before transmission.

## Known Issues

- The HTTPS certificate is self-signed and will trigger browser security warnings.

## Future Improvements

- Implement persistent user accounts
- Add file sharing capabilities
- Enhance mobile responsiveness

## References

- [Mozilla Developer Network - Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/subtle)
- [Node.js Documentation - Web Crypto API](https://nodejs.org/api/webcrypto.html#rsahashedkeygenparamspublicexponent)
