var express = require('express');

var app = express();
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
var bodyParser = require('body-parser');
var session = require('express-session');
var request = require('request');
var cookieParser = require('cookie-parser');
var crypto = require("crypto");
var crawler = require('./crawler/crawler');
const fs = require('fs');
// var cytoscape = require('cytoscape');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({secret:'SecretPassword'}));
app.use(express.static('assets'));

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 80);

function randomString(){
  return "htt://" + crypto.randomBytes(10).toString('hex') + ".com";
}

app.get('/',function(req,res,next){
  var context = {};
  context.title = "Crawl the Web from a Starting URL";
  res.render('home', context);
});


app.get('/crawler',function(req,res,next){
  var context = {};
  context.title = "Crawl the Web from a Starting URL"
  var pastURLs = [];
  if (req.cookies && req.cookies["pastURLs"]) {
    pastURLs = req.cookies["pastURLs"];
  }
  context.pastURLs = pastURLs;
  res.render('crawler',context);
});

// app.get('/history',function(req,res,next){
//   var context = {};
//   context.title = "Previous URL searches"
//   var pastURLs = [];
//   if (req.cookies) pastURLs = req.cookies["pastURLs"];
//   console.log(req.cookies);
//   console.log(pastURLs);
//
//   context.pastURLs = pastURLs;
//   res.render('history',context);
// });

app.post('/submit',function(req,res,next){
  var context = {};
  var eventURL = "/stream?url=" + req.body.url + "&keyword=" + req.body.keyword + "&searchType=" + req.body.searchType + "&limit=" + req.body.maxDepth;
  var given_url = req.body.url;
  var pastURLs = [];
  if (req.cookies["pastURLs"]) pastURLs = [...req.cookies["pastURLs"]];
  pastURLs.push({"url":given_url});
  res.cookie("pastURLs", pastURLs);
  context.eventurl = eventURL;
  context.title = req.body.searchType + "-First Webcrawl for "+ req.body.url + " limit " + req.body.maxDepth;
  if (req.body.keyword && req.body.keyword.trim() != "") {
    context.keyword = "Keyword: " + req.body.keyword;
  }
  
    /** LOGGING **/
  var fileName = new Date().toISOString().replace(/[.:]/g,'-') + '.log';
  fs.appendFile('logs/' + fileName, 'timestamp|title|url|keywordFound|group\n', function (err) {
	  if (err) {
		  console.log('oh no');
		  throw err;
	  }
	  console.log('File is created successfully.');
	    var stream = fs.createWriteStream('./logs/' + fileName, {flags:'a'});

	  crawler.asyncBreadthFirst('https://www.yahoo.com', 2, null, stream)
		.then(data => {
			console.log("done");
		}).catch((err) => {
			// data - array of pages visited before error occurred.

		});
	  
	});

  /*
  fileName = new Date().toISOString().replace('.',':') + '.log';
  stream = fs.createWriteStream('./logs/' + fileName, {flags:'a'});
  stream.write('timestamp\ttitle\turl\tkeywordFound\tgroup\n');
  crawler.asyncBreadFirst('www.yahoo.com', 2, null, stream)
  	.then(data => {
		console.log("done");
	}).catch(err => {
		console.log(err);
	});
  stream.end();
  /** END LOGGING **/
  
  res.render('graph',context);
});

app.get('/about',function(req,res,next){
  var context = {};
  context.title = "About"
  res.render('about',context);
});

app.get('/stream',function(req,res,next){
  var context = {};
  context.title = "About";
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  

  
  var messageCount = 0;
  res.write('\n');
  setInterval(function (){
    messageCount++;
    res.write('id: ' + messageCount + '\n');
    res.write("data: " + req.query.url + " " + req.query.keyword + " " + req.query.searchType + " " + req.query.limit + '\n\n'); // Note the extra newline
  }, 1000);
  setTimeout(function (){
    messageCount++;
    res.write('event: close\n');
    res.write('id: ' + messageCount + '\n');
    res.write("data: " + randomString() + '\n\n'); // Note the extra newline
  }, 5000);
  // res.render('about',context);
});

app.get('/graph',function(req,res,next){
  var context = {};
  context.graph = "graph";
  res.render('graph', context);
});

app.get('/:graph',function(req,res,next){
  var context = {};
  var graph = req.params.graph;
  if (req.cookies && req.cookies.pastURLs && req.cookies.pastURLs[graph]){
    var pastURL = req.cookies.pastURLs[graph];
    context.searchType = pastURL.searchType;
    context.url = pastURL.url;
    // context.links = pastURL.links;
    res.render('graph', context);
  }else{
    res.render('crawler', context);
  }
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
