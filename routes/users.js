const { User } = require('../models/user');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../helpers/jwt')
const crypto = require("crypto");



//Public routes
router.post('/register', async (req, res) => {
    const userCheck = await User.findOne({ name: req.body.name });
    if (userCheck) {
        return res.status(400).send('User with this name Already exist');
    }

    let user = new User({
        name: req.body.name,
        passwordHash: bcrypt.hashSync(req.body.password, 10),
    });
    user = await user.save();

    if (!user) return res.status(400).send('the user cannot be created!');
    
    return res.status(200).send({ id: user.id });
});



router.post('/login', async (req, res) => {
    const user = await User.findOne({ name: req.body.name });
    const secret = process.env.secret;
    if (!user) {
        return res.status(400).send('The user not found');
    }

    if (user && bcrypt.compareSync(req.body.password, user.passwordHash)) {
        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            secret,
            { expiresIn: '1d' }
        );
        res.status(200).send({ id: user.id  , role: user.role, token: token });
    } else {
        res.status(400).send('password is wrong!');
    }
});



//only loged users access
router.use(auth.verifyToken)

router.get('/byId/:id', async (req, res) => {
    const user = await User.findById(req.params.id).select('-passwordHash -role');

    if (!user) {
        res.status(500).json({ message: 'The user with the given ID was not found.' });
    }
    res.status(200).send(user);
});

router.get('/myProfile', async (req, res) => {
    const user = await User.findById(req.userId).select('-passwordHash');

    if (!user) {
        res.status(500).json({ message: 'The user with the given ID was not found.' });
    }
    res.status(200).send(user);
});



//only admins access
router.use(auth.isAdmin)

router.get(`/`,async (req, res) => {
    const userList = await User.find().select('-passwordHash');

    if (!userList) {
        res.status(500).json({ success: false });
    }
    res.send(userList);
});



router.post('/',async (req, res) => {
    let user = new User({
        name: req.body.name,
        passwordHash: bcrypt.hashSync(req.body.password, 10),
        role: req.body.role
    });
    user = await user.save();

    if (!user) return res.status(400).send('the user cannot be created!');

    res.send(user);
});

router.get('/:id', async (req, res) => {
    const user = await User.findById(req.params.id).select('-passwordHash');

    if (!user) {
        res.status(500).json({ message: 'The user with the given ID was not found.' });
    }
    res.status(200).send(user);
});

router.put('/:id', async (req, res) => {
    const userExist = await User.findById(req.params.id);
    let newPassword;
    if (req.body.password) {
        newPassword = bcrypt.hashSync(req.body.password, 10);
    } else {
        newPassword = userExist.passwordHash;
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        {
            name: req.body.name,
            passwordHash: newPassword,
            role: req.body.role
        },
        { new: true }
    );

    if (!user) return res.status(400).send('the user cannot be created!');

    res.send(user);
});



router.delete('/:id', (req, res) => {
    if (req.params.id == req.userId) {
        return res.status(404).json({ success: false, message: 'Can not delete your admin account!' });
    } else {
        User.findByIdAndDelete(req.params.id)
        .then((user) => {
            if (user) {
                return res.status(200).json({ success: true, message: 'the user is deleted!' });
            } else {
                return res.status(404).json({ success: false, message: 'user not found!' });
            }
        })
        .catch((err) => {
            return res.status(500).json({ success: false, error: err });
        });
    }
    
});


router.put('/changeRole/:id', async (req, res) => {
    const user = await User.findByIdAndUpdate(
    req.params.id,
    {
        
        role: req.body.role,
        
    },
    { new: true }
);

if (!user) return res.status(500).send('the User cannot be updated!');

res.send(user);
});




module.exports = router;
