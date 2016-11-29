var Mocha = require('mocha');

//this ensures we use the test.json config file
process.env.NODE_ENV = 'test';

var mocha = new Mocha({
	reporter: 'dot',
	ui: 'bdd',
	timeout: 999999
});

mocha.addFile('./test/servercontroller_test.js');

var runner = mocha.run(function(){
	console.log('finished');
});

runner.on('pass', function(test){
	console.log('... %s passed', test.title);
});

runner.on('fail', function(test){
	console.log('... %s failed', test.title);
});