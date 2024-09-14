// roomHandler.js


module.exports = (socket, io, users, rooms, userPublicKeys) => {
    let currentRoom;

    // ------ handle public key request ------ //
    // Respond to public key request
    socket.on('request_public_key', (recipientNickname, callback) => {
        if (userPublicKeys[recipientNickname]) {
            callback({ publicKey: userPublicKeys[recipientNickname] });
        } else {
            console.log('nickname not found:', recipientNickname);
            callback({ error: 'Public key not found for the given nickname.' });
        }
    });

    socket.on('create_room', (data, callback) => {
        const { roomName, password, ownerId } = data; // Destructure the data object
        console.log("Attempting to create room:", roomName);
        handleCreateRoom(socket, io, roomName, password, ownerId, callback, users, rooms); // Pass ownerId to the function
        console.log('Created room:', roomName);
        emitRoomList(io, rooms); // This will update the room list for all clients
    });

    socket.on('join_room', (roomName, password, callback) => {
        if (!rooms[roomName]) {
            return callback('Room does not exist.');
        }
        if (rooms[roomName].banned && rooms[roomName].banned.includes(socket.id)) {
            return callback('You are banned from this room.');
        }
        // Check if the user is kicked by looking for their socket.id in the kicked array.
        if (rooms[roomName].kicked && rooms[roomName].kicked.includes(socket.id)) {
            // User is kicked, prevent rejoining.
            return callback('You have been kicked from this room.');
        }

        
        currentRoom = roomName;
        handleJoinRoom(socket, io, roomName, password, callback, users, rooms); //it is never reaching here
        console.log("PASSSSSST HANDLE JOIN ROOM")
        emitRoomList(io, rooms);
        console.log("MADE IT PAST EMIT ROOM LIST");   //testing here
    });

    socket.on('leave_room', roomName => {
        handleLeaveRoom(socket, io, roomName, users, rooms, () => { });
        currentRoom = null;
        emitRoomList(io, rooms);
    });

    socket.on('message', ({ room, message }) => {
        io.to(room).emit('message_to_room', message);
    });

    // socket.on('disconnect', () => {
    //     console.log('Client disconnected', socket.id);
    //     if (currentRoom) {
    //         io.to(currentRoom).emit('message', 'A user has left the chat');
    //         socket.leave(currentRoom);
    //     }
    // });

    socket.on('message_to_server', (data) =>
        handleIncomingMessage(socket, io, data, users, rooms));



    //displays the current rooms based on buttons

    socket.on('display_rooms', (callback) => {
        
        emitRoomList(io, rooms);
    });

    // Whisper to user within the room
    socket.on('whisper', (targetNickname, message, callback) => {
        console.log("on server whisper");
        handleWhisper(socket, io, users, targetNickname, message, callback);
    });

    // Kick user from the room
    socket.on('kick', (data, callback) => {
        const { userId, room } = data;
        console.log("kicking user", userId, "from room", room);
        handleKickUser(socket, io, room, users, userId, callback, rooms);
    });

    // Block user from the room
    socket.on('ban', (data, callback) => {
        const { userId, room } = data;
        console.log("Banning user", userId, "from room", room);
        handleBanUser(socket, io, room, users, userId, callback, rooms);
    });


    socket.on('whisper_to_server', (data) => handleIncomingWhisper(socket, io, data, users, rooms));

    // gets the password property from the room
    socket.on('password_check', (room_name_input, callback) => {
        if (getpassword(rooms, room_name_input)) {
            callback(true);
        } else {
            callback(false);
        }
    });
};
//creates room for chat room application
function handleCreateRoom(socket, io, roomName, password, ownerId, callback, users, rooms) {
    console.log('Attempting to create room:', roomName);
    if (!roomName || rooms[roomName]) {
        return callback('Invalid room name or room already exists');
    }

    socket.join(roomName);

    // Set up the new room with the owner
    rooms[roomName] = {
        users: [socket.id],
        messages: [],
        password: password || null, // Use null for no password
        owner: ownerId, // Add owner field to the room object
    };

    // Update the user's current room
    users[socket.id] = {
        nickname: users[socket.id].nickname || socket.id,
        currentRoom: roomName,
        profilepic_file: users[socket.id].profilepic_file,
        profilepic_alttext: users[socket.id].profilepic_alttext,
           
    };

    console.log("Room created with name:", roomName, "users:", rooms[roomName].users);
    emitRoomList(io, rooms);
    callback(null, { roomName: roomName }); // Always good to send some confirmation back
}

// ----------------- whispering - kicking - banning ----------------- //
// Handle kick user
function handleKickUser(socket, io, room, users, targetNickname, callback, rooms) {
    console.log('Attempting to kick user:', targetNickname, 'from room:', room);
    // First, validate the input and the state
    if (!callback || typeof callback !== 'function') {
        console.log('Callback not provided or not a function');
        return; // Stop execution if callback is not a function
    }
    if (!room || !rooms[room]) {
        console.log('Invalid room name or room does not exist');
        return callback('Invalid room name or room does not exist');
    }
    if (!hasPermission(socket.id, room, rooms)) {
        return callback('Permission denied');
    }

    // Find the target user to kick by their socket ID
    let targetSocketId = targetNickname; // Since targetNickname is actually the socket ID
    console.log("users: ", users);
    console.log("targetSocketId: ", targetSocketId);
    console.log("socket.id: ", socket.id);
    console.log("keys: ", Object.keys(users));
    if (!users[targetSocketId]) {
        return callback('Target user not found');
    }

    // Get the target socket
    let targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) {
        return callback('Target socket not found');
    }

    // Kick the user and add them to the kicked list
    targetSocket.leave(room);
    rooms[room].kicked = rooms[room].kicked || [];
    rooms[room].kicked.push(targetSocketId);

    // Notify the target user
    targetSocket.emit('kicked', `You have been kicked from ${room}`);

    // Set a timer to remove the user from the kicked list after 1 minute
    setTimeout(() => {
        rooms[room].kicked = rooms[room].kicked.filter(id => id !== targetSocketId);
    }, 60000);

    // Finally, call the callback with no error and a success message
    callback(null, 'User kicked for 1 minute');
}


function handleWhisper(socket, io, users, targetNickname, message, callback) {
    let recipientSocketId = Object.keys(users).find(key => users[key].nickname === targetNickname);
    if (recipientSocketId) {
        console.log("recipientSocketId: ", recipientSocketId, "message: ", message);
        // Emit the 'receiveWhisper' event to the recipient with the sender's nickname and message
        io.to(recipientSocketId).emit('receiveWhisper', { from: users[socket.id].nickname, message, to: targetNickname});
        if (typeof callback === 'function') {
            callback(null, 'Message sent');
        }
    } else {
        if (typeof callback === 'function') {
            callback('User not found');
        }
    }
}


// Handle block user
function handleBanUser(socket, io, room, users, targetNickname, callback, rooms) {
    if (!hasPermission(socket.id, room, rooms)) {
        return callback('Permission denied');
    }

    // Find the target user to ban by their socket ID
    let targetSocketId = targetNickname; // Since targetNickname is actually the socket ID
    console.log("users: ", users);
    console.log("targetSocketId: ", targetSocketId);
    console.log("socket.id: ", socket.id);
    console.log("keys: ", Object.keys(users));
    if (!users[targetSocketId]) {
        return callback('User not found');
    }

    // Get the target socket
    let targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) {
        return callback('Target socket not found');
    }

    rooms[room].banned = rooms[room].banned || [];
    rooms[room].banned.push(targetSocketId);

    // Notify the user they have been banned
    targetSocket.emit('banned', `You have been banned from ${room}`);

    // Acknowledge the ban to the requester
    callback(null, 'User banned');
}



// Utility function to check if the user has permission
function hasPermission(userId, room, rooms) {
    // Ensure rooms is defined and the room exists
    if (rooms && rooms[room]) {
        return rooms[room].owner === userId;
    }
    return false; // No permission if rooms is not defined or room does not exist
}


// ----------------- -----------------Join room and Leave room logic present below------------------- ----------------- //

function handleJoinRoom(socket, io, roomName, password, callback, users, rooms) {
    //makes sure the roomname is valid
    if (!roomName || !rooms[roomName]) {
        return callback('Invalid room name or room does not exist');
    }

    //makes sure the room password is valid
    if (rooms[roomName].password && rooms[roomName].password !== password) {
        return callback('Incorrect password');
    }

    users[socket.id] = { nickname: users[socket.id].nickname || socket.id, currentRoom: roomName ,  profilepic_file: users[socket.id].profilepic_file,
        profilepic_alttext: users[socket.id].profilepic_alttext,};
    socket.join(roomName);

    // if the user isn't in the room, add them
    if (!rooms[roomName].users.includes(socket.id))
        rooms[roomName].users.push(socket.id);

    console.log("Users in room:", rooms[roomName].users);

    emitRoomList(io, rooms);
    updateUsersInRoom(io, roomName, rooms, users);
    callback(); // Successful join, no error passed to callback.
}


function handleLeaveRoom(socket, io, roomName, users, rooms, callback) {
    if (!roomName || !rooms[roomName]) {
        return callback('Invalid room name or room does not exist');
    }

    // User leaves the room
    socket.leave(roomName);

    // Remove the user from the room's user list
    rooms[roomName].users = rooms[roomName].users.filter(id => id !== socket.id);

    // print out all the users in this room
    console.log("Users in room:", rooms[roomName].users);

    // If there are no users left in the room, delete the room
    if (rooms[roomName].users.length === 0) {
        delete rooms[roomName];
    } else {
        // If there are still users, then update them about the room
        updateUsersInRoom(io, roomName, rooms, users);
    }

    // Update the overall room list since a room might have been deleted
    emitRoomList(io, rooms);

    callback();
}


function emitRoomList(io, rooms) {
    io.emit('room_list', Object.keys(rooms));
}

function updateUsersInRoom(io, roomName, rooms, users) {
    // Create an array of user objects with both nicknames and IDs
    let usersInRoom = rooms[roomName].users.map(id => ({
        nickname: users[id].nickname,
        id: id ,// Include the socket ID
        profilepic_file: users[id].profilepic_file,
        profilepic_alttext: users[id].profilepic_alttext,
    }));
    let roomOwner = rooms[roomName].owner; // Assuming you store the owner's socket ID
    io.to(roomName).emit('users_in_room', { users: usersInRoom, owner: roomOwner, room: roomName });
}

function getRoomList() {
    return Object.keys(rooms);
}

function handleIncomingMessage(socket, io, data, users, rooms) {
    console.log("Received data in handleIncomingMessage:", data);
    console.log("Current rooms:", rooms);
    console.log("!!!!Users:", users);

    const user = users[socket.id];
    const room = rooms[data.room];
    console.log("!!!!!!!!!NICKNAMEEEE: ", user.nickname)
    console.log("User:", user);
    console.log("Room:", room);

    if (!data.room) {
        console.error("Room not specified in message data.");
        return;
    }

    if (!user) {
        console.error(`User not found for socket id: ${socket.id}`);
        console.error(`Users object:`, users);
    }

    if (!room) {
        console.error(`Room not found for room name: ${data.room}`);
        console.error(`Rooms object:`, rooms);
    }






    if (room && user) {
        console.log("IN THE IF: Current rooms:", rooms);

        const message = { message: data.message, username: user.nickname || socket.id, users: users};
        room.messages.push(message);

        // Only send the new me

        io.to(data.room).emit('message_to_client', message);
        console.log(`Sent message: ${data.message} to room: ${data.room}`);
    } else {

        console.log(`Attempt to send message to undefined room: ${data.room}`);
    }
}

// //gets password for a given room, TEST TODO DEBUG
function getpassword(rooms, room_name_input) {

    return rooms[room_name_input].password;
}


