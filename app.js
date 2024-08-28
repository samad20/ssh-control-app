const express = require("express");
const SSH = require("simple-ssh");
const path = require("path");

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/run-ssh", (req, res) => {
  // Replace with your SSH server details
  const ssh = new SSH({
    host: "your-ssh-server-ip",
    user: "your-username",
    pass: "your-password",
  });

  ssh
    .exec("uptime", {
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
