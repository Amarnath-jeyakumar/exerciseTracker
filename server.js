const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(process.env.MLAB_URI || "mongodb://localhost/exercise-track", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true
  },
  log: [
    {
      description: String,
      duration: Number,
      date: Date
    }
  ]
});

let userModel = mongoose.model("userModel", userSchema);

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//creating new user
app.post("/api/exercise/new-user", (req, res) => {
  let username = req.body.username;
  if (username) {
    let newUser = new userModel({
      username: username
    });

    newUser
      .save()
      .then(data => {
        res.json({ username: data.username, _id: data._id });
      })
      .catch(err => {
        if (err.code == 11000) {
          res.send("Username already taken");
        }
      });
  } else {
    res.send("Path 'username' is required");
  }
});

//adding exercise
app.post("/api/exercise/add", (req, res) => {
  let userId = req.body.userId;
  let description = req.body.description;
  let duration = req.body.duration;
  let date = req.body.date;

  if (userId != "") {
    if (description != "") {
      if (duration != "") {
        let update;

        if (date != "") {
          update = { description: description, duration: duration, date: date };
        } else {
          update = { description: description, duration: duration };
        }

        userModel.findById({ _id: userId }, (err, data) => {
          if (err) {
            res.send("Invalid user ID");
          } else {
            data.log.push(update);
            data.save();

            if (date) {
              res.json({
                username: data.username,
                description: description,
                duration: duration,
                _id: userId,
                date: new Date(date).toDateString()
              });
            } else {
              res.json({
                username: data.username,
                description: description,
                duration: duration,
                _id: userId,
                date: ""
              });
            }
          }
        });
      } else {
        res.send("Path 'duration' is required");
      }
    } else {
      res.send("Path 'description' is required");
    }
  } else {
    res.send("Path 'userId' is required");
  }
});
//exercise log
//{"_id":"SJPrPBi-U","username":"AJE0764","count":2,"log":[{"description":"abcd","duration":30,"date":"Tue Dec 23 2014"},{"description":"abcd","duration":30,"date":"Tue Dec 23 2014"}]}
//{"_id":"SJPrPBi-U","username":"AJE0764","from":"Mon Dec 22 2014","to":"Sun Dec 28 2014","count":4,"log":[{"description":"abcd","duration":30,"date":"Sat Dec 27 2014"},{"description":"abcd","duration":30,"date":"Thu Dec 25 2014"},{"description":"abcd","duration":30,"date":"Tue Dec 23 2014"},{"description":"abcd","duration":30,"date":"Tue Dec 23 2014"}]}
app.get("/api/exercise/log", (req, res) => {
  let userId, from, to, limit, count;
  let queryString = req.query;
  let logProject;

  if (Object.keys(queryString).some(e => "userId")) {
    if (queryString.userId) {
      userId = queryString.userId;

      if (
        Object.keys(queryString).some(e => "from") &&
        Object.keys(queryString).some(e => "to") &&
        queryString.from &&
        queryString.to
      ) {
        from = new Date(queryString.from);
        to = new Date(queryString.to);

        logProject = {
          $filter: {
            input: "$log",
            as: "log",
            cond: {
              $and: [
                { $gte: ["$$log.date", from] },
                { $lt: ["$$log.date", to] }
              ]
            }
          }
        };
      } else if (
        Object.keys(queryString).some(e => "from") &&
        queryString.from
      ) {
        from = new Date(queryString.from);

        logProject = {
          $filter: {
            input: "$log",
            as: "log",
            cond: {
              $gte: ["$$log.date", from]
            }
          }
        };
      } else if (Object.keys(queryString).some(e => "to") && queryString.to) {
        to = new Date(queryString.to);

        logProject = {
          $filter: {
            input: "$log",
            as: "log",
            cond: {
              $lte: ["$$log.date", to]
            }
          }
        };
      } else {
        logProject = 1;
      }

      if (
        Object.keys(queryString).some(d => "limit") &&
        queryString.limit > 0
      ) {
        limit = parseInt(queryString.limit);
        userModel
          .aggregate()
          .match({ _id: new mongoose.mongo.ObjectId(userId) })
          .unwind("log")
          .sort({ "log.date": "desc" })
          .limit(limit)
          .group({
            _id: "$_id",
            username: { $first: "$username" },
            log: {
              $push: {
                description: "$log.description",
                duration: "$log.duration",
                date: "$log.date"
              }
            }
          })
          .project({
            _id: 1,
            username: 1,
            log: logProject
          })
          .exec((err, result) => {
            if (err) {
              res.send(err);
            } else {
              res.json({
                _id: result[0]._id,
                username: result[0].username,
                from: from,
                to: to,
                count: result[0].log.length,
                log: result[0].log
              });
            }
          });
      } else {
        userModel
          .aggregate()
          .match({ _id: new mongoose.mongo.ObjectId(userId) })
          .unwind("log")
          .sort({ "log.date": "desc" })
          .group({
            _id: "$_id",
            username: { $first: "$username" },
            log: {
              $push: {
                description: "$log.description",
                duration: "$log.duration",
                date: "$log.date"
              }
            }
          })
          .project({
            _id: 1,
            username: 1,
            log: logProject
          })
          .exec((err, result) => {
            if (err) {
              res.send(err);
            } else {
              res.json({
                _id: result[0]._id,
                username: result[0].username,
                from: from,
                to: to,
                count: result[0].log.length,
                log: result[0].log
              });
            }
          });
      }
    } else {
      res.send("Unknown userID");
    }
  } else {
    res.send("unknown userId");
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
