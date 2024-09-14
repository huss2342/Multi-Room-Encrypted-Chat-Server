//chatUI.js
let currentRoom;
let otherUsersInRoom = [];

const DB_NAME = 'KeyDatabase';
const STORE_NAME = 'keys';
const DB_VERSION = 1; 

// -------------------------------ENCRYPT AND DECRYPT-----------------------

// Use the recipient's public key to encrypt the message
async function encryptMessage(publicKey, message) {
    const encodedMessage = new TextEncoder().encode(message);

    try {
        // Import the public key from base64
        const importedPublicKey = await window.crypto.subtle.importKey(
            "spki",
            Uint8Array.from(atob(publicKey), c => c.charCodeAt(0)),
            {
                name: "RSA-OAEP", // algorithm
                hash: { name: "SHA-256" }, // Hash as an object with a name property
            },
            false,
            ["encrypt"]
        );

        // Encrypt the message with the public key
        const encryptedData = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP",
            },
            importedPublicKey,
            encodedMessage
        );

        // Convert the encrypted data to a Base64 string
        return arrayBufferToBase64(encryptedData);
    } catch (error) {
        console.error("Encryption failed:", error);
        throw error;
    }
}

// Define a function to open a connection to the IndexedDB
async function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'nickname' });
            }
        };

        request.onerror = event => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onblocked = event => {
            console.warn('IndexedDB opening blocked. Please close all other tabs with this site open!');
            reject(new Error('Database opening blocked'));
        };

        request.onsuccess = event => {
            resolve(event.target.result);
        };
    });
}

// Define a function to retrieve a private key from IndexedDB using a nickname
async function getPrivateKey(nickname) {
    const db = await openIndexedDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(nickname);

    return new Promise((resolve, reject) => {
        request.onerror = event => {
            console.error('IndexedDB get error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = event => {
            if (event.target.result) {
                resolve(event.target.result.privateKey);
            } else {
                reject(new Error('No private key found for the given nickname'));
            }
        };
    });
}



// Decrypt an encrypted message using the private key
async function decryptMessage(nickname, encryptedData) {
    // Convert Base64 encrypted data to ArrayBuffer
    const encryptedArrayBuffer = base64ToArrayBuffer(encryptedData);

    console.log("encrypted data", encryptedData);

    // Get the private key from IndexedDB and convert it from Base64 to ArrayBuffer
    try {
        const privateKeyBase64 = await getPrivateKey(nickname);
        if (!privateKeyBase64) {
            throw new Error('No private key found in IndexedDB');
        }

        const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
        // Import the private key from the ArrayBuffer
        const importedPrivateKey = await window.crypto.subtle.importKey(
            "pkcs8",
            privateKeyBuffer,
            {
                name: "RSA-OAEP",
                hash: { name: "SHA-256" }
            },
            true, // Set to true so the key can be extractable
            ["decrypt"]
        );
        console.log("got past the import key stage");

        // Decrypt the message with the private key
        const decryptedData = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP"
            },
            importedPrivateKey,
            encryptedArrayBuffer // Use the ArrayBuffer of the encrypted data
        );
        // Convert the decrypted ArrayBuffer back into a string
        console.log("decrypted and decoded data", new TextDecoder().decode(decryptedData));
        return new TextDecoder().decode(decryptedData);
    } catch (error) {
        console.error("Decryption failed:", error);
        throw error;
    }
}


function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}


// Function to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}


// -------------------------------------------------------------------------------------- //


module.exports = function (socket) {


    socket.onAny((event, ...args) => {
        //this is where it is going once a room is 'created'
        //triggers the making of a room class and storing the properties in there
        console.log(event, args);
    });

    function setRoom(roomName) {
        currentRoom = roomName;
        console.log('Current room set to:', currentRoom);
    }

    //sending message function
    socket.on('message_to_client', function (data) {
        if (data.room === currentRoom) {
            let myName = document.getElementById('nicknameInput').value;
            console.log('userslist', data.users);
            
            // Find if the nickname exists in the users object received
            let isRecipient = Object.values(data.users).some(user => user.nickname === myName);
            
            if (isRecipient) {
                console.log('winning');
                displayMessage(data.username, data.message, myName);
            }
        }
    });
    


    //displays message to the chat room
    async function displayMessage(username, encryptedData, nickname) {
        console.log('displaying the message');
        let chatLog = document.getElementById('chatLog');
        let hr = document.createElement('hr');

        try {
            console.log('decrypting the message for ' + nickname);
            // decrypt the message
            let decryptedMessage = await decryptMessage(nickname, encryptedData);


            let textNode = document.createTextNode(username + ': ' + decryptedMessage);
            chatLog.appendChild(hr);
            chatLog.appendChild(textNode);
            chatLog.scrollTop = chatLog.scrollHeight;
        } catch (error) {//display the error that occurs
            console.error("Decryption failed:", error);

        }
    }


    socket.on('users_in_room', function (data) {
        if (!data || !Array.isArray(data.users)) {
            console.error('Invalid or undefined user data received from server');
            return; // Exit the function if there's no valid user data
        }

        let userListElement = document.getElementById('userList');
        userListElement.innerHTML = '';
        const users = data.users;
        const owner = data.owner;
        const myId = socket.id; // Get your own socket ID
        let currentRoom = data.room;

        // Reset the otherUsersInRoom array
        otherUsersInRoom = users
            .filter(user => user.id !== myId) // Filter out the current user
            .map(user => user.nickname); // Map to an array of nicknames

        users.forEach(function (user) {
         


            let userElement = document.createElement('li');
           

            imageElement = document.createElement('img');
            console.log("IMAGE FILE", user.profilepic_file);
            imageElement.src =  user.profilepic_file; //  the actual path to the image
            imageElement.alt = user.profilepic_alttext; 
            imageElement.classList.add('imagestuff');
            userElement.appendChild(imageElement);

            let userTextNode = document.createTextNode(user.nickname); // Display the user's nickname
            userElement.appendChild(userTextNode);

            // Check if the user is not the current logged in user and if the logged in user is the owner
            if (user.id !== myId && myId === owner) {
                // Create buttons for whispering, kicking, and blocking
                let whisperButton = document.createElement('button');
                whisperButton.innerText = 'Whisper';
                whisperButton.onclick = function () { whisperUser(user.nickname); }; // Pass the user's socket ID

                let kickButton = document.createElement('button');
                kickButton.innerText = 'Kick';
                kickButton.onclick = function () { kickUser(user.id, currentRoom); }; // Pass the user's socket ID

                let blockButton = document.createElement('button');
                blockButton.innerText = 'Ban';
                blockButton.onclick = function () { banUser(user.id, currentRoom); }; // Pass the user's socket ID

                // Append buttons to userElement
                userElement.appendChild(whisperButton);
                userElement.appendChild(kickButton);
                userElement.appendChild(blockButton);
            } else if (user.id !== myId) {
                // If the current user is not the owner, only show the whisper button
                let whisperButton = document.createElement('button');
                whisperButton.innerText = 'Whisper';
                whisperButton.onclick = function () { whisperUser(user.nickname); }; // Pass the user's socket ID
                userElement.appendChild(whisperButton);
            }

            // Append userElement to userList
            userListElement.appendChild(userElement);
        });
    });


    // Function to handle whisper action
    // Get the modal
    let modal = document.getElementById('whisperModal');
    let span = document.getElementsByClassName("close")[0];

    socket.on('receiveWhisper', function (data) {
        console.log('Received whisper - 1:', data.message.message, 'from:', data.from);

        displayWhisper(data.from, data.message, data.to);

        console.log('Received whisper: - 3', data.message, 'from:', data.from);
    });

    async function displayWhisper(from, message, nickname) { //display whisper (decrypt here)
        let chatLog = document.getElementById('chatLog');
        let hr = document.createElement('hr');

        // Create a new span element for the whisper text
        let whisperSpan = document.createElement('span');


        try {
            // decrypt the message
            //todo, try changing this to const
            let decryptedMessage = await decryptMessage(nickname, message.message);
            console.log('Received whisper: - 2', message.message, 'from:', from);


            whisperSpan.textContent = 'Whisper from ' + from + ': ' + decryptedMessage;

            // Apply a class for styling (preferred)
            whisperSpan.className = 'whisper-received';

            // Append the new elements to the chat log
            chatLog.appendChild(hr);
            chatLog.appendChild(whisperSpan);
            chatLog.scrollTop = chatLog.scrollHeight;
        } catch (error) {
            console.error("Decryption failed:", error);

        }
    }


    // Function to handle whisper action
    function whisperUser(userId) { //encrypt whisper here??
        //gets current room
        let room = document.getElementById('current_room').textContent;

        // Display the modal
        modal.style.display = "block";
        // Set a click event on the Send Whisper button
        document.getElementById('sendWhisper').onclick = function () {
            let whisperMessage = document.getElementById('whisperInput').value;
            if (whisperMessage) {
                console.log('Sending whisper:', whisperMessage, 'to:', userId);


                //get the message and organize the recipient from the sender in the encryption process
                let recipientNicknames = [userId];
                console.log('Sending message:', whisperMessage, 'to room:', room, 'recipients:', recipientNicknames);


                recipientNicknames.forEach(recipientNickname => {
                    getRecipientPublicKey(recipientNickname, async (recipientPublicKey) => {
                        if (recipientPublicKey) {
                            // Now you have the public key, proceed with encryption
                            try {
                                let encryptedMessage = await encryptMessage(recipientPublicKey, whisperMessage);
                                console.log('Encrypted message:', encryptedMessage);
                                let payload = {
                                    message: encryptedMessage,
                                    room: room
                                };
                                // Send the whisper message with a callback function for the response
                                socket.emit('whisper', userId, payload, function (error, response) {
                                    if (error) {
                                        console.error('Error sending whisper:', error);
                                    } else {
                                        console.log('Whisper sent:', response);

                                        // Show that the whisper is sent
                                        let chatLog = document.getElementById('chatLog');
                                        let hr = document.createElement('hr');

                                        // Create a new span element for the whisper text
                                        let whisperSpan = document.createElement('span');
                                        whisperSpan.textContent = 'Sent whisper to ' + userId + ': ' + whisperMessage;

                                        // Apply a class for styling (preferred)
                                        whisperSpan.className = 'whisper-sent';

                                        // Append the new elements to the chat log
                                        chatLog.appendChild(hr);
                                        chatLog.appendChild(whisperSpan);
                                        chatLog.scrollTop = chatLog.scrollHeight; // Scrolls to the bottom of the chat log
                                    }
                                });
                                // Clear the input after sending
                                document.getElementById('whisperInput').value = '';
                                // Hide the modal
                                modal.style.display = "none";

                            } catch (error) {
                                console.error("Encryption failed:", error);
                            }
                        } else {
                            console.error("Failed to get recipient's public key for", recipientNickname);
                        }
                    });
                });



            }
        };
    }




    // When the user clicks on <span> (x), close the modal
    span.onclick = window.onclick = function (event) {
        //stop propogating
        if (event.target == modal || event.target == span) {
            modal.style.display = "none";
        }
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
        if (event.target === modal || event.target === span) {
            modal.style.display = "none";
        }
    };



    // Function to handle kick action
    function kickUser(userId, room) {
        console.log('Kicking user:', userId, 'from room:', room);
        socket.emit('kick', { userId: userId, room: room }, function (error, response) {
            if (error) {
                console.error('Error kicking user:', error);
            } else {
                console.log('Kick response:', response);
            }
        });
    }

    // Function to handle block action
    function banUser(userId, room) {
        console.log('Banning user:', userId, 'from room:', room);
        socket.emit('ban', { userId: userId, room: room }, function (error, response) {
            if (error) {
                console.error('Error banning user:', error);
            } else {
                console.log('Ban response:', response);
            }
        });
    }



    // the kick and banned function socket calls 
    socket.on('kicked', message => {

        document.getElementById('leaveRoomButton').click();
        alert(message);
    });

    socket.on('banned', message => {

        document.getElementById('leaveRoomButton').click();
        alert(message);
    });

    function getRecipientPublicKey(recipientNickname, callback) {
        // Request public key for the recipient from the server
        socket.emit('request_public_key', recipientNickname, function (response) {
            if (response.error) {
                console.error("Failed to get recipient's public key:", response.error);
                callback(null);
            } else {
                callback(response.publicKey);
            }
        });
    }


    return {
        sendMessage: async function (message) {
            console.log('Sending message...');
            let room = this.getCurrentRoom();
            let nickname = document.getElementById('nicknameInput').value;

            // Create a new array from the original one and include the sender's nickname
            let recipientNicknames = [...otherUsersInRoom, nickname];

            console.log('Sending message:', message, 'to room:', room, 'recipients:', recipientNicknames);

            // Check if there are any recipients before proceeding
            if (recipientNicknames.length === 1) {
                alert('No other users in the room to send the message to.');
                return; // Exit the function if there are no other users
            }

            recipientNicknames.forEach(recipientNickname => {
                getRecipientPublicKey(recipientNickname, async (recipientPublicKey) => {
                    if (recipientPublicKey) {
                        // Now you have the public key, proceed with encryption
                        try {
                            const encryptedMessage = await encryptMessage(recipientPublicKey, message);
                            let payload = {
                                message: encryptedMessage,
                                room: room
                            };
                            socket.emit('message_to_server', payload);
                        } catch (error) {
                            console.error("Encryption failed:", error);
                        }
                    } else {
                        console.error("Failed to get recipient's public key for", recipientNickname);
                    }
                });
            });
        },

        getCurrentRoom: function () {
            return document.getElementById('current_room').textContent;
        }
    };



};

