var express = require('express');

var app = express();
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
var bodyParser = require('body-parser');
var session = require('express-session');
var request = require('request');
var cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({secret:'SecretPassword'}));
app.use(express.static('assets'));

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', 6962);

app.get('/',function(req,res,next){
  var context = {};
  context.title = "Crawl the Web from a Starting URL"
  res.render('home',context);
});

app.get('/crawler',function(req,res,next){
  var context = {};
  context.title = "Crawl the Web from a Starting URL"
  // if(!req.session.info){
  //   req.session.info = true;
  //   req.session.pastURLs = [];
  // }
  // context.pastURLs = req.session.pastURLs;
  // context.currentURL = req.session.currentURL
  res.render('crawler',context);
});

app.post('/submit',function(req,res,next){
  var context = {};
  // req.session.currentURL = req.body.url;
  // req.session.pastURLs.push(req.body.url)
  // context.currentURL = req.session.currentURL
  res.render('crawler',context);
});

app.get('/about',function(req,res,next){
  var context = {};
  context.title = "About"
  res.render('about',context);
});


app.use(function(req,res){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.render('500');
});

app.listen(app.get('port'), function(){
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});
