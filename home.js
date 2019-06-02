var express = require('express');

var app = express();
var handlebars = require('express-handlebars').create({
        defaultLayout: 'main'
    });
var bodyParser = require('body-parser');
var session = require('express-session');
var request = require('request');
var cookieParser = require('cookie-parser');
var crypto = require("crypto");
var Crawler = require('./crawler/crawler');
var SSE = require('./crawler/sse');
var Log = require('./crawler/log');
const DEPTHLIMIT = 50;

app.use(cookieParser());
app.use(bodyParser.urlencoded({
        extended: false
    }));
app.use(bodyParser.json());
app.use(session({
        secret: 'SecretPassword'
    }));
app.use(express.static('assets'));
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', process.env.PORT || 80);

function randomString() {
    return "htt://" + crypto.randomBytes(10).toString('hex') + ".com";
}

app.get('/', function (req, res, next) {
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
  var tmp = pastURLs.map((x)=>{
    return {"query": "/previous?url=" + x.url + "&keyword=" + x.keyword + "&searchType=" + x.searchType + "&maxDepth=" + x.maxDepth, 'url': x.url, 'keyword': x.keyword, "searchtype": x.searchType, "limit": x.maxDepth};
  });
  var depthOptions = [];
  for (let i=1; i<DEPTHLIMIT; i++){
    depthOptions.push(i);
  }
  context.depth = depthOptions;
  context.pastURLs = tmp;
  res.render('crawler',context);
});

app.get('/previous',function(req,res,next){
  var context = {};
  var eventURL = "/stream?url=" + req.query.url + "&keyword=" + req.query.keyword + "&searchType=" + req.query.searchType + "&limit=" + req.query.maxDepth;
  var given_url = req.query.url;
  context.eventurl = eventURL;
  context.title = req.query.searchType + "-First Webcrawl for "+ req.query.url + " limit " + req.query.maxDepth;
  if (req.query.keyword && req.query.keyword.trim() != "") {
    context.keyword = "Keyword: " + req.query.keyword;
  }
  res.render('graph',context);
});

app.post('/submit', function (req, res, next) {
    var context = {};
    var limit = req.body.maxDepth;
    if (req.body.searchType == 'Breadth') limit = req.body.maxBreadth;
    var eventURL = "/stream?url=" + req.body.url + "&keyword=" + req.body.keyword + "&searchType=" + req.body.searchType + "&limit=" + limit;
    var given_url = req.body.url;
    var pastURLs = [];
    if (req.cookies["pastURLs"])
        pastURLs = [...req.cookies["pastURLs"]];
    pastURLs.push({"url":given_url, "keyword":req.body.keyword, "searchType": req.body.searchType, "maxDepth": limit});
    res.cookie("pastURLs", pastURLs);
    context.eventurl = eventURL;
    context.title = req.body.searchType + "-First Webcrawl for " + req.body.url + " limit " + limit;
    if (req.body.keyword && req.body.keyword.trim() != "") {
        context.keyword = "Keyword: " + req.body.keyword;
    }
    res.render('graph', context);
});

app.get('/about', function (req, res, next) {
    var context = {};
    context.title = "About";
        res.render('about', context);
});

app.get('/stream', function (req, res, next) {
    // Establish SSE connection with client.
    var sseConnection = new SSE(res);

    // Create a log file stream.
    var options = {
        filename: new Date().toISOString().replace(/[.:]/g, '-') + '.log',
        header: 'timestamp||title||url||keywordFound||group',
        path: './logs/'
    };
    var logger = new Log(options);
    logger.createFileStream();

    // Create a new crawler object
    var crawler = new Crawler(logger, sseConnection);

    // Get query values
    var limit = req.query.limit;
    var url = req.query.url;
    var keyword = req.query.keyword === '' ? null : req.query.keyword;

    // Start crawl.
    if (req.query.searchType == 'Breadth') {
        crawler.breadthFirst(url, limit, keyword).then((data) => {
			console.log('Crawl Complete.');
			sseConnection.end();
	});
    } else if (req.query.searchType == 'Depth') {
        crawler.depthFirst(url, limit, keyword).then(() => {
			console.log('Crawl Complete.');
			sseConnection.end();
		});
    } else {
		sseConnection.end();
	}


});

app.get('/graph', function (req, res, next) {
    var context = {};
    context.graph = "graph";
    res.render('graph', context);
});

app.get('/:graph', function (req, res, next) {
    var context = {};
    var graph = req.params.graph;
    if (req.cookies && req.cookies.pastURLs && req.cookies.pastURLs[graph]) {
        var pastURL = req.cookies.pastURLs[graph];
        context.searchType = pastURL.searchType;
        context.url = pastURL.url;
        // context.links = pastURL.links;
        res.render('graph', context);
    } else {
        res.render('crawler', context);
    }
});

app.use(function (req, res) {
    res.status(404);
    res.render('404');
});

app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.type('plain/text');
    res.status(500);
    res.render('500');
});

app.listen(app.get('port'), function () {
    console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});
