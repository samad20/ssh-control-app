const mongoose = require('mongoose');

const serverSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    owenerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    usersID: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    dateCreated: {
        type: Date,
        default: Date.now
    },
});

serverSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
  

serverSchema.set('toJSON', {
    virtuals: true
});

exports.Server = mongoose.model('Server', serverSchema);
