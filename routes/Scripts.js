const { Script } = require('../models/script');
const { Server } = require('../models/server');

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../helpers/jwt')
path = require('path');

const SSH = require("simple-ssh");
const readline = require('readline');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const jwt = require('jsonwebtoken');
const secret = process.env.secret;


require('dotenv/config');

const crypto = require('crypto');

// Example secret key (store securely in env variables)
const secretKey = process.env.SECRET_KEY;
const algorithm = 'aes-256-ctr';

// Function to encrypt password
function encryptPassword(password) {
    // const key = crypto.randomBytes(32).toString('hex'); // For AES-256, use 32 bytes
    // console.log('AES Encryption Key:', key);
    
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
   
    return iv.toString('hex') + ':' + encrypted;
}

// Function to decrypt password
function decryptPassword(encryptedPassword) {
    const [iv, encrypted] = encryptedPassword.split(':');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'hex'), Buffer.from(iv, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    
    return decrypted;
}




// WebSocket server for live streaming
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
    
    // Extract token from query string in the WebSocket connection URL
    const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token'); 

    if (!token) {
        ws.send(JSON.stringify({ error: 'Unauthorized: No token provided' }));
        ws.close();
        return;
    }

    // Verify the token (assuming JWT)
    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            ws.send(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
            ws.close();
            return;
        }


        console.log('Client connected to WebSocket for live streaming.');

        // When the client sends a message (assuming it sends the script ID)
        ws.on('message', async (scriptId) => {
            try {
                const script = await Script.findById(scriptId);
                if (!script) {
                    ws.send(JSON.stringify({ success: false, message: 'Script not found' }));
                    return;
                }

                const server = await Server.findById(script.server);
                if (!server) {
                    ws.send(JSON.stringify({ success: false, message: 'Server not found' }));
                    return;
                }

                if(!server.usersID.includes(decoded.userId)){
                    ws.send(JSON.stringify({ success: false, message: 'Not your Server' }));
                    return;
                }

                const decryptedPassword = decryptPassword(script.sshPass);

                const conn = new Client();
                conn.on('ready', () => {
                    console.log('SSH Client :: ready');

                    conn.exec(script.command, (err, stream) => {
                        if (err) throw err;

                        // Send the command output line by line to the WebSocket client
                        const rl = readline.createInterface({
                            input: stream,
                            terminal: false,
                        });

                        rl.on('line', (line) => {
                            ws.send(JSON.stringify({ output: line })); // Send each line of output
                        });

                        // If there's an error in the command execution, send it to the client
                        stream.stderr.on('data', (data) => {
                            ws.send(JSON.stringify({ error: data.toString() }));
                        });

                        // Close connection when the command completes
                        stream.on('close', (code, signal) => {
                            ws.send(JSON.stringify({ message: `Command finished with code: ${code}` }));
                            conn.end();
                        });
                    });
                }).connect({
                    host: server.ip,
                    username: script.sshUser,
                    password: decryptedPassword,
                });

            } catch (error) {
                ws.send(JSON.stringify({ error: 'An error occurred: ' + error.message }));
            }
        });
        // Close WebSocket when the client disconnects
        ws.on('close', () => {
            console.log('Client disconnected from WebSocket.');
        });
    });
});





//gets logged user servers
router.get(`/byServer/:id`,auth.verifyToken, async (req, res) => {
    const scripts = await Script.find({server: req.params.id}).select('-sshPass');

    if (!scripts) {
        res.status(500).json({ success: false });
    }

    // console.log(scripts)
    res.send(scripts);
});

router.get(`/run/:id`, async (req, res) => {
    const script = await Script.findById(req.params.id);

    const decryptedPassword = decryptPassword(script.sshPass)
    
    if (!script) {
        res.status(500).json({ success: false });
    }

    const server = await Server.findById(script.server)

    if (!server) {
        res.status(500).json({ success: false });
    }

    // console.log(script)

    const conn = new Client();

    conn.on('ready', () => {
        console.log('Client :: ready');
    
        // Execute command on the remote server
        conn.exec(script.command, (err, stream) => {
            if (err) throw err;
    
            // Process the live output line by line
            const rl = readline.createInterface({
                input: stream, // Reading from the stream
                terminal: false,
            });
    
            rl.on('line', (line) => {
                console.log('OUTPUT:', line); // Output each line as it is received
            });
    
            // If an error occurs, log it
            stream.stderr.on('data', (data) => {
                console.error('STDERR:', data.toString());
            });
    
            stream.on('close', (code, signal) => {
                console.log(`Stream :: close :: code: ${code}, signal: ${signal}`);
                conn.end(); // Close the SSH connection after the command is done
            });
        });
    }).connect({
        host: server.ip,
        username: script.sshUser,
        password: decryptedPassword,
    });
});


//only admin



router.post(`/Server/:id`,auth.verifyToken,auth.isAdmin, async (req, res) => {

    const encryptedPassword = encryptPassword(req.body.sshPass);
 
    let script = new Script({
        server: req.params.id,
        name: req.body.name,   
        command: req.body.command,
        sshPass: encryptedPassword,
        sshUser: req.body.sshUser     
    });

    script = await script.save();

    if (!script) return res.status(500).send('The Server cannot be created');

    res.send(script);
});

router.put('/:id',auth.verifyToken, auth.isAdmin,  async (req, res) => {

    const scriptExist = await Script.findById(req.params.id);

    let newSshPass;
    if (req.body.sshPass) {
        newSshPass = encryptPassword(req.body.sshPass);
    } else {
        newSshPass = scriptExist.sshPass;
    }
   
    const updatedScript = await Script.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,   
            command: req.body.command,
            sshPass: newSshPass,
            sshUser: req.body.sshUser
        },
        { new: true }
    );

    if (!updatedScript) return res.status(500).send('the Server cannot be updated!');

    res.send(updatedScript);
});



//delete a servers, only the owner or the admin 
router.delete('/:id',auth.verifyToken, auth.isAdmin, (req, res) => {
    Script.findByIdAndDelete(req.params.id)
        .then((scripts) => {
            if (scripts) {                              
                return res.status(200).json({
                    success: true,
                    message: 'the Script is deleted!'
                });
            } else {
                return res.status(404).json({ success: false, message: 'Server not found!' });
            }
        })
        .catch((err) => {
            return res.status(500).json({ success: false, error: err });
        });
});

//gets all serverss in all states of serverss (inclueds unverified serverss)
router.get(`/all`,auth.verifyToken,auth.isAdmin, async (req, res) => {
    const ServerList = await Script.find().select('-sshPass');

    if (!ServerList) {
        res.status(500).json({ success: false });
    }
    res.send(ServerList);
});


module.exports = router;
