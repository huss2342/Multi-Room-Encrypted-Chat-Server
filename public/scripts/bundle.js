(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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
    
    
    },{}],2:[function(require,module,exports){
    //main.js
    //required files
    let socket = io.connect();
    let chatUI = require('./chatUI.js')(socket);
    let roomUI = require('./roomUI.js')(socket);
    
    const DB_NAME = 'KeyDatabase';
    const STORE_NAME = 'keys';
    const DB_VERSION = 1;
    
    // -------------------------------SETTING ENCRYPTION-----------------------
    
    function arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    
    // checking when tab is closed
        // remove private key from indexedDB
        // leave the room
    window.addEventListener('beforeunload', async (event) => {
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
        const nickname = document.getElementById('nicknameInput').value;
        if (nickname) {
            // Prevent the default unload behavior
            event.preventDefault();
    
            // Set the returnValue property of the event to a string message
            event.returnValue = '';
    
            // Delete the private key asynchronously
            try {
                await deletePrivateKey(nickname);
    
                let roomName = chatUI.getCurrentRoom(); // Get current room from chatUI
                if(roomName){
                    roomUI.leaveRoom(roomName);
                }
       
                console.log('Private key deleted successfully.');
            } catch (error) {
                console.error('Error deleting private key:', error);
            }
        }
    });
    
    // Function to delete a private key from IndexedDB based on the nickname
    async function deletePrivateKey(nickname) {
        const db = await openIndexedDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(nickname); // Delete the entry with the nickname
    
        return new Promise((resolve, reject) => {
            request.onerror = (event) => {
                console.error('IndexedDB delete error:', event.target.error);
                reject(event.target.error);
            };
    
            request.onsuccess = () => {
                resolve(true);
            };
        });
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
    
    
    // Define a function to store (or update) a private key in IndexedDB with a nickname
    async function storePrivateKey(nickname, privateKey) {
        const db = await openIndexedDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ nickname, privateKey }); // Use put to overwrite if the nickname already exists
    
        return new Promise((resolve, reject) => {
            request.onerror = event => {
                console.error('IndexedDB store error:', event.target.error);
                reject(event.target.error);
            };
    
            request.onsuccess = () => {
                resolve(request.result); // The result here is the keyPath of the stored object, which is 'nickname'
            };
        });
    }
    
    
    
    
    // Function to generate and send the key pair
    async function generateAndSendKeyPair(nickname) {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "RSA-OAEP",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash: { name: "SHA-256" },
                },
                true,
                ["encrypt", "decrypt"]
            );
    
            const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
            const publicKey = arrayBufferToBase64(exportedPublicKey);
            socket.emit('public_key', { nickname: nickname, publicKey: publicKey });
    
            const exportedPrivateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
            const privateKey = arrayBufferToBase64(exportedPrivateKey);
            // Store the private key with the associated nickname
            const keyId = await storePrivateKey(nickname, privateKey);
            console.log('!!!!!!!SETTING private key for:', nickname);
            console.log(`Private key stored in IndexedDB with key ID: ${keyId}`);
        } catch (error) {
            console.error("Key generation failed:", error);
        }
    }
    
    
    // ------------------------------- ------------ -----------------------
    
    
    document.addEventListener("DOMContentLoaded", function () {
        // Your code to run after the page is fully loaded goes here
        console.log("The main page has been loaded!");
    
        socket.emit('display_rooms', function (error) {  // include password here
    
    
            console.log("IN  DISPLAY ROOMS CLIENT SIDE ");
    
            if (error) {
                alert(error);
                console.log(true);
            } else {
                joinRoomAndUpdateDisplay(roomName);
                console.log(false);
            }
    
    
        });
    
    
    });
    
    
    window.joinRoom = function () {
        let roomName = document.getElementById('roomInput').value;
        let password = document.getElementById('passwordInput').value; // Get password
        roomUI.joinRoom(roomName, password, function (error) {  // pass the password and handle error
            if (!error) {
                joinRoomAndUpdateDisplay(roomName);
            }
        });
    }
    function joinRoomAndUpdateDisplay(roomName) {
    
    
        let current_room = document.getElementById('current_room');
        current_room.textContent = roomName;
    
    
        document.getElementById('roomSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        let roomDisplay = document.getElementById('roomDisplay');
        roomDisplay.textContent = 'Room: ' + roomName;
    
    
    }
    
    //code for leaving the room
    window.leaveRoom = function () {
        let roomName = chatUI.getCurrentRoom(); // Get current room from chatUI
        console.log('Room name fetched:', roomName);
        roomUI.leaveRoom(roomName);
    
    
        let roomDisplay = document.getElementById('roomDisplay');
        console.log('Leave room:', roomName);
        roomDisplay.textContent = '';
    
        // Hide chatSection and show roomSection when leaving a room
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('roomSection').style.display = 'block';
    }
    
    document.getElementById('messageForm').addEventListener('submit', function (e) {
        e.preventDefault(); // Prevents the form from submitting normally
        let message = document.getElementById('messageInput').value;
        chatUI.sendMessage(message);
        document.getElementById('messageInput').value = ''; // Clear the input field
    });
    
    
    document.getElementById('setNicknameButton').onclick = function () {
    
    
        //gets nickname input
        let nickname = document.getElementById('nicknameInput').value;
    
        //modify nickname display
        let nicknameDisplay = document.getElementById('nicknameDisplay');
        //save the nickname display in a hidden label
        let nickname_storage = document.getElementById('nickname_storage');
        nickname_storage.textContent = nickname;
    
    
        // //IMAGE CREATIVE PORTION STUFF: updates the user's profile image
    
        //IMAGE CREATIVE PORTION STUFF: updates the user's profile image
    
        let selectedpic;
        var imageInputs = document.getElementsByName('profileImage');
    
        for (var i = 0; i < imageInputs.length; i++) {
            if (imageInputs[i].checked) {
                selectedpic = imageInputs[i].value;
                break;
            }
        }
    
    
        let selectedPicPath = "./bird_images/" +  selectedpic;
        let selectedPicalt = selectedPicPath;
    
        console.log("Selected image:", selectedpic);
        console.log("Image Path: " + selectedPicPath);
        console.log("Alt text: ", selectedpic);
    
        //get the image path and alt text values
        let profilePicDisplay = document.getElementById('profilePicDisplay');
        profilePicDisplay.src = selectedPicPath;
        profilePicDisplay.alt = selectedPicalt;
        profilePicDisplay.classList.add('imagestuff');
        profilePicDisplay.style.display = 'block';  // Display the image
    
        //sets the user's image properties
    
    
    
    
    
    
        //updates the nickname display
        nicknameDisplay.textContent = 'User: ' + nickname;
    
    
        // Hide the nickname section and show the room section
        document.getElementById('nicknameSection').style.display = 'none';
    
        //IMAGE CREATIVE PORTION STUFF Hide the getprofilepic section and show the room section
        document.getElementById('getprofileimage').style.display = 'none';
    
    
    
        document.getElementById('roomSection').style.display = 'block';
        console.log('!!!!Set nickname:', nickname);
        // Emit the setNickname event to the server and wait for acknowledgment
    
    
    
    
    
        socket.emit('setNickname', nickname, selectedPicPath, selectedPicalt, function (acknowledged) {
            if (acknowledged) {
    
    
    
    
    
    
    
                // Nickname is set, now generate and send the key pair
                generateAndSendKeyPair(nickname);
    
                // Update the nickname display
                let nicknameDisplay = document.getElementById('nicknameDisplay');
                nicknameDisplay.textContent = 'User: ' + nickname;
    
                // Save the nickname in a hidden label for later use
                let nickname_storage = document.getElementById('nickname_storage');
                nickname_storage.textContent = nickname;
    
                // Proceed to show room section or other UI elements
                document.getElementById('nicknameSection').style.display = 'none';
                //hide the image stuff
                document.getElementById('getprofileimage').style.display = 'none';
    
    
    
                document.getElementById('roomSection').style.display = 'block';
            } else {
                // Handle the error here, such as prompting the user to try a different nickname
                console.error("Failed to set nickname on the server.");
                // Revert UI changes if the nickname wasn't set
                document.getElementById('nicknameSection').style.display = 'block';
    
                //redisplay profile image stuff
                document.getElementById('getprofileimage').style.display = 'block';
    
    
    
                document.getElementById('roomSection').style.display = 'none';
            }
        });
    
         //sets the user's image properties
    
    
        console.log('Set nickname:', nickname);
    };
    
    //create room
    document.getElementById('createRoomButton').onclick = function () {
        let roomName = document.getElementById('roomInput').value;
        let password = document.getElementById('passwordInput').value; // Get password
        console.log('Room name:', roomName);
        roomUI.createRoom(roomName, password, function (error) {  // pass the password and handle error
            if (!error) {
                console.log('Room IS MADEEEEEEEE:', roomName);
    
    
            } else {
                console.log(error);
            }
        }
        );
    };
    
    //leave room
    document.getElementById('leaveRoomButton').onclick = function () {
    
        let roomName = chatUI.getCurrentRoom(); // Get current room from chatUI
        console.log('Room name fetched:', roomName);
        roomUI.leaveRoom(roomName);
    
    
        let roomDisplay = document.getElementById('roomDisplay');
        console.log('Leave room:', roomName);
        roomDisplay.textContent = '';
    
        // Hide chatSection and show roomSection when leaving a room
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('roomSection').style.display = 'block';
        ;
    };
    
    },{"./chatUI.js":1,"./roomUI.js":3}],3:[function(require,module,exports){
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
    },{}]},{},[2]);