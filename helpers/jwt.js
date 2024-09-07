const jwt = require("jsonwebtoken");
const { User } = require("../models/user");


const secret = process.env.secret;
const secretPassword = process.env.secretPassword;



verifyToken = (req, res, next) => {
  // console.log(req.headers)
  let token = req.headers.authorization;
  token = token.replace(/^Bearer\s+/, "");

  if (!token) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  jwt.verify(token, secret , (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized!"
      });
    }
    req.userId = decoded.userId;
    next();
  });
};


verifyTokenPassword = (req, res, next) => {
  let token = req.headers.authorization;
  token = token.replace(/^Bearer\s+/, "");

  if (!token) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  jwt.verify(token, secretPassword , (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized!"
      });
    }
    req.userId = decoded.userId;
    next();
  });
};

isAdmin =async (req, res, next) => {
  await User.findOne({_id: req.userId}).then(user => {
        if (user.role === "admin") {
          next();
          return;
        }
    
        res.status(403).send({
            message: "Require Admin Role!"
        });
        return;
  });
};



const authJwt = {
  verifyToken: verifyToken,
  verifyTokenPassword: verifyTokenPassword,
  isAdmin: isAdmin,
};
module.exports = authJwt;