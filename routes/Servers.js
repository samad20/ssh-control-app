const { User } = require('../models/user');
const {Server} = require('../models/server');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../helpers/jwt')
path = require('path');

require('dotenv/config');



// //public route to get all verified Servers
// router.get(`/`, async (req, res) => {
//     const ServerList = await Script.find()

//     if (!ServerList) {
//         res.status(500).json({ success: false });
//     }
//     res.send(ServerList);
// });




//App routes
router.get(`/`, async (req, res) => {
    const ServerList = await Server.find();

    if (!ServerList) {
        res.status(500).json({ success: false });
    }
    res.send(ServerList);
});

//gets logged user servers
router.get(`/my`,auth.verifyToken , async (req, res) => {
    const server = await Server.find({owenerID: req.userId});
  
    if (!server) {
        res.status(500).json({ success: false });
    }
    res.send(server);
});

router.get(`/user`,auth.verifyToken , async (req, res) => {

    const UserId = new mongoose.Types.ObjectId(req.userId);

    const server = await Server.find({usersID: { $in: [UserId] } });
  
    if (!server) {
        res.status(500).json({ success: false });
    }
    res.send(server);
});


//get a Server by id in params
router.get(`/byId/:id`,auth.verifyToken,  async (req, res) => {

    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).send('Invalid Server Id');
    }

    const server = await Server.findById(req.params.id);

    if (!server) {
        res.status(500).json({ message: 'The server with the given ID was not found.' });
    }
    res.send(server);
});

//only admin


router.post(`/create`,auth.verifyToken, auth.isAdmin, async (req, res) => {
        
    let server = new Server({
        name: req.body.name, 
        ip: req.body.ip,
        owenerID: req.body.owenerID,
        usersID: req.body.usersID            
    });

    server = await server.save();

    if (!server) return res.status(500).send('The Server cannot be created');

    res.send(server);
});

router.put('/:id',auth.verifyToken, auth.isAdmin,  async (req, res) => {
    const updatedServer = await Server.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            ip: req.body.ip,
            usersID: req.body.usersID 
            
        },
        { new: true }
    );

    if (!updatedServer) return res.status(500).send('the Server cannot be updated!');

    res.send(updatedServer);
});


//all Admin routes

//delete a server, only the owner or the admin 
router.delete('/:id',auth.verifyToken, auth.isAdmin, (req, res) => {
    Server.findByIdAndDelete(req.params.id)
        .then((server) => {
            if (server) {                              
                return res.status(200).json({
                    success: true,
                    message: 'the Server is deleted!'
                });
            } else {
                return res.status(404).json({ success: false, message: 'Server not found!' });
            }
        })
        .catch((err) => {
            return res.status(500).json({ success: false, error: err });
        });
});

//gets all servers in all states of servers (inclueds unverified servers)
router.get(`/all`,auth.verifyToken, auth.isAdmin, async (req, res) => {
    const ServerList = await Server.find();

    if (!ServerList) {
        res.status(500).json({ success: false });
    }
    res.send(ServerList);
});


module.exports = router;
