const express = require("express");
const SSH = require("simple-ssh");
const path = require("path");

const app = express();
const port = 3000;

const bodyParser = require('body-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv/config');
const errorHandler = require('./helpers/error-handler');


app.use(cors());
app.options('*', cors());

//middleware
app.disable('etag');
app.use(express.json());
app.use(morgan('tiny'));
app.use(errorHandler);


app.use(express.static(path.join(__dirname, "public")));



//Routes
const usersRoutes = require('./routes/users');
const serversRoutes = require('./routes/Servers');
const scriptsRoutes = require('./routes/Scripts');

const api = process.env.API_URL;

app.use(`${api}/users`, usersRoutes);
app.use(`${api}/servers`, serversRoutes);
app.use(`${api}/scripts`, scriptsRoutes);

//Database
mongoose
    .connect(process.env.CONNECTION_STRING, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: 'automate'
    })
    .then(() => {
        console.log('Database Connection is ready...');
    })
    .catch((err) => {
        console.log(err);
    });




app.get("/run-ssh", (req, res) => {
  // Replace with your SSH server details
  const ssh = new SSH({
    host: "192.168.100.153",
    user: "mohammed",
    pass: "needfordrift123",
  });

  ssh
    .exec("tail -f /homeCloud/nextcloud.log", {
      out: function (stdout) {
        console.log(stdout); // Log the output of the SSH command
        res.send(stdout); // Send output to client
      },
      err: function (stderr) {
        console.error(stderr); // Log error if any
        res.status(500).send(stderr);
      },
    })
    .start();
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
