const http = require('http');
const express = require("express"); 
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { exit } = require("process");
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') });
const { MongoClient, ServerApiVersion } = require('mongodb');

/****** FUNCTIONS FROM database_helpers ******/
const { insertNewUser, verifyReturningUser, verifyExistingUsername, updateUserTransactions, getUserData, getUpdatedBalance } = require("./database_helpers");
const { arrayToHTMLTable } = require("./helpers");

/****** MANAGING MONOGDB DATABASE ******/
const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const dbName = process.env.MONGO_DB_NAME;
const dbCollection = process.env.MONGO_COLLECTION

/* Our database and collection */
const databaseAndCollection = {db: dbName, collection: dbCollection};

/* Connect to the database */
const uri = `mongodb+srv://${userName}:${password}@cluster0.vbckr.mongodb.net/${dbName}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

/****** START SERVER ON THE PORT 5000 ******/
let app = express();
http.createServer(app).listen(process.env.PORT || 5000);

/****** MANAGING APP ROUTES******/
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static(__dirname + '/public'));
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(
  session({
    resave: true,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET
  })
);

app.get("/", function (_, response) {
    response.render("index");
});

app.get("/login", function (_, response) {
    response.render("login", {warning: ""});
});

app.post("/login", function(_, response) {
    response.render("login", {warning: "INVALID USERNAME OR PASSWORD"});
});



app.get("/signup", function (_, response) {
    response.render("signup", {usernameWarning: ""});
});

app.post("/signup", function (_, response) {
    response.render("signup", {usernameWarning: "USERNAME ALREADY TAKEN"});
});

app.post("/homeAfterSignup", function (request, response) {
    
    verifyExistingUsername(client, databaseAndCollection, request.body.username).then(async function(result) {
        if (result) {
            response.redirect(307, "/signup");
        } else {
            request.session.username = request.body.username;
            request.session.name = request.body.name;
            request.session.save();
            // request.session.balanace = [0,0];

            let variables = { 
                name: request.body.name,
                username: request.body.username,
                password: request.body.password,
                transactions: []
            };
            insertNewUser(client, databaseAndCollection, variables);

            let temp = await getUpdatedBalance(client, databaseAndCollection, request.session.username);
            let responseVariables = {
                name: request.session.name,
                balance: 0,
                table: arrayToHTMLTable([])
            };
            response.render("home", responseVariables);
        }
    });
});

app.post("/homeAfterLogin", function (request, response) {
    verifyReturningUser(client, databaseAndCollection, request.body.username, request.body.password).then(function(result) {
        if (result) {
            request.session.username = request.body.username;
            request.session.name = result.name;
            request.session.save();
            request.session.balance = result.balance;

            getUserData(client, databaseAndCollection, request.session.username).then(function(result) {
                request.session.balance = result.balance; // this FIXED IT
                var temp;

                if (!request.session.balance) {
                    temp = 0;
                } else {
                    temp = request.session.balance[0];
                }

                responseVariables = {
                    name: request.session.name,
                    balance: temp,
                    table: arrayToHTMLTable(result.transactions)
                };
                response.render("home", responseVariables);
            })
        } else {
            response.redirect(307, "/login");
        }
    });
});

app.post("/home", function (request, response) {
    let transaction = {
        date: request.body.date,
        stock: request.body.stock,
        numStock: request.body.numStock
    }
    updateUserTransactions(client, databaseAndCollection, request.session.username,transaction).then(function(result) {
        if (result) {
            request.session.save();
            request.session.balance = result.balance;

            getUserData(client, databaseAndCollection, request.session.username).then(async function(result) {
                let temp = await getUpdatedBalance(client, databaseAndCollection, request.session.username);
                request.session.balance = result.balance; 
                
                var tempBalance;

                if (!request.session.balance) {
                    tempBalance = 0;
                } else {
                    tempBalance = request.session.balance[0];
                }

                responseVariables = {
                    name: request.session.name,
                    balance: tempBalance,
                    table: arrayToHTMLTable(result.transactions)
                };
                response.render("home", responseVariables);
            })
        }
    });
});

/** NOTIMPLEMENTED **/
app.post("/logout", (request, response) => {
    let message;
  
    if (request.session.username != undefined) {
      request.session.destroy();
      message = "You have logged out";
    } else {
      message = "You were not logged in";
    }
    response.send(message);
});
