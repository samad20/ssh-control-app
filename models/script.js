const mongoose = require('mongoose');

const scriptSchema = mongoose.Schema({
    server:  {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Server',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    command: {
        type: String,
        required: true
    },
    sshUser:{
        type: String,
        required: true
    },
    sshPass:{
        type: String,
        required: true
    },
    dateCreated: {
        type: Date,
        default: Date.now
    },
});

scriptSchema.virtual('id').get(function () {
    return this._id.toHexString();
});
  

scriptSchema.set('toJSON', {
    virtuals: true
});

exports.Script = mongoose.model('Script', scriptSchema);
