// socketConnectionHandler.js

const users = {};  // Stores user details like nickname, room, etc.
const rooms = {};  // Stores room details

const userPublicKeys = {};  // Maps user nicknames to their public keys
const tempPublicKeys = {};  // Temporary storage for public keys before nicknames are set

const roomHandler = require('./roomHandler');

module.exports = (socket, io) => {

    // Initialize user entry upon connection
    console.log('New client connected:', socket.id);
    users[socket.id] = { nickname: null, currentRoom: null };


    // --------------------------- PUBLIC KEY AND NICKNAME HANDLING --------------------------- //

    /* When the user sets up their nicknames, they will generate a public key and 
    send it to be stored here in the server */

    // Handle public key reception
    socket.on('public_key', (data) => {
        const { nickname, publicKey } = data;
        if (nickname) {
            // If the nickname is already known, store the public key
            console.log(`Public key received for ${nickname}: ${publicKey}`);
            userPublicKeys[nickname] = publicKey;
        } else {
            // If the nickname isn't set yet, store the public key temporarily with the socket ID
            tempPublicKeys[socket.id] = publicKey;
        }
    });

    // Handle setting a nickname
    socket.on('setNickname',  function (nickname, selectedPicPath, selectedPicalt,callback) {
        if (users[socket.id]) {
            if (!users[socket.id].nickname) {
                const isNicknameTaken = Object.values(users).some(user => user.nickname === nickname);
                if (nickname && !isNicknameTaken) {
                    users[socket.id].nickname = nickname;

                    users[socket.id].profilepic_file = selectedPicPath;
                    users[socket.id].profilepic_alttext = selectedPicalt;
                  
                    console.log(`Image set for socket ${socket.id}: ${ users[socket.id].profilepic_file}`);

                    if (tempPublicKeys[socket.id]) {
                        userPublicKeys[nickname] = tempPublicKeys[socket.id];
                        delete tempPublicKeys[socket.id]; // Remove the temporary entry
                    }
                    console.log(`Nickname set for socket ${socket.id}: ${nickname}`);
                    callback(true); // Acknowledge that the nickname is set
                } else {
                    console.log(`Nickname ${nickname} is taken or invalid for socket ${socket.id}`);
                    callback(false); // Indicate failure to set nickname
                }
            } else {
                console.log(`Nickname for Socket ${socket.id} is already set to ${users[socket.id].nickname}`);
                callback(false); // Indicate nickname is already set
            }
        } else {
            console.log(`User not found for socket ${socket.id}`);
            callback(false); // Indicate user not found
        }
    });

    // --------------------------------------------------------------------------------------- //

    // Handle room-related events
    roomHandler(socket, io, users, rooms, userPublicKeys);

    // Handle disconnect event
    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
        if (users[socket.id] && users[socket.id].nickname) {
            // Remove the public key associated with the user's nickname
            delete userPublicKeys[users[socket.id].nickname];
        }
        // delete the user from the users object upon disconnection
        delete users[socket.id];
        // Also, delete any temporary public key
        delete tempPublicKeys[socket.id];
    });
};
