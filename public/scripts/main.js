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
