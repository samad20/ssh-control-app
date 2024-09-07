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
                    password: script.sshPass,
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
    const scripts = await Script.find({server: req.params.id});

    if (!scripts) {
        res.status(500).json({ success: false });
    }

    console.log(scripts)
    res.send(scripts);
});

router.get(`/run/:id`, async (req, res) => {
    const script = await Script.findById(req.params.id);
    
    if (!script) {
        res.status(500).json({ success: false });
    }

    const server = await Server.findById(script.server)

    if (!server) {
        res.status(500).json({ success: false });
    }

    console.log(script)

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
        password: script.sshPass,
    });
});


//only admin



router.post(`/Server/:id`,auth.verifyToken,auth.isAdmin, async (req, res) => {

 
    let script = new Script({
        server: req.params.id,
        name: req.body.name,   
        command: req.body.command,
        sshPass: req.body.sshPass,
        sshUser: req.body.sshUser     
    });

    script = await script.save();

    if (!script) return res.status(500).send('The Server cannot be created');

    res.send(script);
});

router.put('/:id',auth.verifyToken, auth.isAdmin,  async (req, res) => {
   
    const updatedScript = await Script.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,   
            command: req.body.command,
            sshPass: req.body.sshPass,
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
    const ServerList = await Server.find().populate('location');

    if (!ServerList) {
        res.status(500).json({ success: false });
    }
    res.send(ServerList);
});


module.exports = router;
