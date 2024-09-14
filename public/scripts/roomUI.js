//roomUI.js
module.exports = function (socket) {
    // Listen for server events to update the room list
    socket.on('room_list', function (roomList) {
        let roomListElement = document.getElementById('roomList');
        roomListElement.innerHTML = '';
        for (let i = 0; i < roomList.length; i++) {
            (function (roomName) {
                let roomElement = document.createElement('li');
                let roomTextNode = document.createTextNode(roomName);
                let joinButton = document.createElement('button');
        
                // Create a container for the password input and label
                const passwordContainer = document.createElement('div');
                passwordContainer.id = `passwordContainer-${roomName}`; // Set a unique ID using the room name
        
                const passwordLabel = document.createElement('label');
                passwordLabel.textContent = "Password for " + roomName + ":";
                passwordLabel.setAttribute('for', `passwordField-${roomName}`);
        
                const passwordInput = document.createElement('input');
                passwordInput.type = 'password';
                passwordInput.id = `passwordField-${roomName}`; // Set a unique ID using the room name
                passwordInput.placeholder = 'Enter password';
        
                joinButton.textContent = 'Join Room';
        
                // Add elements to the roomElement
                roomElement.appendChild(roomTextNode);
                roomElement.appendChild(joinButton);
                roomElement.appendChild(passwordContainer); // Append the password container to the room element
                document.getElementById('roomList').appendChild(roomElement); // Append the room element to the room list
        

            
                // gets password of the currently iterated room
                socket.emit('password_check', roomName, function (password) {
                    console.log("IN PASSWORD CHECK ROOM CLIENT SIDE");
                    passwordInfo = {}
                    if (password) {
                        // Check if the elements are not already appended
                        if (!passwordContainer.contains(passwordLabel)) {
                            passwordContainer.appendChild(passwordLabel);
                        }
                        if (!passwordContainer.contains(passwordInput)) {
                            passwordContainer.appendChild(passwordInput);
                        }
                    }
                });

                
                joinButton.onclick = function () {
                    console.log('Joining room:', roomName);

                    let password = passwordInput.value;// going to be a password input eventually

                    socket.emit('join_room', roomName, password, function (error) {  // include password here
                        console.log("IN  JOIN ROOM CLIENT SIDE "); //TODO DEBUG

                        if (error) {
                            alert(error);
                            console.log(true);
                        } else {
                            joinRoomAndUpdateDisplay(roomName);
                            console.log(false);
                        }
                    });
                };
            })(roomList[i]);
        }
    });

    //added this function here so that the join buttons can work and make chat rooms accordingly
    function joinRoomAndUpdateDisplay(roomName) {

        //save the room storage in a hidden label 
        let current_room = document.getElementById('current_room');
        current_room.textContent = roomName;


        document.getElementById('roomSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        let roomDisplay = document.getElementById('roomDisplay');
        roomDisplay.textContent = 'Room: ' + roomName;


    }

    return {
        createRoom: function (roomName, password, callback) {
            let ownerId = socket.id;
        
            console.log('outside: create_room event emitted with room:', roomName);
            socket.emit('create_room', { roomName, password, ownerId }, function (error) { // Send an object with roomName, password, and ownerId
                if (error) {
                    alert(error);
                    console.log('roomUI: create_room event emitted with room:', roomName);
                    console.log(true);
                } else {
                    console.log('Successfully created room:', roomName);
        
                    // join the room that is created
                    socket.emit('join_room', roomName, password, function (error) { // include password here
                        console.log("ABLE TO JOIN DA NEW ROOOOOOM "); 
                        joinRoomAndUpdateDisplay(roomName);
                    });
                    console.log(false);
                }
            });
        },
        


        leaveRoom: function (roomName) {
            // Clear the chat UI
            let chatLog = document.getElementById('chatLog');
            chatLog.innerHTML = '';

            socket.emit('leave_room', roomName, function (error) {
                if (error) {
                    alert(error);
                } else {
                    console.log('Successfully left room:', roomName);
                }
            });
            console.log('leave_room event emitted with room:', roomName);
        },


        kickUser: function (userId, roomName) { // Method to kick a user from a room
            socket.emit('kick_user', userId, roomName, function (error) {
                if (error) alert(error);
            });
        },
        banUser: function (userId, roomName) { // Method to permanently ban a user from a room
            socket.emit('ban_user', userId, roomName, function (error) {
                if (error) alert(error);
            });
        }
    };
};

function getUsername() {
    let nickname_storage = document.getElementById('nickname_storage');
    let myNickname = nickname_storage ? nickname_storage.textContent : 'Unknown';
    return myNickname;
}