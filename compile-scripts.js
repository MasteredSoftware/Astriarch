var exec = require("child_process").exec;
var path = require("path");

var clientFiles = require("./client_file_registry.js");

var executeClosureCompiler = function(outputFile, fileList, outputDebugFile) {
  var command =
    "java -jar closure_compiler" +
    path.sep +
    "compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --js_output_file " +
    outputFile +
    " ";
  for (var i = 0; i < fileList.length; i++) {
    command += "--js " + "./public/" + fileList[i] + " ";
  }

  command += "2> " + outputDebugFile;

  exec(command, function(error, stdout, stderr) {
    console.log("stdout: " + stdout);
    console.log("stderr: " + stderr);
    if (error !== null) {
      console.log("exec error: " + error);
    }
  });
};

executeClosureCompiler("./public/js/dist/astriarch.js", clientFiles.clientFilesInternal, "output-debug-i.txt");
executeClosureCompiler("./public/js/dist/external.js", clientFiles.clientFilesExternal, "output-debug-e.txt");
